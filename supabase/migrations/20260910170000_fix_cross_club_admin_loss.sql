-- Fix cross-club paths that can strip admin from a user later.
--
-- Three tightenings:
--   A) delete_player now removes only the caller's-club membership; it purges
--      the whole profile and auth.user only when this was the user's LAST
--      membership and they aren't a superadmin. Prevents an admin of Club A
--      from wiping a user's admin membership in Club B.
--   B) approve_signup_request no longer downgrades an existing membership via
--      on-conflict; it becomes idempotent (do nothing). Prevents a stale
--      pending signup_request from silently demoting a user promoted to
--      admin via an email invite.
--   C) accept_invite auto-closes any pending signup_requests for the same
--      (club_id, email) so the stale-request path can't be triggered later.
--      Also stops overwriting global profiles.role/status on conflict — the
--      per-club role lives in club_memberships and the global column is not
--      used for access gating.

------------------------------------------------------------
-- A. delete_player — scoped to a single club
------------------------------------------------------------

create or replace function public.delete_player(p_club_id uuid default null, p_profile_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_cm_role text;
  v_caller_profile_id uuid := public.current_profile_id();
  v_auth_user_id uuid;
  v_remaining int;
  v_is_superadmin boolean;
begin
  if not (public.is_club_admin(v_club_id) or public.is_superadmin()) then
    raise exception 'Only club admins can remove players';
  end if;

  if v_caller_profile_id = p_profile_id then
    raise exception 'You cannot remove yourself';
  end if;

  select role into v_cm_role
  from public.club_memberships
  where club_id = v_club_id and profile_id = p_profile_id
  for update;

  if v_cm_role is null then
    return;
  end if;

  if v_cm_role = 'owner' then
    raise exception 'Cannot remove the club owner';
  end if;

  delete from public.club_memberships
  where club_id = v_club_id and profile_id = p_profile_id;

  -- Clear any pending signup requests for this club so the removed user
  -- doesn't get auto-re-added by an approval later.
  delete from public.signup_requests
  where club_id = v_club_id
    and lower(email) = (select lower(email) from public.profiles where id = p_profile_id)
    and status = 'pending';

  -- Only purge the profile + auth user if this was the last membership
  -- AND the profile isn't a superadmin.
  select count(*) into v_remaining
  from public.club_memberships
  where profile_id = p_profile_id;

  select coalesce(is_superadmin, false), auth_user_id
    into v_is_superadmin, v_auth_user_id
  from public.profiles where id = p_profile_id;

  if v_remaining = 0 and not v_is_superadmin then
    delete from public.profiles where id = p_profile_id;
    if v_auth_user_id is not null then
      delete from auth.users where id = v_auth_user_id;
    end if;
  end if;
end;
$$;

grant execute on function public.delete_player(uuid, uuid) to authenticated;
revoke execute on function public.delete_player(uuid, uuid) from anon;

------------------------------------------------------------
-- B. approve_signup_request — idempotent, never downgrades
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
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name)
  returning id into v_profile_id;

  -- Never downgrade an existing membership: only insert when absent.
  insert into public.club_memberships (club_id, profile_id, role)
  values (v_request.club_id, v_profile_id, p_role)
  on conflict (club_id, profile_id) do nothing;

  update public.signup_requests
  set status = 'approved', reviewed_by = v_reviewer, reviewed_at = now(), updated_at = now()
  where id = p_request_id;
end;
$$;

------------------------------------------------------------
-- C. accept_invite — close pending sibling requests, don't overwrite profile role
------------------------------------------------------------

drop function if exists public.accept_invite(text, text);

create or replace function public.accept_invite(p_token text, p_full_name text default null)
returns table (profile_id uuid, club_id uuid, role text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_name text := nullif(trim(coalesce(p_full_name, auth.jwt() #>> '{user_metadata,full_name}', auth.jwt() #>> '{user_metadata,name}', '')), '');
  v_invite public.club_invites%rowtype;
  v_profile_id uuid;
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
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name)
  returning id into v_profile_id;

  insert into public.club_memberships (club_id, profile_id, role)
  values (v_invite.club_id, v_profile_id, v_invite.role)
  on conflict (club_id, profile_id)
  do update set role = excluded.role;

  update public.club_invites
  set status = 'accepted', accepted_profile_id = v_profile_id, accepted_at = now()
  where id = v_invite.id;

  -- Supersede any pending signup_requests for the same (club, email) so a
  -- stale request can't be approved later and downgrade this member.
  update public.signup_requests
  set status = 'approved',
      reviewed_by = v_profile_id,
      reviewed_at = now(),
      updated_at = now()
  where club_id = v_invite.club_id
    and lower(email) = v_email
    and status = 'pending';

  profile_id := v_profile_id;
  club_id := v_invite.club_id;
  role := v_invite.role;
  return next;
end;
$$;

revoke all on function public.accept_invite(text, text) from public;
grant execute on function public.accept_invite(text, text) to authenticated;

notify pgrst, 'reload schema';
