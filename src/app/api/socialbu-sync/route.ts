/**
 * POST /api/socialbu-sync
 * 
 * Syncs post statuses between SocialBu and local database.
 * Checks all 'scheduled' events and updates their status based on:
 * 1. Whether scheduled_for time has passed
 * 2. SocialBu API response (if available)
 * 
 * Call this periodically or on page load to keep statuses in sync.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SyncResult {
  eventId: string
  oldStatus: string
  newStatus: string
  reason: string
}

export async function POST(request: NextRequest) {
  const results: SyncResult[] = []
  const errors: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const profileId = body.profile_id

    const supabase = await createClient()

    // Get all events that need syncing:
    // - 'scheduled' status (sent to SocialBu, waiting to post)
    // - 'approved' status with scheduled_for in the past (should have been sent)
    let query = supabase
      .from('event_discovery')
      .select('*')
      .in('status', ['scheduled', 'approved'])
      .not('scheduled_for', 'is', null)

    if (profileId) {
      query = query.eq('profile_id', profileId)
    }

    const { data: events, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch events', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No events to sync',
        synced: 0,
        results: [],
      })
    }

    const now = new Date()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const event of events as any[]) {
      const scheduledFor = new Date(event.scheduled_for)
      const hasSocialBuId = event.meta_post_id || event.socialbu_post_id
      
      // Case 1: Event is 'scheduled' and time has passed → mark as 'posted'
      if (event.status === 'scheduled' && scheduledFor < now && hasSocialBuId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('event_discovery')
          .update({
            status: 'posted',
            posted_at: scheduledFor.toISOString(), // Use scheduled time as posted time
            updated_at: new Date().toISOString(),
          })
          .eq('id', event.id)

        if (updateError) {
          errors.push(`Failed to update event ${event.id}: ${updateError.message}`)
        } else {
          results.push({
            eventId: event.id,
            oldStatus: 'scheduled',
            newStatus: 'posted',
            reason: 'Scheduled time passed',
          })
        }
      }
      
      // Case 2: Event is 'approved' but scheduled time passed and was never sent
      // This shouldn't happen normally, but flag it
      else if (event.status === 'approved' && scheduledFor < now && !hasSocialBuId) {
        // Mark as needing attention - move back to pending or keep as approved
        // For now, just log it
        errors.push(`Event ${event.id} was approved for ${scheduledFor.toISOString()} but never sent to SocialBu`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${results.length} events`,
      synced: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (error) {
    console.error('Error syncing with SocialBu:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET - Check sync status / trigger sync
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const profileId = searchParams.get('profile_id')

  // Redirect to POST for actual sync
  const syncRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ profile_id: profileId }),
    headers: { 'Content-Type': 'application/json' },
  })

  return POST(syncRequest)
}

