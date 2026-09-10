-- Fix ambiguous "profile_id" reference inside redeem_shareable_invite.
-- The function declares RETURNS TABLE (profile_id uuid, ...), which makes
-- profile_id a PL/pgSQL out-variable inside the body; the membership lookup
-- then collided with club_memberships.profile_id. Qualify with a table alias.

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
    if not exists (
      select 1 from public.club_memberships cm
      where cm.club_id = v_invite.club_id and cm.profile_id = v_profile_id
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

notify pgrst, 'reload schema';
