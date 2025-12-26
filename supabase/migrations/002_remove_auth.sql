-- ============================================================================
-- REBUILD - Simplified Schema (No Auth)
-- ============================================================================
-- Run 000_drop_all.sql FIRST, then run this file
-- This creates a simplified schema without user authentication

-- ============================================================================
-- DROP EXISTING AUTH TRIGGER (if exists)
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- ============================================================================
-- CREATE STORAGE
-- ============================================================================

-- Create storage bucket for event posters
INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to posters
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posters');

-- Allow anyone to upload (no auth required)
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload" ON storage.objects;
CREATE POLICY "Anyone can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'posters');

-- Allow anyone to delete their uploads
DROP POLICY IF EXISTS "Anyone can delete" ON storage.objects;
CREATE POLICY "Anyone can delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'posters');

-- ============================================================================
-- CREATE FUNCTIONS
-- ============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROFILES TABLE (social media accounts/brands)
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Profile Identity
  name TEXT NOT NULL,
  handle TEXT,
  avatar_url TEXT,
  
  -- SocialBu Integration
  socialbu_account_id INTEGER NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN (
    'instagram', 'tiktok', 'twitter', 'facebook', 
    'linkedin', 'youtube', 'pinterest', 'reddit', 
    'mastodon', 'bluesky', 'google_business_profile', 'threads'
  )),
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_socialbu_account ON profiles(socialbu_account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- EVENT DISCOVERY TABLE (scraped content)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_discovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Profile scope
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'scheduled', 'posted', 'archived', 'discarded')) DEFAULT 'pending',
  
  -- Source information
  source_account TEXT NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('image', 'carousel')) DEFAULT 'image',
  
  -- Content
  original_caption TEXT,
  ai_generated_caption TEXT,
  final_caption TEXT,
  media_urls TEXT[] NOT NULL,
  
  -- Instagram metadata
  ig_post_id TEXT NOT NULL UNIQUE,
  is_pinned BOOLEAN DEFAULT false,
  posted_at_source TIMESTAMPTZ,
  
  -- Scheduling & posting
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  meta_post_id TEXT,
  
  -- SocialBu integration
  socialbu_post_id BIGINT,
  socialbu_account_ids BIGINT[],
  
  -- Engagement metrics
  engagement_likes INTEGER,
  engagement_comments INTEGER,
  engagement_shares INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_discovery_profile_id ON event_discovery(profile_id);
CREATE INDEX IF NOT EXISTS idx_event_discovery_status ON event_discovery(status);
CREATE INDEX IF NOT EXISTS idx_event_discovery_profile_status ON event_discovery(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_event_discovery_ig_post_id ON event_discovery(ig_post_id);
CREATE INDEX IF NOT EXISTS idx_event_discovery_scheduled_for ON event_discovery(scheduled_for);

DROP TRIGGER IF EXISTS update_event_discovery_updated_at ON event_discovery;
CREATE TRIGGER update_event_discovery_updated_at
  BEFORE UPDATE ON event_discovery
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SOCIAL ACCOUNTS TABLE (SocialBu accounts cache)
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Profile link (optional - can be unassigned)
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- SocialBu data
  socialbu_account_id INTEGER UNIQUE NOT NULL,
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL,
  username TEXT,
  profile_picture_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  extra_data JSONB DEFAULT '{}',
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_socialbu_id ON social_accounts(socialbu_account_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_profile_id ON social_accounts(profile_id);

DROP TRIGGER IF EXISTS update_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER update_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CAPTION EDITS TABLE (edit history tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS caption_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES event_discovery(id) ON DELETE CASCADE,
  previous_caption TEXT,
  new_caption TEXT NOT NULL,
  edited_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caption_edits_event_id ON caption_edits(event_id);

-- ============================================================================
-- SCRAPE HISTORY TABLE (track scraping runs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS scrape_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  account TEXT NOT NULL,
  posts_found INTEGER DEFAULT 0,
  posts_ingested INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_history_profile_id ON scrape_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_scrape_history_created_at ON scrape_history(created_at DESC);

-- ============================================================================
-- DISABLE RLS (No auth = open access)
-- ============================================================================
-- Since we removed auth, disable RLS or create permissive policies

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_discovery DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE caption_edits DISABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_history DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE profiles IS 'Social media profiles/brands. Each profile connects to a SocialBu account.';
COMMENT ON TABLE event_discovery IS 'Scraped Instagram posts for curation and reposting';
COMMENT ON TABLE social_accounts IS 'Connected SocialBu accounts for posting';
COMMENT ON TABLE caption_edits IS 'Edit history for captions';
COMMENT ON TABLE scrape_history IS 'History of scraping runs';

COMMENT ON COLUMN profiles.socialbu_account_id IS 'Links to SocialBu account ID for API integration';
COMMENT ON COLUMN event_discovery.profile_id IS 'Scopes content to a specific profile';

-- ============================================================================
-- COMPLETE! ✅
-- ============================================================================

