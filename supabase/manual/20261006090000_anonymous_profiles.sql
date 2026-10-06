-- Anonymous profiles: players can hide themselves from the roster/rankings.
-- Apply manually in the Supabase SQL editor.

alter table public.profiles
  add column if not exists is_anonymous boolean not null default false;

create or replace function public.set_my_anonymous(p_value boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id = (select auth.uid())
  limit 1;

  if v_profile_id is null then
    raise exception 'No profile for the current user';
  end if;

  update public.profiles
  set is_anonymous = coalesce(p_value, false)
  where id = v_profile_id;

  return coalesce(p_value, false);
end;
$$;

grant execute on function public.set_my_anonymous(boolean) to authenticated;
revoke execute on function public.set_my_anonymous(boolean) from anon;
