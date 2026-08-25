# The Akhada

A tennis club app scaffolded from the MortgageLab AIQ frontend patterns. It is ready for Lovable import, local Vite development, AWS Amplify static hosting, and Supabase-backed data.

## Development Docs

- [Architecture](docs/architecture.md)
- [Frontend Guidelines](docs/frontend-guidelines.md)
- [Auth and Access](docs/auth-access.md)
- [Supabase Development](docs/supabase-development.md)

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

Apply the schema migrations in `supabase/migrations`.

Optional seed data lives in `supabase/seed.sql`.

### Auth

The app supports Magic Link and Google login through Supabase Auth. Configure Supabase Auth URL settings with the deployed Amplify URL as the Site URL and add redirect URLs for:

- `/auth/callback`
- `/accept-invite`
- local development equivalents on `http://localhost:8080`

For Google login, enable the Google provider in Supabase and add the Supabase Auth callback URL to the Google OAuth client redirect URIs.

The access model, RPCs, and redirect requirements are documented in [Auth and Access](docs/auth-access.md).

## AWS Amplify

This repo includes `amplify.yml` for Amplify Hosting:

- preBuild: `npm ci`
- build: `npm run build`
- artifact directory: `dist`

Add the two `VITE_SUPABASE_*` variables in Amplify environment variables.

## Lovable

Import the `theakhada` folder. The project uses Vite, React, TypeScript, Tailwind, shadcn-style components, and the Lovable tagger in development mode.
