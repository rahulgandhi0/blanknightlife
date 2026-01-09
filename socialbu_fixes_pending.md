You are a Senior Backend Engineer and QA Expert. Review the SocialBu integration in `src/lib/socialbu.ts` and `src/app/api/socialbu-schedule/route.ts` against the functional requirements below.

### 1. Update `SocialBuClient` (src/lib/socialbu.ts)
The current client is missing several features mentioned in the official requirements. Update the interfaces and methods to support:
* **Drafts:** Add `draft?: boolean` to `CreatePostPayload`.
* **Teams & Queues:** Add `team_id?: number` and `queue_ids?: number[]` to `CreatePostPayload`.
* **Options:** Add `options?: { video_title?: string; comment?: string; [key: string]: any }` to `CreatePostPayload`.
* **Media Editing:** Update the `updatePost` method to accept `existing_attachments` (string[] of upload tokens) so users can change media on scheduled posts.
* **Naming Convention:** KEEP snake_case (`publish_at`, `upload_media`) as per the current working code. Do NOT remove underscores.

### 2. Refactor `updatePost`
Ensure `updatePost` in `SocialBuClient` accurately reflects the PATCH endpoint capabilities:
* It should allow updating `accounts`, `team_id`, `publish_at`, `content`, `existing_attachments`, and `options`.

### 3. Implement Robust "WAL-Lite" Logic (src/app/api/socialbu-schedule/route.ts)
The current route performs a risky dual-write. Refactor `POST` to be more robust:
1.  **State 1:** Immediately update the DB event status to `scheduling` (or a similar temporary state) *before* calling SocialBu.
2.  **Execute:** Call `client.schedulePostWithMedia`.
3.  **State 2:** If successful, update DB to `scheduled` with the `meta_post_id`.
4.  **Error Handling:** If the API call fails, revert DB status to `approved` (so user can try again) and log the error.
5.  **Orphan Handling:** Add a comment/TODO suggesting a Cron job that checks for events stuck in `scheduling` for >5 minutes (this acts as our safety net/WAL).

### 4. Optimize UI Sync (src/app/scheduled/page.tsx)
* The `syncAllWithSocialBu` function causes an N+1 API flood.
* Refactor it to use a new bulk-check endpoint OR simply rely on the `postback_url` webhook (which is already implemented) for status updates, rather than aggressively polling on every page load.
* If active syncing is needed, limit it to only the next 5 upcoming posts.

Fix these files to ensure we match the full API capabilities and prevent data inconsistency.