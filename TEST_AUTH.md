# 🔍 Auth Troubleshooting Guide

## Most Common Issue: Migrations Not Applied

### Did you run these SQL scripts in Supabase?

1. **000_drop_all.sql** - Clears old tables
2. **001_rebuild_multi_tenant.sql** - Creates new tables

---

## Quick Fix Steps

### Step 1: Apply Migrations in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the ENTIRE contents of `supabase/migrations/000_drop_all.sql`
5. Paste and click **Run** (or Cmd/Ctrl + Enter)
6. Wait for "Success" message
7. Click **New Query** again
8. Copy the ENTIRE contents of `supabase/migrations/001_rebuild_multi_tenant.sql`
9. Paste and click **Run**
10. Wait for "Success" message

### Step 2: Disable Email Confirmation (for development)

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Click on **Email**
3. Find "Enable email confirmations"
4. **Toggle it OFF** (disabled)
5. Click **Save**

### Step 3: Verify Tables Were Created

1. Go to **Table Editor** (left sidebar)
2. You should see these tables:
   - ✅ users
   - ✅ profiles
   - ✅ event_discovery
   - ✅ social_accounts
   - ✅ caption_edits

If you DON'T see these tables, the migrations didn't run!

### Step 4: Test Signup Again

1. Go to http://localhost:3000/auth/signup
2. Fill out the form
3. Click "Sign Up"
4. Check browser console (F12) for errors

---

## What Should Happen

When signup works correctly:

1. User is created in Supabase Auth (check: Authentication → Users)
2. A row is auto-created in the `users` table (check: Table Editor → users)
3. You're redirected to `/auth/setup-profile`

---

## If Still Broken

Check these:

### Browser Console Errors
Open F12 → Console tab, look for red errors

### Supabase Auth Users
Go to: Authentication → Users
- Is there a user created?
- What's the status? (Confirmed/Unconfirmed)

### Environment Variables
Check your `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

All three must be set!

---

## Common Errors

### "relation 'users' does not exist"
→ Migrations weren't applied. Run Step 1 above.

### "Email not confirmed"
→ Email confirmation is enabled. Run Step 2 above.

### "Invalid login credentials"
→ User might not exist, or password is wrong. Check Auth → Users.

### "Row Level Security policy violation"
→ The trigger didn't create the user row. Check Table Editor → users.

---

## Nuclear Option: Reset Everything

If nothing works, do this:

1. Run `000_drop_all.sql` in Supabase SQL Editor
2. Run `001_rebuild_multi_tenant.sql` in Supabase SQL Editor
3. Disable email confirmation
4. Clear browser localStorage (F12 → Application → Local Storage → Clear All)
5. Restart dev server: `npm run dev`
6. Try signup again

