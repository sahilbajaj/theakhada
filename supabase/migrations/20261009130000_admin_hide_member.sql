-- Admins/owners can hide (or unhide) a club member's profile.
-- Players can still unhide themselves via set_my_anonymous.
create or replace function public.set_member_anonymous(p_profile_id uuid, p_value boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.club_memberships cm
    where cm.profile_id = p_profile_id
      and public.is_club_admin(cm.club_id)
  ) then
    raise exception 'Only club admins can hide another member';
  end if;

  update public.profiles
  set is_anonymous = coalesce(p_value, false)
  where id = p_profile_id;

  return coalesce(p_value, false);
end;
$$;

grant execute on function public.set_member_anonymous(uuid, boolean) to authenticated;
revoke execute on function public.set_member_anonymous(uuid, boolean) from anon;
