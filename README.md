# BlankNightlife 🌙

Automated nightlife content curation and scheduling system.

Scrapes → AI rewrites → You approve → Auto-posts.

---

## Quick Start

### 1. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **SQL Editor** and run the migration:

```sql
-- Copy contents from: supabase/migrations/001_create_event_discovery.sql
```

3. Go to **Storage** → Create a new bucket called `posters`
   - Set it to **Public** bucket
   - File size limit: 50MB

4. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 2. Set Up Groq

1. Go to [console.groq.com](https://console.groq.com)
2. Create an API key (free tier is plenty)

### 3. Configure Environment

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GROQ_API_KEY=your-groq-api-key
```

### 4. Run the App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## How It Works

### Ingest Flow

1. **Apify scrapes** Instagram posts from venue accounts
2. **Webhook sends** posts to `/api/ingest`
3. **System downloads** images to Supabase Storage (prevents Instagram URL expiry)
4. **Groq AI** rewrites captions in a minimalist nightlife style
5. **Posts appear** in the dashboard as "Pending"

### Review Flow

1. Open the **Pending** tab
2. Review each post: see original image, edit the AI caption
3. Pick a date and click **Approve & Schedule**
4. Posts move to the **Scheduled** queue

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingest` | POST | Receive posts from Apify |
| `/api/events` | GET | List events by status |
| `/api/events` | PATCH | Update event status/caption |
| `/api/events` | DELETE | Delete an event |

### Sending Test Data

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '[{
    "id": "123456789",
    "shortCode": "ABC123",
    "type": "Image",
    "caption": "🎉 This Saturday! DJ Awesome takes over the decks for an unforgettable night...",
    "timestamp": "2024-12-21T20:00:00Z",
    "displayUrl": "https://picsum.photos/800/800",
    "ownerUsername": "temple_sf",
    "isPinned": false
  }]'
```

---

## Apify Configuration

Use the `apify/instagram-scraper` actor with these settings:

```json
{
  "directUrls": [
    "https://www.instagram.com/temple_sf/",
    "https://www.instagram.com/audiogroupsf/"
  ],
  "resultsType": "posts",
  "resultsLimit": 5,
  "addParentData": true
}
```

Set webhook URL to: `https://your-domain.vercel.app/api/ingest`

---

## Deploy to Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── ingest/route.ts    # Apify webhook receiver
│   │   └── events/route.ts    # CRUD for events
│   ├── pending/page.tsx       # Review pending posts
│   ├── scheduled/page.tsx     # View scheduled queue
│   ├── posted/page.tsx        # History of posted content
│   └── page.tsx               # Dashboard overview
├── components/
│   ├── event-card.tsx         # Post review card
│   └── sidebar.tsx            # Navigation
├── lib/
│   ├── groq.ts                # AI caption rewriting
│   └── supabase/              # Database clients
└── types/
    ├── database.ts            # TypeScript types
    └── apify.ts               # Apify response types
```

---

## Next Steps (Phase 4+)

- [ ] Add Meta Graph API publishing
- [ ] Implement Vercel cron for auto-posting
- [ ] Add token refresh automation
- [ ] Build source account management UI

See `PLAN.md` for the full roadmap.
