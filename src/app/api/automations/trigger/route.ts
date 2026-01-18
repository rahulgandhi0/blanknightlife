/**
 * GET /api/automations/trigger
 * 
 * Trigger endpoint for running due automations.
 * Call this via Vercel Cron or external scheduler every 30 minutes.
 * 
 * Query params:
 * - secret: Optional secret key for authentication
 * - force_id: Force run a specific automation by ID (for testing)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

const FIXED_FREQUENCY_HOURS = 36

/**
 * Calculate next run time anchored to the previous scheduled time to prevent drift.
 * If the calculated next run is in the past (e.g., after downtime), keep adding
 * frequency_hours until it's in the future.
 * 
 * @param previousNextRunAt - The previous next_run_at timestamp from the automation
 * @param frequencyHours - The frequency in hours
 * @param now - Current timestamp for reference
 * @returns The next scheduled run time
 */
function calculateNextRun(
  previousNextRunAt: string | Date,
  frequencyHours: number,
  now: Date = new Date()
): Date {
  const previousNext = new Date(previousNextRunAt)
  const frequencyMs = frequencyHours * 60 * 60 * 1000
  
  // Start with the previous scheduled time + frequency
  let nextRun = new Date(previousNext.getTime() + frequencyMs)
  
  // If we're in the past (e.g., after downtime), keep adding frequency until we're in the future
  while (nextRun.getTime() <= now.getTime()) {
    nextRun = new Date(nextRun.getTime() + frequencyMs)
  }
  
  return nextRun
}

const LOOKBACK_FALLBACK_HOURS = 120

/**
 * Calculate how many hours to look back for a scrape run.
 * Uses the actual gap between last_run_at and now to determine the scrape window.
 * This ensures we capture all posts since the last successful run.
 * 
 * @param automation - The automation object with last_run_at timestamp
 * @param referenceDate - Current timestamp (now)
 * @returns Number of hours to look back
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateSinceHours(automation: any, referenceDate: Date): number {
  if (!automation?.last_run_at) {
    // First run - use fallback window
    return LOOKBACK_FALLBACK_HOURS
  }
  const lastRunAt = new Date(automation.last_run_at)
  const diffMs = Math.max(0, referenceDate.getTime() - lastRunAt.getTime())
  // Add a small buffer (10%) to account for any timing variations
  const diffHours = Math.max(1, Math.ceil((diffMs / (60 * 60 * 1000)) * 1.1))
  return diffHours
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const secret = searchParams.get('secret')
  const forceId = searchParams.get('force_id')

  // Verify secret for security
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const now = new Date()
  const results: { id: string; account: string; status: string; details?: unknown }[] = []

  try {
    // Get automations that are due
    let query = supabase
      .from('scrape_automations')
      .select('*')
      .eq('is_active', true)

    if (forceId) {
      query = query.eq('id', forceId)
    } else {
      query = query.lte('next_run_at', now.toISOString())
    }

    const { data: automations, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!automations || automations.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No automations due',
        triggered: 0,
        results: [],
      })
    }

    // Get base URL for internal API calls
    const origin = (() => {
      try {
        return new URL(request.url).origin
      } catch {
        return null
      }
    })()
    const baseUrl = origin || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Process each automation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const automation of automations as any[]) {
      const runTimestamp = new Date()
      const automationId = automation.id
      const accountHandle = automation.account_handle
      const profileId = automation.profile_id
      const sinceHours = calculateSinceHours(automation, runTimestamp)

      // Mark as running
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('scrape_automations')
        .update({ 
          last_run_status: 'running',
          updated_at: new Date().toISOString(),
        })
        .eq('id', automationId)

      try {
        // Trigger the scrape
        const scrapeRes = await fetch(`${baseUrl}/api/apify-trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account: accountHandle,
            sinceHours,
            profile_id: profileId,
          }),
        })

        const scrapeData = await scrapeRes.json()
        const success = scrapeData.success === true
        const isAsync = scrapeData.async === true
        const runStatus = isAsync ? 'running' : success ? 'success' : 'failed'

        // Calculate next run anchored to previous scheduled time to prevent drift
        const nextRunAt = calculateNextRun(
          automation.next_run_at,
          automation.frequency_hours || FIXED_FREQUENCY_HOURS,
          runTimestamp
        )

        // Update automation status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('scrape_automations')
          .update({
            last_run_at: new Date().toISOString(),
            last_run_status: runStatus,
            last_run_result: {
              found: scrapeData.found || 0,
              processed: scrapeData.ingestResult?.processed || 0,
              error: scrapeData.error || null,
              async: isAsync,
              runId: scrapeData.runId || null,
              datasetId: scrapeData.datasetId || null,
            },
            next_run_at: nextRunAt.toISOString(),
            run_count: (automation.run_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', automationId)

        results.push({
          id: automationId,
          account: accountHandle,
          status: runStatus,
          details: {
            found: scrapeData.found || 0,
            processed: scrapeData.ingestResult?.processed || 0,
            nextRun: nextRunAt.toISOString(),
            sinceHours,
            async: isAsync,
            runId: scrapeData.runId || null,
          },
        })
      } catch (err) {
        // Update as failed - still calculate next run anchored to prevent drift
        const nextRunAt = calculateNextRun(
          automation.next_run_at,
          automation.frequency_hours || FIXED_FREQUENCY_HOURS,
          runTimestamp
        )

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('scrape_automations')
          .update({
            last_run_at: new Date().toISOString(),
            last_run_status: 'failed',
            last_run_result: { error: String(err) },
            next_run_at: nextRunAt.toISOString(),
            run_count: (automation.run_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', automationId)

        results.push({
          id: automationId,
          account: accountHandle,
          status: 'failed',
          details: { error: String(err), sinceHours },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Triggered ${results.length} automation(s)`,
      triggered: results.length,
      results,
    })

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

