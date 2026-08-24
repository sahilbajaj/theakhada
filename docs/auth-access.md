# Auth And Access

## Access Model

The Akhada is invite/request based.

- Users can authenticate with Google or Magic Link.
- Authentication does not grant app access by itself.
- Approved `club_memberships` grant app access.
- `owner` and `admin` can approve requests and create invites.
- The initial owner bootstrap email is `sahilbajaj.nc@gmail.com`.

## Frontend States

`AuthContext` exposes:
- `session` and `user`
- `profile`
- `role`
- `clubId`
- `accessStatus`
- auth actions for Google, Magic Link, sign out, and access refresh

`accessStatus` values:
- `demo`: Supabase env vars are missing; demo data is used.
- `loading`: auth/membership is being checked.
- `unauthenticated`: user needs to sign in.
- `pending`: user signed in but has no approved membership.
- `approved`: user can use the app.

## Routes

- `/auth`: Google login, Magic Link login, and access request form.
- `/auth/callback`: redirect target after auth.
- `/accept-invite?token=...`: invite acceptance route.
- `/`: protected dashboard.
- `/admin`: protected owner/admin access management UI.

## Database RPCs

Frontend code should use RPCs for access-management writes:

- `request_access(email, full_name)`
- `claim_current_access()`
- `approve_signup_request(request_id, role)`
- `reject_signup_request(request_id)`
- `create_invite(email, role, expires_at, base_url)`
- `accept_invite(token, full_name)`

Do not implement approval or invite writes by directly inserting rows from the browser. The RPCs contain authorization checks and token handling.

## Google And Magic Link Setup

Supabase Auth URL settings must include the production Amplify URL and local development redirects.

Required redirect paths:
- `/auth/callback`
- `/accept-invite`

Google Cloud OAuth must use the Supabase callback URL:

```txt
https://fiizcmvfikslxiykrzls.supabase.co/auth/v1/callback
```

Google login should use Supabase `signInWithOAuth({ provider: "google" })`; Magic Link should use `signInWithOtp`.

## Security Rules

- Do not use editable user metadata for authorization.
- Treat frontend role checks as UI hints only.
- RLS policies and RPC authorization checks are the authority.
- Invite tokens are only shown once when created and are stored hashed in the database.
- Invite acceptance must match the authenticated user's email to the invite email.

