-- Hotfix for accept_invite: the RETURNS TABLE columns profile_id, club_id,
-- role become OUT variables in plpgsql and collide with the identically
-- named columns in club_memberships / profiles / club_invites. Same
-- pattern as claim_current_access — add #variable_conflict use_column so
-- unqualified names bind to table columns.

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
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    role = excluded.role,
    status = excluded.status
  returning id into v_profile_id;

  insert into public.club_memberships (club_id, profile_id, role)
  values (v_invite.club_id, v_profile_id, v_invite.role)
  on conflict (club_id, profile_id)
  do update set role = excluded.role;

  update public.club_invites
  set status = 'accepted', accepted_profile_id = v_profile_id, accepted_at = now()
  where id = v_invite.id;

  profile_id := v_profile_id;
  club_id := v_invite.club_id;
  role := v_invite.role;
  return next;
end;
$$;

revoke all on function public.accept_invite(text, text) from public;
grant execute on function public.accept_invite(text, text) to authenticated;

notify pgrst, 'reload schema';
