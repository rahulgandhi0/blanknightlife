import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { featureFlags } from '@/lib/feature-flags'
import { logMetric, nowMs } from '@/lib/metrics'
import { uploadMediaToStorage } from '@/lib/media'
import type { ApifyInstagramPost } from '@/types/apify'
import type { PostType } from '@/types/database'

// Process a single post from Apify
async function processPost(
  supabase: ReturnType<typeof createServiceClient>,
  post: ApifyInstagramPost,
  profileId: string
): Promise<{ success: boolean; reason?: string }> {
  const igPostId = post.id || post.shortCode

  if (!igPostId) {
    return { success: false, reason: 'Missing Instagram post id' }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postData = post as any

  // Skip pinned posts entirely
  if (postData.isPinned || postData.pinned) {
    return { success: false, reason: 'Skipped pinned post' }
  }

  // Skip stories only
  const productType = (postData.productType || '').toString().toLowerCase()
  if (productType === 'story') {
    return { success: false, reason: 'Skipped story' }
  }

  // Detect if this is a reel
  const isReel = productType === 'clips' || productType === 'reel' || productType === 'reels' || post.type === 'Video'

  // Check if already exists in database
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('event_discovery') as any)
    .select('id')
    .eq('ig_post_id', igPostId)
    .single()

  if (existing) {
    return { success: false, reason: 'Duplicate - already in database' }
  }

  // Determine post type and collect media URLs with broader compatibility
  let postType: PostType = 'image'
  const originalMediaUrls: string[] = []

  // Priority 1: Check 'images' array (apify/instagram-post-scraper format for Sidecars)
  if (Array.isArray(postData.images) && postData.images.length > 0) {
    originalMediaUrls.push(...postData.images.filter(Boolean) as string[])
    if (postData.images.length > 1) postType = 'carousel'
  }
  // Priority 2: Check 'imageUrls' array (alternative format)
  if (Array.isArray(postData.imageUrls) && postData.imageUrls.length > 0) {
    originalMediaUrls.push(...postData.imageUrls.filter(Boolean) as string[])
    if (postData.imageUrls.length > 1) postType = 'carousel'
  }
  // Priority 3: Check 'imageUrl' single field
  if (postData.imageUrl) {
    originalMediaUrls.push(postData.imageUrl as string)
  }
  // Priority 4: Extract from childPosts for Sidecars
  if (post.type === 'Sidecar' && post.childPosts) {
    postType = 'carousel'
    for (const child of post.childPosts) {
      if (child.type === 'Image' && child.displayUrl) {
        originalMediaUrls.push(child.displayUrl)
      }
    }
  }
  // Priority 5: Fallback to displayUrl
  if (post.displayUrl) {
    originalMediaUrls.push(post.displayUrl)
  }
  // Priority 6: For reels, use videoUrl or thumbnail as fallback
  if (isReel && postData.videoUrl) {
    originalMediaUrls.push(postData.videoUrl as string)
  }

  // Deduplicate
  const uniqueMediaUrls = Array.from(new Set(originalMediaUrls))

  if (uniqueMediaUrls.length === 0) {
    return { success: false, reason: 'No valid media URLs found' }
  }

  // Set postType based on Apify type field and reel detection
  if (isReel) {
    postType = 'reel'
  } else if (post.type === 'Sidecar' || uniqueMediaUrls.length > 1) {
    postType = 'carousel'
  }

  const sourceMediaUrls = uniqueMediaUrls
  const shouldUploadOnIngest = !featureFlags.uploadOnApprove

  // Upload all media to Supabase Storage (prevent Instagram URL expiry)
  const uploadedUrls: string[] = []
  if (shouldUploadOnIngest) {
    for (let i = 0; i < sourceMediaUrls.length; i++) {
      const permanentUrl = await uploadMediaToStorage(
        supabase,
        sourceMediaUrls[i],
        igPostId,
        i
      )
      if (permanentUrl) {
        uploadedUrls.push(permanentUrl)
      }
    }
  }

  if (shouldUploadOnIngest && uploadedUrls.length === 0) {
    return { success: false, reason: 'Failed to upload any media' }
  }

  // Choose best caption value available
  const caption =
    (post.caption as string | null) ??
    (postData.captionText as string | null) ??
    (postData.title as string | null) ??
    null

  const mediaUrlsToStore = shouldUploadOnIngest ? uploadedUrls : []

  // Normalize timestamp to ISO string if possible
  let postedAt: string | null = null
  const tsCandidates = [
    post.timestamp,
    postData.takenAt,
    postData.takenAtLocal,
    postData.takenAtTimestamp ? new Date((postData.takenAtTimestamp as number) * 1000).toISOString() : null,
  ].filter(Boolean) as string[]
  if (tsCandidates.length > 0) {
    const parsed = new Date(tsCandidates[0])
    postedAt = isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  // Insert into database - NO AI generation yet (saves credits, user triggers manually)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('event_discovery') as any).insert({
    status: 'pending',
    source_account: post.ownerUsername,
    post_type: postType,
    original_caption: caption,
    ai_generated_caption: null,
    final_caption: null,
    media_urls: mediaUrlsToStore,
    source_media_urls: sourceMediaUrls,
    ig_post_id: igPostId,
    is_pinned: post.isPinned || false,
    posted_at_source: postedAt,
    profile_id: profileId,
  })

  if (error) {
    console.error('Database insert error:', JSON.stringify(error, null, 2))
    return { success: false, reason: `Database error: ${error.message || error.code || JSON.stringify(error)}` }
  }

  return { success: true }
}

// Fetch posts from Apify dataset
async function fetchApifyDataset(datasetId: string): Promise<ApifyInstagramPost[]> {
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?format=json`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch Apify dataset: ${response.status}`)
  }
  return response.json()
}

// POST /api/ingest?profile_id=xxx
// Receives posts directly OR Apify webhook payload
export async function POST(request: NextRequest) {
  const startedAt = nowMs()
  try {
    const body = await request.json()
    const supabase = createServiceClient()

    // Get profile_id from query params or body
    const searchParams = request.nextUrl.searchParams
    const profileId = searchParams.get('profile_id') || body.profile_id

    if (!profileId) {
      return NextResponse.json(
        { error: 'Missing profile_id. Required for multi-tenant support.' },
        { status: 400 }
      )
    }

    // Handle multiple payload formats
    let posts: ApifyInstagramPost[] = []
    
    if (Array.isArray(body)) {
      // Direct array of posts
      posts = body
    } else if (body.posts && Array.isArray(body.posts)) {
      // Wrapped in { posts: [...] }
      posts = body.posts
    } else if (body.resource?.defaultDatasetId) {
      // Apify webhook format - fetch from dataset API
      console.log('Apify webhook received, fetching dataset:', body.resource.defaultDatasetId)
      posts = await fetchApifyDataset(body.resource.defaultDatasetId)
    } else if (body.defaultDatasetId) {
      // Alternative Apify format
      console.log('Apify dataset ID received:', body.defaultDatasetId)
      posts = await fetchApifyDataset(body.defaultDatasetId)
    } else {
      return NextResponse.json(
        { error: 'Invalid payload. Expected array of posts or Apify webhook.' },
        { status: 400 }
      )
    }
    
    console.log(`Processing ${posts.length} posts from ingest for profile ${profileId}`)

    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      details: [] as { id: string; result: string }[],
    }

    for (const post of posts) {
      const { success, reason } = await processPost(supabase, post, profileId)
      
      if (success) {
        results.processed++
        results.details.push({ id: post.id || post.shortCode, result: 'success' })
      } else if (reason?.includes('Duplicate') || reason?.includes('Skipped')) {
        results.skipped++
        results.details.push({ id: post.id || post.shortCode, result: reason })
      } else {
        results.errors++
        results.details.push({ id: post.id || post.shortCode, result: reason || 'unknown error' })
      }
    }

    const response = NextResponse.json({
      message: `Ingested ${results.processed} posts, skipped ${results.skipped}, errors ${results.errors}`,
      ...results,
    })
    logMetric('ingest_complete', {
      processed: results.processed,
      skipped: results.skipped,
      errors: results.errors,
      duration_ms: nowMs() - startedAt,
      uploadOnApprove: featureFlags.uploadOnApprove,
    })
    return response
  } catch (error) {
    console.error('Ingest error:', error)
    logMetric('ingest_error', { error: String(error), duration_ms: nowMs() - startedAt })
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

// GET /api/ingest - Health check
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    endpoint: '/api/ingest',
    method: 'POST',
    description: 'Send array of Apify Instagram posts to ingest',
  })
}
