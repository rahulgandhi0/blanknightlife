# Multi-Tenant Authentication System

## Overview

BlankNightlife now supports **multi-user, multi-profile** authentication. This allows:
- **Multiple users** to manage their own accounts
- **Multiple profiles** per user (e.g., Drexel Nightlife, SF Nightlife, NYC Nightlife)
- **Complete data isolation** between profiles (Philly content never shows on SF account)
- **SocialBu integration** for each profile

---

## Architecture

### Database Schema

```
users (extends Supabase Auth)
├── id (UUID, linked to auth.users)
├── full_name
├── email
├── phone
└── avatar_url

profiles (social media accounts/brands)
├── id (UUID)
├── user_id (FK → users.id)
├── name (e.g., "Drexel Nightlife")
├── handle (e.g., "@drexelnightlife")
├── socialbu_account_id (links to SocialBu)
├── platform (instagram, tiktok, etc.)
└── is_active

event_discovery (content posts)
├── ... (all existing columns)
├── profile_id (FK → profiles.id) ⭐ SCOPED
└── user_id (FK → users.id) ⭐ SCOPED
```

### Row Level Security (RLS)

All tables use **Row Level Security** to ensure:
- Users can only see their own data
- Queries are automatically filtered by `auth.uid()`
- No cross-profile data leakage

---

## User Flow

### 1. Sign Up
```
/auth/signup
- Full name, email, phone, password
- Creates user in Supabase Auth + users table
```

### 2. Profile Setup (First Time)
```
/auth/setup-profile
- Select a SocialBu account
- Give it a profile name
- Automatically switches to that profile
```

### 3. Dashboard
```
/ (home page)
- Shows stats for current profile only
- Profile switcher in bottom-left
```

### 4. Profile Switching
```
Bottom-left sidebar menu:
- View all profiles
- Switch between profiles
- Add new profile
- Edit account settings
- Log out
```

---

## API Changes

### All Content APIs Now Profile-Scoped

**Before:**
```typescript
GET /api/events?status=pending
```

**After:**
```typescript
GET /api/events?status=pending&profile_id=xxx
```

The `useProfileFetch` hook automatically adds `profile_id` to all requests.

### Ingest API Update

**Before:**
```bash
POST /api/ingest
{ "posts": [...] }
```

**After:**
```bash
POST /api/ingest?profile_id=xxx&user_id=xxx
{ "posts": [...] }
```

⚠️ **Important:** When configuring Apify webhooks, append `?profile_id=YOUR_PROFILE_ID&user_id=YOUR_USER_ID` to the webhook URL.

---

## UI Components

### Profile Switcher (`src/components/profile-switcher.tsx`)
- Replaces old "API Endpoint" box
- Shows current profile avatar and name
- Dropdown with:
  - List of all profiles
  - "Add Profile"
  - "Account Settings"
  - "Log Out"

### Auth Pages
- `/auth/login` - Login form
- `/auth/signup` - Sign up form
- `/auth/setup-profile` - First-time profile creation
- `/profiles/new` - Add new profile
- `/settings/account` - Edit user details

### Protected Routes
Middleware automatically:
- Redirects unauthenticated users to `/auth/login`
- Redirects authenticated users away from auth pages

---

## Key Files

### Context
- `src/contexts/auth-context.tsx` - Auth state, profile management

### Hooks
- `src/hooks/use-profile-fetch.ts` - Auto-injects profile_id

### Components
- `src/components/profile-switcher.tsx` - Profile UI
- `src/components/layout-content.tsx` - Conditional sidebar

### Middleware
- `src/middleware.ts` - Route protection

### Database
- `supabase/migrations/004_add_multi_tenant_auth.sql` - Full schema

---

## Development Workflow

### 1. Run Migrations
```bash
# Apply the multi-tenant migration
supabase db push
```

### 2. Create Test User
1. Go to `/auth/signup`
2. Fill out form
3. Create first profile linked to SocialBu account

### 3. Test Profile Switching
1. Add multiple profiles
2. Switch between them
3. Verify content isolation (each profile only sees its own posts)

### 4. Configure Apify Webhooks
For each profile, update your Apify webhook URL:
```
https://blanknightlife.vercel.app/api/ingest?profile_id=PROFILE_UUID&user_id=USER_UUID
```

---

## Security Features

✅ **Row Level Security (RLS)** - Automatic database-level filtering  
✅ **Supabase Auth Integration** - Industry-standard authentication  
✅ **Protected API Routes** - All routes check `auth.uid()`  
✅ **CSRF Protection** - Built into Next.js  
✅ **Secure Password Hashing** - Handled by Supabase  
✅ **Profile Isolation** - No data crossover between profiles  

---

## Common Tasks

### Get Current User
```typescript
import { useAuth } from '@/contexts/auth-context'

const { user, currentProfile } = useAuth()
```

### Fetch Profile-Scoped Data
```typescript
import { useProfileFetch } from '@/hooks/use-profile-fetch'

const { fetchWithProfile } = useProfileFetch()
const res = await fetchWithProfile('/api/events?status=pending')
```

### Switch Profile
```typescript
const { switchProfile } = useAuth()
await switchProfile('new-profile-id')
router.refresh() // Reload page data
```

### Sign Out
```typescript
const { signOut } = useAuth()
await signOut()
router.push('/auth/login')
```

---

## Troubleshooting

### "No profile selected" error
- User needs to create at least one profile
- Redirect to `/auth/setup-profile`

### RLS policy blocking insert
- Ensure `user_id` and `profile_id` are set correctly
- Check that user is authenticated (`auth.uid()` is not null)

### Profile data not loading
- Check browser console for auth errors
- Verify Supabase env vars are set
- Ensure migrations have been applied

---

## Next Steps

- [ ] Add profile avatar upload
- [ ] Implement team invitations (share profiles)
- [ ] Add profile analytics (per-account metrics)
- [ ] Implement forgot password flow
- [ ] Add email verification

---

**Built with:**
- Next.js 15
- Supabase (Auth + Database + RLS)
- TypeScript
- Tailwind CSS
- shadcn/ui

🎉 **Your app is now a fully multi-tenant SaaS platform!**

