# Frontend Guidelines

## Component Organization

- Put reusable app-specific components in `src/components`.
- Put shadcn-style primitives in `src/components/ui`.
- Do not place feature behavior inside `components/ui`; those files should stay generic.
- Put route-level screens in `src/pages`.
- Keep cross-page state in `src/contexts` only when it is genuinely app-wide.
- Put Supabase/data-fetching hooks in `src/hooks` unless they are clearly local to one feature.

## UI Conventions

- Use existing `components/ui` primitives before adding new primitives.
- Use `lucide-react` icons in buttons and navigation.
- Keep operational screens compact and scannable; this is a club operations app, not a marketing site.
- Use cards only for repeated items, forms, dialogs, and bounded tools.
- Keep app sections full-width inside the existing shell instead of nesting cards inside cards.
- Use `Badge` for status/role labels, `Select` for role choices, `Dialog` for focused creation flows, and `toast` for action results.
- Maintain responsive layouts with stable grid/flex dimensions. Mobile bottom nav is part of `AppShell`.

## Routing And Navigation

- Add protected app routes inside the `AccessGate` + `AppShell` branch in `src/App.tsx`.
- Add public auth routes outside `AccessGate`.
- Add navigation entries in `primaryNav` in `AppShell`.
- Use `adminOnly: true` for owner/admin-only nav items.
- If adding a new app page, also update `pageTitle` behavior by using the route in `primaryNav` when possible.

## Hooks And Data Fetching

- Use React Query for remote reads.
- Keep query keys stable and descriptive, for example `["club-snapshot"]` or `["signup-requests"]`.
- Throw Supabase errors from query functions so React Query owns the failure state.
- Use mutations for writes and invalidate affected query keys after success.
- Keep domain mapping in hooks instead of page components when multiple pages need the data.

## TypeScript

- Prefer domain types from `src/types/club.ts` for UI-facing objects.
- Keep Supabase generated types in `src/integrations/supabase/types.ts`.
- Regenerate Supabase types after schema migrations when CLI/tooling is available.
- Avoid `any`; for newly added RPCs before type regeneration, use narrow local result casts.

