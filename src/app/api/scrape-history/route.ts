import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { EventDiscovery } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const account = searchParams.get('account')

    if (!account) {
      return NextResponse.json({ error: 'Missing account' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('event_discovery')
      .select('created_at, posted_at_source, status')
      .eq('source_account', account)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const events = (data as Pick<EventDiscovery, 'created_at' | 'posted_at_source' | 'status'>[]) || []
    const lastIngestedAt = events[0]?.created_at || null

    const statusCounts: Record<string, number> = {}
    events.forEach((e) => {
      statusCounts[e.status] = (statusCounts[e.status] || 0) + 1
    })

    const recent = events.slice(0, 5)

    return NextResponse.json({
      account,
      lastIngestedAt,
      statusCounts,
      recent,
      total: events.length,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}

