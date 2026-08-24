# CourtSync Club

CourtSync Club is a Vite + React + TypeScript tennis club operations app derived from the MortgageLab AIQ frontend architecture.

## Import Notes

- Entry point: `src/main.tsx`
- Routing shell: `src/App.tsx` and `src/components/AppShell.tsx`
- UI primitives: `src/components/ui`
- Supabase client: `src/integrations/supabase/client.ts`
- Supabase schema: `supabase/migrations/202608240001_initial_tennis_club_schema.sql`
- Demo mode is intentional when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are empty.

## Product Direction

The app starts with bookings, score keeping, attendance, seeding, tournaments, admin controls, and player management. AI features should be added later on top of the structured club data rather than as first-pass UI placeholders.
