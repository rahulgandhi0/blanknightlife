# 🚀 Multi-Tenant Setup Guide

## Quick Start (5 minutes)

### Step 1: Apply Database Migration

```bash
# If using Supabase locally:
supabase db push

# If using hosted Supabase:
# Copy contents of supabase/migrations/004_add_multi_tenant_auth.sql
# Paste into Supabase SQL Editor and run
```

### Step 2: Environment Variables

Make sure these are in your `.env.local`:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# SocialBu (required)
SOCIALBU_API_KEY=your_socialbu_api_key

# App URL (for webhooks)
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # or your production URL
```

### Step 3: Run the App

```bash
npm run dev
```

Navigate to `http://localhost:3000`

---

## First Time User Flow

### 1. Sign Up
1. Go to `http://localhost:3000` (will redirect to `/auth/signup`)
2. Fill in:
   - Full Name
   - Email
   - Phone (optional)
   - Password (min 6 characters)
   - Confirm Password
3. Click "Sign Up"

### 2. Create First Profile
1. You'll be redirected to `/auth/setup-profile`
2. Select a SocialBu account from dropdown
3. Give it a profile name (e.g., "Drexel Nightlife")
4. Click "Create Profile"

### 3. Dashboard
- You're now on your dashboard!
- Bottom-left shows your profile switcher
- All content is scoped to your current profile

---

## Adding More Profiles

### Option A: Via Profile Switcher
1. Click profile avatar in bottom-left
2. Click "Add Profile"
3. Select another SocialBu account
4. Name it and save

### Option B: Direct URL
Navigate to `/profiles/new`

---

## Profile Switching

1. Click your profile avatar in bottom-left
2. See all your profiles listed
3. Click any profile to switch
4. Page refreshes with that profile's data

---

## Account Settings

1. Click profile avatar → "Account Settings"
2. Update your:
   - Full Name
   - Email
   - Phone
3. Click "Save Changes"

---

## Setting Up Apify Webhooks (Per Profile)

### Get Your IDs
1. Open browser DevTools → Console
2. Run:
   ```javascript
   // Get current profile ID
   localStorage.getItem('current_profile_id')
   
   // Get user ID (from Supabase dashboard or your profile)
   ```

### Configure Webhook
In Apify actor settings, set webhook URL to:
```
https://your-domain.com/api/ingest?profile_id=YOUR_PROFILE_ID&user_id=YOUR_USER_ID
```

**Important:** Each profile needs its own webhook URL!

---

## Testing the System

### Test 1: Profile Isolation
1. Create 2 profiles
2. Add a post to Profile A (via Apify or ingest API)
3. Switch to Profile B
4. Verify you **don't** see Profile A's post ✅

### Test 2: Profile Switching
1. Go to "Pending" page
2. Note the posts shown
3. Switch profile
4. Verify different posts appear ✅

### Test 3: Authentication
1. Log out
2. Try accessing `/pending` directly
3. Verify redirect to `/auth/login` ✅

---

## Troubleshooting

### "No profile selected" Error
**Solution:** Create a profile at `/auth/setup-profile`

### Posts Not Appearing
**Checklist:**
- [ ] Migration applied?
- [ ] Using correct `profile_id` in ingest webhook?
- [ ] Logged in as correct user?
- [ ] Current profile is active?

### Can't See SocialBu Accounts
**Checklist:**
- [ ] `SOCIALBU_API_KEY` in env?
- [ ] Accounts connected in SocialBu dashboard?
- [ ] Try restarting dev server

### RLS Policy Error
**Solution:** 
```sql
-- Run in Supabase SQL Editor
ALTER TABLE event_discovery ENABLE ROW LEVEL SECURITY;
-- Then re-apply migration 004
```

---

## Database Query Examples

### Get User's Profiles
```sql
SELECT * FROM profiles WHERE user_id = 'your-user-id';
```

### Get Profile's Events
```sql
SELECT * FROM event_discovery WHERE profile_id = 'profile-id';
```

### Check RLS Policies
```sql
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

---

## Architecture Highlights

✨ **Profile-Scoped Queries**
```typescript
// Automatically filtered by profile_id
const { fetchWithProfile } = useProfileFetch()
await fetchWithProfile('/api/events?status=pending')
```

🔒 **Row Level Security**
```sql
-- Users can only see their own profiles
CREATE POLICY "Users can view own profiles"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);
```

🎯 **Auto-Profile Injection**
```typescript
// Hook adds profile_id to all requests
export function useProfileFetch() {
  return { 
    fetchWithProfile: (url) => fetch(url + `&profile_id=${currentProfile.id}`)
  }
}
```

---

## What Changed?

### Database
- ✅ Added `users` table
- ✅ Added `profiles` table  
- ✅ Added `profile_id` to `event_discovery`
- ✅ Added RLS policies on all tables

### Frontend
- ✅ Auth pages (login, signup, profile setup)
- ✅ Profile switcher component
- ✅ Profile-scoped queries
- ✅ Protected routes middleware

### API
- ✅ All endpoints check auth
- ✅ All endpoints filter by `profile_id`
- ✅ Ingest API requires `profile_id` + `user_id`

---

## Production Deployment

### 1. Apply Migration
Run `004_add_multi_tenant_auth.sql` in production Supabase

### 2. Update Env Vars
Set all env vars in Vercel/hosting platform

### 3. Update Webhooks
For each profile, update Apify webhook URLs with production domain

### 4. Test Auth Flow
1. Create test account
2. Create test profile
3. Verify data isolation

---

## Support

- 📖 Full docs: See `AUTH_SYSTEM.md`
- 🐛 Issues: Check browser console + Supabase logs
- 💬 Questions: Review migration SQL for schema details

---

**🎉 You now have a multi-tenant SaaS platform!**

Each user can manage multiple social media brands with complete data isolation.

