-- ============================================================================
-- DROP EVERYTHING - Nuclear Option
-- ============================================================================
-- This drops ALL tables in the public schema, ALL functions, ALL storage

-- Drop all tables in public schema (dynamically)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop all functions
    FOR r IN (SELECT proname, oidvectortypes(proargtypes) as argtypes 
              FROM pg_proc INNER JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
              WHERE pg_namespace.nspname = 'public')
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.argtypes || ') CASCADE';
    END LOOP;
    
    -- Drop all views
    FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public')
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;
END $$;

-- Drop ALL storage buckets and objects
DO $$ 
DECLARE
    bucket_record RECORD;
BEGIN
    FOR bucket_record IN (SELECT id FROM storage.buckets)
    LOOP
        DELETE FROM storage.objects WHERE bucket_id = bucket_record.id;
        DELETE FROM storage.buckets WHERE id = bucket_record.id;
    END LOOP;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Done! Everything in public schema is now gone.
