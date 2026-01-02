# Database Reset Instructions

## ⚠️ WARNING

**This will DELETE ALL DATA including:**
- All profiles
- All scraped events/posts
- All automation schedules
- All scrape history
- All stored images in the `posters` bucket
- All caption edits

## When to Reset

Reset the database when you need to:
- Start fresh with clean data
- Fix corrupted database state
- Remove all test/bad data
- Rebuild schema from scratch

## How to Reset

### Step 1: Backup (Optional but Recommended)

If you want to keep any data, export it first:

1. Go to Supabase Dashboard → Table Editor
2. Select each table you want to backup
3. Click "Export" → Download as CSV

### Step 2: Run the Reset Script

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Click **+ New query**
4. Copy the **entire contents** of `supabase/FRESH_RESET.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press Ctrl+Enter / Cmd+Enter)

### Step 3: Verify

The script will output:
```
Database reset complete! All tables recreated.
```

Followed by a list of all tables in the public schema:
- caption_edits
- event_discovery  
- profiles
- scrape_automations
- scrape_history
- social_accounts

### Step 4: Create Your First Profile

1. Go to **Accounts** page in your app
2. Click **Refresh** to see your SocialBu accounts
3. Copy the account ID
4. Go to **Profiles → New**
5. Enter profile name and paste the account ID
6. Submit

## What Gets Reset

| Item | Action |
|------|--------|
| All tables | Dropped and recreated |
| All data | Deleted |
| All functions | Dropped and recreated |
| Storage bucket `posters` | Cleared and recreated |
| Storage policies | Reset to defaults |
| Row Level Security | Disabled (as before) |
| Permissions | Granted to anon/authenticated/service_role |

## What Does NOT Get Reset

| Item | Status |
|------|--------|
| Supabase project settings | Unchanged |
| Environment variables | Unchanged |
| API keys | Unchanged |
| Auth users | Unchanged |
| Other storage buckets | Unchanged |

## Troubleshooting

### "Permission denied" errors

Make sure you're running the script as the **postgres** user or have sufficient permissions. If you're on the free tier, you should have full access.

### "Cannot drop table because other objects depend on it"

The script uses `CASCADE` which should handle all dependencies. If it still fails, try running the DROP section twice.

### Tables not appearing

Refresh the Table Editor or run:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

### Storage bucket errors

If the storage bucket fails to recreate:
1. Go to Storage in Supabase Dashboard
2. Manually delete the `posters` bucket
3. Run the reset script again

## After Reset

1. Create at least one profile
2. Set up your automations (optional)
3. Run a test scrape to verify everything works
4. Check that images are being uploaded to the `posters` bucket

## Need Help?

If the reset fails or you encounter issues:
1. Check the error message in the SQL Editor
2. Copy the exact error text
3. Try running individual sections of the script
4. Contact support or check Supabase docs

