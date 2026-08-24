# CourtSync Club

A tennis club app scaffolded from the MortgageLab AIQ frontend patterns. It is ready for Lovable import, local Vite development, AWS Amplify static hosting, and Supabase-backed data.

## Run Locally

```bash
npm install
npm run dev
```

The app runs in demo mode until Supabase env vars are set:

```bash
cp .env.example .env
```

Then fill:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

## Supabase

Apply the schema in `supabase/migrations/202608240001_initial_tennis_club_schema.sql`.

Optional seed data lives in `supabase/seed.sql`.

## AWS Amplify

This repo includes `amplify.yml` for Amplify Hosting:

- preBuild: `npm ci`
- build: `npm run build`
- artifact directory: `dist`

Add the two `VITE_SUPABASE_*` variables in Amplify environment variables.

## Lovable

Import the `tennis-club-app` folder. The project uses Vite, React, TypeScript, Tailwind, shadcn-style components, and the Lovable tagger in development mode.
