-- ============================================================================
-- BLANKNIGHTLIFE - COMPLETE DATABASE RESET
-- ============================================================================
-- Complete database wipe and rebuild from scratch
-- ⚠️  WARNING: This will DELETE ALL DATA ⚠️
--
-- This script creates a fresh database with all tables, indexes, and 
-- configurations needed for the BlankNightLife application.
--
-- To execute: Copy and paste this entire script into Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EVERYTHING (Clean Slate)
-- ============================================================================

-- Drop all triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles CASCADE;
DROP TRIGGER IF EXISTS update_event_discovery_updated_at ON event_discovery CASCADE;
DROP TRIGGER IF EXISTS update_social_accounts_updated_at ON social_accounts CASCADE;
DROP TRIGGER IF EXISTS update_scrape_automations_updated_at ON scrape_automations CASCADE;

-- Drop all tables in public schema
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Drop all functions
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT proname, oidvectortypes(proargtypes) as argtypes 
              FROM pg_proc INNER JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
              WHERE pg_namespace.nspname = 'public')
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.argtypes || ') CASCADE';
    END LOOP;
END $$;

-- Drop storage bucket and all objects
DO $$ 
BEGIN
    DELETE FROM storage.objects WHERE bucket_id = 'posters';
    DELETE FROM storage.buckets WHERE id = 'posters';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop storage policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public read access" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can upload" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can delete" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- STEP 2: CREATE STORAGE BUCKET
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posters');

CREATE POLICY "Anyone can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'posters');

CREATE POLICY "Anyone can delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'posters');

-- ============================================================================
-- STEP 3: CREATE HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: CREATE TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- PROFILES TABLE
-- Each profile represents a social media account (linked to SocialBu)
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  handle TEXT,
  avatar_url TEXT,
  socialbu_account_id INTEGER NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'instagram',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_socialbu_account ON profiles(socialbu_account_id);
CREATE INDEX idx_profiles_active ON profiles(is_active) WHERE is_active = true;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE profiles IS 'Social media profiles/accounts managed by the app';
COMMENT ON COLUMN profiles.socialbu_account_id IS 'Links to SocialBu account ID for publishing';

-- -----------------------------------------------------------------------------
-- EVENT DISCOVERY TABLE
-- Stores Instagram posts that have been scraped and processed
-- -----------------------------------------------------------------------------
CREATE TABLE event_discovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Post status and metadata
  status TEXT NOT NULL DEFAULT 'pending',
  source_account TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'image',
  
  -- Captions (original → AI → final)
  original_caption TEXT,
  ai_generated_caption TEXT,
  ai_context TEXT,
  final_caption TEXT,
  
  -- Media
  media_urls TEXT[] NOT NULL,
  source_media_urls TEXT[],
  ig_post_id TEXT NOT NULL UNIQUE,
  is_pinned BOOLEAN DEFAULT false,
  
  -- Timestamps
  posted_at_source TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  
  -- SocialBu integration
  meta_post_id TEXT,
  socialbu_post_id BIGINT,
  socialbu_account_ids BIGINT[],
  
  -- Engagement metrics
  engagement_likes INTEGER,
  engagement_comments INTEGER,
  engagement_shares INTEGER,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'scheduling', 'scheduled', 'posted', 'archived', 'discarded')),
  CONSTRAINT valid_post_type CHECK (post_type IN ('image', 'carousel', 'reel'))
);

CREATE INDEX idx_event_discovery_profile_id ON event_discovery(profile_id);
CREATE INDEX idx_event_discovery_status ON event_discovery(status);
CREATE INDEX idx_event_discovery_profile_status ON event_discovery(profile_id, status);
CREATE INDEX idx_event_discovery_ig_post_id ON event_discovery(ig_post_id);
CREATE INDEX idx_event_discovery_source_account ON event_discovery(source_account);
CREATE INDEX idx_event_discovery_scheduled_for ON event_discovery(scheduled_for) WHERE scheduled_for IS NOT NULL;

CREATE TRIGGER update_event_discovery_updated_at
  BEFORE UPDATE ON event_discovery
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE event_discovery IS 'Instagram posts scraped from source accounts';
COMMENT ON COLUMN event_discovery.status IS 'Workflow status: pending → approved → scheduling → scheduled → posted';
COMMENT ON COLUMN event_discovery.post_type IS 'Type of Instagram post: image, carousel, or reel';

-- -----------------------------------------------------------------------------
-- SOCIAL ACCOUNTS TABLE
-- Stores social media accounts from SocialBu
-- -----------------------------------------------------------------------------
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  socialbu_account_id INTEGER UNIQUE NOT NULL,
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL,
  username TEXT,
  profile_picture_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  extra_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_accounts_socialbu_id ON social_accounts(socialbu_account_id);
CREATE INDEX idx_social_accounts_profile_id ON social_accounts(profile_id);
CREATE INDEX idx_social_accounts_platform ON social_accounts(platform);

CREATE TRIGGER update_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE social_accounts IS 'Social media accounts synced from SocialBu';

-- -----------------------------------------------------------------------------
-- CAPTION EDITS TABLE
-- Tracks caption edit history for reinforcement learning
-- -----------------------------------------------------------------------------
CREATE TABLE caption_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES event_discovery(id) ON DELETE CASCADE,
  previous_caption TEXT,
  new_caption TEXT NOT NULL,
  edited_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_caption_edits_event_id ON caption_edits(event_id);
CREATE INDEX idx_caption_edits_created_at ON caption_edits(created_at DESC);

COMMENT ON TABLE caption_edits IS 'Caption edit history for AI learning and tracking';

-- -----------------------------------------------------------------------------
-- SCRAPE HISTORY TABLE
-- Logs all scrape operations (manual and automated)
-- -----------------------------------------------------------------------------
CREATE TABLE scrape_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  account TEXT NOT NULL,
  posts_found INTEGER DEFAULT 0,
  posts_ingested INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_scrape_status CHECK (status IN ('success', 'partial', 'error'))
);

CREATE INDEX idx_scrape_history_profile_id ON scrape_history(profile_id);
CREATE INDEX idx_scrape_history_created_at ON scrape_history(created_at DESC);
CREATE INDEX idx_scrape_history_account ON scrape_history(account);

COMMENT ON TABLE scrape_history IS 'Audit log of all scraping operations';

-- -----------------------------------------------------------------------------
-- SCRAPE AUTOMATIONS TABLE
-- Manages automated scraping schedules
-- -----------------------------------------------------------------------------
CREATE TABLE scrape_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- What to scrape
  account_handle TEXT NOT NULL,
  days_back INTEGER NOT NULL DEFAULT 3,
  
  -- When to scrape (frequency in hours)
  frequency_hours INTEGER DEFAULT 36,  -- Frequency in hours (e.g., 1, 6, 12, 24, 36, 48, 168)
  run_at_hour INTEGER DEFAULT 9,
  run_at_minute INTEGER DEFAULT 0,
  
  -- Status tracking
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_result JSONB,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_automation_status CHECK (last_run_status IS NULL OR last_run_status IN ('success', 'failed', 'running')),
  CONSTRAINT unique_profile_account UNIQUE (profile_id, account_handle)
);

CREATE INDEX idx_scrape_automations_profile_id ON scrape_automations(profile_id);
CREATE INDEX idx_scrape_automations_active ON scrape_automations(is_active) WHERE is_active = true;
CREATE INDEX idx_scrape_automations_next_run ON scrape_automations(next_run_at) WHERE is_active = true;

CREATE TRIGGER update_scrape_automations_updated_at
  BEFORE UPDATE ON scrape_automations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE scrape_automations IS 'Automated scraping schedules for Instagram accounts';
COMMENT ON COLUMN scrape_automations.frequency_hours IS 'Hours between scrape runs (e.g., 1=hourly, 24=daily, 168=weekly)';
COMMENT ON CONSTRAINT unique_profile_account ON scrape_automations IS 'Prevents duplicate automations per account';

-- -----------------------------------------------------------------------------
-- CRON JOB: Cleanup orphaned 'scheduling' events (WAL-Lite safety net)
-- -----------------------------------------------------------------------------
-- This function checks for events stuck in 'scheduling' status for >5 minutes
-- and reverts them to 'approved' so users can retry scheduling.
-- 
-- To enable this cron job in Supabase:
-- 1. Go to Database → Extensions → Enable "pg_cron"
-- 2. Run the cron schedule command below in SQL Editor
-- 3. The job will run every 5 minutes automatically
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cleanup_orphaned_scheduling_events()
RETURNS void AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Find events stuck in 'scheduling' for more than 5 minutes
  -- and revert them to 'approved' so they can be retried
  UPDATE event_discovery
  SET 
    status = 'approved',
    updated_at = NOW()
  WHERE 
    status = 'scheduling'
    AND updated_at < NOW() - INTERVAL '5 minutes';
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  IF affected_count > 0 THEN
    RAISE NOTICE 'Cleaned up % orphaned scheduling event(s)', affected_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_orphaned_scheduling_events IS 'WAL-Lite safety net: Reverts events stuck in scheduling status for >5 minutes';

-- Schedule the cron job to run every 5 minutes
-- Uncomment the line below after enabling pg_cron extension:
-- SELECT cron.schedule('cleanup-orphaned-scheduling', '*/5 * * * *', 'SELECT cleanup_orphaned_scheduling_events();');

-- ============================================================================
-- STEP 5: DISABLE RLS & GRANT PERMISSIONS
-- ============================================================================
-- Note: RLS is disabled for simplicity. Enable and configure policies for production.

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_discovery DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE caption_edits DISABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_automations DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- ============================================================================
-- STEP 6: VERIFICATION
-- ============================================================================

SELECT 'Database reset complete! ✅' as status;

SELECT 
  tablename as "Table Name",
  schemaname as "Schema"
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

SELECT 
  table_name as "Table",
  column_name as "Column",
  data_type as "Type",
  is_nullable as "Nullable"
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- DONE! 🎉
-- ============================================================================
-- Your database is now ready for use with BlankNightLife!
-- 
-- Next steps:
-- 1. Create your first profile via the app
-- 2. Link it to a SocialBu account
-- 3. Start scraping Instagram posts
-- ============================================================================
