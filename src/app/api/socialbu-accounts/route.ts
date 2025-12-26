/**
 * GET /api/socialbu-accounts
 * 
 * Fetches all connected social media accounts from SocialBu.
 * Use this to get account IDs for multi-account posting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SocialBuClient } from '@/lib/socialbu';

export async function GET(request: NextRequest) {
  try {
    const client = new SocialBuClient();
    const accounts = await client.getAccounts();

    return NextResponse.json({
      success: true,
      accounts,
      count: accounts.length,
    });
  } catch (error) {
    console.error('Error fetching SocialBu accounts:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        accounts: [],
      },
      { status: 500 }
    );
  }
}

