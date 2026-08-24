# Roadmap

Snapshot of what's shipped, what's paused, and what comes next. Update as slices land.

## Shipped

### Foundation
- `profiles.nickname`, `profiles.avatar_url`, `clubs.prefer_nicknames`.
- `displayName(person, {preferNicknames})` and `initialsFrom(name)` shared utilities.
- Admin RPCs: `set_member_role`, `set_member_rating`, `set_member_nickname`, `set_member_avatar`, `set_club_prefer_nicknames`.
- Admin page: members list with avatar + name + rating + role, inline edit dialog for nickname/rating/avatar URL, prefer-nicknames toggle.

### Notifications v1
- Table `notifications` (RLS: own rows only) + trigger `match_events_fan_out` inserting one row per participant when a `match_created`, `match_finalized`, or `match_reopened` event lands (set-level events don't fan out to keep noise down).
- RPCs: `list_notifications`, `unread_notifications_count`, `mark_notification_read`, `mark_all_notifications_read`.
- Bell in `AppShell` top bar with unread badge, dropdown with 5 recent items, "See all" opens a right-side Sheet with card-per-item feed. Tapping a card opens the underlying match in `ScoreEntry` and marks the notification read.
- `src/features/notifications/{types, data, logic, ui}`.

### Match v1
- Tables: `match_participants`, `match_sets`, `match_events`. Legacy `matches.home_players` / `.away_players` / `.sets` columns are unused by new code but not yet dropped.
- `matches.best_of` (1 / 3 / 5) chosen at match creation.
- RPCs: `create_match`, `record_set`, `finalize_match`, `reopen_match`, `list_recent_matches`. All `security definer`, gated on `is_club_member`.
- Feature slice at `src/features/matches/{types, data, logic, ui}`.
- `ScoreEntry` drawer covers singles + doubles, per-set +/- counters, on-demand tiebreak (works at 6-6 or forced for super tiebreak), finalize confirmation, reopen-to-edit for finalized matches.
- `MatchCard` used on Dashboard live tile and `/scores` Live/Recent tabs.

## Parked (documented, not started)

Ordered by rough priority. Each is a self-contained slice.

### Stats overview (player page)
- Route: `/players/:profile_id`. Tabs: Overview / Matches / Trends.
- Overview: current rating, W-L this month, current streak, most-frequent opponent, favorite court.
- Matches tab: reverse-chron list built on `list_recent_matches` filtered by participant.
- Data: derive from `match_participants` + `match_sets` + `match_events`; a Postgres view `profile_match_summary` keeps queries cheap.
- Trends tab is stretch — sparkline of rating over time, singles vs doubles split.

### Profile self-edit
- Player edits own nickname, avatar URL (upload flow later — see below).
- New RPCs: `set_own_nickname(text)`, `set_own_avatar(text)`. Rating stays admin-only (or admin-approved change request).
- Page at `/profile` or drawer accessible from the top-right user chip.

### Match polish
- Namesake disambiguation: subtitle (email or nickname) in `OpponentPicker` and `MatchCard` when two members share the primary display name.
- Edit trail on cards: small "edited by X · 12m ago" pill sourced from `match_events`.
- Delete match: admin-only `delete_match(id)` RPC + confirm dialog.
- Admin lock/unlock finalized matches (prevent reopen after N hours).

### Seeding & tournaments v1
- Compute: `rating * 0.6 + last_10_win_pct * 0.3 + recency * 0.1`.
- New table: `tournament_seeds(tournament_id, profile_id, seed, source enum('auto','manual'))`.
- Admin page `/tournaments/:id/seed` shows auto rank with drag-reorder (adds `@dnd-kit/sortable` dep). "Publish seeds" freezes into a bracket.

### Avatar upload
- Supabase Storage bucket `avatars`. Signed upload URLs from a small RPC.
- Cropper UI in profile self-edit; write result to `profiles.avatar_url`.
- Until then, `set_member_avatar` accepts a pasted URL.

## Nav plan

Live nav is deliberately minimal: **Home · Scores · Admin**. Routes for the following pages still exist (direct URLs work) but are hidden from the sidebar and bottom bar until they carry real functionality:

| Hidden page | Reintroduce when |
|---|---|
| `/players` | Stats slice ships (rating, form, opponent history). |
| `/tournaments` | Seeding slice ships. |
| `/bookings` | Court-booking backend exists. |
| `/attendance` | Coaching-session backend exists. |
| `/insights` | Club-level stats built on top of Stats. |

## Known housekeeping

- **Migration files live in `supabase/manual/`** — Lovable's Supabase integration writes to `supabase/migrations/`. Next schema change goes in `migrations/`; the accumulated `manual/*.sql` are already applied on remote, safe to leave in place.
- **Local vs remote migration history is out of sync** (Dashboard SQL Editor entries don't line up with local files). Cosmetic; only matters the day you want `supabase db push` to be clean. Fix path in prior notes: `supabase migration repair --status reverted/applied` per timestamp after `db diff --linked` returns empty.
- **Legacy `matches.home_players` / `.away_players` / `.sets` columns** are unused by new code. Drop them once `useClubData.ts` stops reading `matches` directly (right now it still does, for other bits).
- **Namesake data** is real (two members with the same name is legitimate, not a duplicate profile issue).
- **Tiebreak entry has no validation** — RPC accepts any numbers. If misuse becomes a problem, add rules in `record_set` (e.g., disallow 7-6 with no tiebreak).

## Non-goals for now

- Live scoring for spectators (websocket updates).
- Push notifications outside the app.
- Multi-club support in the UI (schema already carries `club_id`).
- ELO-style automatic rating updates.
