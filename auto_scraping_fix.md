I need to fix two critical issues in the scraping automation system: **Scheduling Drift** and **Apify Actor Input**.

Please modify `src/app/api/automations/trigger/route.ts` and `src/app/api/apify-trigger/route.ts` with the following requirements.

### 1. Fix Scheduling Drift (in `src/app/api/automations/trigger/route.ts`)
The current logic calculates the next run based on the *execution time* (`now + frequency`), causing scrapes to drift later and later.
**Requirement:** The next run must be calculated relative to the **previous scheduled time** to lock it to the intended wall-clock time.

* **Logic:** `next_run_at = current_automation.next_run_at + frequency_hours`
* **Catch-up:** If the calculated `next_run_at` is in the past (e.g., after downtime), keep adding `frequency_hours` until it is in the future.
* **Scrape Window:** Calculate `sinceHours` based on the actual gap between `last_run_at` and `now`.

### 2. Update Apify Actor (in `src/app/api/apify-trigger/route.ts`)
We must use the `apify/instagram-scraper` (Actor ID: `shu8hvrXbJbY3Eb9W`) with the **correct input schema** derived from its documentation.

* **Actor ID:** `apify~instagram-scraper`
* **Input Payload:**
    * **`directUrls`**: `[`https://www.instagram.com/${handle}/`]` (Construct full URL from handle; *do not* use `usernames`).
    * **`resultsType`**: `"posts"`
    * **`resultsLimit`**: `50` (Or a reasonable limit to cover the time window).
    * **`onlyPostsNewerThan`**: Calculate the date (`YYYY-MM-DD`) based on `sinceHours` and pass it here. This creates a native date filter in Apify.
* **Filtering:** Keep a local safety filter to remove pinned posts or any stray older posts returned by the actor.

### Summary of Changes
1.  **Trigger Route**: Rewrite `calculateNextRun` to anchor off the previous `next_run_at` to prevent drift.
2.  **Apify Route**: Switch to `apify/instagram-scraper`, using `directUrls` (mapped from handle) and `onlyPostsNewerThan` for efficient filtering.

Please apply these changes now.