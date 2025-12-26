import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApifyInstagramPost } from '@/types/apify'
import type { PostType } from '@/types/database'

// Download image and upload to Supabase Storage
async function uploadMediaToStorage(
  supabase: ReturnType<typeof createServiceClient>,
  mediaUrl: string,
  postId: string,
  index: number
): Promise<string | null> {
  try {
    // Download the image
    const response = await fetch(mediaUrl)
    if (!response.ok) {
      console.error(`Failed to download media: ${mediaUrl}, status: ${response.status}`)
      return null
    }

    // Use arrayBuffer for Node.js compatibility
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const extension = contentType.includes('png') ? 'png' : 'jpg'
    const fileName = `${postId}_${index}.${extension}`

    console.log(`Uploading ${fileName} to Supabase Storage (${buffer.length} bytes)`)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('posters')
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
      })

    if (error) {
      console.error('Supabase storage error:', error.message, error)
      return null
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('posters')
      .getPublicUrl(data.path)

    console.log(`Uploaded successfully: ${urlData.publicUrl}`)
    return urlData.publicUrl
  } catch (error) {
    console.error('Media upload error:', error)
    return null
  }
}

// Process a single post from Apify
async function processPost(
  supabase: ReturnType<typeof createServiceClient>,
  post: ApifyInstagramPost,
  profileId: string,
  userId: string
): Promise<{ success: boolean; reason?: string }> {
  const igPostId = post.id || post.shortCode

  if (!igPostId) {
    return { success: false, reason: 'Missing Instagram post id' }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postData = post as any

  // Skip pinned posts entirely (avoid media downloads/credits waste)
  if (postData.isPinned || postData.pinned) {
    return { success: false, reason: 'Skipped pinned post' }
  }

  // Skip Reels - check productType for "clips" which indicates Reels
  const productType = (postData.productType || '').toString().toLowerCase()
  if (productType === 'clips' || productType === 'reel' || productType === 'reels' || productType === 'story') {
    return { success: false, reason: 'Skipped reel/story' }
  }

  // Skip videos - we only want images and carousels (Sidecars)
  if (post.type === 'Video') {
    return { success: false, reason: 'Skipped video' }
  }

  // Check if already exists in database
  const { data: existing } = await supabase
    .from('event_discovery')
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

  // Deduplicate
  const uniqueMediaUrls = Array.from(new Set(originalMediaUrls))

  if (uniqueMediaUrls.length === 0) {
    return { success: false, reason: 'No valid media URLs found' }
  }

  // Set postType based on Apify type field
  if (post.type === 'Sidecar' || uniqueMediaUrls.length > 1) {
    postType = 'carousel'
  }

  // Upload all media to Supabase Storage (prevent Instagram URL expiry)
  const uploadedUrls: string[] = []
  for (let i = 0; i < uniqueMediaUrls.length; i++) {
    const permanentUrl = await uploadMediaToStorage(
      supabase,
      uniqueMediaUrls[i],
      igPostId,
      i
    )
    if (permanentUrl) {
      uploadedUrls.push(permanentUrl)
    }
  }

  if (uploadedUrls.length === 0) {
    return { success: false, reason: 'Failed to upload any media' }
  }

  // Choose best caption value available
  const caption =
    (post.caption as string | null) ??
    (postData.captionText as string | null) ??
    (postData.title as string | null) ??
    null

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
  const { error } = await supabase.from('event_discovery').insert({
    status: 'pending',
    source_account: post.ownerUsername,
    post_type: postType,
    original_caption: caption,
    ai_generated_caption: null, // Generated on-demand by user
    final_caption: null, // User will edit after AI generation
    media_urls: uploadedUrls,
    ig_post_id: igPostId,
    is_pinned: post.isPinned || false,
    posted_at_source: postedAt,
    profile_id: profileId,
    user_id: userId,
  } as never)

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

// POST /api/ingest?profile_id=xxx&user_id=xxx
// Receives posts directly OR Apify webhook payload
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServiceClient()

    // Get profile_id and user_id from query params or body
    const searchParams = request.nextUrl.searchParams
    const profileId = searchParams.get('profile_id') || body.profile_id
    const userId = searchParams.get('user_id') || body.user_id

    if (!profileId || !userId) {
      return NextResponse.json(
        { error: 'Missing profile_id and user_id. Required for multi-tenant support.' },
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
      const { success, reason } = await processPost(supabase, post, profileId, userId)
      
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

    return NextResponse.json({
      message: `Ingested ${results.processed} posts, skipped ${results.skipped}, errors ${results.errors}`,
      ...results,
    })
  } catch (error) {
    console.error('Ingest error:', error)
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

