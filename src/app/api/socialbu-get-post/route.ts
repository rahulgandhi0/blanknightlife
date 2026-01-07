/**
 * GET /api/socialbu-get-post?eventId={eventId}
 * 
 * Fetches the latest post data from SocialBu and syncs it with local state
 */

import { NextRequest, NextResponse } from 'next/server';
import { SocialBuClient } from '@/lib/socialbu';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId');

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

    // Fetch from SocialBu
    const client = new SocialBuClient();
    const socialBuPost = await client.getPost(socialBuId);

    // Parse the scheduled_at from SocialBu format (YYYY-MM-DD HH:MM:SS) to ISO
    let scheduledFor = event.scheduled_for;
    if (socialBuPost.scheduled_at) {
      // Convert "YYYY-MM-DD HH:MM:SS" to ISO format
      scheduledFor = new Date(socialBuPost.scheduled_at.replace(' ', 'T') + 'Z').toISOString();
    }

    // Update local database with latest data from SocialBu
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('event_discovery')
      .update({
        scheduled_for: scheduledFor,
        final_caption: socialBuPost.content || event.final_caption,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (updateError) {
      console.error('Failed to update local database:', updateError);
    }

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        scheduled_for: scheduledFor,
        final_caption: socialBuPost.content || event.final_caption,
        status: socialBuPost.status,
      },
      socialbu_post: socialBuPost,
    });

  } catch (error) {
    console.error('Error fetching post from SocialBu:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

