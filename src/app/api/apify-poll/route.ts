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

    const runResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
    
    if (!runResp.ok) {
      return NextResponse.json({ error: 'Failed to fetch run status' }, { status: 500 })
    }

    const runData = await runResp.json()
    const status = runData.data?.status
    const datasetId = runData.data?.defaultDatasetId

    if (status === 'SUCCEEDED' && datasetId) {
      const datasetResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`)
      
      if (!datasetResp.ok) {
        return NextResponse.json({ 
          status, 
          ready: true, 
          error: 'Failed to fetch dataset' 
        })
      }

      const posts = await datasetResp.json()

      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000'
      
      const ingestResp = await fetch(`${baseUrl}/api/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(posts)
      })

      const ingestData = await ingestResp.json()

      return NextResponse.json({
        status,
        ready: true,
        ingested: true,
        ingestResult: ingestData
      })
    }

    return NextResponse.json({
      status,
      ready: status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED',
      datasetId
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}

