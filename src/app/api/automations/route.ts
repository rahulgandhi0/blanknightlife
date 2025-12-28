/**
 * /api/automations
 * 
 * CRUD API for scrape automations.
 * Each automation is tied to a profile and runs independently.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Calculate next run time based on frequency and schedule
function calculateNextRun(
  frequency: string,
  runAtHour: number,
  runAtMinute: number,
  runOnDays: number[]
): Date {
  const now = new Date()
  const next = new Date(now)
  
  // Set the time
  next.setUTCHours(runAtHour, runAtMinute, 0, 0)
  
  if (frequency === 'hourly') {
    // Next hour at the specified minute
    next.setUTCMinutes(runAtMinute)
    if (next <= now) {
      next.setUTCHours(next.getUTCHours() + 1)
    }
  } else if (frequency === 'daily') {
    // Tomorrow at the specified time if already passed today
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1)
    }
  } else if (frequency === 'weekly') {
    // Find next matching day
    const currentDay = next.getUTCDay()
    let daysUntilNext = 7
    
    for (const day of runOnDays.sort((a, b) => a - b)) {
      const diff = day - currentDay
      if (diff > 0 || (diff === 0 && next > now)) {
        daysUntilNext = Math.min(daysUntilNext, diff > 0 ? diff : 7)
      }
    }
    
    if (daysUntilNext === 7 && runOnDays.length > 0) {
      // Wrap to next week
      daysUntilNext = (runOnDays[0] + 7 - currentDay) % 7 || 7
    }
    
    next.setUTCDate(next.getUTCDate() + daysUntilNext)
  }
  
  return next
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
      days_back = 3,
      frequency = 'daily',
      run_at_hour = 9,
      run_at_minute = 0,
      run_on_days = [0, 1, 2, 3, 4, 5, 6],
      is_active = true,
    } = body

    if (!profile_id || !account_handle) {
      return NextResponse.json(
        { error: 'profile_id and account_handle are required' },
        { status: 400 }
      )
    }

    const cleanHandle = account_handle.trim().replace(/^@/, '')
    const nextRunAt = calculateNextRun(frequency, run_at_hour, run_at_minute, run_on_days)

    const supabase = await createClient()
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('scrape_automations')
      .insert({
        profile_id,
        account_handle: cleanHandle,
        days_back,
        frequency,
        run_at_hour,
        run_at_minute,
        run_on_days,
        is_active,
        next_run_at: nextRunAt.toISOString(),
      })
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
    if (updates.frequency || updates.run_at_hour !== undefined || updates.run_at_minute !== undefined || updates.run_on_days) {
      // Fetch current automation to get full schedule
      const { data: current } = await supabase
        .from('scrape_automations')
        .select('*')
        .eq('id', id)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const curr = current as any
      if (curr) {
        const frequency = updates.frequency || curr.frequency
        const runAtHour = updates.run_at_hour ?? curr.run_at_hour
        const runAtMinute = updates.run_at_minute ?? curr.run_at_minute
        const runOnDays = updates.run_on_days || curr.run_on_days

        updates.next_run_at = calculateNextRun(frequency, runAtHour, runAtMinute, runOnDays).toISOString()
      }
    }

    // Clean handle if provided
    if (updates.account_handle) {
      updates.account_handle = updates.account_handle.trim().replace(/^@/, '')
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

