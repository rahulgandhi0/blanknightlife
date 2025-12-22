# BlankNightlife — Automated Nightlife Content Curation System

> **Philosophy:** "The Filter, Not the Funnel"  
> Spend 5 minutes/day approving what took AI 24 hours to find.

---

## 📊 Plan Evaluation

### Feasibility Assessment: ✅ VIABLE

| Aspect | Rating | Notes |
|--------|--------|-------|
| Technical Complexity | Medium | Standard stack, well-documented APIs |
| Cost Efficiency | Excellent | $0-5/month is realistic |
| Time to MVP | 2-3 days | With focused Cursor development |
| Maintenance Burden | Low | Once set up, mostly automated |
| Legal Risk | None | Partner pages with permission ✅ |

### Cost Breakdown (2025 Estimates)

| Component | Tool | Monthly Cost | Free Tier Limits |
|-----------|------|--------------|------------------|
| Scraping | Apify (IG Scraper) | $0-1 | $5 free credit/month |
| Database | Supabase | $0 | 500MB DB, 1GB Storage |
| Hosting/UI | Vercel | $0 | Hobby tier, 100GB bandwidth |
| AI Brain | Groq API | $0 | ~14,400 requests/day on Llama-3 |
| Posting | Meta Graph API | $0 | Unlimited (own account) |

**Total: $0-1/month** ☕ Less than a coffee.

---

## 🚨 Critical Pitfalls & Mitigations

### ⚠️ Pitfall 1: The "Pinned Post" Trap
- **Issue:** Apify's `onlyPostsNewerThan` ignores pinned posts. A 2-year-old "Happy Hour" keeps appearing as "new."
- **Fix:** Check `isPinned` attribute. If `isPinned === true` AND timestamp > 48 hours old → auto-discard.
- **Implementation:** Add filter in `/api/ingest` route.

### ⚠️ Pitfall 2: Instagram's "Hotlinking" Ban
- **Issue:** Raw Apify image URLs expire within 24 hours (Instagram security tokens).
- **Fix:** Immediately download and re-upload to Supabase Storage bucket.
- **Implementation:** Download in `/api/ingest`, store permanent URL in `media_urls`.

### ⚠️ Pitfall 3: Apify Credit Drain
- **Issue:** Scraping 100 accounts every 4 hours = credit burn.
- **Fix:** Run scrape every 48 hours. Nightlife posts are 2-7 days in advance anyway.
- **Implementation:** Set Vercel cron to run every 48 hours, not hourly.

### ⚠️ Pitfall 4: Meta Token Expiry (IMPORTANT - Meta API Requirement)
- **Issue:** Long-Lived Access Tokens expire after 60 days. This is how Meta's API works — no way around it.
- **Reality:** You generate a token once, it works for 60 days, then stops. Posts will fail silently.
- **Fix:** Set a calendar reminder for day 50, or build a simple refresh button in dashboard.
- **Implementation:** Store token expiry date, show warning banner when < 7 days remaining. Manual refresh is fine initially.

### ℹ️ Note: Content Rights
- **Status:** ✅ CLEARED — All source accounts are partner pages with permission granted.

### ℹ️ Note: Posting Limits  
- **Status:** ✅ NOT A CONCERN — Established account, no rate limiting issues.

---

## 🗄️ Database Schema

```sql
-- Table: event_discovery
CREATE TABLE event_discovery (
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

-- Index for status queries
CREATE INDEX idx_event_discovery_status ON event_discovery(status);

-- Index for duplicate checking
CREATE INDEX idx_event_discovery_ig_post_id ON event_discovery(ig_post_id);

-- Index for scheduled posts
CREATE INDEX idx_event_discovery_scheduled ON event_discovery(scheduled_for) WHERE status = 'scheduled';
```

---

## 📋 Implementation Phases

### Phase 1: Foundation Setup
- [x] Initialize Next.js 14+ app with App Router
- [ ] Set up Supabase project (manual step)
- [x] Create database migration with `event_discovery` table
- [ ] Create Supabase Storage bucket `posters` (public read) (manual step)
- [x] Configure environment variables template
- [x] Set up shadcn/ui

### Phase 2: Ingest Pipeline
- [x] Create `/api/ingest` POST route
- [x] Implement Apify webhook receiver
- [x] Add duplicate detection (check `ig_post_id`)
- [x] Add pinned post filter (discard old pinned posts)
- [x] Implement media download → Supabase Storage upload
- [x] Integrate Groq API for caption rewriting
- [x] Add proper error handling and logging

### Phase 3: Review Dashboard
- [x] Build dashboard layout (sidebar navigation)
- [x] Create "Pending" posts view with cards
- [x] Left side: Original poster/media preview
- [x] Right side: Editable AI caption textarea
- [x] Date-time picker for scheduling
- [x] "Approve & Schedule" button
- [x] "Discard" button for bad content
- [x] Add "Scheduled" view to see queue
- [x] Add "Posted" view for history

### Phase 4: Meta Publisher
- [ ] Create `/api/publish` route for manual testing
- [ ] Implement Instagram Graph API posting (single image)
- [ ] Implement carousel posting
- [ ] Create Vercel cron job (runs every hour)
- [ ] Handle API errors gracefully
- [ ] Update post status after successful publish

### Phase 5: Token Management (Simple)
- [ ] Store token expiry date in env or Supabase
- [ ] Add expiry warning banner in dashboard
- [ ] Document manual refresh process (can automate later)

### Phase 6: Polish & Monitoring
- [ ] Add Vercel Analytics
- [ ] Create simple error alerting (email or Discord webhook)
- [ ] Add storage usage indicator
- [ ] Implement bulk actions (approve/discard multiple)
- [ ] Add source account management UI

---

## 🔑 Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Groq AI
GROQ_API_KEY=

# Meta/Instagram
META_ACCESS_TOKEN=
META_TOKEN_EXPIRY=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
FACEBOOK_PAGE_ID=

# Apify (for testing locally)
APIFY_TOKEN=

# Cron Security
CRON_SECRET=
```

---

## 📱 Meta API Prerequisites Checklist

- [ ] Instagram account converted to **Business Account**
- [ ] Business Account connected to a **Facebook Page**
- [ ] Facebook App created in Meta Developer Portal
- [ ] Requested permissions: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`
- [ ] Generated **Long-Lived Access Token** (60-day expiry)
- [ ] **Standard Access** is sufficient (no Advanced Access review needed for own account)

---

## 🎯 Source Accounts to Track (Example SF Venues)

```
@temple_sf
@audiogroupsf
@midikilosf
@publicworkssf
@thegrandnightclub
@1015folsom
@halyardbar
@monarchsf
@dloungebar
```

---

## 🔄 Apify Actor Configuration

**Actor:** `apify/instagram-scraper` or `apify/instagram-post-scraper`

**Recommended Settings:**
```json
{
  "directUrls": ["https://www.instagram.com/temple_sf/"],
  "resultsType": "posts",
  "resultsLimit": 5,
  "onlyPostsNewerThan": "2024-01-01",
  "addParentData": true
}
```

**Webhook URL:** `https://your-domain.vercel.app/api/ingest`

---

## 📏 AI Caption Prompt Template

```
You are a minimalist nightlife curator. Rewrite this venue post caption in a hype-focused, clean style.

Rules:
- Maximum 2-3 short sentences
- Use line breaks for rhythm
- Include key info: artist, date, venue (if mentioned)
- Remove excessive hashtags and emojis
- Keep it mysterious and exclusive-feeling
- Never use words like "amazing" or "incredible"

Original caption:
{original_caption}

Source: @{source_account}
```

---

## 📅 Operational Schedule

| Task | Frequency | Method |
|------|-----------|--------|
| Scrape venues | Every 48 hours | Apify scheduled task |
| Check for posts to publish | Every hour | Vercel cron |
| Review pending content | Daily (manual) | Dashboard |
| Refresh Meta token | Every 50 days | Cron or manual |
| Check storage usage | Weekly | Dashboard indicator |

---

## 🚀 Quick Start Commands

```bash
# Initialize project
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir

# Install dependencies
npm install @supabase/supabase-js @supabase/ssr groq-sdk
npm install date-fns lucide-react

# Install shadcn
npx shadcn@latest init
npx shadcn@latest add button card input textarea label badge calendar popover

# Run dev server
npm run dev
```

---

## ✅ Success Metrics

- [ ] <5 minutes daily review time
- [ ] >90% automation rate
- [ ] Zero broken image links
- [ ] Consistent posting schedule
- [ ] $0 monthly cost (within free tiers)

---

## 📝 Notes & Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Day 1 | Created plan | Initial setup |
| Day 1 | Skip reels/videos for v1 | Focus on images & carousels only |
| Day 1 | Content rights confirmed | Partner pages with permission |
| Day 1 | Ignore posting limits | Established account |

---

*Last updated: 2024-12-21*

