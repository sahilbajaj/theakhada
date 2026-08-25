# Supabase Development

## Project

- Project URL: `https://fiizcmvfikslxiykrzls.supabase.co`
- Frontend env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not commit `.env` or `.env.local`.

## Migration Workflow

**All schema changes go in `supabase/migrations/`.** Local CLI, Lovable's Supabase integration, and Amplify all agree on this folder. The old `supabase/manual/` folder is retired — every file was moved here and its history repaired.

### Filename convention

`YYYYMMDDhhmmss_short_description.sql`. Timestamp is significant: it drives ordering and matches rows in `supabase_migrations.schema_migrations`.

### Local apply (Supabase CLI)

```
supabase migration list          # local vs remote sync
supabase db push --dry-run       # preview
supabase db push                 # apply pending files
```

CLI is already linked to project `fiizcmvfikslxiykrzls`. From a fresh machine:

```
brew install supabase/tap/supabase       # or download the release binary
supabase login
supabase link --project-ref fiizcmvfikslxiykrzls
```

### Lovable apply

Lovable's connected Supabase integration writes into `supabase/migrations/` and applies on save. Because the folder is shared, running `supabase migration list` after pulling a Lovable commit may show a new file as local-only. If Lovable already ran it against the DB, mark it applied instead of pushing again:

```
supabase migration repair --status applied <timestamp>
```

### Rules

- Never paste DDL directly in the dashboard SQL editor. Dashboard runs don't leave a repo trail and cause the history drift we just fixed.
- Never edit a migration file after it's been pushed. Write a new file instead.

### If history drifts

Symptom: `supabase migration list` shows local-only or remote-only rows.

```
supabase migration repair --status applied  <local_ts>     # local file already on remote
supabase migration repair --status reverted <remote_ts>    # remote entry has no local file
```

Re-run `supabase migration list` to confirm every row is paired.

### After schema changes

- Regenerate `src/integrations/supabase/types.ts` when tooling is available.
- Run the Supabase security and performance advisors.

## Existing Migrations

- Initial club schema and RLS.
- FK index and policy cleanup.
- Seed club rename to The Akhada.
- Auth access workflow: signup requests, invites, RPCs, member-scoped RLS.
- Advisor cleanup for auth access indexes and policy splitting.

## RLS Expectations

- Public app data should not be readable by arbitrary authenticated users.
- Operational tables should be scoped through `club_memberships`.
- Admin-only actions should go through RPCs that call `is_club_admin`.
- Any new table in `public` must have RLS enabled before use.

## Advisor Notes

Security advisor warnings about exposed `SECURITY DEFINER` RPCs should be reviewed carefully. Some access workflow RPCs are intentionally callable from the browser, but each must validate the caller internally.

Unused-index warnings are expected on a freshly seeded database until real queries run. Missing-FK-index warnings should generally be fixed.

## Deployment Checklist

Before pushing a database-backed feature:

```bash
npm run typecheck
npm run lint
npm run build
```

Then verify:
- migrations applied to Supabase
- generated types updated if schema changed
- Amplify env vars are present
- Auth redirect URLs include production and local paths

