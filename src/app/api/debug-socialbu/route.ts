/**
 * GET /api/debug-socialbu
 * 
 * Debug endpoint to check SocialBu account IDs and profile configuration
 * 
 * Query params:
 * - verbose=true: Returns detailed logs of the mismatch analysis process
 */

import { NextRequest, NextResponse } from 'next/server';
import { SocialBuClient } from '@/lib/socialbu';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, createRequestLogger } from '@/lib/api-wrapper';
import type { Profile } from '@/types/database';

export const GET = withApiHandler(async (request: NextRequest, { correlationId }) => {
  const logger = createRequestLogger(correlationId, { endpoint: 'debug-socialbu' });
  
  // Check for verbose mode
  const verbose = request.nextUrl.searchParams.get('verbose') === 'true';
  const logs: string[] = [];
  
  const log = (message: string) => {
    if (verbose) {
      logs.push(`[${new Date().toISOString()}] ${message}`);
    }
    logger.debug(message);
  };

  log('Starting SocialBu debug analysis');
  
  // Get all SocialBu accounts
  log('Fetching SocialBu accounts...');
  const client = new SocialBuClient(undefined, { correlationId });
  const socialBuAccounts = await client.getAccounts();
  log(`Fetched ${socialBuAccounts.length} SocialBu accounts`);

  // Get all profiles from database
  log('Fetching profiles from database...');
  const supabase = await createClient();
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (profilesError) {
    logger.error('Failed to fetch profiles from database', { 
      correlationId,
      error: profilesError.message,
    });
    throw profilesError;
  }

  log(`Fetched ${profiles?.length || 0} profiles from database`);

  // Compare and find mismatches
  log('Analyzing profile-account matches...');
  const typedProfiles = profiles as Profile[] | null;
  const analysis = typedProfiles?.map(profile => {
    const matchingAccount = socialBuAccounts.find(
      acc => acc.id === profile.socialbu_account_id
    );

    const result = {
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

    if (!matchingAccount) {
      log(`MISMATCH: Profile "${profile.name}" (${profile.handle}) has SocialBu ID ${profile.socialbu_account_id} but no matching account found`);
    } else {
      log(`MATCH: Profile "${profile.name}" -> SocialBu account "${matchingAccount.name}" (@${matchingAccount.username})`);
    }

    return result;
  }) || [];

  const mismatches = analysis.filter(a => !a.account_found);
  log(`Analysis complete: ${analysis.length} total profiles, ${mismatches.length} mismatches`);

  logger.info('Debug analysis completed successfully', {
    correlationId,
    totalProfiles: analysis.length,
    totalAccounts: socialBuAccounts.length,
    mismatchCount: mismatches.length,
  });

  const response: any = {
    success: true,
    socialbu_accounts: socialBuAccounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      username: acc.username,
      type: acc.type,
      is_active: acc.is_active,
    })),
    profiles: analysis,
    mismatches,
    summary: {
      total_profiles: analysis.length,
      total_accounts: socialBuAccounts.length,
      mismatches: mismatches.length,
    },
  };

  if (verbose) {
    response.logs = logs;
  }

  return NextResponse.json(response);
});
