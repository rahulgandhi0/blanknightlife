Reduce Vercel load without breaking features
Phase 0 — Baseline + Guardrails (no behavior change)
Instrument: Add lightweight logging/metrics around /api/apify-trigger, /api/ingest, media upload, and /api/generate-caption to quantify costs.
Snapshot: Record current invocation counts, average duration, and total CPU usage.
Rollback switch: Add a feature flag for each change so you can instantly revert.
Phase 1 — Keep media previews while reducing uploads
Goal: Stop uploading all media during ingest, but still show previews in the UI.
Approach (non-breaking):
Store original Instagram URLs in event_discovery alongside media_urls (e.g., source_media_urls).
Preview logic:
If media_urls (Supabase) exists → use that
Else → use source_media_urls (Instagram URLs) for previews
Upload-on-approve: Only upload media to Supabase when a post is approved or scheduled.
Impact:
Saves 60–70% invocations (the biggest cost driver)
UI previews remain functional for images/reels using original URLs
No user-visible change in workflow
Phase 2 — Async Apify (eliminate long-running functions)
Goal: Remove 5-minute sync runs that blow CPU and timeout risk.
Approach (safe refactor):
/api/apify-trigger sends async Apify run
Apify webhook hits /api/ingest when ready
Fallback: If webhook fails, allow manual “fetch results” endpoint
Impact:
Reduces function duration drastically
Prevents timeouts on Vercel free tier
Same end-user behavior: scrape → results appear
Phase 3 — Smarter automation cadence
Goal: Cut invocations without affecting coverage.
Approach:
Change GitHub Actions cron from 15 min → 30 min
Keep your 36h scrape windows to prevent missing posts
Add “manual run now” for urgent scrapes
Impact:
Saves ~3–5K invocations/month
No missing posts (window still covers delays)
Phase 4 — Cache AI caption generation (non‑breaking)
Goal: Avoid repeated expensive calls.
Approach:
Cache AI output per event if unchanged
Regenerate only if user explicitly requests new variation
Impact:
Small but meaningful reduction in invocations and API costs
Media Preview Guarantee
You explicitly asked for no interruption of media previews.
The plan maintains previews by falling back to original Instagram URLs until approved media is uploaded to Supabase.
That means:
✅ Images still render
✅ Reels still playable (if Instagram URL supports it)
✅ No blank cards or broken UI
✅ Approved posts still get permanent media URLs
Risk Management / No Interruption Strategy
All changes behind feature flags
Rollout one phase at a time
Double-write (store both source + uploaded URLs) until stable
Rollback in seconds if needed
Expected Result
Function invocations drop from ~1.1M → ~200–300K
CPU usage drops ~70–90%
No feature loss or UI regressions
Media preview preserved