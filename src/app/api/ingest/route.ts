import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rewriteCaption } from '@/lib/groq'
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
  post: ApifyInstagramPost
): Promise<{ success: boolean; reason?: string }> {
  const igPostId = post.id || post.shortCode

  // Skip videos/reels - we only want images and carousels
  if (post.type === 'Video') {
    return { success: false, reason: 'Skipped video/reel' }
  }

  // Check for pinned post trap (old pinned posts)
  if (post.isPinned) {
    const postDate = new Date(post.timestamp)
    const hoursSincePost = (Date.now() - postDate.getTime()) / (1000 * 60 * 60)
    if (hoursSincePost > 48) {
      return { success: false, reason: 'Skipped old pinned post' }
    }
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

  // Determine post type and collect media URLs
  let postType: PostType = 'image'
  const originalMediaUrls: string[] = []

  if (post.type === 'Sidecar' && post.childPosts) {
    postType = 'carousel'
    // Only get image URLs from carousel (skip videos within carousels)
    for (const child of post.childPosts) {
      if (child.type === 'Image' && child.displayUrl) {
        originalMediaUrls.push(child.displayUrl)
      }
    }
  } else if (post.displayUrl) {
    originalMediaUrls.push(post.displayUrl)
  }

  if (originalMediaUrls.length === 0) {
    return { success: false, reason: 'No valid media URLs found' }
  }

  // Upload all media to Supabase Storage (prevent Instagram URL expiry)
  const uploadedUrls: string[] = []
  for (let i = 0; i < originalMediaUrls.length; i++) {
    const permanentUrl = await uploadMediaToStorage(
      supabase,
      originalMediaUrls[i],
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

  // Generate AI caption
  const aiCaption = await rewriteCaption(
    post.caption || '',
    post.ownerUsername
  )

  // Insert into database
  const { error } = await supabase.from('event_discovery').insert({
    status: 'pending',
    source_account: post.ownerUsername,
    post_type: postType,
    original_caption: post.caption,
    ai_generated_caption: aiCaption,
    final_caption: aiCaption, // Default to AI caption, user can edit
    media_urls: uploadedUrls,
    ig_post_id: igPostId,
    is_pinned: post.isPinned || false,
    posted_at_source: post.timestamp,
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

// POST /api/ingest
// Receives posts directly OR Apify webhook payload
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServiceClient()

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
    
    console.log(`Processing ${posts.length} posts from ingest`)

    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      details: [] as { id: string; result: string }[],
    }

    for (const post of posts) {
      const { success, reason } = await processPost(supabase, post)
      
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

