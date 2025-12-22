import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rewriteCaption } from '@/lib/groq'
import type { EventDiscovery } from '@/types/database'

// POST /api/generate-caption
// Generate AI caption on-demand for a specific event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, context } = body

    if (!eventId) {
      return NextResponse.json(
        { error: 'Missing eventId' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get the event
    const { data, error: fetchError } = await supabase
      .from('event_discovery')
      .select('*')
      .eq('id', eventId)
      .single()

    if (fetchError || !data) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    const event = data as EventDiscovery

    // Generate AI caption with optional context
    const aiCaption = await rewriteCaption(
      event.original_caption || '',
      event.source_account,
      context || undefined
    )

    // Update the event with the generated caption
    const { data: updated, error: updateError } = await supabase
      .from('event_discovery')
      .update({
        ai_generated_caption: aiCaption,
        final_caption: aiCaption, // Set as default, user can edit
      } as Partial<EventDiscovery>)
      .eq('id', eventId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update event', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      caption: aiCaption,
      event: updated,
    })
  } catch (error) {
    console.error('Generate caption error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

