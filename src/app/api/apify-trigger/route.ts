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

    const runResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    })

    if (!runResp.ok) {
      const err = await runResp.text()
      return NextResponse.json({ error: 'Apify run failed', details: err }, { status: 500 })
    }

    const data = await runResp.json()
    const runId = data?.data?.id

    if (!runId) {
      return NextResponse.json({ error: 'Apify run did not return runId' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      runId,
      message: 'Scrape started',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}
