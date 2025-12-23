import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account, sinceHours = 48 } = body

    if (!account) {
      return NextResponse.json({ error: 'Missing account' }, { status: 400 })
    }

    const token = process.env.APIFY_API_TOKEN
    const envActor = process.env.APIFY_ACTOR_ID
    const actorId = envActor ? envActor.replace('/', '~') : 'apify~instagram-post-scraper'

    if (!token) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN missing' }, { status: 500 })
    }

    const cleanHandle = account.trim().replace(/^@/, '')
    const hours = Number(sinceHours) || 48
    const onlyPostsNewerThan = `${hours} hours`

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const runOnce = async (useTimeWindow: boolean) => {
      const input = {
        username: [cleanHandle],
        resultsType: 'posts',
        resultsLimit: 50,
        ...(useTimeWindow ? { scrapePostsFromLastNDays: Math.max(1, Math.ceil(hours / 24)) } : {}),
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

    let posts = await runOnce(true)
    let fallbackUsed = false

    if (posts.length === 0 && hours >= 24) {
      // Retry once without time window
      posts = await runOnce(false)
      fallbackUsed = true
    }

    if (posts.length === 0) {
      return NextResponse.json({
        success: true,
        found: 0,
        ingested: 0,
        message: 'No items returned (private account or no posts in range)',
      })
    }

    const ingestResp = await fetch(`${baseUrl}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posts),
    })

    if (!ingestResp.ok) {
      const err = await ingestResp.text()
      return NextResponse.json({ error: 'Ingest failed', details: err }, { status: 500 })
    }

    const ingestData = await ingestResp.json()

    return NextResponse.json({
      success: true,
      found: posts.length,
      fallbackUsed,
      ingestResult: ingestData,
      sample: posts[0] || null,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}
