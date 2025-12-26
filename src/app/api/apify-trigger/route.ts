import { NextRequest, NextResponse } from 'next/server'
import type { ApifyInstagramPost } from '@/types/apify'

type StepStatus = 'pending' | 'running' | 'done' | 'error'

interface Step {
  label: string
  status: StepStatus
  info?: string
}

const stepList = (overrides?: Partial<Step>[]) =>
  ['Validate input', 'Run Apify', 'Filter results', 'Ingest'].map((label, idx) => ({
    label,
    status: 'pending' as StepStatus,
    ...(overrides && overrides[idx]),
  }))

const updateStep = (steps: Step[], label: string, status: StepStatus, info?: string) =>
  steps.map((s) => (s.label === label ? { ...s, status, info } : s))

const typeFromRaw = (rawType?: string) => {
  if (!rawType) return 'Image'
  const t = rawType.toLowerCase()
  if (t.includes('sidecar') || t.includes('carousel')) return 'Sidecar'
  if (t.includes('video')) return 'Video'
  return 'Image'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizePost = (raw: any): ApifyInstagramPost => {
  const short = raw.shortCode || raw.shortcode || raw.code || ''
  const urlFromShort = short ? `https://www.instagram.com/p/${short}/` : ''
  const rawType = raw.type || raw.__typename || raw.product_type || raw.productType
  const takenAtTs =
    typeof raw.takenAtTimestamp === 'number'
      ? new Date(raw.takenAtTimestamp * 1000).toISOString()
      : null

  const caption =
    raw.caption ??
    raw.captionText ??
    raw.title ??
    (raw.edge_media_to_caption?.edges?.[0]?.node?.text ?? null)

  const displayUrl =
    raw.displayUrl || raw.display_url || raw.imageUrl || raw.thumbnailUrl || raw.thumbnail_url || urlFromShort

  // Harmonize media arrays
  const images: string[] = []
  if (Array.isArray(raw.images)) images.push(...raw.images.filter(Boolean))
  if (Array.isArray(raw.imageUrls)) images.push(...raw.imageUrls.filter(Boolean))
  if (raw.imageUrl) images.push(raw.imageUrl)
  if (Array.isArray(raw.displayResources)) {
    for (const res of raw.displayResources) {
      if (res.src) images.push(res.src)
    }
  }

  const childPosts =
    raw.childPosts ||
    (raw.children &&
      Array.isArray(raw.children) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw.children.map((c: any) => ({
        type: typeFromRaw(c.type || c.__typename),
        displayUrl: c.displayUrl || c.display_url || c.imageUrl || c.thumbnailUrl,
        videoUrl: c.videoUrl || c.video_url || null,
      })))

  return {
    id: raw.id?.toString?.() || short || urlFromShort,
    shortCode: short || raw.code || '',
    url: raw.url || urlFromShort,
    type: typeFromRaw(rawType),
    caption: caption ?? null,
    timestamp:
      raw.timestamp ||
      raw.takenAt ||
      raw.takenAtLocal ||
      takenAtTs ||
      (raw.taken_at ? new Date(raw.taken_at).toISOString() : null),
    displayUrl,
    images: images.length ? Array.from(new Set(images)) : undefined,
    imageUrl: raw.imageUrl,
    imageUrls: raw.imageUrls,
    videoUrl: raw.videoUrl || raw.video_url || null,
    ownerUsername: raw.ownerUsername || raw.username || raw.ownerFullName || raw.owner?.username || '',
    ownerId: raw.ownerId || raw.owner?.id || '',
    likesCount: raw.likesCount ?? raw.likeCount ?? raw.likes ?? 0,
    commentsCount: raw.commentsCount ?? raw.commentCount ?? raw.comments ?? 0,
    isPinned: raw.isPinned ?? raw.pinned ?? false,
    pinned: raw.pinned,
    productType: raw.productType || raw.product_type,
    takenAt: raw.takenAt || raw.taken_at,
    takenAtLocal: raw.takenAtLocal,
    takenAtTimestamp: raw.takenAtTimestamp,
    childPosts,
  }
}

export async function POST(request: NextRequest) {
  const logs: string[] = []
  let steps = stepList()

  const log = (msg: string) => {
    logs.push(msg)
  }

  try {
    const body = await request.json()
    const { account, sinceHours = 48 } = body

    if (!account) {
      steps = updateStep(steps, 'Validate input', 'error', 'Missing account')
      return NextResponse.json({ error: 'Missing account', steps, logs }, { status: 400 })
    }

    steps = updateStep(steps, 'Validate input', 'done')

    const token = process.env.APIFY_API_TOKEN
    const envActor = process.env.APIFY_ACTOR_ID
    const primaryActor = envActor ? envActor.replace('/', '~') : 'apify~instagram-api-scraper'
    const fallbackActor = 'apify~instagram-post-scraper'

    if (!token) {
      steps = updateStep(steps, 'Run Apify', 'error', 'APIFY_API_TOKEN missing')
      return NextResponse.json({ error: 'APIFY_API_TOKEN missing', steps, logs }, { status: 500 })
    }

    const cleanHandle = account.trim().replace(/^@/, '')
    const hours = Number(sinceHours) || 48
    const cutoffMs = Date.now() - hours * 60 * 60 * 1000

    // Prefer the current origin to avoid Vercel protection redirects; fall back to env
    const origin = (() => {
      try {
        return new URL(request.url).origin
      } catch {
        return null
      }
    })()
    const localPort = process.env.PORT || process.env.NEXT_PUBLIC_PORT || '3000'
    const baseUrl =
      origin ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${localPort}`)

    const callActor = async (actorId: string, useApiScraperShape: boolean) => {
      const profileUrl = `https://www.instagram.com/${cleanHandle}`
      const input = useApiScraperShape
        ? {
            directUrls: [profileUrl],
            resultsLimit: 25,
            onlyPostsNewerThan: `${hours} hours`,
            resultsType: 'posts', // restrict to feed posts
            addStories: false,
            addTaggedPosts: false,
            includeStories: false,
            includeTagged: false,
            includeHighlights: false,
            includeComments: false,
            includeReplies: false,
            downloadMedia: false,
            proxy: { useApifyProxy: true },
          }
        : {
            username: [cleanHandle],
            resultsType: 'posts',
            resultsLimit: 50,
            scrapePostsFromLastNDays: Math.max(1, Math.ceil(hours / 24)),
            proxy: { useApifyProxy: true },
          }

      const resp = await fetch(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!resp.ok) {
        const err = await resp.text()
        throw new Error(err || 'Apify run failed')
      }

      const items = await resp.json()
      return Array.isArray(items) ? items : []
    }

    steps = updateStep(steps, 'Run Apify', 'running', `Actor: ${primaryActor}`)
    log(`Running Apify actor ${primaryActor} for @${cleanHandle}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawPosts: any[] = []
    let fallbackUsed = false

    try {
      rawPosts = await callActor(primaryActor, true)
      log(`Primary actor returned ${rawPosts.length} items`)
    } catch (err) {
      log(`Primary actor failed: ${String(err)}`)
      fallbackUsed = true
      steps = updateStep(steps, 'Run Apify', 'running', `Retrying with ${fallbackActor}`)
      rawPosts = await callActor(fallbackActor, false)
      log(`Fallback actor returned ${rawPosts.length} items`)
    }

    if (!rawPosts || rawPosts.length === 0) {
      steps = updateStep(steps, 'Run Apify', 'error', 'No items returned')
      return NextResponse.json({
        success: true,
        found: 0,
        message: 'No items returned (private account or no posts in range)',
        steps,
        logs,
        fallbackUsed,
      })
    }

    steps = updateStep(steps, 'Run Apify', 'done', `${rawPosts.length} items`)

    steps = updateStep(steps, 'Filter results', 'running')

    const normalized = rawPosts.map(normalizePost)

    const filtered = normalized.filter((post) => {
      // Skip pinned
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (post.isPinned || (post as any).pinned) return false
      // Skip reels/stories via productType
      const productType = (post.productType || '').toString().toLowerCase()
      if (['clips', 'reel', 'reels', 'story'].includes(productType)) return false
      // Skip videos
      if (post.type === 'Video') return false
      // Must have timestamp within window
      if (post.timestamp) {
        const ts = new Date(post.timestamp).getTime()
        if (!isNaN(ts) && ts < cutoffMs) return false
      }
      return true
    })

    const filteredAndRecent = filtered.slice(0, 30) // safety cap

    steps = updateStep(
      steps,
      'Filter results',
      'done',
      `${filteredAndRecent.length} of ${normalized.length} kept after filters`
    )
    log(`Filtered down to ${filteredAndRecent.length} posts (skipping pinned/reels/video/old)`)

    if (filteredAndRecent.length === 0) {
      return NextResponse.json({
        success: true,
        found: 0,
        message: 'No eligible posts after filtering (likely only reels/pinned/old)',
        steps,
        logs,
        fallbackUsed,
      })
    }

    steps = updateStep(steps, 'Ingest', 'running', 'Sending to Supabase')
    log('Sending posts to /api/ingest')

    const ingestResp = await fetch(`${baseUrl}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filteredAndRecent),
    })

    if (!ingestResp.ok) {
      const err = await ingestResp.text()
      steps = updateStep(steps, 'Ingest', 'error', 'Ingest failed')
      log(`Ingest failed: ${err}`)
      return NextResponse.json({ error: 'Ingest failed', details: err, steps, logs }, { status: 500 })
    }

    const ingestData = await ingestResp.json()

    steps = updateStep(steps, 'Ingest', 'done', `Processed ${ingestData.processed || 0}`)

    return NextResponse.json({
      success: true,
      found: filteredAndRecent.length,
      fallbackUsed,
      ingestResult: ingestData,
      sample: filteredAndRecent[0] || null,
      steps,
      logs,
    })
  } catch (error) {
    steps = updateStep(steps, 'Run Apify', 'error', 'Unexpected error')
    logs.push(`Error: ${String(error)}`)
    return NextResponse.json({ error: 'Internal error', details: String(error), steps, logs }, { status: 500 })
  }
}
