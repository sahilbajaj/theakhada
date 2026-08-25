-- Member role management: owners/admins can promote or demote existing members.
-- Apply manually: paste into the Supabase SQL editor, or move into
-- supabase/migrations/ locally and run `supabase db push`.

create or replace function public.list_club_members()
returns table (
  profile_id uuid,
  club_id uuid,
  full_name text,
  email text,
  role text,
  is_self boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
  v_self uuid := public.current_profile_id();
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p.id,
    cm.club_id,
    coalesce(p.full_name, p.email) as full_name,
    p.email,
    cm.role,
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

create or replace function public.set_member_role(p_profile_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
  v_self uuid := public.current_profile_id();
  v_current_role text;
begin
  if not public.is_club_admin(v_club_id) then
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

grant execute on function public.list_club_members() to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
