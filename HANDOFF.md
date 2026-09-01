# The Akhada Handoff

## Current State

- App path: `/Users/bajaj/theakhada`
- Git remote: `git@github.com:sahilbajaj/theakhada.git`
- Initial local commit: `2abb5a5 Initial tennis club app`
- The app was moved into `/Users/bajaj/theakhada` as a standalone repository.
- The app has its own Git repository.
- `node_modules/`, `dist/`, `.env`, and `.env.local` are ignored by the app repo.
- Development guidance now lives in `docs/`.


## Verified

- `npm run typecheck`, `npm run lint`, and `npm run build` have been used as the validation baseline.
- Build includes TypeScript checks before Vite build.

## Supabase

- Supabase MCP was added and authenticated for project ref `fiizcmvfikslxiykrzls`.
- MCP project URL: `https://fiizcmvfikslxiykrzls.supabase.co`
- The Akhada app contains:
  - `supabase/migrations/`
  - `supabase/seed.sql`
  - `src/integrations/supabase/client.ts`
  - `src/integrations/supabase/types.ts`
- `.env.example` contains the expected frontend variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- Auth access workflow has been added:
  - Magic Link and Google login
  - signup requests
  - copyable invite links
  - owner/admin approval
  - fixed bootstrap owner email `sahilbajaj.nc@gmail.com`

## Next Steps

1. Keep docs updated when adding routes, shared hooks, auth/RLS behavior, or new database tables.
2. Regenerate Supabase TypeScript types after schema migrations when tooling is available.
3. Verify production auth after Amplify deploys:
   - Google login
   - Magic Link
   - invite acceptance
   - request approval
4. Add focused tests as workflows become more interactive.

## MortgageLab Repo Note

Historical note: `/Users/bajaj/mortgagelab-aiq` had unrelated changes during the original repo move:

- `package-lock.json` changed after `npm install`
- `.agents/skills/supabase/`
- `.agents/skills/supabase-postgres-best-practices/`
- `skills-lock.json`
- `calls/`

Those were not committed as part of The Akhada move.
