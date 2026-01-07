/**
 * PATCH /api/socialbu-update
 * 
 * Updates a scheduled post in SocialBu (reschedule time or content)
 */

import { NextRequest, NextResponse } from 'next/server';
import { SocialBuClient } from '@/lib/socialbu';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, scheduledFor } = body;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Fetch the event from database
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: event, error: fetchError } = await (supabase as any)
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

    // Check if event has a SocialBu post ID (check both fields)
    const socialBuId = event.socialbu_post_id || (event.meta_post_id ? parseInt(event.meta_post_id) : null);
    
    if (!socialBuId) {
      return NextResponse.json(
        { success: false, error: 'Event is not linked to a SocialBu post' },
        { status: 400 }
      );
    }
    
    console.log('Updating SocialBu post:', { eventId, socialBuId, scheduledFor });

    // Validate scheduled time if provided
    if (scheduledFor) {
      const scheduledTime = new Date(scheduledFor);
      const minScheduleTime = new Date();
      minScheduleTime.setMinutes(minScheduleTime.getMinutes() + 20);

      if (scheduledTime < minScheduleTime) {
        return NextResponse.json(
          { success: false, error: 'Posts must be scheduled at least 20 minutes in the future' },
          { status: 400 }
        );
      }
    }

    // Update in SocialBu
    const client = new SocialBuClient();
    
    const updates: { publish_at?: string } = {};
    if (scheduledFor) {
      // Format date as YYYY-MM-DD HH:MM:SS (UTC)
      updates.publish_at = new Date(scheduledFor).toISOString().slice(0, 19).replace('T', ' ');
    }

    const result = await client.updatePost(socialBuId, updates);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message || 'Failed to update post in SocialBu',
        },
        { status: 500 }
      );
    }

    // Update local database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('event_discovery')
      .update({
        scheduled_for: scheduledFor || event.scheduled_for,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (updateError) {
      console.error('Failed to update local database:', updateError);
      // Don't fail - SocialBu is already updated
    }

    return NextResponse.json({
      success: true,
      message: 'Post updated successfully',
      event_id: eventId,
      scheduled_for: scheduledFor || event.scheduled_for,
    });

  } catch (error) {
    console.error('Error updating post in SocialBu:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

