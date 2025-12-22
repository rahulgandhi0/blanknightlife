import { NextRequest, NextResponse } from 'next/server'
import { testCaption } from '@/lib/groq'

// POST /api/test-caption
// Test the AI caption rewriting without saving to database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { caption, source, context } = body

    if (!caption) {
      return NextResponse.json(
        { error: 'Missing caption in request body' },
        { status: 400 }
      )
    }

    const result = await testCaption(caption, source || 'test_venue', context)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Test caption error:', error)
    return NextResponse.json(
      { error: 'Failed to generate caption', details: String(error) },
      { status: 500 }
    )
  }
}

// GET /api/test-caption - Usage info
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test-caption',
    method: 'POST',
    description: 'Test the AI caption rewriter without saving to database',
    body: {
      caption: 'The original caption text to rewrite (required)',
      source: 'The source account handle (optional, defaults to test_venue)',
    },
    example: {
      caption: 'Friday night at Temple SF! DJ Awesome spinning all night. Doors at 10pm, 21+. Tickets at link in bio!',
      source: 'temple_sf',
    },
  })
}

