alter table public.profiles
  add column if not exists email text;

update public.profiles
set email = lower(email)
where email is not null;

create unique index if not exists profiles_auth_user_id_unique_idx
  on public.profiles (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

create table if not exists public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  email text not null,
  full_name text not null,
  requested_role text not null default 'player' check (requested_role in ('coach', 'player', 'guest')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists signup_requests_pending_email_idx
  on public.signup_requests (club_id, lower(email))
  where status = 'pending';

create index if not exists signup_requests_club_status_idx
  on public.signup_requests (club_id, status, created_at);

create table if not exists public.club_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  email text not null,
  role text not null default 'player' check (role in ('admin', 'coach', 'player', 'guest')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  accepted_profile_id uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists club_invites_pending_email_idx
  on public.club_invites (club_id, lower(email))
  where status = 'pending';

create index if not exists club_invites_club_status_idx
  on public.club_invites (club_id, status, created_at);

alter table public.signup_requests enable row level security;
alter table public.club_invites enable row level security;

create or replace function public.default_club_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.clubs order by created_at, id limit 1
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.profiles
  where auth_user_id = (select auth.uid())
  limit 1
$$;

create or replace function public.is_club_member(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_memberships cm
    join public.profiles p on p.id = cm.profile_id
    where cm.club_id = target_club_id
      and p.auth_user_id = (select auth.uid())
  )
$$;

create or replace function public.is_club_admin(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_memberships cm
    join public.profiles p on p.id = cm.profile_id
    where cm.club_id = target_club_id
      and p.auth_user_id = (select auth.uid())
      and cm.role in ('owner', 'admin')
  )
$$;

create or replace function public.claim_current_access()
returns table (
  profile_id uuid,
  club_id uuid,
  role text,
  full_name text,
  email text,
  has_membership boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_name text := nullif(coalesce(auth.jwt() #>> '{user_metadata,full_name}', auth.jwt() #>> '{user_metadata,name}'), '');
  v_club_id uuid := public.default_club_id();
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
    values (v_club_id, v_profile_id, 'owner')
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
    cm.role,
    p.full_name,
    coalesce(p.email, v_email),
    cm.id is not null
  from public.profiles p
  left join public.club_memberships cm on cm.profile_id = p.id
  where p.auth_user_id = v_user_id
  order by cm.created_at nulls last
  limit 1;

  if not found then
    return query select null::uuid, null::uuid, null::text, coalesce(v_name, v_email), v_email, false;
  end if;
end;
$$;

create or replace function public.request_access(p_email text, p_full_name text)
returns table (request_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_name text := trim(p_full_name);
  v_club_id uuid := public.default_club_id();
begin
  if v_email = '' or v_name = '' then
    raise exception 'Email and name are required';
  end if;

  insert into public.signup_requests (club_id, email, full_name)
  values (v_club_id, v_email, v_name)
  on conflict (club_id, lower(email)) where status = 'pending'
  do update set
    full_name = excluded.full_name,
    updated_at = now()
  returning id, signup_requests.status into request_id, status;

  return next;
end;
$$;

create or replace function public.approve_signup_request(p_request_id uuid, p_role text default 'player')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.signup_requests%rowtype;
  v_reviewer uuid := public.current_profile_id();
  v_profile_id uuid;
begin
  select * into v_request
  from public.signup_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if not public.is_club_admin(v_request.club_id) then
    raise exception 'Not authorized';
  end if;

  if p_role not in ('coach', 'player', 'guest') then
    raise exception 'Invalid role';
  end if;

  insert into public.profiles (email, full_name, role, status)
  values (lower(v_request.email), v_request.full_name, p_role, case when p_role = 'guest' then 'visitor' else 'active' end)
  on conflict (lower(email)) where email is not null
  do update set
    full_name = excluded.full_name,
    role = excluded.role,
    status = excluded.status
  returning id into v_profile_id;

  insert into public.club_memberships (club_id, profile_id, role)
  values (v_request.club_id, v_profile_id, p_role)
  on conflict (club_id, profile_id)
  do update set role = excluded.role;

  update public.signup_requests
  set status = 'approved', reviewed_by = v_reviewer, reviewed_at = now(), updated_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.reject_signup_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.signup_requests%rowtype;
begin
  select * into v_request
  from public.signup_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if not public.is_club_admin(v_request.club_id) then
    raise exception 'Not authorized';
  end if;

  update public.signup_requests
  set status = 'rejected', reviewed_by = public.current_profile_id(), reviewed_at = now(), updated_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.create_invite(
  p_email text,
  p_role text default 'player',
  p_expires_at timestamptz default now() + interval '7 days',
  p_base_url text default ''
)
returns table (invite_id uuid, token text, invite_url text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_club_id uuid := public.default_club_id();
  v_token text := encode(gen_random_bytes(32), 'hex');
begin
  if not public.is_club_admin(v_club_id) then
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
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
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

drop policy if exists "authenticated users can read clubs" on public.clubs;
drop policy if exists "authenticated users can read profiles" on public.profiles;
drop policy if exists "authenticated users can read memberships" on public.club_memberships;
drop policy if exists "authenticated users can read courts" on public.courts;
drop policy if exists "authenticated users can read bookings" on public.bookings;
drop policy if exists "authenticated users can read matches" on public.matches;
drop policy if exists "authenticated users can read attendance sessions" on public.attendance_sessions;
drop policy if exists "authenticated users can read attendance records" on public.attendance_records;
drop policy if exists "authenticated users can read tournaments" on public.tournaments;
drop policy if exists "authenticated users can insert bookings" on public.bookings;
drop policy if exists "authenticated users can update bookings" on public.bookings;
drop policy if exists "authenticated users can delete bookings" on public.bookings;
drop policy if exists "authenticated users can insert matches" on public.matches;
drop policy if exists "authenticated users can update matches" on public.matches;
drop policy if exists "authenticated users can delete matches" on public.matches;
drop policy if exists "authenticated users can insert attendance sessions" on public.attendance_sessions;
drop policy if exists "authenticated users can update attendance sessions" on public.attendance_sessions;
drop policy if exists "authenticated users can delete attendance sessions" on public.attendance_sessions;
drop policy if exists "authenticated users can insert attendance records" on public.attendance_records;
drop policy if exists "authenticated users can update attendance records" on public.attendance_records;
drop policy if exists "authenticated users can delete attendance records" on public.attendance_records;

create policy "members can read clubs" on public.clubs for select to authenticated
using (public.is_club_member(id));

create policy "members can read courts" on public.courts for select to authenticated
using (public.is_club_member(club_id));

create policy "members can read bookings" on public.bookings for select to authenticated
using (public.is_club_member(club_id));

create policy "members can manage bookings" on public.bookings for all to authenticated
using (public.is_club_member(club_id))
with check (public.is_club_member(club_id));

create policy "members can read matches" on public.matches for select to authenticated
using (public.is_club_member(club_id));

create policy "members can manage matches" on public.matches for all to authenticated
using (public.is_club_member(club_id))
with check (public.is_club_member(club_id));

create policy "members can read attendance sessions" on public.attendance_sessions for select to authenticated
using (public.is_club_member(club_id));

create policy "members can manage attendance sessions" on public.attendance_sessions for all to authenticated
using (public.is_club_member(club_id))
with check (public.is_club_member(club_id));

create policy "members can read attendance records" on public.attendance_records for select to authenticated
using (
  exists (
    select 1
    from public.attendance_sessions s
    where s.id = session_id
      and public.is_club_member(s.club_id)
  )
);

create policy "members can manage attendance records" on public.attendance_records for all to authenticated
using (
  exists (
    select 1
    from public.attendance_sessions s
    where s.id = session_id
      and public.is_club_member(s.club_id)
  )
)
with check (
  exists (
    select 1
    from public.attendance_sessions s
    where s.id = session_id
      and public.is_club_member(s.club_id)
  )
);

create policy "members can read tournaments" on public.tournaments for select to authenticated
using (public.is_club_member(club_id));

create policy "members can read memberships" on public.club_memberships for select to authenticated
using (public.is_club_member(club_id));

create policy "members can read profiles" on public.profiles for select to authenticated
using (
  auth_user_id = (select auth.uid())
  or exists (
    select 1
    from public.club_memberships target_membership
    where target_membership.profile_id = profiles.id
      and public.is_club_member(target_membership.club_id)
  )
);

create policy "admins can read signup requests" on public.signup_requests for select to authenticated
using (public.is_club_admin(club_id));

create policy "admins can update signup requests" on public.signup_requests for update to authenticated
using (public.is_club_admin(club_id))
with check (public.is_club_admin(club_id));

create policy "admins can read invites" on public.club_invites for select to authenticated
using (public.is_club_admin(club_id));

revoke all on function public.default_club_id() from public;
revoke all on function public.current_profile_id() from public;
revoke all on function public.is_club_member(uuid) from public;
revoke all on function public.is_club_admin(uuid) from public;
revoke all on function public.claim_current_access() from public;
revoke all on function public.request_access(text, text) from public;
revoke all on function public.approve_signup_request(uuid, text) from public;
revoke all on function public.reject_signup_request(uuid) from public;
revoke all on function public.create_invite(text, text, timestamptz, text) from public;
revoke all on function public.accept_invite(text, text) from public;

grant execute on function public.default_club_id() to authenticated;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.is_club_member(uuid) to authenticated;
grant execute on function public.is_club_admin(uuid) to authenticated;
grant execute on function public.claim_current_access() to authenticated;
grant execute on function public.request_access(text, text) to anon, authenticated;
grant execute on function public.approve_signup_request(uuid, text) to authenticated;
grant execute on function public.reject_signup_request(uuid) to authenticated;
grant execute on function public.create_invite(text, text, timestamptz, text) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;

grant select on public.signup_requests to authenticated;
grant select on public.club_invites to authenticated;
