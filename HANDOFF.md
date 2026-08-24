# The Akhada Handoff

## Current State

- App path: `/Users/bajaj/theakhada`
- Git remote: `git@github.com:sahilbajaj/theakhada.git`
- Initial local commit: `2abb5a5 Initial tennis club app`
- The app was moved out of `/Users/bajaj/mortgagelab-aiq/tennis-club-app`.
- The app has its own Git repository and a clean working tree after the initial commit.
- `node_modules/`, `dist/`, `.env`, and `.env.local` are ignored by the app repo.

## Verified

- `npm run build` passes in `/Users/bajaj/theakhada`.
- Build includes TypeScript checks via:
  - `tsc --noEmit -p tsconfig.app.json`
  - `tsc --noEmit -p tsconfig.node.json`
  - `vite build`

## Supabase

- Supabase MCP was added and authenticated for project ref `fiizcmvfikslxiykrzls`.
- MCP project URL: `https://fiizcmvfikslxiykrzls.supabase.co`
- The MCP project was empty when checked:
  - no public tables
  - no migrations recorded
  - no Edge Functions
  - no security/performance advisor lint findings
- The Akhada app contains:
  - `supabase/migrations/202608240001_initial_tennis_club_schema.sql`
  - `supabase/seed.sql`
  - `src/integrations/supabase/client.ts`
  - `src/integrations/supabase/types.ts`
- `.env.example` contains the expected frontend variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

## Next Steps

1. Push the initial commit to GitHub:

   ```sh
   cd /Users/bajaj/theakhada
   git push -u origin main
   ```

2. Connect the app to Supabase:
   - Add real values to a local `.env.local`.
   - Apply the local migration to the Supabase project.
   - Seed demo data if needed.
   - Regenerate TypeScript types after the database schema exists remotely.

3. Deploy or configure hosting:
   - `amplify.yml` exists.
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the host environment.

## MortgageLab Repo Note

`/Users/bajaj/mortgagelab-aiq` still has unrelated changes from this session:

- `package-lock.json` changed after `npm install`
- `.agents/skills/supabase/`
- `.agents/skills/supabase-postgres-best-practices/`
- `skills-lock.json`
- `calls/`

Those were not committed as part of The Akhada move.
