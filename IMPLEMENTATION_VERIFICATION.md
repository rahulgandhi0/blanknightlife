# Auto Scraping Fix - Implementation Verification

## Changes Implemented

### 1. Fixed Scheduling Drift (`src/app/api/automations/trigger/route.ts`)

#### Problem
The previous implementation calculated `next_run_at` based on the current execution time (`now + frequency`), causing scrapes to drift later over time.

#### Solution
- **Anchored Scheduling**: `next_run_at` is now calculated relative to the **previous scheduled time** (`automation.next_run_at + frequency_hours`)
- **Catch-up Logic**: If the calculated next run is in the past (e.g., after downtime), the function keeps adding `frequency_hours` until it's in the future
- **Drift Prevention**: This locks the schedule to the intended wall-clock time

#### Code Changes
```typescript
function calculateNextRun(
  previousNextRunAt: string | Date,
  frequencyHours: number,
  now: Date = new Date()
): Date {
  const previousNext = new Date(previousNextRunAt)
  const frequencyMs = frequencyHours * 60 * 60 * 1000
  
  // Start with the previous scheduled time + frequency
  let nextRun = new Date(previousNext.getTime() + frequencyMs)
  
  // If we're in the past (e.g., after downtime), keep adding frequency until we're in the future
  while (nextRun.getTime() <= now.getTime()) {
    nextRun = new Date(nextRun.getTime() + frequencyMs)
  }
  
  return nextRun
}
```

#### Usage
```typescript
// Success case
const nextRunAt = calculateNextRun(
  automation.next_run_at,
  automation.frequency_hours || FIXED_FREQUENCY_HOURS,
  runTimestamp
)

// Error case (still prevents drift)
const nextRunAt = calculateNextRun(
  automation.next_run_at,
  automation.frequency_hours || FIXED_FREQUENCY_HOURS,
  runTimestamp
)
```

### 2. Enhanced Scrape Window Calculation

#### Problem
The scrape window needs to accurately reflect the time since the last successful run.

#### Solution
- Calculate `sinceHours` based on the actual gap between `last_run_at` and `now`
- Added 10% buffer to account for timing variations
- Falls back to 120 hours for first run

#### Code Changes
```typescript
function calculateSinceHours(automation: any, referenceDate: Date): number {
  if (!automation?.last_run_at) {
    // First run - use fallback window
    return LOOKBACK_FALLBACK_HOURS
  }
  const lastRunAt = new Date(automation.last_run_at)
  const diffMs = Math.max(0, referenceDate.getTime() - lastRunAt.getTime())
  // Add a small buffer (10%) to account for any timing variations
  const diffHours = Math.max(1, Math.ceil((diffMs / (60 * 60 * 1000)) * 1.1))
  return diffHours
}
```

### 3. Updated Apify Actor (`src/app/api/apify-trigger/route.ts`)

#### Problem
The previous actor configuration didn't use the optimal Instagram scraper or native date filtering.

#### Solution
- **Actor**: Switched to `apify/instagram-scraper` (Actor ID: `shu8hvrXbJbY3Eb9W`)
- **Input Schema**: Updated to use correct parameters:
  - `directUrls`: Constructed from handle as `https://www.instagram.com/${handle}/`
  - `resultsType`: `"posts"`
  - `resultsLimit`: `50`
  - `onlyPostsNewerThan`: Date in `YYYY-MM-DD` format calculated from `sinceHours`
- **Safety Filter**: Kept local filtering for pinned posts and stray older posts

#### Code Changes
```typescript
// Use the instagram-scraper actor (Actor ID: shu8hvrXbJbY3Eb9W)
const primaryActor = 'apify~instagram-scraper'

// Calculate onlyPostsNewerThan date (YYYY-MM-DD format)
const newerThanDate = new Date(cutoffMs)
const onlyPostsNewerThan = newerThanDate.toISOString().split('T')[0]

const input = useInstagramScraper
  ? {
      // apify/instagram-scraper input schema
      directUrls: [profileUrl],
      resultsType: 'posts',
      resultsLimit: 50,
      onlyPostsNewerThan: onlyPostsNewerThan, // YYYY-MM-DD format
      proxy: { useApifyProxy: true },
    }
  : {
      // Fallback actor schema
      username: [cleanHandle],
      resultsType: 'posts',
      resultsLimit: 50,
      scrapePostsFromLastNDays: Math.max(1, Math.ceil(hours / 24)),
      proxy: { useApifyProxy: true },
    }
```

## Verification Checklist

### ✅ Scheduling Drift Prevention
- [x] `calculateNextRun` now anchors to `automation.next_run_at`
- [x] Catch-up logic handles downtime scenarios
- [x] Both success and error cases use the new logic
- [x] No changes to database schema required

### ✅ Scrape Window Accuracy
- [x] `calculateSinceHours` uses actual gap between runs
- [x] 10% buffer added for timing variations
- [x] Fallback for first run scenarios

### ✅ Apify Actor Update
- [x] Switched to `apify/instagram-scraper`
- [x] Using `directUrls` with full Instagram URL
- [x] `onlyPostsNewerThan` in YYYY-MM-DD format
- [x] `resultsType` set to `"posts"`
- [x] `resultsLimit` set to 50
- [x] Safety filters maintained for pinned/old posts

### ✅ Backward Compatibility
- [x] API interface unchanged (`account`, `sinceHours`, `profile_id`)
- [x] Existing calls from scrape page work
- [x] Existing calls from automations route work
- [x] Fallback actor still available

### ✅ Code Quality
- [x] No TypeScript/ESLint errors
- [x] Comprehensive JSDoc comments added
- [x] Error handling preserved
- [x] Logging maintained for debugging

## Testing Scenarios

### Scenario 1: Normal Operation
**Given**: Automation with `next_run_at` = "2026-01-08T09:00:00Z", `frequency_hours` = 36
**When**: Triggered at "2026-01-08T09:05:00Z"
**Expected**: 
- `next_run_at` = "2026-01-09T21:00:00Z" (previous + 36 hours)
- No drift accumulation

### Scenario 2: Downtime Recovery
**Given**: Automation with `next_run_at` = "2026-01-06T09:00:00Z", `frequency_hours` = 36
**When**: Triggered at "2026-01-08T09:00:00Z" (48 hours late)
**Expected**:
- Catch-up: "2026-01-06T09:00:00Z" + 36h = "2026-01-07T21:00:00Z" (still past)
- Catch-up: "2026-01-07T21:00:00Z" + 36h = "2026-01-09T09:00:00Z" (future)
- `next_run_at` = "2026-01-09T09:00:00Z"

### Scenario 3: First Run
**Given**: New automation with no `last_run_at`
**Expected**:
- `sinceHours` = 120 (fallback)
- `onlyPostsNewerThan` = 5 days ago

### Scenario 4: Regular Run
**Given**: Automation with `last_run_at` = 36 hours ago
**Expected**:
- `sinceHours` ≈ 40 (36 hours + 10% buffer)
- `onlyPostsNewerThan` = 40 hours ago in YYYY-MM-DD format

## Database Impact

**No schema changes required** - all necessary fields already exist:
- `next_run_at TIMESTAMPTZ`
- `last_run_at TIMESTAMPTZ`
- `frequency_hours INTEGER`
- Index on `next_run_at` already exists

## Performance Considerations

1. **Apify Actor**: The `instagram-scraper` with `onlyPostsNewerThan` is more efficient as it filters at the source
2. **Safety Filters**: Local filters still applied as a safety net
3. **Result Limit**: Set to 50 to cover typical posting frequency within time windows
4. **No Additional Queries**: All calculations done in-memory

## Rollback Plan

If issues arise, the changes can be rolled back by:
1. Reverting `src/app/api/automations/trigger/route.ts` to use `now + frequency`
2. Reverting `src/app/api/apify-trigger/route.ts` to previous actor configuration
3. No database rollback needed (schema unchanged)

## Monitoring Recommendations

1. **Monitor `next_run_at` values** - should remain stable at intended times
2. **Track `sinceHours` values** - should match actual time gaps
3. **Monitor Apify actor success rates** - ensure new actor performs well
4. **Check for missed posts** - verify no gaps in post coverage

## Conclusion

All requirements from `auto_scraping_fix.md` have been successfully implemented:
- ✅ Scheduling drift fixed with anchored calculation
- ✅ Scrape window based on actual gap
- ✅ Apify actor updated with correct schema
- ✅ Safety filters maintained
- ✅ No breaking changes
- ✅ Production-ready code quality
