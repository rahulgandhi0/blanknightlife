-- ============================================================================
-- ADD SCRAPE AUTOMATIONS TABLE
-- ============================================================================
-- Run this in Supabase SQL Editor to add automated scraping support

-- SCRAPE AUTOMATIONS TABLE
CREATE TABLE IF NOT EXISTS scrape_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- What to scrape
  account_handle TEXT NOT NULL,  -- Instagram handle to scrape (without @)
  days_back INTEGER NOT NULL DEFAULT 3,  -- How many days back to scrape
  
  -- When to scrape
  frequency TEXT NOT NULL DEFAULT 'daily',  -- 'hourly', 'daily', 'weekly'
  run_at_hour INTEGER DEFAULT 9,  -- Hour of day to run (0-23, in UTC)
  run_at_minute INTEGER DEFAULT 0,  -- Minute of hour (0-59)
  run_on_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],  -- Days of week (0=Sunday)
  
  -- Status tracking
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,  -- 'success', 'failed', 'running'
  last_run_result JSONB,  -- Store run details
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scrape_automations_profile_id ON scrape_automations(profile_id);
CREATE INDEX IF NOT EXISTS idx_scrape_automations_active ON scrape_automations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scrape_automations_next_run ON scrape_automations(next_run_at) WHERE is_active = true;

-- Update trigger
CREATE TRIGGER update_scrape_automations_updated_at
  BEFORE UPDATE ON scrape_automations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON scrape_automations TO anon;
GRANT ALL ON scrape_automations TO authenticated;
GRANT ALL ON scrape_automations TO service_role;

