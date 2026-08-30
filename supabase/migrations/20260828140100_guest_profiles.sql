-- Guest members: admin-created roster entries with no auth login.
-- Apply manually (supabase db push after moving into migrations/, or SQL editor).

create or replace function public.create_guest_member(p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
  v_trimmed text := nullif(btrim(p_full_name), '');
  v_profile_id uuid;
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Only club admins can add guests';
  end if;

  if v_trimmed is null then
    raise exception 'Guest name is required';
  end if;

  if char_length(v_trimmed) > 80 then
    raise exception 'Guest name is too long (max 80 characters)';
  end if;

  insert into public.profiles (full_name, role, status, auth_user_id)
  values (v_trimmed, 'guest', 'active', null)
  returning id into v_profile_id;

  insert into public.club_memberships (club_id, profile_id, role)
  values (v_club_id, v_profile_id, 'guest')
  on conflict (club_id, profile_id) do update set role = 'guest';

  return v_profile_id;
end;
$$;

grant execute on function public.create_guest_member(text) to authenticated;
revoke execute on function public.create_guest_member(text) from anon;
