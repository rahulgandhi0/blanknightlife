/**
 * /api/automations
 * 
 * CRUD API for scrape automations.
 * Each automation is tied to a profile and runs independently.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_FREQUENCY_HOURS = 36
const DEFAULT_LOOKBACK_DAYS = 3

// Calculate next run time based on frequency_hours
function calculateNextRun(
  frequencyHours: number,
  runAtHour: number,
  runAtMinute: number,
  fromDate?: Date
): Date {
  const now = fromDate || new Date()
  const next = new Date(now)
  
  // Set to the specified start time
  next.setUTCHours(runAtHour, runAtMinute, 0, 0)
  
  // If the calculated time is in the past, add frequency_hours until it's in the future
  while (next <= now) {
    next.setTime(next.getTime() + frequencyHours * 60 * 60 * 1000)
  }
  
  return next
}

function resolveBaseUrl(request: NextRequest): string {
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

async function triggerImmediateScrape(baseUrl: string, account: string, profileId: string, daysBack: number) {
  if (!baseUrl || !profileId) return
  try {
    await fetch(`${baseUrl}/api/apify-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account,
        sinceHours: daysBack * 24,
        profile_id: profileId,
      }),
    })
  } catch (error) {
    console.error('Failed to start immediate scrape', error)
  }
}

// GET - List automations for a profile
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const profileId = searchParams.get('profile_id')

  if (!profileId) {
    return NextResponse.json({ error: 'profile_id required' }, { status: 400 })
  }

  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('scrape_automations')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ automations: data || [] })
}

// POST - Create new automation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      profile_id,
      account_handle,
      run_at_hour = 9,
      run_at_minute = 0,
      frequency_hours = DEFAULT_FREQUENCY_HOURS,
      days_back = DEFAULT_LOOKBACK_DAYS,
      is_active = true,
    } = body

    if (!profile_id || !account_handle) {
      return NextResponse.json(
        { error: 'profile_id and account_handle are required' },
        { status: 400 }
      )
    }

    const cleanHandle = account_handle.trim().replace(/^@/, '')
    
    const supabase = await createClient()
    
    // Check for duplicate (profile_id, account_handle)
    const { data: existing } = await supabase
      .from('scrape_automations')
      .select('id')
      .eq('profile_id', profile_id)
      .eq('account_handle', cleanHandle)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `Automation for @${cleanHandle} already exists` },
        { status: 409 }
      )
    }

    const nextRunAt = calculateNextRun(frequency_hours, run_at_hour, run_at_minute)
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('scrape_automations')
      .insert({
        profile_id,
        account_handle: cleanHandle,
        days_back,
        frequency_hours,
        run_at_hour,
        run_at_minute,
        is_active,
        next_run_at: nextRunAt.toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const baseUrl = resolveBaseUrl(request)
    void triggerImmediateScrape(baseUrl, cleanHandle, profile_id, days_back)

    return NextResponse.json({ success: true, automation: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH - Update automation
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const supabase = await createClient()

    // If schedule changed, recalculate next_run_at
    if (updates.frequency_hours !== undefined || updates.run_at_hour !== undefined || updates.run_at_minute !== undefined) {
      // Fetch current automation to get full schedule
      const { data: current } = await supabase
        .from('scrape_automations')
        .select('*')
        .eq('id', id)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const curr = current as any
      if (curr) {
        const frequencyHours = updates.frequency_hours ?? curr.frequency_hours
        const runAtHour = updates.run_at_hour ?? curr.run_at_hour
        const runAtMinute = updates.run_at_minute ?? curr.run_at_minute

        updates.next_run_at = calculateNextRun(frequencyHours, runAtHour, runAtMinute).toISOString()
      }
    }

    // Clean handle if provided
    if (updates.account_handle) {
      updates.account_handle = updates.account_handle.trim().replace(/^@/, '')
      
      // Check for duplicate if changing account_handle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: current } = await (supabase as any)
        .from('scrape_automations')
        .select('profile_id')
        .eq('id', id)
        .single()

      if (current && current.profile_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: duplicate } = await (supabase as any)
          .from('scrape_automations')
          .select('id')
          .eq('profile_id', current.profile_id)
          .eq('account_handle', updates.account_handle)
          .neq('id', id)
          .single()

        if (duplicate) {
          return NextResponse.json(
            { error: `Automation for @${updates.account_handle} already exists` },
            { status: 409 }
          )
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('scrape_automations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, automation: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove automation
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('scrape_automations')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

