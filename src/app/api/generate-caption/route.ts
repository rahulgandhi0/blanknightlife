import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rewriteCaption } from '@/lib/groq'
import type { EventDiscovery } from '@/types/database'

interface CaptionEdit {
  ai_caption: string
  user_edited_caption: string
  original_caption: string | null
}

// POST /api/generate-caption
// Generate AI caption on-demand for a specific event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, context, useRL = true } = body

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

    // Fetch recent significant edits for RL (learn from past corrections)
    let learnedExamples: string | undefined
    if (useRL) {
      const { data: recentEdits } = await supabase
        .from('caption_edits')
        .select('ai_caption, user_edited_caption, original_caption')
        .eq('was_significant_edit', true)
        .order('created_at', { ascending: false })
        .limit(3)

      if (recentEdits && recentEdits.length > 0) {
        const examples = (recentEdits as CaptionEdit[]).map((edit, i) => 
          `Correction ${i + 1}:\nAI wrote: "${edit.ai_caption}"\nUser preferred: "${edit.user_edited_caption}"`
        ).join('\n\n')
        learnedExamples = `\n\nLEARN FROM THESE RECENT USER CORRECTIONS:\n${examples}`
      }
    }

    // Build context with learned examples
    const fullContext = [context, learnedExamples].filter(Boolean).join('\n')

    // Generate AI caption with optional context + learned patterns
    const aiCaption = await rewriteCaption(
      event.original_caption || '',
      event.source_account,
      fullContext || undefined
    )

    // Update the event with the generated caption
    const { data: updated, error: updateError } = await supabase
      .from('event_discovery')
      .update({
        ai_generated_caption: aiCaption,
        final_caption: aiCaption,
      } as never)
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

