import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { EventDiscovery } from '@/types/database'

// Calculate simple edit distance (approximation)
function calculateEditDistance(a: string, b: string): number {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0)
  
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  
  if (longer.length === 0) return 0
  
  // Simple word-based diff
  const wordsA = a.toLowerCase().split(/\s+/)
  const wordsB = b.toLowerCase().split(/\s+/)
  
  let changes = 0
  const maxLen = Math.max(wordsA.length, wordsB.length)
  
  for (let i = 0; i < maxLen; i++) {
    if (wordsA[i] !== wordsB[i]) changes++
  }
  
  return changes
}

// POST /api/track-edit
// Track caption edits for reinforcement learning
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, aiCaption, userCaption, context } = body

    if (!eventId || !aiCaption || !userCaption) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Skip if no changes
    if (aiCaption.trim() === userCaption.trim()) {
      return NextResponse.json({ tracked: false, reason: 'No changes made' })
    }

    const supabase = createServiceClient()

    // Get event details
    const { data } = await supabase
      .from('event_discovery')
      .select('source_account, original_caption')
      .eq('id', eventId)
      .single()

    const event = data as Pick<EventDiscovery, 'source_account' | 'original_caption'> | null

    const editDistance = calculateEditDistance(aiCaption, userCaption)
    const aiWords = aiCaption.split(/\s+/).length
    const changeRatio = editDistance / Math.max(aiWords, 1)
    const wasSignificantEdit = changeRatio > 0.2 // >20% words changed

    // Store the edit
    const { error } = await supabase
      .from('caption_edits')
      .insert({
        event_id: eventId,
        source_account: event?.source_account || 'unknown',
        original_caption: event?.original_caption,
        ai_caption: aiCaption,
        user_edited_caption: userCaption,
        context_used: context || null,
        edit_distance: editDistance,
        was_significant_edit: wasSignificantEdit,
      } as never)

    if (error) {
      console.error('Failed to track edit:', error)
      return NextResponse.json(
        { error: 'Failed to track edit' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tracked: true,
      editDistance,
      wasSignificantEdit,
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
// Get recent edits for learning (to be used in prompt)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const significantOnly = searchParams.get('significant') === 'true'

    const supabase = createServiceClient()

    let query = supabase
      .from('caption_edits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (significantOnly) {
      query = query.eq('was_significant_edit', true)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch edits' },
        { status: 500 }
      )
    }

    return NextResponse.json({ edits: data })
  } catch (error) {
    console.error('Get edits error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

