/**
 * GET /api/debug-socialbu
 * 
 * Debug endpoint to check SocialBu account IDs and profile configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { SocialBuClient } from '@/lib/socialbu';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Get all SocialBu accounts
    const client = new SocialBuClient();
    const socialBuAccounts = await client.getAccounts();

    // Get all profiles from database
    const supabase = await createClient();
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      throw profilesError;
    }

    // Compare and find mismatches
    const analysis = profiles?.map(profile => {
      const matchingAccount = socialBuAccounts.find(
        acc => acc.id === profile.socialbu_account_id
      );

      return {
        profile_id: profile.id,
        profile_name: profile.name,
        profile_handle: profile.handle,
        stored_socialbu_id: profile.socialbu_account_id,
        account_found: !!matchingAccount,
        account_name: matchingAccount?.name || 'NOT FOUND',
        account_username: matchingAccount?.username || 'NOT FOUND',
        account_type: matchingAccount?.type || 'NOT FOUND',
        is_active: matchingAccount?.is_active ?? false,
      };
    }) || [];

    return NextResponse.json({
      success: true,
      socialbu_accounts: socialBuAccounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        username: acc.username,
        type: acc.type,
        is_active: acc.is_active,
      })),
      profiles: analysis,
      mismatches: analysis.filter(a => !a.account_found),
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
