-- Add support for SocialBu integration
-- This migration adds optional tables and fields for tracking multi-account posting

-- Optional: Table to store connected social media accounts
-- This allows tracking which SocialBu accounts are available for posting
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socialbu_account_id INTEGER UNIQUE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'facebook', 'linkedin', 'youtube')),
  account_name TEXT NOT NULL,
  username TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Automatically selected when scheduling
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active) WHERE is_active = true;

-- Add column to track which accounts a post was scheduled to (optional)
-- Stores array of SocialBu account IDs
ALTER TABLE event_discovery 
ADD COLUMN IF NOT EXISTS socialbu_account_ids INTEGER[] DEFAULT '{}';

-- Add column for engagement metrics (for future analytics)
ALTER TABLE event_discovery 
ADD COLUMN IF NOT EXISTS engagement_likes INTEGER DEFAULT 0;

ALTER TABLE event_discovery 
ADD COLUMN IF NOT EXISTS engagement_comments INTEGER DEFAULT 0;

ALTER TABLE event_discovery 
ADD COLUMN IF NOT EXISTS engagement_shares INTEGER DEFAULT 0;

-- Updated at trigger for social_accounts
DROP TRIGGER IF EXISTS update_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER update_social_accounts_updated_at
    BEFORE UPDATE ON social_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for social_accounts (allow all for now)
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on social_accounts" ON social_accounts
  FOR ALL USING (true) WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE social_accounts IS 'Stores connected SocialBu accounts for multi-platform posting';
COMMENT ON COLUMN event_discovery.meta_post_id IS 'SocialBu post ID for tracking scheduled/published posts';
COMMENT ON COLUMN event_discovery.socialbu_account_ids IS 'Array of SocialBu account IDs this post was scheduled to';
COMMENT ON COLUMN event_discovery.engagement_likes IS 'Number of likes from SocialBu insights';
COMMENT ON COLUMN event_discovery.engagement_comments IS 'Number of comments from SocialBu insights';
COMMENT ON COLUMN event_discovery.engagement_shares IS 'Number of shares from SocialBu insights';

