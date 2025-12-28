/**
 * POST /api/socialbu-sync
 * 
 * Syncs post statuses between SocialBu and local database.
 * 1. Checks if scheduled_for time has passed → marks as posted
 * 2. Queries SocialBu for recently published posts → matches and updates
 * 
 * Call this periodically or on page load to keep statuses in sync.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SocialBuClient } from '@/lib/socialbu'

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

    // Get all events that need syncing
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

    // Try to get published posts from SocialBu for matching
    let socialBuPublished: { id: number; content: string; published_at?: string }[] = []
    try {
      const client = new SocialBuClient()
      socialBuPublished = await client.getPublishedPosts(undefined, 100)
    } catch (e) {
      // SocialBu API might not support this endpoint, continue without it
      console.log('Could not fetch SocialBu published posts:', e)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const event of events as any[]) {
      const scheduledFor = new Date(event.scheduled_for)
      const hasSocialBuId = event.meta_post_id || event.socialbu_post_id
      const isPast = scheduledFor < now
      const isPastBy30Min = scheduledFor < new Date(now.getTime() - 30 * 60 * 1000)

      // Case 1: Event has SocialBu ID and time has passed → mark as posted
      if (event.status === 'scheduled' && hasSocialBuId && isPast) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('event_discovery')
          .update({
            status: 'posted',
            posted_at: scheduledFor.toISOString(),
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
            reason: 'Scheduled time passed (has SocialBu ID)',
          })
        }
        continue
      }

      // Case 2: Try to match with SocialBu published posts by caption similarity
      if (event.status === 'scheduled' && isPastBy30Min && event.final_caption) {
        const captionStart = event.final_caption.slice(0, 50).toLowerCase()
        
        const match = socialBuPublished.find(p => 
          p.content?.toLowerCase().startsWith(captionStart)
        )

        if (match) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateError } = await (supabase as any)
            .from('event_discovery')
            .update({
              status: 'posted',
              posted_at: match.published_at || scheduledFor.toISOString(),
              meta_post_id: String(match.id),
              socialbu_post_id: match.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', event.id)

          if (!updateError) {
            results.push({
              eventId: event.id,
              oldStatus: event.status,
              newStatus: 'posted',
              reason: 'Matched with SocialBu published post',
            })
          }
          continue
        }
      }

      // Case 3: Scheduled but past due with no SocialBu ID - might have been posted manually
      // After 1 hour, mark as posted anyway (assume success)
      const isPastBy1Hour = scheduledFor < new Date(now.getTime() - 60 * 60 * 1000)
      if (event.status === 'scheduled' && isPastBy1Hour) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('event_discovery')
          .update({
            status: 'posted',
            posted_at: scheduledFor.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', event.id)

        if (!updateError) {
          results.push({
            eventId: event.id,
            oldStatus: 'scheduled',
            newStatus: 'posted',
            reason: 'Auto-marked after 1 hour',
          })
        }
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

  const syncRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ profile_id: profileId }),
    headers: { 'Content-Type': 'application/json' },
  })

  return POST(syncRequest)
}
