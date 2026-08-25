-- Seeding v1: whole-list admin RPC to set every profile's seed atomically,
-- plus a clear-all helper. Reuses the existing profiles.seed column.
--
-- Apply manually: paste into the Supabase SQL editor.

create or replace function public.set_all_seeds(p_profile_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  -- Assign 1..N to the ordered list; null every other profile in the club.
  update public.profiles p
  set seed = ord.seed
  from (
    select ord.value::uuid as profile_id, ord.ordinality::int as seed
    from unnest(p_profile_ids) with ordinality as ord(value, ordinality)
  ) as ord
  where p.id = ord.profile_id;

  update public.profiles p
  set seed = null
  where p.id in (
    select cm.profile_id from public.club_memberships cm where cm.club_id = v_club_id
  )
  and (p.id <> all(coalesce(p_profile_ids, '{}'::uuid[])));
end;
$$;

grant execute on function public.set_all_seeds(uuid[]) to authenticated;

create or replace function public.clear_all_seeds()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  update public.profiles
  set seed = null
  where id in (
    select cm.profile_id from public.club_memberships cm where cm.club_id = v_club_id
  );
end;
$$;

grant execute on function public.clear_all_seeds() to authenticated;
