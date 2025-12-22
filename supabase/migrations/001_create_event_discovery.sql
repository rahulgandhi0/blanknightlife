-- BlankNightlife: Event Discovery Table
-- Run this in your Supabase SQL Editor

-- Table: event_discovery
CREATE TABLE IF NOT EXISTS event_discovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'scheduled', 'posted', 'archived', 'discarded')),
  source_account TEXT NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('image', 'carousel')),
  original_caption TEXT,
  ai_generated_caption TEXT,
  final_caption TEXT,
  media_urls JSONB NOT NULL DEFAULT '[]',
  ig_post_id TEXT UNIQUE NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  posted_at_source TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  meta_post_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for status queries (most common filter)
CREATE INDEX IF NOT EXISTS idx_event_discovery_status ON event_discovery(status);

-- Index for duplicate checking on ingest
CREATE INDEX IF NOT EXISTS idx_event_discovery_ig_post_id ON event_discovery(ig_post_id);

-- Index for scheduled posts (publisher cron job)
CREATE INDEX IF NOT EXISTS idx_event_discovery_scheduled ON event_discovery(scheduled_for) 
  WHERE status = 'scheduled';

-- Index for source account filtering
CREATE INDEX IF NOT EXISTS idx_event_discovery_source ON event_discovery(source_account);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_event_discovery_updated_at ON event_discovery;
CREATE TRIGGER update_event_discovery_updated_at
    BEFORE UPDATE ON event_discovery
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (but allow all for now - no auth)
ALTER TABLE event_discovery ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth required for this app)
CREATE POLICY "Allow all operations" ON event_discovery
  FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for posters (run separately in Storage settings or via API)
-- Note: Create a bucket called 'posters' with public access in Supabase Dashboard
-- Settings: Public bucket = ON, File size limit = 50MB

