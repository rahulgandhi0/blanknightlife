# Implementation & Testing Guide

## 1. Database Setup

### Apply the Updated Schema

1. Go to your Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of `supabase/COMPLETE_RESET.sql`
3. Execute the script
4. Verify the `event_discovery` table now includes `'scheduling'` in the status constraint

### Enable the Cron Job (WAL-Lite Safety Net)

The cron job automatically cleans up events stuck in `'scheduling'` status for more than 5 minutes.

**Steps:**

1. **Enable pg_cron extension** in Supabase:
   ```sql
   -- Go to Database → Extensions → Search for "pg_cron" → Enable it
   ```

2. **Schedule the cron job** (run this in SQL Editor):
   ```sql
   SELECT cron.schedule(
     'cleanup-orphaned-scheduling',  -- Job name
     '*/5 * * * *',                   -- Every 5 minutes
     'SELECT cleanup_orphaned_scheduling_events();'
   );
   ```

3. **Verify the cron job is scheduled**:
   ```sql
   SELECT * FROM cron.job;
   ```

4. **Monitor cron job execution** (optional):
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-orphaned-scheduling')
   ORDER BY start_time DESC 
   LIMIT 10;
   ```

5. **To disable/remove the cron job** (if needed):
   ```sql
   SELECT cron.unschedule('cleanup-orphaned-scheduling');
   ```

---

## 2. Testing the Scheduling Flow

### Test Case 1: Happy Path (Successful Scheduling)

**Steps:**
1. Navigate to the "Pending" page in your app
2. Find an event with media and a caption
3. Click "Approve" and set a schedule time (at least 20 minutes in the future)
4. Click "Send to SocialBu" on the Scheduled page
5. **Expected behavior:**
   - Event status changes to `'scheduling'` (brief)
   - SocialBu API is called
   - Event status changes to `'scheduled'` with `meta_post_id` and `socialbu_post_id` populated
   - No errors in console

**Verification:**
```sql
SELECT id, status, meta_post_id, socialbu_post_id, updated_at 
FROM event_discovery 
WHERE id = 'YOUR_EVENT_ID';
```

---

### Test Case 2: SocialBu API Failure (Rollback)

**Steps:**
1. Temporarily break the SocialBu API (e.g., use invalid API key or disconnect internet)
2. Try to schedule an event
3. **Expected behavior:**
   - Event status changes to `'scheduling'`
   - SocialBu API call fails
   - Event status reverts to `'approved'`
   - Error message shown to user
   - No orphaned post in SocialBu

**Verification:**
```sql
SELECT id, status, meta_post_id, socialbu_post_id, updated_at 
FROM event_discovery 
WHERE id = 'YOUR_EVENT_ID';
-- Should show status='approved', meta_post_id=null, socialbu_post_id=null
```

---

### Test Case 3: Database Failure After SocialBu Success (Rollback)

**Steps:**
1. Manually simulate a DB constraint violation or connection issue
2. Try to schedule an event
3. **Expected behavior:**
   - Event status changes to `'scheduling'`
   - SocialBu API succeeds
   - Database update fails
   - Post is deleted from SocialBu (rollback)
   - Event status reverts to `'approved'`
   - Error message shown to user

**Manual Simulation:**
```sql
-- Temporarily add a constraint that will fail
ALTER TABLE event_discovery ADD CONSTRAINT temp_fail CHECK (status != 'scheduled');

-- Try scheduling through the UI

-- Remove the constraint after testing
ALTER TABLE event_discovery DROP CONSTRAINT temp_fail;
```

---

### Test Case 4: Orphaned Event Cleanup (Cron Job)

**Steps:**
1. Manually set an event to `'scheduling'` status with old timestamp:
   ```sql
   UPDATE event_discovery 
   SET status = 'scheduling', updated_at = NOW() - INTERVAL '10 minutes'
   WHERE id = 'YOUR_EVENT_ID';
   ```

2. Wait 5 minutes for the cron job to run (or manually trigger it):
   ```sql
   SELECT cleanup_orphaned_scheduling_events();
   ```

3. **Expected behavior:**
   - Event status changes from `'scheduling'` to `'approved'`
   - User can retry scheduling

**Verification:**
```sql
SELECT id, status, updated_at 
FROM event_discovery 
WHERE id = 'YOUR_EVENT_ID';
-- Should show status='approved'
```

---

### Test Case 5: UI Sync Optimization (No N+1 Flood)

**Steps:**
1. Create 20+ scheduled events in the database
2. Navigate to the "Scheduled" page
3. Open browser DevTools → Network tab
4. Observe the API calls made on page load

**Expected behavior:**
- Only 5 API calls to `/api/socialbu-get-post` (for the next 5 upcoming posts)
- NOT 20+ API calls (N+1 problem avoided)

**Verification:**
```javascript
// Check console logs
// Should see: "Syncing next 5 upcoming events with SocialBu (out of 20 total)..."
```

---

## 3. Monitoring & Debugging

### Check Event Status Distribution
```sql
SELECT status, COUNT(*) as count
FROM event_discovery
GROUP BY status
ORDER BY count DESC;
```

### Find Events Stuck in 'scheduling'
```sql
SELECT id, source_account, status, updated_at, 
       NOW() - updated_at as stuck_duration
FROM event_discovery
WHERE status = 'scheduling'
ORDER BY updated_at DESC;
```

### View Recent Scheduling Activity
```sql
SELECT id, source_account, status, meta_post_id, socialbu_post_id, 
       scheduled_for, updated_at
FROM event_discovery
WHERE status IN ('scheduling', 'scheduled')
ORDER BY updated_at DESC
LIMIT 20;
```

### Check Cron Job Logs
```sql
SELECT jobid, runid, job_pid, database, username, 
       command, status, return_message, 
       start_time, end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-orphaned-scheduling')
ORDER BY start_time DESC
LIMIT 10;
```

---

## 4. Production Checklist

- [ ] Database schema updated with `'scheduling'` status
- [ ] pg_cron extension enabled in Supabase
- [ ] Cron job scheduled and verified
- [ ] All test cases pass
- [ ] No linter errors in code
- [ ] Environment variables set (SOCIALBU_API_KEY, NEXT_PUBLIC_BASE_URL)
- [ ] Postback webhook URL configured correctly
- [ ] Monitoring/alerting set up for orphaned events (optional)

---

## 5. Troubleshooting

### Issue: Events stuck in 'scheduling' forever
**Solution:** Run the cleanup function manually:
```sql
SELECT cleanup_orphaned_scheduling_events();
```

### Issue: Cron job not running
**Solution:** Check if pg_cron is enabled and job is scheduled:
```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-orphaned-scheduling';
```

### Issue: SocialBu API rate limiting
**Solution:** The UI sync now only checks the next 5 posts. If still hitting limits, increase the interval or reduce to 3 posts.

### Issue: Rollback not deleting post from SocialBu
**Solution:** Check SocialBu API logs and verify the `deletePost` method is working correctly. May need to manually delete orphaned posts.

---

## 6. Next Steps

1. **Apply the database reset** (`COMPLETE_RESET.sql`)
2. **Enable pg_cron** and schedule the cleanup job
3. **Run all test cases** to verify the WAL-Lite pattern works
4. **Monitor for 24 hours** to ensure no orphaned events
5. **Consider adding alerting** for events stuck in `'scheduling'` for >10 minutes

---

## Notes

- The `'scheduling'` status is a temporary state (should only last 5-30 seconds)
- The cron job is a safety net and should rarely need to clean up events
- If you see frequent cleanups, investigate the root cause (network issues, API timeouts, etc.)
- The postback webhook (`/api/socialbu-postback`) handles real-time status updates from SocialBu
