-- Admin RPCs: delete a match, rename a member (full_name), delete a player.
-- All gated via public.is_club_admin(v_club_id).

create or replace function public.delete_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  select club_id into v_club_id from public.matches where id = p_match_id;
  if v_club_id is null then
    return;
  end if;
  if not public.is_club_admin(v_club_id) then
    raise exception 'Only club admins can delete matches';
  end if;
  delete from public.matches where id = p_match_id;
end;
$$;

grant execute on function public.delete_match(uuid) to authenticated;
revoke execute on function public.delete_match(uuid) from anon;

create or replace function public.set_member_full_name(p_profile_id uuid, p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
  v_trimmed text := nullif(btrim(p_full_name), '');
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  if v_trimmed is null then
    raise exception 'Full name is required';
  end if;

  if char_length(v_trimmed) > 80 then
    raise exception 'Full name is too long (max 80 characters)';
  end if;

  update public.profiles
  set full_name = v_trimmed
  where id = p_profile_id;

  if not found then
    raise exception 'Member not found';
  end if;
end;
$$;

grant execute on function public.set_member_full_name(uuid, text) to authenticated;
revoke execute on function public.set_member_full_name(uuid, text) from anon;

create or replace function public.delete_player(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid := public.default_club_id();
  v_role text;
  v_auth_user_id uuid;
  v_caller_profile_id uuid;
begin
  if not public.is_club_admin(v_club_id) then
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

grant execute on function public.delete_player(uuid) to authenticated;
revoke execute on function public.delete_player(uuid) from anon;
