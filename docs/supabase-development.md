# Supabase Development

## Project

- Project URL: `https://fiizcmvfikslxiykrzls.supabase.co`
- Frontend env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not commit `.env` or `.env.local`.

## Migration Workflow

- Add schema changes as new files under `supabase/migrations`.
- Prefer migrations plus RPCs over ad hoc dashboard edits.
- Apply DDL through migrations.
- After schema changes, regenerate `src/integrations/supabase/types.ts` when tooling is available.
- Run Supabase security and performance advisors after applying migrations.

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

