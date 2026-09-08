-- Hotfix for 20260908120400_phase4_multi_club_onboarding.sql.
-- pgcrypto lives in the `extensions` schema on current Supabase projects,
-- and this function runs with `set search_path = ''`, so unqualified
-- gen_random_bytes / digest calls fail with 42883. Qualify them.

drop function if exists public.create_invite(text, text, timestamptz, text, uuid);

create or replace function public.create_invite(
  p_email text,
  p_role text default 'player',
  p_expires_at timestamptz default now() + interval '7 days',
  p_base_url text default '',
  p_club_id uuid default null
)
returns table (invite_id uuid, token text, invite_url text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_email text := lower(trim(p_email));
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if v_club_id is null then
    raise exception 'No club specified';
  end if;
  if not (public.is_club_admin(v_club_id) or public.is_superadmin()) then
    raise exception 'Not authorized';
  end if;

  if v_email = '' then
    raise exception 'Email is required';
  end if;

  if p_role not in ('admin', 'coach', 'player', 'guest') then
    raise exception 'Invalid role';
  end if;

  insert into public.club_invites (club_id, email, role, token_hash, expires_at, created_by)
  values (v_club_id, v_email, p_role, encode(extensions.digest(v_token, 'sha256'), 'hex'), p_expires_at, public.current_profile_id())
  on conflict (club_id, lower(email)) where status = 'pending'
  do update set
    role = excluded.role,
    token_hash = excluded.token_hash,
    expires_at = excluded.expires_at,
    created_by = excluded.created_by,
    created_at = now()
  returning id into invite_id;

  token := v_token;
  invite_url := rtrim(p_base_url, '/') || '/accept-invite?token=' || v_token;
  return next;
end;
$$;

revoke all on function public.create_invite(text, text, timestamptz, text, uuid) from public;
grant execute on function public.create_invite(text, text, timestamptz, text, uuid) to authenticated;

-- accept_invite has the same digest call; qualify it too.
drop function if exists public.accept_invite(text, text);

create or replace function public.accept_invite(p_token text, p_full_name text default null)
returns table (profile_id uuid, club_id uuid, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_name text := nullif(trim(coalesce(p_full_name, auth.jwt() #>> '{user_metadata,full_name}', auth.jwt() #>> '{user_metadata,name}', '')), '');
  v_invite public.club_invites%rowtype;
begin
  if v_user_id is null or v_email is null then
    raise exception 'Sign in before accepting this invite';
  end if;

  select * into v_invite
  from public.club_invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Invite is invalid or already used';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'Invite has expired';
  end if;

  if lower(v_invite.email) <> v_email then
    raise exception 'This invite belongs to a different email address';
  end if;

  insert into public.profiles (auth_user_id, email, full_name, role, status)
  values (v_user_id, v_email, coalesce(v_name, v_email), v_invite.role, case when v_invite.role = 'guest' then 'visitor' else 'active' end)
  on conflict (lower(email)) where email is not null
  do update set
    auth_user_id = excluded.auth_user_id,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    role = excluded.role,
    status = excluded.status
  returning id into profile_id;

  insert into public.club_memberships (club_id, profile_id, role)
  values (v_invite.club_id, profile_id, v_invite.role)
  on conflict (club_id, profile_id)
  do update set role = excluded.role;

  update public.club_invites
  set status = 'accepted', accepted_profile_id = profile_id, accepted_at = now()
  where id = v_invite.id;

  club_id := v_invite.club_id;
  role := v_invite.role;
  return next;
end;
$$;

revoke all on function public.accept_invite(text, text) from public;
grant execute on function public.accept_invite(text, text) to authenticated;

notify pgrst, 'reload schema';
