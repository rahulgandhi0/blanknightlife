# BlankNightLife: Final Polish & Safety Plan

## 1. Safety: Prevent Duplicate Posts
- **File:** `src/app/api/socialbu-schedule/route.ts`
- **Action:** 1. Wrap the Supabase `.update()` call in a try/catch.
    2. If the Supabase update fails, immediately call a (to-be-created) `client.deletePost(result.post_id)` method to remove it from SocialBu.
    3. This ensures that if we can't track the post in our DB, it doesn't exist in the real world.

## 2. Feature: Enable Caption Editing for Scheduled Posts
- **File:** `src/app/scheduled/page.tsx`
- **Action:** 1. Add `const [editCaption, setEditCaption] = useState('')` to the `ScheduledPage` component.
    2. In `startEditing`, initialize `setEditCaption(event.final_caption || '')`.
    3. Inside the `editingId === event.id` block, add a `Textarea` component (from `@/components/ui/textarea`) to allow caption changes.
    4. Update `saveReschedule` to include `finalCaption: editCaption` in the body of the `fetch('/api/socialbu-update', ...)` call.

## 3. Performance: Fix "Bulk Update" Lag
- **File:** `src/app/scheduled/page.tsx`
- **Action:** 1. Simplify `handleRefresh`. Instead of mapping over every event and calling `socialbu-update`, simply call `await syncWithSocialBu(true)` and then `await fetchEvents()`.
    2. Your `api/socialbu-sync` route is already designed for bulk processing; use it.

## 4. UI: Improved Interaction States
- **File:** `src/components/event-card.tsx`
- **Action:** 1. Add a `pending` state to the "Approve & Schedule" button. Disable the button and show a spinner immediately when clicked.
    2. In `src/app/pending/page.tsx`, ensure `handleApprove` sets a local "processing" ID to prevent multiple clicks on different cards while the first one is uploading media.
    