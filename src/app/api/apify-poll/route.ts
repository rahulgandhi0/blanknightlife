import { NextRequest, NextResponse } from 'next/server'
import { logMetric, nowMs } from '@/lib/metrics'

const resolveBaseUrl = (request: NextRequest): string => {
  try {
    return new URL(request.url).origin
  } catch {
    const localPort = process.env.PORT || process.env.NEXT_PUBLIC_PORT || '3000'
    return (
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${localPort}`)
    )
  }
}

export async function POST(request: NextRequest) {
  const startedAt = nowMs()
  try {
    const body = await request.json()
    const { runId, datasetId, profile_id } = body

    if (!runId && !datasetId) {
      return NextResponse.json({ error: 'Missing runId or datasetId' }, { status: 400 })
    }
    if (!profile_id) {
      return NextResponse.json({ error: 'Missing profile_id' }, { status: 400 })
    }

    const token = process.env.APIFY_API_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN missing' }, { status: 500 })
    }

    let resolvedDatasetId = datasetId as string | undefined
    let runStatus: string | null = null

    if (!resolvedDatasetId && runId) {
      const runResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
      if (!runResp.ok) {
        const err = await runResp.text()
        return NextResponse.json({ error: 'Failed to fetch run status', details: err }, { status: 500 })
      }
      const runData = await runResp.json()
      runStatus = runData?.data?.status || null
      resolvedDatasetId = runData?.data?.defaultDatasetId || null

      if (runStatus && runStatus !== 'SUCCEEDED') {
        return NextResponse.json({ success: false, status: runStatus })
      }
    }

    if (!resolvedDatasetId) {
      return NextResponse.json({ error: 'Could not resolve dataset id' }, { status: 500 })
    }

    const datasetResp = await fetch(`https://api.apify.com/v2/datasets/${resolvedDatasetId}/items?format=json`)
    if (!datasetResp.ok) {
      const err = await datasetResp.text()
      return NextResponse.json({ error: 'Failed to fetch dataset items', details: err }, { status: 500 })
    }
    const items = await datasetResp.json()
    const posts = Array.isArray(items) ? items : []

    const baseUrl = resolveBaseUrl(request)
    const ingestResp = await fetch(`${baseUrl}/api/ingest?profile_id=${profile_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posts),
    })

    if (!ingestResp.ok) {
      const err = await ingestResp.text()
      return NextResponse.json({ error: 'Ingest failed', details: err }, { status: 500 })
    }

    const ingestData = await ingestResp.json()
    logMetric('apify_manual_fetch', {
      runId,
      datasetId: resolvedDatasetId,
      processed: ingestData.processed || 0,
      duration_ms: nowMs() - startedAt,
    })

    return NextResponse.json({
      success: true,
      runId,
      datasetId: resolvedDatasetId,
      ingestResult: ingestData,
    })
  } catch (error) {
    logMetric('apify_manual_fetch_error', { error: String(error), duration_ms: nowMs() - startedAt })
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}
