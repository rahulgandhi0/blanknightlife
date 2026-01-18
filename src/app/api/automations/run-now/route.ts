import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LOOKBACK_FALLBACK_HOURS = 120

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateSinceHours(automation: any, referenceDate: Date): number {
  if (!automation?.last_run_at) {
    return LOOKBACK_FALLBACK_HOURS
  }
  const lastRunAt = new Date(automation.last_run_at)
  const diffMs = Math.max(0, referenceDate.getTime() - lastRunAt.getTime())
  const diffHours = Math.max(1, Math.ceil((diffMs / (60 * 60 * 1000)) * 1.1))
  return diffHours
}

const resolveBaseUrl = (request: NextRequest): string => {
  try {
    return new URL(request.url).origin
  } catch {
    const port = process.env.PORT || process.env.NEXT_PUBLIC_PORT || '3000'
    const host = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
    if (host?.startsWith('http')) {
      return host
    }
    if (host) {
      return `https://${host}`
    }
    return `http://localhost:${port}`
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body as { id?: string }

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: automation, error } = await (supabase as any)
      .from('scrape_automations')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const runTimestamp = new Date()
    const sinceHours = calculateSinceHours(automation, runTimestamp)
    const baseUrl = resolveBaseUrl(request)

    // Trigger the scrape
    const scrapeRes = await fetch(`${baseUrl}/api/apify-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: automation.account_handle,
        sinceHours,
        profile_id: automation.profile_id,
      }),
    })

    if (!scrapeRes.ok) {
      const err = await scrapeRes.text()
      return NextResponse.json({ error: 'Failed to trigger scrape', details: err }, { status: 500 })
    }

    const scrapeData = await scrapeRes.json()
    const success = scrapeData.success === true
    const isAsync = scrapeData.async === true
    const runStatus = isAsync ? 'running' : success ? 'success' : 'failed'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('scrape_automations')
      .update({
        last_run_at: runTimestamp.toISOString(),
        last_run_status: runStatus,
        last_run_result: {
          found: scrapeData.found || 0,
          processed: scrapeData.ingestResult?.processed || 0,
          error: scrapeData.error || null,
          async: isAsync,
          runId: scrapeData.runId || null,
          datasetId: scrapeData.datasetId || null,
        },
        run_count: (automation.run_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      automation_id: id,
      run_status: runStatus,
      scrape: scrapeData,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
