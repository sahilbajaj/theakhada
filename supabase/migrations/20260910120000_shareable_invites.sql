-- Email-agnostic (shareable) invite links.
-- Additive to the existing email-bound `club_invites` table. Anyone with the
-- link can redeem it after signing in with any email; redemption creates a
-- `signup_requests` row that flows through the existing admin approval UI.

------------------------------------------------------------
-- Table
------------------------------------------------------------

create table if not exists public.shareable_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid null references public.clubs(id) on delete cascade,
  role text not null default 'player' check (role in ('coach', 'player', 'guest')),
  token text not null unique,
  token_hash text not null unique,
  max_uses int null check (max_uses is null or max_uses > 0),
  use_count int not null default 0,
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists shareable_invites_club_idx
  on public.shareable_invites (club_id, status, created_at desc);

alter table public.shareable_invites enable row level security;

-- Admins of the target club (or any superadmin for app-wide links) can see and
-- manage links. Superadmins can see all.
create policy "admins read shareable invites" on public.shareable_invites
  for select to authenticated
  using (
    public.is_superadmin()
    or (club_id is not null and public.is_club_admin(club_id))
  );

create policy "admins revoke shareable invites" on public.shareable_invites
  for update to authenticated
  using (
    public.is_superadmin()
    or (club_id is not null and public.is_club_admin(club_id))
  )
  with check (
    public.is_superadmin()
    or (club_id is not null and public.is_club_admin(club_id))
  );

grant select, update on public.shareable_invites to authenticated;

------------------------------------------------------------
-- create_shareable_invite
------------------------------------------------------------

create or replace function public.create_shareable_invite(
  p_club_id uuid default null,
  p_role text default 'player',
  p_expires_at timestamptz default now() + interval '30 days',
  p_max_uses int default null,
  p_base_url text default ''
)
returns table (invite_id uuid, token text, invite_url text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if p_role not in ('coach', 'player', 'guest') then
    raise exception 'Invalid role';
  end if;

  if p_club_id is null then
    if not public.is_superadmin() then
      raise exception 'Only superadmins can create app-wide links';
    end if;
  else
    if not (public.is_club_admin(p_club_id) or public.is_superadmin()) then
      raise exception 'Not authorized';
    end if;
    if not exists (select 1 from public.clubs where id = p_club_id) then
      raise exception 'Club not found';
    end if;
  end if;

  if p_max_uses is not null and p_max_uses <= 0 then
    raise exception 'max_uses must be positive';
  end if;

  insert into public.shareable_invites (club_id, role, token, token_hash, max_uses, expires_at, created_by)
  values (
    p_club_id,
    p_role,
    v_token,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    p_max_uses,
    p_expires_at,
    public.current_profile_id()
  )
  returning id into invite_id;

  token := v_token;
  invite_url := rtrim(p_base_url, '/') || '/join?token=' || v_token;
  return next;
end;
$$;

revoke all on function public.create_shareable_invite(uuid, text, timestamptz, int, text) from public;
grant execute on function public.create_shareable_invite(uuid, text, timestamptz, int, text) to authenticated;

------------------------------------------------------------
-- preview_shareable_invite (public — bearer of token can already redeem)
------------------------------------------------------------

create or replace function public.preview_shareable_invite(p_token text)
returns table (
  club_id uuid,
  club_name text,
  role text,
  status text,
  expires_at timestamptz,
  max_uses int,
  use_count int,
  is_full boolean
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
    i.status,
    i.expires_at,
    i.max_uses,
    i.use_count,
    (i.max_uses is not null and i.use_count >= i.max_uses)
  from public.shareable_invites i
  left join public.clubs c on c.id = i.club_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  limit 1
$$;

grant execute on function public.preview_shareable_invite(text) to anon, authenticated;

------------------------------------------------------------
-- redeem_shareable_invite
------------------------------------------------------------

create or replace function public.redeem_shareable_invite(
  p_token text,
  p_full_name text default null
)
returns table (profile_id uuid, suggested_club_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_name text := nullif(trim(coalesce(p_full_name, auth.jwt() #>> '{user_metadata,full_name}', auth.jwt() #>> '{user_metadata,name}', '')), '');
  v_invite public.shareable_invites%rowtype;
  v_profile_id uuid;
begin
  if v_user_id is null or v_email is null then
    raise exception 'Sign in before redeeming this link';
  end if;

  select * into v_invite
  from public.shareable_invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Link is invalid';
  end if;

  if v_invite.status <> 'active' then
    raise exception 'Link has been revoked';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'Link has expired';
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'Link has reached its usage limit';
  end if;

  insert into public.profiles (auth_user_id, email, full_name, role, status)
  values (v_user_id, v_email, coalesce(v_name, v_email), 'player', 'active')
  on conflict (lower(email)) where email is not null
  do update set
    auth_user_id = excluded.auth_user_id,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name)
  returning id into v_profile_id;

  if v_invite.club_id is not null then
    -- Skip if user is already a member of the target club.
    if not exists (
      select 1 from public.club_memberships
      where club_id = v_invite.club_id and profile_id = v_profile_id
    ) then
      insert into public.signup_requests (club_id, email, full_name, requested_role)
      values (v_invite.club_id, v_email, coalesce(v_name, v_email), v_invite.role)
      on conflict (club_id, lower(email)) where status = 'pending'
      do update set
        full_name = excluded.full_name,
        requested_role = excluded.requested_role,
        updated_at = now();
    end if;
  end if;

  update public.shareable_invites
  set use_count = use_count + 1
  where id = v_invite.id;

  profile_id := v_profile_id;
  suggested_club_id := v_invite.club_id;
  return next;
end;
$$;

revoke all on function public.redeem_shareable_invite(text, text) from public;
grant execute on function public.redeem_shareable_invite(text, text) to authenticated;

------------------------------------------------------------
-- request_club_join — authenticated user asks to join a specific club
------------------------------------------------------------

create or replace function public.request_club_join(
  p_club_id uuid,
  p_requested_role text default 'player'
)
returns table (request_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_name text := nullif(coalesce(auth.jwt() #>> '{user_metadata,full_name}', auth.jwt() #>> '{user_metadata,name}'), '');
  v_profile_id uuid := public.current_profile_id();
  v_full_name text;
begin
  if v_user_id is null or v_email is null then
    raise exception 'Sign in first';
  end if;
  if p_club_id is null then
    raise exception 'Club is required';
  end if;
  if not exists (select 1 from public.clubs where id = p_club_id) then
    raise exception 'Club not found';
  end if;
  if p_requested_role not in ('coach', 'player', 'guest') then
    raise exception 'Invalid role';
  end if;

  if v_profile_id is not null then
    select full_name into v_full_name from public.profiles where id = v_profile_id;
  end if;
  v_full_name := coalesce(nullif(v_full_name, ''), v_name, v_email);

  -- If already a member, do nothing.
  if v_profile_id is not null and exists (
    select 1 from public.club_memberships
    where club_id = p_club_id and profile_id = v_profile_id
  ) then
    request_id := null;
    status := 'already_member';
    return next;
    return;
  end if;

  insert into public.signup_requests (club_id, email, full_name, requested_role)
  values (p_club_id, v_email, v_full_name, p_requested_role)
  on conflict (club_id, lower(email)) where status = 'pending'
  do update set
    full_name = excluded.full_name,
    requested_role = excluded.requested_role,
    updated_at = now()
  returning id, signup_requests.status into request_id, status;

  return next;
end;
$$;

revoke all on function public.request_club_join(uuid, text) from public;
grant execute on function public.request_club_join(uuid, text) to authenticated;

------------------------------------------------------------
-- list_joinable_clubs — clubs the authed user isn't in and hasn't requested
------------------------------------------------------------

create or replace function public.list_joinable_clubs()
returns table (
  id uuid,
  name text,
  city text,
  has_pending_request boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select
      public.current_profile_id() as profile_id,
      lower(nullif(auth.jwt() ->> 'email', '')) as email
  )
  select
    c.id,
    c.name,
    c.city,
    exists (
      select 1 from public.signup_requests sr, me
      where sr.club_id = c.id
        and lower(sr.email) = me.email
        and sr.status = 'pending'
    ) as has_pending_request
  from public.clubs c, me
  where auth.uid() is not null
    and not exists (
      select 1 from public.club_memberships cm
      where cm.club_id = c.id and cm.profile_id = me.profile_id
    )
  order by c.name
$$;

grant execute on function public.list_joinable_clubs() to authenticated;

------------------------------------------------------------
-- list_shareable_invites — admin console list
------------------------------------------------------------

create or replace function public.list_shareable_invites(p_club_id uuid default null)
returns table (
  id uuid,
  club_id uuid,
  club_name text,
  role text,
  status text,
  token text,
  max_uses int,
  use_count int,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.club_id,
    c.name,
    i.role,
    i.status,
    i.token,
    i.max_uses,
    i.use_count,
    i.expires_at,
    i.created_at
  from public.shareable_invites i
  left join public.clubs c on c.id = i.club_id
  where (
    (p_club_id is null and (public.is_superadmin() or (i.club_id is not null and public.is_club_admin(i.club_id))))
    or (p_club_id is not null and i.club_id = p_club_id and (public.is_superadmin() or public.is_club_admin(p_club_id)))
  )
  order by i.created_at desc
  limit 50
$$;

grant execute on function public.list_shareable_invites(uuid) to authenticated;

------------------------------------------------------------
-- revoke_shareable_invite
------------------------------------------------------------

create or replace function public.revoke_shareable_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.shareable_invites%rowtype;
begin
  select * into v_invite from public.shareable_invites where id = p_invite_id for update;
  if not found then
    raise exception 'Link not found';
  end if;

  if not (
    public.is_superadmin()
    or (v_invite.club_id is not null and public.is_club_admin(v_invite.club_id))
  ) then
    raise exception 'Not authorized';
  end if;

  update public.shareable_invites set status = 'revoked' where id = p_invite_id;
end;
$$;

revoke all on function public.revoke_shareable_invite(uuid) from public;
grant execute on function public.revoke_shareable_invite(uuid) to authenticated;

notify pgrst, 'reload schema';
