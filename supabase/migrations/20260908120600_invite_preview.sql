-- Adds a lightweight invite_preview RPC so the accept-invite screen can
-- name the destination club before the user commits. The token is the
-- shared bearer secret; anyone who holds it already has enough to accept,
-- so returning club name/role/expiry is not a privacy leak.

create or replace function public.invite_preview(p_token text)
returns table (
  club_id uuid,
  club_name text,
  role text,
  email text,
  expires_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.club_id,
    c.name,
    i.role,
    i.email,
    i.expires_at,
    i.status
  from public.club_invites i
  join public.clubs c on c.id = i.club_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  limit 1
$$;

grant execute on function public.invite_preview(text) to anon, authenticated;

notify pgrst, 'reload schema';
