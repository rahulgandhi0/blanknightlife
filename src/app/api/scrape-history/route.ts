import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const account = searchParams.get('account')
    const limit = parseInt(searchParams.get('limit') || '30', 10)

    const supabase = createServiceClient()

    // If account is provided, return old format for backward compatibility
    if (account) {
      const { data, error } = await supabase
        .from('scrape_history')
        .select('created_at, status, posts_found, posts_ingested')
        .eq('account', account)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const scrapes = data || []
      const lastIngestedAt = scrapes[0]?.created_at || null

      const statusCounts: Record<string, number> = {}
      scrapes.forEach((s) => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1
      })

      const recent = scrapes.slice(0, 5)

      return NextResponse.json({
        account,
        lastIngestedAt,
        statusCounts,
        recent,
        total: scrapes.length,
      })
    }

    // Fetch all scrapes (for activity log)
    const { data, error } = await supabase
      .from('scrape_history')
      .select('id, profile_id, account, posts_found, posts_ingested, status, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      scrapes: data || [],
      total: data?.length || 0,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}

