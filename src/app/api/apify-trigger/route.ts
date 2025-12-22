import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account, sinceHours = 48 } = body

    if (!account) {
      return NextResponse.json({ error: 'Missing account' }, { status: 400 })
    }

    const token = process.env.APIFY_API_TOKEN
    const actorId = process.env.APIFY_ACTOR_ID || 'apify~instagram-scraper'

    if (!token) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN missing' }, { status: 500 })
    }

    const cleanHandle = account.trim().replace(/^@/, '')
    const profileUrl = `https://www.instagram.com/${cleanHandle}/`
    const hours = Number(sinceHours) || 48
    const onlyPostsNewerThan = `${hours} hours`

    const input = {
      directUrls: [profileUrl],
      resultsType: 'posts',
      resultsLimit: 50,
      onlyPostsNewerThan,
      proxy: { useApifyProxy: true },
    }

    const runResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    if (!runResp.ok) {
      const err = await runResp.text()
      return NextResponse.json({ error: 'Apify run failed', details: err }, { status: 500 })
    }

    const posts = await runResp.json()

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({
        success: true,
        found: 0,
        ingested: 0,
        message: 'No items returned (private account or no posts in range)',
      })
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const ingestResp = await fetch(`${baseUrl}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posts),
    })

    const ingestData = await ingestResp.json()

    return NextResponse.json({
      success: true,
      found: posts.length,
      ingestResult: ingestData,
      sample: posts[0] || null,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}
