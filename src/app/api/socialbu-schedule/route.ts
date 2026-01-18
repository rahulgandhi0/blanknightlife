/**
 * POST /api/socialbu-schedule
 * 
 * Schedules a post from your event_discovery table to SocialBu.
 * Handles media upload and post creation in one seamless flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SocialBuClient } from '@/lib/socialbu';
import { createClient } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';
import { uploadMediaToStorage } from '@/lib/media';
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

    // Validate event status - allow approved or scheduled (for re-scheduling)
    if (typedEvent.status !== 'approved' && typedEvent.status !== 'scheduled') {
      return NextResponse.json(
        { success: false, error: 'Only approved or scheduled events can be sent to SocialBu' },
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

    let mediaUrls = typedEvent.media_urls || [];

    if (featureFlags.uploadOnApprove && mediaUrls.length === 0) {
      const sourceUrls = (typedEvent as Database['public']['Tables']['event_discovery']['Row'] & {
        source_media_urls?: string[] | null
      }).source_media_urls || [];

      if (!sourceUrls || sourceUrls.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Event is missing source media URLs' },
          { status: 400 }
        );
      }

      const uploaded: string[] = [];
      for (let i = 0; i < sourceUrls.length; i++) {
        const uploadedUrl = await uploadMediaToStorage(supabase as any, sourceUrls[i], typedEvent.ig_post_id, i);
        if (uploadedUrl) {
          uploaded.push(uploadedUrl);
        }
      }

      if (uploaded.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Failed to upload media for scheduling' },
          { status: 500 }
        );
      }

      // Persist uploaded URLs for future use
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('event_discovery')
        .update({ media_urls: uploaded, updated_at: new Date().toISOString() })
        .eq('id', eventId);

      mediaUrls = uploaded;
    }

    if (!mediaUrls || mediaUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Event must have at least one media file' },
        { status: 400 }
      );
    }

    // WAL-Lite Implementation: Step 1 - Set status to 'scheduling' before calling SocialBu
    // This prevents dual-write inconsistency and allows recovery from failures
    console.log('📝 Step 1: Setting event status to "scheduling"...');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: schedulingError } = await (supabase as any)
        .from('event_discovery')
        .update({
          status: 'scheduling',
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (schedulingError) {
        console.error('❌ Failed to set scheduling state:', schedulingError);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to initiate scheduling process',
            details: schedulingError.message || String(schedulingError),
          },
          { status: 500 }
        );
      }
      console.log('✅ Event marked as "scheduling"');
    } catch (error) {
      console.error('❌ Exception while setting scheduling state:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to initiate scheduling process',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }

    // Step 2: Execute SocialBu API call
    const client = new SocialBuClient();
    
    // Generate postback URL for status updates
    const postbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/socialbu-postback`;

    let result;
    let socialBuPostId: string | number | null = null;
    
    // Prepare platform-specific options
    const options: any = {};
    
    // For Instagram Reels
    if (typedEvent.post_type === 'reel') {
      options.share_reel_to_feed = true;
    }
    
    console.log('📤 Step 2: Calling SocialBu API...');
    console.log('Post type:', typedEvent.post_type);
    console.log('Media count:', mediaUrls.length);
    console.log('Account IDs:', accountIds);
    
    try {
      // Handle carousels and multi-media posts differently
      // For carousels (multiple media), send individual requests to avoid "Maximum 1" error
      if (mediaUrls.length > 1) {
        console.log('🎠 Carousel detected - sending individual requests per account');
        
        const results = [];
        for (const accountId of accountIds) {
          console.log(`  Scheduling for account ${accountId}...`);
          const accountResult = await client.schedulePostWithMedia(
            [accountId], // Single account
            typedEvent.final_caption,
            mediaUrls,
            new Date(typedEvent.scheduled_for),
            options,
            postbackUrl
          );
          
          if (!accountResult.success) {
            console.error(`  ❌ Failed for account ${accountId}:`, accountResult.message);
            // Continue with other accounts but track failures
          } else {
            console.log(`  ✅ Success for account ${accountId}:`, accountResult.post_id);
          }
          
          results.push(accountResult);
        }
        
        // Check if at least one succeeded
        const successfulResults = results.filter(r => r.success);
        if (successfulResults.length === 0) {
          throw new Error(`All accounts failed. First error: ${results[0]?.message || 'Unknown error'}`);
        }
        
        // Use the first successful post ID
        socialBuPostId = successfulResults[0].post_id || null;
        result = {
          success: true,
          post_id: socialBuPostId,
          message: `Scheduled to ${successfulResults.length}/${accountIds.length} accounts`,
        };
        
      } else {
        // Single media - can send to multiple accounts at once
        console.log('🖼️ Single media - sending multi-account request');
        result = await client.schedulePostWithMedia(
          accountIds,
          typedEvent.final_caption,
          mediaUrls,
          new Date(typedEvent.scheduled_for),
          options,
          postbackUrl
        );
        
        socialBuPostId = result.post_id || null;
      }

      if (!result.success) {
        // Step 4: Error Handling - Revert to 'approved' so user can retry
        console.error('❌ SocialBu API returned failure:', result.message);
        console.log('🔄 Reverting status to "approved" for retry...');
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('event_discovery')
          .update({
            status: 'approved',
            updated_at: new Date().toISOString(),
          })
          .eq('id', eventId);

        return NextResponse.json(
          {
            success: false,
            error: result.message || 'Failed to schedule post',
            details: result.errors,
          },
          { status: 500 }
        );
      }

      console.log('✅ SocialBu scheduling successful:', { post_id: socialBuPostId });

    } catch (socialBuError) {
      // Step 4: Error Handling - Revert to 'approved' so user can retry
      console.error('❌ SocialBu API threw exception:', socialBuError);
      console.log('🔄 Reverting status to "approved" for retry...');
      
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('event_discovery')
          .update({
            status: 'approved',
            updated_at: new Date().toISOString(),
          })
          .eq('id', eventId);
      } catch (revertError) {
        console.error('❌ Failed to revert status:', revertError);
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to schedule post in SocialBu',
          details: socialBuError instanceof Error ? socialBuError.message : String(socialBuError),
        },
        { status: 500 }
      );
    }

    // Step 3: Success - Update to 'scheduled' with post ID
    const numericPostId = socialBuPostId ? (typeof socialBuPostId === 'number' ? socialBuPostId : parseInt(String(socialBuPostId))) : null;
    
    console.log('💾 Step 3: Saving to database with "scheduled" status...');
    console.log('Attempting to save to DB:', {
      meta_post_id: String(socialBuPostId),
      socialbu_post_id: numericPostId,
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('event_discovery')
        .update({
          status: 'scheduled',
          meta_post_id: String(socialBuPostId), // Store as string
          socialbu_post_id: numericPostId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (updateError) {
        console.error('❌ CRITICAL: Failed to update local database after successful SocialBu scheduling!');
        console.error('Post ID in SocialBu:', socialBuPostId);
        console.error('Event ID:', eventId);
        console.error('Database error:', updateError);
        
        // SAFETY: Delete the post from SocialBu to prevent orphaned posts
        console.log('🔄 Attempting to rollback: Deleting post from SocialBu...');
        try {
          const deleteResult = await client.deletePost(socialBuPostId!);
          if (deleteResult.success) {
            console.log('✅ Successfully rolled back: Post deleted from SocialBu');
            // Revert to approved
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('event_discovery')
              .update({ status: 'approved', updated_at: new Date().toISOString() })
              .eq('id', eventId);
          } else {
            console.error('❌ Rollback failed: Could not delete post from SocialBu:', deleteResult.message);
          }
        } catch (deleteError) {
          console.error('❌ Rollback exception:', deleteError);
        }
        
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to save post to database. Post was not scheduled (rolled back).',
            details: updateError.message || String(updateError),
          },
          { status: 500 }
        );
      }
      
      console.log('✅ Successfully saved post IDs to database');
      
    } catch (dbError) {
      console.error('❌ CRITICAL: Database operation threw exception after successful SocialBu scheduling!');
      console.error('Post ID in SocialBu:', socialBuPostId);
      console.error('Event ID:', eventId);
      console.error('Exception:', dbError);
      
      // SAFETY: Delete the post from SocialBu to prevent orphaned posts
      console.log('🔄 Attempting to rollback: Deleting post from SocialBu...');
      try {
        const deleteResult = await client.deletePost(socialBuPostId!);
        if (deleteResult.success) {
          console.log('✅ Successfully rolled back: Post deleted from SocialBu');
          // Revert to approved
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('event_discovery')
            .update({ status: 'approved', updated_at: new Date().toISOString() })
            .eq('id', eventId);
        } else {
          console.error('❌ Rollback failed: Could not delete post from SocialBu:', deleteResult.message);
        }
      } catch (deleteError) {
        console.error('❌ Rollback exception:', deleteError);
      }
      
      return NextResponse.json(
        {
          success: false,
          error: 'Database error occurred. Post was not scheduled (rolled back).',
          details: dbError instanceof Error ? dbError.message : String(dbError),
        },
        { status: 500 }
      );
    }

    // TODO: ORPHAN HANDLING - Implement a Cron job that checks for events stuck in 'scheduling' 
    // status for more than 5 minutes. This acts as a safety net for the WAL-Lite pattern.
    // The cron should:
    // 1. Find events with status='scheduling' AND updated_at < NOW() - INTERVAL '5 minutes'
    // 2. Check if the post exists in SocialBu (using meta_post_id if available)
    // 3. If exists in SocialBu: update local status to 'scheduled'
    // 4. If not exists: revert status to 'approved' so user can retry

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

