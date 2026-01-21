import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Polling disabled; scrape runs synchronously now.' }, { status: 400 })
}
