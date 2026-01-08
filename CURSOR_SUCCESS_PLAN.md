BlankNightLife: Success Implementation Plan
Phase 1: Core API & Sync Fixes
Goal: Align with the SocialBu API and fix the broken synchronization between the UI and the publishing platform.

1.1 Fix SocialBu API Parameter Mismatch
File: src/lib/socialbu.ts

Problem: Methods getPublishedPosts and getScheduledPosts use status as a query parameter. The SocialBu API documentation requires the parameter key to be type.

Action: * In getPublishedPosts, change params.set('status', 'published') to params.set('type', 'published').

In getScheduledPosts, change params.set('status', 'scheduled') to params.set('type', 'scheduled').

1.2 Enable Full Update Capability (Captions + Time)
File: src/app/api/socialbu-update/route.ts

Problem: The route only accepts and sends scheduledFor to SocialBu, ignoring caption changes.

Action: * Update the PATCH handler to accept finalCaption from the request body.

Pass content: finalCaption into the client.updatePost call.

Ensure the local Supabase update also saves the final_caption if provided.

1.3 Fix Serial Execution Risk in Scheduling
File: src/app/api/socialbu-schedule/route.ts

Problem: If SocialBu schedules successfully but the Supabase update fails, the UI becomes out of sync, leading to potential duplicate posts.

Action: * Wrap the SocialBu call and Supabase update in a more defensive block.

If Supabase fails to record the socialbu_post_id, log a critical error and consider an immediate "Unschedule" call to SocialBu to prevent a "ghost post".

Phase 2: AI Captioning Reinforcement Learning
Goal: Make the Groq AI learn specifically from individual venue styles rather than a global pool of edits.

2.1 Profile-Specific Learning
File: src/app/api/generate-caption/route.ts

Problem: The RL logic pulls the last 5 edits globally, mixing styles from different venues.

Action: * First, retrieve the profile_id associated with the eventId.

Update the Supabase query for caption_edits to filter by that specific profile_id (this requires ensuring caption_edits table has a profile_id or joining through event_discovery).

Increase the training limit from 5 to 15 recent examples for better pattern matching.

Phase 3: Automation & Infrastructure
Goal: Remove fragile hardcoded dependencies and improve scraper reliability.

3.1 Dynamic Automation Trigger
File: .github/workflows/trigger-automations.yml

Problem: The Vercel URL is hardcoded, which breaks on domain changes or preview deployments.

Action: * Replace the hardcoded URL with a variable ${{ secrets.BASE_URL }}.

Add BASE_URL to your GitHub Repository Secrets.

3.2 Scraper Multi-Actor Fallback Logic
File: src/app/api/apify-trigger/route.ts

Action: Ensure the fallback from apify~instagram-api-scraper to apify~instagram-post-scraper is robust by explicitly checking for 401/403 errors (often caused by private accounts) before triggering the fallback.

Phase 4: UI/UX & Design Snappiness
Goal: Improve perceived performance and interaction feedback.

4.1 Optimistic UI for Approvals
File: src/app/pending/page.tsx

Action: In handleApprove, move the setEvents filter call to the very top of the function. This removes the card immediately upon clicking "Approve," making the app feel "snappy" while the media uploads happen in the background.

4.2 Scheduled Post Editing UI
File: src/app/scheduled/page.tsx

Problem: "Edit" mode currently only allows changing the time, not the caption.

Action: * Add a Textarea for editCaption in the editing state of the card.

Update saveReschedule to send the new caption to your updated api/socialbu-update route.

4.3 Visual Polish
File: src/components/event-card.tsx

Action: * Increase the transition duration for hover states to 200ms for smoother visual feedback.

Add a "Sending..." loading state to the "Approve" button that is triggered globally so users don't double-click.