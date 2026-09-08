-- Phase 1a of multi-club rollout.
-- Adds an app-level superadmin flag (strictly meta: can create clubs and
-- invite the first owner, but has no per-club data access unless explicitly
-- a member). Adds a create_club RPC gated on that flag.

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

update public.profiles
set is_superadmin = true
where lower(email) = 'sahilbajaj.nc@gmail.com';

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select is_superadmin
      from public.profiles
      where auth_user_id = (select auth.uid())
      limit 1
    ),
    false
  )
$$;

create or replace function public.create_club(
  p_name text,
  p_city text,
  p_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'name is required' using errcode = '22023';
  end if;
  if p_timezone is null or length(btrim(p_timezone)) = 0 then
    raise exception 'timezone is required' using errcode = '22023';
  end if;

  insert into public.clubs (name, city, timezone)
  values (btrim(p_name), nullif(btrim(p_city), ''), btrim(p_timezone))
  returning id into v_club_id;

  return v_club_id;
end;
$$;

grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.create_club(text, text, text) to authenticated;
