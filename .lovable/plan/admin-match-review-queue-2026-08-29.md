# Admin match review queue

Give owners/admins a private way to verify finalized match scores, one match at a time or a whole day at once. The review state is invisible to non-admins.

## What the admin sees

- A new "To review" tab on the Scores page, visible only to owners/admins, with a count badge.
- Only finalized matches that have not been reviewed yet appear there.
- Matches are grouped into day sections (Today, Yesterday, then dates), newest first.
- Each day section header has a "Review all (n)" button that stamps every unreviewed finalized match from that day.
- Each match card in the queue has its own "Mark reviewed" button, plus the existing tap-to-open score editing.
- Reviewed matches drop out of the queue and show a small "Reviewed" marker on the Recent tab — again only for owners/admins.

Non-admin users see the Scores page exactly as today: no review tab, no review markers.

## Technical details

Database (external Supabase, so SQL goes to `supabase/manual/20260829120000_match_review.sql` for manual application):

- `alter table public.matches add column reviewed_at timestamptz`, `reviewed_by uuid references public.profiles(id)`; partial index on `(club_id, starts_at desc) where reviewed_at is null`.
- `list_unreviewed_matches(p_limit int default 200)` — security definer, owner/admin gate, same row shape as `list_recent_matches` (reuses its participant/set/winner CTE logic), filtered to `status = 'final' and reviewed_at is null`, ordered by `starts_at desc`.
- `review_match(p_match_id uuid)` — owner/admin gate, sets `reviewed_at = now()`, `reviewed_by` = caller's profile id, only when status is `final`; idempotent.
- `review_matches_for_day(p_day date)` — owner/admin gate, stamps all finalized unreviewed matches whose `starts_at` falls on that day in the club timezone; returns the number of rows updated.
- `list_recent_matches` extended with `reviewed_at` in its return shape, nulled out for non-admin callers so the stamp stays admin-only.
- Grants: execute to `authenticated` for all three new functions.

Frontend:

- `src/features/matches/types.ts`: add `reviewed_at: string | null` to `MatchListItem`.
- `src/features/matches/data/useMatches.ts`: add `useUnreviewedMatches()`, `useReviewMatch()`, `useReviewDay()`; on success invalidate both the recent and unreviewed query keys.
- New `src/features/matches/ui/ReviewQueue.tsx`: day grouping, per-day "Review all" button, per-match "Mark reviewed" button, empty state ("Nothing to review"), reusing `MatchCard`.
- `src/pages/Scores.tsx`: render the "To review" tab and queue only when the current membership role from `useAuth` is `owner` or `admin`.
- `MatchCard` gets an optional admin-only "Reviewed" badge and an optional review action slot.

Manual step: run the SQL file in the Supabase SQL editor after the code lands.
