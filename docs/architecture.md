# Architecture

The Akhada is a Vite, React, TypeScript, Tailwind, shadcn-style web app backed by Supabase. It is deployed as static assets through AWS Amplify.

## Runtime Shape

- `src/main.tsx` wires app-wide providers: theme, React Query, auth, tooltips, router, and toasts.
- `src/App.tsx` owns top-level route composition.
- Public auth routes live outside the protected shell:
  - `/auth`
  - `/auth/callback`
  - `/accept-invite`
- App routes are wrapped by `AccessGate` and `AppShell`.
- `AccessGate` is the authorization boundary for the frontend. It redirects unauthenticated users, blocks unapproved users, and allows demo mode when Supabase env vars are missing.
- `AppShell` owns navigation, responsive shell layout, current user badge, theme toggle, and sign out.

## Data Flow

- Supabase browser client is initialized in `src/integrations/supabase/client.ts`.
- Generated database types live in `src/integrations/supabase/types.ts`.
- Auth state and membership state live in `AuthContext`.
- Club snapshot reads live in `useClubData.ts`; pages consume typed domain objects from `src/types/club.ts`.
- Demo data lives in `src/data/demoData.ts` and is used only when Supabase is not configured or no club row exists.

## Database Shape

The app is currently a single-club app. The database still stores `club_id` on operational tables so a multi-club future remains possible.

Core tables:
- `clubs`
- `profiles`
- `club_memberships`
- `courts`
- `bookings`
- `matches`
- `attendance_sessions`
- `attendance_records`
- `tournaments`

Access workflow tables:
- `signup_requests`
- `club_invites`

Security is enforced with Supabase Auth plus Postgres RLS. Frontend route checks are user experience gates only; database policies remain the source of truth.

