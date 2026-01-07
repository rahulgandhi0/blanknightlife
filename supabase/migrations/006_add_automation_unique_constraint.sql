-- Migration: Add unique constraint for (profile_id, account_handle) in scrape_automations
-- This prevents duplicate automations for the same account within a profile

-- Step 1: Remove duplicate automations, keeping only the most recent one per (profile_id, account_handle)
-- This handles existing duplicates before adding the constraint
DELETE FROM scrape_automations
WHERE id NOT IN (
  SELECT DISTINCT ON (profile_id, account_handle) id
  FROM scrape_automations
  ORDER BY profile_id, account_handle, created_at DESC
);

-- Step 2: Add unique constraint (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_profile_account'
  ) THEN
    ALTER TABLE scrape_automations 
    ADD CONSTRAINT unique_profile_account 
    UNIQUE (profile_id, account_handle);
    
    COMMENT ON CONSTRAINT unique_profile_account ON scrape_automations IS 
    'Ensures each profile can only have one automation per Instagram account';
  END IF;
END $$;
