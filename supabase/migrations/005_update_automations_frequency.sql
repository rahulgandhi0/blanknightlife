-- ============================================================================
-- UPDATE AUTOMATIONS TO USE frequency_hours
-- ============================================================================
-- Run this in Supabase SQL Editor to update the automations table

-- Add new column
ALTER TABLE scrape_automations ADD COLUMN IF NOT EXISTS frequency_hours INTEGER DEFAULT 24;

-- Migrate old frequency values to hours
UPDATE scrape_automations SET frequency_hours = CASE
  WHEN frequency = 'hourly' THEN 1
  WHEN frequency = 'daily' THEN 24
  WHEN frequency = 'weekly' THEN 168
  ELSE 24
END WHERE frequency_hours IS NULL OR frequency_hours = 24;

-- Drop old columns (optional - can keep for compatibility)
-- ALTER TABLE scrape_automations DROP COLUMN IF EXISTS frequency;
-- ALTER TABLE scrape_automations DROP COLUMN IF EXISTS run_on_days;

