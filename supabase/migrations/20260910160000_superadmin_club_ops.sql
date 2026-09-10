-- Let superadmins operate on clubs they aren't a member of.
--
-- Widens the auth guard on the four RPCs that admins hit from /admin
-- (approve_signup_request, reject_signup_request, set_member_role,
-- list_club_members, delete_player) to also allow public.is_superadmin().
-- Widens the RLS policies on signup_requests and club_memberships so
-- superadmins can read/update those rows, and extends the profiles select
-- policy so joins from list_club_members return names/emails for members
-- of clubs the superadmin isn't in.
--
-- Only the guard/using-clause changes; every function body is preserved
-- verbatim from the current definition.

------------------------------------------------------------
-- RPC guards
------------------------------------------------------------

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

  if not (public.is_club_admin(v_request.club_id) or public.is_superadmin()) then
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

  if not (public.is_club_admin(v_request.club_id) or public.is_superadmin()) then
    raise exception 'Not authorized';
  end if;

  update public.signup_requests
  set status = 'rejected', reviewed_by = public.current_profile_id(), reviewed_at = now(), updated_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.list_club_members(p_club_id uuid default null)
returns table (
  profile_id uuid,
  club_id uuid,
  full_name text,
  nickname text,
  email text,
  role text,
  rating numeric,
  avatar_url text,
  is_self boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_self uuid := public.current_profile_id();
begin
  if not (public.is_club_admin(v_club_id) or public.is_superadmin()) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p.id,
    cm.club_id,
    coalesce(p.full_name, p.email) as full_name,
    p.nickname,
    p.email,
    cm.role,
    p.rating,
    p.avatar_url,
    (p.id = v_self) as is_self
  from public.club_memberships cm
  join public.profiles p on p.id = cm.profile_id
  where cm.club_id = v_club_id
  order by
    case cm.role
      when 'owner' then 0
      when 'admin' then 1
      when 'coach' then 2
      when 'player' then 3
      else 4
    end,
    coalesce(p.full_name, p.email);
end;
$$;

create or replace function public.set_member_role(p_club_id uuid default null, p_profile_id uuid default null, p_role text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_self uuid := public.current_profile_id();
  v_current_role text;
begin
  if not (public.is_club_admin(v_club_id) or public.is_superadmin()) then
    raise exception 'Not authorized';
  end if;

  if p_role not in ('admin', 'coach', 'player', 'guest') then
    raise exception 'Invalid role';
  end if;

  select role into v_current_role
  from public.club_memberships
  where club_id = v_club_id and profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'Member not found';
  end if;

  if v_current_role = 'owner' then
    raise exception 'The club owner role cannot be changed';
  end if;

  if p_profile_id = v_self then
    raise exception 'You cannot change your own role';
  end if;

  update public.club_memberships
  set role = p_role
  where club_id = v_club_id and profile_id = p_profile_id;

  update public.profiles
  set
    role = p_role,
    status = case when p_role = 'guest' then 'visitor' else 'active' end
  where id = p_profile_id;
end;
$$;

create or replace function public.delete_player(p_club_id uuid default null, p_profile_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_role text;
  v_auth_user_id uuid;
  v_caller_profile_id uuid;
begin
  if not (public.is_club_admin(v_club_id) or public.is_superadmin()) then
    raise exception 'Only club admins can delete players';
  end if;

  select role, auth_user_id into v_role, v_auth_user_id
  from public.profiles
  where id = p_profile_id;

  if v_role is null then
    return;
  end if;

  if v_role = 'owner' then
    raise exception 'Cannot delete the club owner';
  end if;

  select id into v_caller_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_caller_profile_id = p_profile_id then
    raise exception 'You cannot delete your own profile';
  end if;

  delete from public.profiles where id = p_profile_id;

  if v_auth_user_id is not null then
    delete from auth.users where id = v_auth_user_id;
  end if;
end;
$$;

------------------------------------------------------------
-- RLS
------------------------------------------------------------

drop policy if exists "admins can read signup requests" on public.signup_requests;
create policy "admins can read signup requests" on public.signup_requests for select to authenticated
using (public.is_club_admin(club_id) or public.is_superadmin());

drop policy if exists "admins can update signup requests" on public.signup_requests;
create policy "admins can update signup requests" on public.signup_requests for update to authenticated
using (public.is_club_admin(club_id) or public.is_superadmin())
with check (public.is_club_admin(club_id) or public.is_superadmin());

drop policy if exists "members can read memberships" on public.club_memberships;
create policy "members can read memberships" on public.club_memberships for select to authenticated
using (public.is_club_member(club_id) or public.is_superadmin());

drop policy if exists "members can read profiles" on public.profiles;
create policy "members can read profiles" on public.profiles for select to authenticated
using (
  auth_user_id = (select auth.uid())
  or public.is_superadmin()
  or exists (
    select 1
    from public.club_memberships target_membership
    where target_membership.profile_id = profiles.id
      and public.is_club_member(target_membership.club_id)
  )
);

notify pgrst, 'reload schema';
