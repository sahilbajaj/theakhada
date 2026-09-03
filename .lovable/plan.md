# Suspend and resume matches

Let a match be paused mid-play (rain, injury, darkness) and picked up later. A suspended match keeps its scores but counts for nothing in rankings until it is finished.

## Rules

- Only a player in the match can suspend or resume it; owners/admins can do it for any match.
- Suspending asks for a reason: Rain, Injury, Darkness, Other (with a short optional note).
- A suspended match keeps every set already recorded, but no further score edits until it is resumed.
- Resuming puts it straight back to live scoring, sets intact.
- Rankings, seeding, and insights already count only finalized matches, so suspended matches contribute nothing — no formula changes needed.

## What the user sees

- In the score sheet for a live match: a "Suspend" action next to Save set / End match. Choosing it opens a small sheet with reason chips and an optional note.
- Suspended matches stay in the **Live** tab with an amber "Suspended" badge and the reason ("Suspended · Rain"), sorted after truly live matches.
- Opening a suspended match shows the current score read-only with a single primary "Resume match" button; scoring controls unlock after resuming.
- Everyone else in the match gets a notification when it is suspended and when it resumes.
- Suspended matches never appear in the admin "To review" queue (that stays finalized-only).

## Technical notes

New migration (external Supabase project — apply it by hand in the SQL editor after it lands):

- `matches.status` check constraint widened to `('scheduled','live','final','suspended')`; new nullable `suspended_reason text` and `suspended_note text` columns.
- `match_events.kind` and `notifications.kind` check constraints extended with `match_suspended` and `match_resumed`; the existing fan-out function then notifies participants for both.
- `suspend_match(p_match_id uuid, p_reason text, p_note text)` — security definer; requires the caller to be a participant or club admin, requires current status `live`, sets status/reason/note, writes a `match_suspended` event.
- `resume_match(p_match_id uuid)` — same authorization, requires status `suspended`, sets status back to `live`, clears reason/note, writes a `match_resumed` event.
- `record_set` and `finalize_match` reject matches whose status is `suspended` with a clear error.
- `list_recent_matches` and `list_unreviewed_matches` return the two new columns; the unreviewed query keeps its `status = 'final'` filter.

Frontend:

- `src/features/matches/types.ts` — add `"suspended"` to `MatchStatus`, plus `suspended_reason` / `suspended_note` on `MatchListItem`.
- `src/features/matches/data/useMatches.ts` — `useSuspendMatch` and `useResumeMatch` mutations reusing the existing invalidation set.
- `src/features/matches/ui/ScoreEntry.tsx` — suspend action with reason sheet, suspended read-only state, Resume button; keep the existing set-score validation rules for finalizing.
- `src/features/matches/ui/MatchCard.tsx` — suspended badge and reason line.
- `src/pages/Scores.tsx` — keep suspended matches in the Live tab, ordered after live ones.
