# BlankNightLife Database Setup

## Quick Start

### Fresh Database Setup

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `COMPLETE_RESET.sql`
4. Paste into the SQL Editor
5. Click **Run**

⚠️ **WARNING**: This will delete ALL existing data and recreate all tables from scratch.

## Database Schema

### Tables

1. **profiles** - Social media profiles/accounts managed by the app
2. **event_discovery** - Instagram posts scraped and processed
3. **social_accounts** - Social media accounts synced from SocialBu
4. **caption_edits** - Caption edit history for AI learning
5. **scrape_history** - Audit log of scraping operations
6. **scrape_automations** - Automated scraping schedules

### Key Features

- ✅ Profile-based multi-account management
- ✅ Instagram post scraping and ingestion
- ✅ AI caption generation with reinforcement learning
- ✅ SocialBu integration for scheduling and publishing
- ✅ Automated scraping with configurable frequency
- ✅ Complete audit trail of all operations

## Schema Updates

If you need to make schema changes:

1. Edit `COMPLETE_RESET.sql` directly
2. Run the entire script to apply changes
3. All data will be wiped - export important data first if needed

## Environment Variables Required

Make sure these are set in your `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# SocialBu
SOCIALBU_API_KEY=your_socialbu_api_key

# AI (Groq)
GROQ_API_KEY=your_groq_api_key

# Apify (for scraping)
APIFY_API_TOKEN=your_apify_token
APIFY_ACTOR_ID=apify~instagram-api-scraper

# GitHub Actions (for automations)
CRON_SECRET=your_random_secret_string
BASE_URL=https://your-app.vercel.app
```

## Troubleshooting

### "Permission denied" errors
- Make sure you're running the script as a superuser or with sufficient privileges
- Check that the service_role key is being used for admin operations

### "Table already exists" errors
- The script should handle this with `DROP TABLE IF EXISTS`
- If issues persist, manually drop tables in Supabase dashboard first

### RLS (Row Level Security) issues
- RLS is currently disabled for simplicity
- Enable RLS and create policies if you need user-level access control

## Support

For issues or questions, check the main README.md in the project root.
