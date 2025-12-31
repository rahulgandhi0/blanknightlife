import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/track-edit
// Track caption edits for reinforcement learning
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, aiCaption, userCaption } = body

    if (!eventId || !userCaption) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Skip if no changes
    if (aiCaption && aiCaption.trim() === userCaption.trim()) {
      return NextResponse.json({ tracked: false, reason: 'No changes made' })
    }

    const supabase = createServiceClient()

    // Store the edit - matches the actual table schema
    const { error } = await supabase
      .from('caption_edits')
      .insert({
        event_id: eventId,
        previous_caption: aiCaption || null,
        new_caption: userCaption,
        edited_by: 'user',
      } as never)

    if (error) {
      console.error('Failed to track edit:', error)
      return NextResponse.json(
        { error: 'Failed to track edit', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tracked: true,
    })
  } catch (error) {
    console.error('Track edit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/track-edit
// Get recent edits for learning (to be used in GROQ prompt)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const eventId = searchParams.get('event_id')

    const supabase = createServiceClient()

    let query = supabase
      .from('caption_edits')
      .select(`
        id,
        event_id,
        previous_caption,
        new_caption,
        edited_by,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch edits', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      edits: data,
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('Get edits error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

