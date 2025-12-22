import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account, sinceHours = 48 } = body

    if (!account) {
      return NextResponse.json({ error: 'Missing account' }, { status: 400 })
    }

    const token = process.env.APIFY_API_TOKEN
    const actorId = process.env.APIFY_ACTOR_ID

    if (!token || !actorId) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN or APIFY_ACTOR_ID missing' }, { status: 500 })
    }

    const cleanHandle = account.trim().replace(/^@/, '')

    const input = {
      handle: cleanHandle,
      sinceHours,
    }

    const resp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    })

    if (!resp.ok) {
      const err = await resp.text()
      return NextResponse.json({ error: 'Failed to start Apify run', details: err }, { status: 500 })
    }

    const data = await resp.json()
    return NextResponse.json({ success: true, runId: data.data?.id })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}
