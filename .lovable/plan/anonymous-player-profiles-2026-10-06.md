# Anonymous player profiles

## What players get
- A "Hide my profile" switch on their own player profile page.
- While it's on:
  - Other members won't see them on the Players page or in any ranking (Combined, Singles, Doubles). Seeds are renumbered so there's no gap.
  - Their name and photo show as "Anonymous player" in matches, scores and insights that other members see.
  - Opening their profile link shows a "This player is private" message.
- They still see themselves normally, with a small "Hidden" label.
- Owners and admins still see everyone (hidden players get a "Hidden" label), so they can keep managing seeding and approving matches.
- Turning it off brings everything back as it was. Match history and scores are kept the whole time.

## Technical details
- Manual SQL file (`supabase/manual/..._anonymous_profiles.sql`, run in the Supabase SQL editor):
  - `profiles.is_anonymous boolean not null default false`.
  - RPC `set_my_anonymous(p_value boolean)` (security definer, updates only the caller's profile).
- `useClubRoster`: select `is_anonymous` and add it to `RosterMember`.
- New helper `isHiddenFrom(member, viewer)`: hidden when `is_anonymous` is on, the viewer is not that player, and the viewer is not an owner or admin.
- `Players.tsx`: filter out hidden members before ranking/sorting. Show the seed as the player's position in the visible list. `SeedingPane` (admin only) keeps the full list.
- `displayName` and match/insight rendering: show "Anonymous player" with no photo for hidden profiles.
- `PlayerDetail.tsx`: add the switch for the profile owner, and the private-message state for other non-admin viewers.
- Note: this hides profiles in the app only. The database read rules are not changed.
