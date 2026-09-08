-- Phase 4 of multi-club rollout.
-- 1) request_access(): accepts optional p_club_id (last param, defaulted).
-- 2) create_invite(): accepts optional p_club_id (last param, defaulted).
-- 3) claim_current_access(): returns is_superadmin per row so the frontend
--    can gate superadmin UI.
-- 4) list_all_clubs(): superadmin-only, returns every club with a member
--    count for the onboarding console.

------------------------------------------------------------
-- request_access(p_email, p_full_name, p_club_id?)
------------------------------------------------------------

drop function if exists public.request_access(text, text);

create or replace function public.request_access(
  p_email text,
  p_full_name text,
  p_club_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_name text := trim(p_full_name);
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
begin
  if v_email = '' or v_name = '' then
    raise exception 'Email and name are required';
  end if;
  if v_club_id is null then
    raise exception 'No club specified';
  end if;
  if not exists (select 1 from public.clubs where id = v_club_id) then
    raise exception 'Club not found';
  end if;

  insert into public.signup_requests (club_id, email, full_name)
  values (v_club_id, v_email, v_name)
  on conflict (club_id, lower(email)) where status = 'pending'
  do update set
    full_name = excluded.full_name,
    updated_at = now();
end;
$$;

revoke all on function public.request_access(text, text, uuid) from public;
grant execute on function public.request_access(text, text, uuid) to anon, authenticated;

------------------------------------------------------------
-- create_invite(p_email, p_role?, p_expires_at?, p_base_url?, p_club_id?)
------------------------------------------------------------

drop function if exists public.create_invite(text, text, timestamptz, text);

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
  v_token text := encode(gen_random_bytes(32), 'hex');
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
  values (v_club_id, v_email, p_role, encode(digest(v_token, 'sha256'), 'hex'), p_expires_at, public.current_profile_id())
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

------------------------------------------------------------
-- claim_current_access() -> now includes is_superadmin
------------------------------------------------------------

drop function if exists public.claim_current_access();

create or replace function public.claim_current_access()
returns table (
  profile_id uuid,
  club_id uuid,
  club_name text,
  role text,
  full_name text,
  email text,
  has_membership boolean,
  is_superadmin boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_name text := nullif(coalesce(auth.jwt() #>> '{user_metadata,full_name}', auth.jwt() #>> '{user_metadata,name}'), '');
  v_bootstrap_club_id uuid := public.default_club_id();
  v_profile_id uuid;
begin
  if v_user_id is null or v_email is null then
    return;
  end if;

  if v_email = 'sahilbajaj.nc@gmail.com' then
    insert into public.profiles (auth_user_id, email, full_name, role, status)
    values (v_user_id, v_email, coalesce(v_name, v_email), 'owner', 'active')
    on conflict (lower(email)) where email is not null
    do update set
      auth_user_id = excluded.auth_user_id,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      role = 'owner',
      status = 'active'
    returning id into v_profile_id;

    insert into public.club_memberships (club_id, profile_id, role)
    values (v_bootstrap_club_id, v_profile_id, 'owner')
    on conflict (club_id, profile_id)
    do update set role = 'owner';
  else
    select id into v_profile_id
    from public.profiles
    where auth_user_id = v_user_id or lower(email) = v_email
    order by auth_user_id is null
    limit 1;

    if v_profile_id is not null then
      update public.profiles
      set
        auth_user_id = v_user_id,
        email = coalesce(email, v_email),
        full_name = coalesce(nullif(full_name, ''), coalesce(v_name, v_email))
      where id = v_profile_id
        and (auth_user_id is null or auth_user_id = v_user_id);
    end if;
  end if;

  return query
  select
    p.id,
    cm.club_id,
    c.name,
    cm.role,
    p.full_name,
    coalesce(p.email, v_email),
    cm.id is not null,
    coalesce(p.is_superadmin, false)
  from public.profiles p
  left join public.club_memberships cm on cm.profile_id = p.id
  left join public.clubs c on c.id = cm.club_id
  where p.auth_user_id = v_user_id
  order by cm.created_at nulls last;

  if not found then
    return query select null::uuid, null::uuid, null::text, null::text, coalesce(v_name, v_email), v_email, false, false;
  end if;
end;
$$;

grant execute on function public.claim_current_access() to authenticated;

------------------------------------------------------------
-- list_all_clubs() — superadmin console
------------------------------------------------------------

create or replace function public.list_all_clubs()
returns table (
  id uuid,
  name text,
  city text,
  timezone text,
  created_at timestamptz,
  member_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.city,
    c.timezone,
    c.created_at,
    (select count(*) from public.club_memberships cm where cm.club_id = c.id) as member_count
  from public.clubs c
  where public.is_superadmin()
  order by c.created_at, c.id
$$;

grant execute on function public.list_all_clubs() to authenticated;
