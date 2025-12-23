import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { runId } = body

    if (!runId) {
      return NextResponse.json({ error: 'Missing runId' }, { status: 400 })
    }

    const token = process.env.APIFY_API_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN missing' }, { status: 500 })
    }

    const resp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${token}`, {
      method: 'POST',
    })

    if (!resp.ok) {
      const err = await resp.text()
      return NextResponse.json({ error: 'Failed to abort run', details: err }, { status: 500 })
    }

    const data = await resp.json()
    return NextResponse.json({ success: true, status: data?.data?.status || 'ABORTED' })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}

