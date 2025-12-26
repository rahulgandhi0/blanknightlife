/**
 * POST /api/socialbu-postback
 * 
 * Webhook handler for SocialBu status updates.
 * Called by SocialBu when a post is published or fails.
 * 
 * Expected payload from SocialBu:
 * {
 *   post_id: string,
 *   account_id: number,
 *   status: 'created' | 'published' | 'failed'
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { post_id, account_id, status } = body;

    console.log('SocialBu postback received:', { post_id, account_id, status });

    if (!post_id || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Find the event with this SocialBu post ID
    const supabase = await createClient();
    const { data: event, error: fetchError } = await supabase
      .from('event_discovery')
      .select('*')
      .eq('meta_post_id', post_id)
      .single();

    if (fetchError || !event) {
      console.error('Event not found for SocialBu post:', post_id);
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Update event status based on SocialBu status
    let newStatus: string;
    let posted_at: string | null = null;

    switch (status) {
      case 'published':
        newStatus = 'posted';
        posted_at = new Date().toISOString();
        break;
      
      case 'failed':
        newStatus = 'approved'; // Revert to approved so user can reschedule
        console.error(`Post ${post_id} failed to publish on SocialBu`);
        break;
      
      case 'created':
        newStatus = 'scheduled'; // Keep as scheduled
        break;
      
      default:
        console.warn(`Unknown SocialBu status: ${status}`);
        return NextResponse.json({ success: true, message: 'Status ignored' });
    }

    // Update the event
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (posted_at) {
      updateData.posted_at = posted_at;
    }

    const { error: updateError } = await supabase
      .from('event_discovery')
      .update(updateData)
      .eq('id', event.id);

    if (updateError) {
      console.error('Failed to update event status:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update event' },
        { status: 500 }
      );
    }

    console.log(`Event ${event.id} updated to status: ${newStatus}`);

    return NextResponse.json({
      success: true,
      message: 'Event status updated',
      event_id: event.id,
      new_status: newStatus,
    });

  } catch (error) {
    console.error('Error processing SocialBu postback:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

