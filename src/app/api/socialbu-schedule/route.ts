/**
 * POST /api/socialbu-schedule
 * 
 * Schedules a post from your event_discovery table to SocialBu.
 * Handles media upload and post creation in one seamless flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SocialBuClient } from '@/lib/socialbu';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, accountIds } = body;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one account ID is required' },
        { status: 400 }
      );
    }

    // Fetch the event from database
    const supabase = await createClient();
    const { data: event, error: fetchError } = await supabase
      .from('event_discovery')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const typedEvent = event as Database['public']['Tables']['event_discovery']['Row'];

    // Validate event status
    if (typedEvent.status !== 'approved') {
      return NextResponse.json(
        { success: false, error: 'Only approved events can be scheduled' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!typedEvent.final_caption) {
      return NextResponse.json(
        { success: false, error: 'Event must have a final caption' },
        { status: 400 }
      );
    }

    if (!typedEvent.scheduled_for) {
      return NextResponse.json(
        { success: false, error: 'Event must have a scheduled time' },
        { status: 400 }
      );
    }

    // 20-minute buffer validation (server-side)
    const scheduledTime = new Date(typedEvent.scheduled_for);
    const minScheduleTime = new Date();
    minScheduleTime.setMinutes(minScheduleTime.getMinutes() + 20);

    if (scheduledTime < minScheduleTime) {
      return NextResponse.json(
        { success: false, error: 'Posts must be scheduled at least 20 minutes in the future' },
        { status: 400 }
      );
    }

    if (!typedEvent.media_urls || typedEvent.media_urls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Event must have at least one media file' },
        { status: 400 }
      );
    }

    // Schedule with SocialBu
    const client = new SocialBuClient();
    
    // Generate postback URL for status updates
    const postbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/socialbu-postback`;

    const result = await client.schedulePostWithMedia(
      accountIds,
      typedEvent.final_caption,
      typedEvent.media_urls,
      new Date(typedEvent.scheduled_for),
      postbackUrl
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message || 'Failed to schedule post',
          details: result.errors,
        },
        { status: 500 }
      );
    }

    // Update event status to 'scheduled' and store SocialBu post ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('event_discovery')
      .update({
        status: 'scheduled',
        meta_post_id: String(result.post_id), // Store as string
        socialbu_post_id: result.post_id ? (typeof result.post_id === 'number' ? result.post_id : parseInt(result.post_id)) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (updateError) {
      console.error('Failed to update event status:', updateError);
      // Don't fail the request - post is already scheduled in SocialBu
    }

    return NextResponse.json({
      success: true,
      message: 'Post scheduled successfully',
      post_id: result.post_id,
      event_id: eventId,
      scheduled_for: typedEvent.scheduled_for,
    });

  } catch (error) {
    console.error('Error scheduling post to SocialBu:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

