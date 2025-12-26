-- Run this in Supabase SQL Editor to verify the trigger exists

-- Check if the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check if the function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- If no results, the trigger isn't set up!
-- Re-run: supabase/migrations/001_rebuild_multi_tenant.sql

