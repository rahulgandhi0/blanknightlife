-- ============================================================================
-- REBUILD - Complete Multi-Tenant Schema
-- ============================================================================
-- This migration rebuilds the database with full multi-tenant architecture
-- Run 000_drop_all.sql FIRST, then run this file

-- ============================================================================
-- CREATE STORAGE
-- ============================================================================

-- Create storage bucket for event posters
INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to posters
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posters');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'posters');

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
-- USERS TABLE (extends Supabase Auth)
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PROFILES TABLE (social media accounts/brands)
-- ============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Profile Identity
  name TEXT NOT NULL,
  handle TEXT,
  avatar_url TEXT,
  
  -- SocialBu Integration
  socialbu_account_id INTEGER NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN (
    'instagram', 'tiktok', 'twitter', 'facebook', 
    'linkedin', 'youtube', 'pinterest', 'reddit', 
    'mastodon', 'bluesky', 'google_business_profile', 'threads'
  )),
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure user can't add same SocialBu account twice
  UNIQUE(user_id, socialbu_account_id)
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_socialbu_account ON profiles(socialbu_account_id);
CREATE INDEX idx_profiles_active ON profiles(is_active) WHERE is_active = true;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- EVENT DISCOVERY TABLE (scraped content)
-- ============================================================================

CREATE TABLE event_discovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Multi-tenant scope
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
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
  ig_post_id TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  posted_at_source TIMESTAMPTZ,
  
  -- Scheduling & posting
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  meta_post_id TEXT,
  
  -- SocialBu integration
  socialbu_post_id BIGINT,
  socialbu_account_ids BIGINT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure no duplicate posts from same source
  UNIQUE(ig_post_id)
);

CREATE INDEX idx_event_discovery_profile_id ON event_discovery(profile_id);
CREATE INDEX idx_event_discovery_user_id ON event_discovery(user_id);
CREATE INDEX idx_event_discovery_status ON event_discovery(status);
CREATE INDEX idx_event_discovery_profile_status ON event_discovery(profile_id, status);
CREATE INDEX idx_event_discovery_ig_post_id ON event_discovery(ig_post_id);
CREATE INDEX idx_event_discovery_scheduled_for ON event_discovery(scheduled_for);

CREATE TRIGGER update_event_discovery_updated_at
  BEFORE UPDATE ON event_discovery
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SOCIAL ACCOUNTS TABLE (SocialBu accounts)
-- ============================================================================

CREATE TABLE social_accounts (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  
  -- Multi-tenant scope
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- SocialBu data
  socialbu_account_id BIGINT UNIQUE NOT NULL,
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL,
  username TEXT,
  profile_picture_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  extra_data JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_accounts_socialbu_id ON social_accounts(socialbu_account_id);
CREATE INDEX idx_social_accounts_profile_id ON social_accounts(profile_id);

CREATE TRIGGER update_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CAPTION EDITS TABLE (edit history tracking)
-- ============================================================================

CREATE TABLE caption_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES event_discovery(id) ON DELETE CASCADE,
  previous_caption TEXT,
  new_caption TEXT NOT NULL,
  edited_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_caption_edits_event_id ON caption_edits(event_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_discovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE caption_edits ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Profiles table policies
CREATE POLICY "Users can view own profiles"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profiles"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles"
  ON profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Event discovery policies (profile-scoped)
CREATE POLICY "Users can view own profile events"
  ON event_discovery FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create events for own profiles"
  ON event_discovery FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile events"
  ON event_discovery FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile events"
  ON event_discovery FOR DELETE
  USING (auth.uid() = user_id);

-- Social accounts policies
CREATE POLICY "Users can view own profile social accounts"
  ON social_accounts FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR profile_id IS NULL -- Allow viewing unassigned accounts
  );

CREATE POLICY "Users can manage own profile social accounts"
  ON social_accounts FOR ALL
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Caption edits policies
CREATE POLICY "Users can view own caption edits"
  ON caption_edits FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM event_discovery WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create caption edits"
  ON caption_edits FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT id FROM event_discovery WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user record on auth signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts - extends Supabase auth.users';
COMMENT ON TABLE profiles IS 'Social media profiles/brands managed by users. Each profile is a separate account (e.g., Drexel, SF, NYC)';
COMMENT ON TABLE event_discovery IS 'Scraped Instagram posts for curation and reposting';
COMMENT ON TABLE social_accounts IS 'Connected SocialBu accounts for posting';
COMMENT ON TABLE caption_edits IS 'Edit history for captions';

COMMENT ON COLUMN profiles.socialbu_account_id IS 'Links to SocialBu account ID for API integration';
COMMENT ON COLUMN event_discovery.profile_id IS 'Scopes content to a specific profile - ensures no crossover between accounts';
COMMENT ON COLUMN event_discovery.user_id IS 'Denormalized user_id for faster user-level queries';

-- ============================================================================
-- COMPLETE! ✅
-- ============================================================================
-- Your multi-tenant database is ready!
-- Next steps:
--   1. Sign up at /auth/signup
--   2. Create your first profile
--   3. Start curating content!

