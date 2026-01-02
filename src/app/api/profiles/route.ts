import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServiceClient()
    // Don't filter by is_active - show all profiles (some may have null is_active)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch profiles:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('Profiles fetched:', data?.length || 0)
    return NextResponse.json({ profiles: data || [] })
  } catch (err) {
    console.error('Profiles API error:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    )
  }
}

