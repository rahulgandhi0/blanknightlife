# BlankNightLife

Automated Instagram content curation and scheduling platform for nightlife venues and promoters.

**Scrapes → AI rewrites → You approve → Auto-posts**

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Automation System](#automation-system)
- [Integrations](#integrations)
- [Development](#development)
- [Deployment](#deployment)

---

## Overview

BlankNightLife automates the content curation workflow for nightlife social media accounts:

1. **Scrape** Instagram posts from venue accounts via Apify
2. **AI Rewrite** captions using Groq (Llama 3.1)
3. **Review & Approve** posts in a clean dashboard
4. **Schedule** posts to SocialBu for automated publishing

### Key Features

- **Multi-tenant**: Support multiple profiles/venues
- **Automated Scraping**: Schedule recurring scrapes (every 36h)
- **AI Caption Generation**: Minimalist, nightlife-optimized captions
- **Manual & Automated Workflows**: Scrape on-demand or via automations
- **SocialBu Integration**: Direct scheduling and posting
- **Scrape History**: Track all scraping activity
- **Image Management**: Supabase Storage for persistent images

---

## Architecture

### Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (images)
- **AI**: Groq API (Llama 3.1-70b)
- **Scraping**: Apify (Instagram scrapers)
- **Publishing**: SocialBu API
- **Hosting**: Vercel

### Data Flow

```
Apify Scraper
    ↓
/api/apify-trigger (or automation)
    ↓
Download images → Supabase Storage
    ↓
Generate captions → Groq AI
    ↓
Insert into event_discovery table (status: pending)
    ↓
User reviews in Dashboard
    ↓
Approve → Schedule to SocialBu
    ↓
Posted via SocialBu
```

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Groq API key (free tier available)
- Apify account (for scraping)
- SocialBu account (for posting)

### 1. Clone & Install

```bash
git clone <repo-url>
cd blanknightlife
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/FRESH_RESET.sql`
3. Copy your project URL and keys from **Settings → API**

### 3. Configure Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# AI & Scraping
GROQ_API_KEY=gsk_xxx
APIFY_API_TOKEN=apify_api_xxx

# Publishing
SOCIALBU_API_KEY=xxx

# Optional: Automation trigger secret
CRON_SECRET=your_secret_here
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Create Your First Profile

1. Go to **Accounts** page
2. Click **Refresh** to load your SocialBu accounts
3. Copy an account ID
4. Go to **Profiles → New** and create a profile with that ID

### 6. Scrape Content

1. Go to **Scrape Now** page
2. Enter an Instagram username (e.g., `@templeSF`)
3. Set time range (e.g., 3 days)
4. Click **Scrape Profile**
5. View results in **Pending** tab

---

## Database Schema

### Tables

#### `profiles`

Represents a social media account/venue.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Display name |
| handle | TEXT | Instagram handle |
| socialbu_account_id | INTEGER | SocialBu account ID (unique) |
| platform | TEXT | Platform (default: instagram) |
| is_active | BOOLEAN | Active status |

#### `event_discovery`

Scraped Instagram posts.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| profile_id | UUID | Foreign key to profiles |
| status | TEXT | pending/scheduled/posted/discarded |
| source_account | TEXT | Instagram account scraped from |
| post_type | TEXT | image/video/sidecar |
| original_caption | TEXT | Original Instagram caption |
| ai_generated_caption | TEXT | AI-rewritten caption |
| final_caption | TEXT | User-edited final caption |
| media_urls | TEXT[] | Array of image/video URLs |
| ig_post_id | TEXT | Instagram post ID (unique) |
| posted_at_source | TIMESTAMPTZ | When posted on Instagram |
| scheduled_for | TIMESTAMPTZ | Scheduled publish time |
| socialbu_post_id | BIGINT | SocialBu post ID |

#### `scrape_automations`

Automated scraping schedules.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| profile_id | UUID | Foreign key to profiles |
| account_handle | TEXT | Instagram handle to scrape |
| days_back | INTEGER | Days to look back (fixed: 3) |
| frequency_hours | INTEGER | Hours between scrapes (fixed: 36) |
| run_at_hour | INTEGER | Hour to run (UTC 0-23) |
| run_at_minute | INTEGER | Minute to run (0-59) |
| is_active | BOOLEAN | Active status |
| last_run_at | TIMESTAMPTZ | Last execution time |
| last_run_status | TEXT | success/failed/running |
| next_run_at | TIMESTAMPTZ | Next scheduled run |
| run_count | INTEGER | Total runs |

#### `scrape_history`

Logs all scraping operations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| profile_id | UUID | Foreign key to profiles |
| account | TEXT | Instagram handle scraped |
| posts_found | INTEGER | Posts found by scraper |
| posts_ingested | INTEGER | Posts inserted to DB |
| status | TEXT | success/failed/partial |
| error_message | TEXT | Error details (if failed) |
| created_at | TIMESTAMPTZ | Scrape timestamp |

---

## API Endpoints

### Scraping

#### `POST /api/apify-trigger`

Trigger a scrape (manual or automated).

**Body:**
```json
{
  "account": "username",
  "sinceHours": 72,
  "profile_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "found": 5,
  "ingestResult": {
    "processed": 5,
    "skipped": 0
  }
}
```

### Automations

#### `GET /api/automations?profile_id=uuid`

List all automations for a profile.

#### `POST /api/automations`

Create new automation.

**Body:**
```json
{
  "profile_id": "uuid",
  "account_handle": "username",
  "run_at_hour": 17,
  "run_at_minute": 0
}
```

#### `GET /api/automations/trigger?secret=xxx`

Trigger automation cron job. Called by Vercel Cron or external scheduler.

### Events

#### `GET /api/events?profile_id=uuid&status=pending`

List events (posts) by status.

#### `PATCH /api/events`

Update event (approve, schedule, edit caption).

**Body:**
```json
{
  "id": "uuid",
  "status": "scheduled",
  "scheduled_for": "2024-01-15T19:00:00Z",
  "final_caption": "Updated caption"
}
```

### SocialBu

#### `POST /api/socialbu-schedule`

Schedule a post to SocialBu.

**Body:**
```json
{
  "event_id": "uuid",
  "profile_id": "uuid",
  "scheduled_for": "2024-01-15T19:00:00Z"
}
```

---

## Automation System

### How It Works

1. **Create Automation**: User specifies Instagram handle and time of day
2. **Fixed Schedule**: All automations run every 36 hours
3. **Trigger**: `/api/automations/trigger` checks for due automations
4. **Scrape**: Fetches posts from last 36h (or 5 days if first run)
5. **Process**: Downloads images, generates captions, inserts to DB
6. **Log**: Records result in `scrape_history`
7. **Update**: Sets `next_run_at` to 36 hours from now

### Setting Up Cron

#### Option 1: Vercel Cron (Recommended)

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/automations/trigger?secret=YOUR_SECRET",
    "schedule": "*/15 * * * *"
  }]
}
```

#### Option 2: External Cron

Use cron-job.org or similar to hit:
```
https://yourdomain.com/api/automations/trigger?secret=YOUR_SECRET
```

Every 15 minutes.

### Fallback Window

- **First run**: Scrapes last 5 days (120 hours)
- **Subsequent runs**: Scrapes since `last_run_at` (~36 hours)

This ensures no posts are missed if automation is delayed.

---

## Integrations

### Apify

**Purpose**: Scrape Instagram posts

**Actors Used:**
- `apify/instagram-api-scraper` (primary)
- `apify/instagram-post-scraper` (fallback)

**Configuration:**

```javascript
{
  directUrls: [`https://www.instagram.com/${username}/`],
  resultsLimit: 25,
  onlyPostsNewerThan: "72 hours",
  resultsType: "posts"
}
```

### Groq

**Purpose**: AI caption generation

**Model**: `llama-3.1-70b-versatile`

**Prompt Style**: Minimalist, nightlife-focused, removes emojis and promotional language

### SocialBu

**Purpose**: Schedule and publish posts

**Key Endpoints:**
- `/accounts` - List connected accounts
- `/publishing/create` - Schedule a post

**Webhook**: `/api/socialbu-postback` receives publish notifications

---

## Development

### Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   ├── (pages)/          # Page components
│   └── globals.css       # Global styles
├── components/           # Reusable UI components
│   ├── ui/              # shadcn/ui components
│   └── *.tsx            # Custom components
├── contexts/            # React contexts
├── hooks/               # Custom hooks
├── lib/                 # Utilities
│   ├── groq.ts         # AI caption generation
│   ├── socialbu.ts     # SocialBu API client
│   └── supabase/       # Supabase clients
└── types/              # TypeScript types
```

### Key Libraries

- **UI**: shadcn/ui, Tailwind, Lucide icons
- **Forms**: React Hook Form
- **Dates**: date-fns
- **HTTP**: Native fetch

### Adding a New Feature

1. **Database**: Add/modify tables in `supabase/FRESH_RESET.sql`
2. **Types**: Update `src/types/database.ts`
3. **API**: Create route in `src/app/api/`
4. **UI**: Add page/component in `src/app/` or `src/components/`
5. **Test**: Run locally, verify in UI

---

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

**Environment Variables in Vercel:**

Go to **Settings → Environment Variables** and add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `APIFY_API_TOKEN`
- `SOCIALBU_API_KEY`
- `CRON_SECRET`

### Database Reset

If you need to reset the database:

1. Go to Supabase SQL Editor
2. Copy/paste `supabase/FRESH_RESET.sql`
3. Run the script
4. Verify tables are recreated

See `supabase/RESET_INSTRUCTIONS.md` for detailed steps.

---

## Troubleshooting

### Scraping Issues

**Problem**: No posts found

**Solutions:**
- Verify account is public
- Check date range (try more days)
- Verify APIFY_API_TOKEN is set
- Check Apify usage/credits

### Automation Not Running

**Problem**: Automations don't trigger

**Solutions:**
- Verify `CRON_SECRET` matches Vercel cron config
- Check `next_run_at` is in the past
- Check automation `is_active` is true
- Verify cron job is hitting the endpoint

### Images Not Loading

**Problem**: Images show broken/expired

**Solutions:**
- Images are downloaded to Supabase Storage during scrape
- Check `posters` bucket exists and is public
- Verify `media_urls` in database point to Supabase URLs

---

## License

Proprietary - All Rights Reserved

---

## Support

For issues or questions, contact the development team.
