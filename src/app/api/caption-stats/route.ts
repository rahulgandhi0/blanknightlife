import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/caption-stats
// Calculate caption length statistics from approved/posted posts
export async function GET() {
  try {
    const supabase = createServiceClient()

    // Get all scheduled and posted events with final captions
    const { data: events, error } = await supabase
      .from('event_discovery')
      .select('final_caption')
      .in('status', ['scheduled', 'posted'])
      .not('final_caption', 'is', null)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch caption stats' },
        { status: 500 }
      )
    }

    if (!events || events.length === 0) {
      // No data yet, return sensible defaults
      return NextResponse.json({
        count: 0,
        avgLength: 200,
        stdDev: 50,
        minRecommended: 100,
        maxRecommended: 300,
      })
    }

    // Calculate lengths
    const lengths = events
      .map(e => e.final_caption?.length || 0)
      .filter(len => len > 0)

    if (lengths.length === 0) {
      return NextResponse.json({
        count: 0,
        avgLength: 200,
        stdDev: 50,
        minRecommended: 100,
        maxRecommended: 300,
      })
    }

    // Calculate mean
    const sum = lengths.reduce((a, b) => a + b, 0)
    const avgLength = Math.round(sum / lengths.length)

    // Calculate standard deviation
    const squaredDiffs = lengths.map(len => Math.pow(len - avgLength, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / lengths.length
    const stdDev = Math.round(Math.sqrt(variance))

    // Recommended range: avg ± 1 std dev
    const minRecommended = Math.max(50, avgLength - stdDev)
    const maxRecommended = avgLength + stdDev

    return NextResponse.json({
      count: lengths.length,
      avgLength,
      stdDev,
      minRecommended,
      maxRecommended,
    })
  } catch (error) {
    console.error('Caption stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

