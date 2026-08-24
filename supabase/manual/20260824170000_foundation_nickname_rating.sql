-- Foundation: nicknames on profiles, display preference on clubs,
-- admin RPCs for setting a member's nickname / rating, and
-- extended list_club_members payload.
--
-- Apply manually: paste into the Supabase SQL editor.

-- Schema additions (idempotent).
alter table public.profiles
  add column if not exists nickname text;

alter table public.clubs
  add column if not exists prefer_nicknames boolean not null default true;

-- list_club_members returns extra columns now, so drop-and-recreate.
drop function if exists public.list_club_members();

create or replace function public.list_club_members()
returns table (
  profile_id uuid,
  club_id uuid,
  full_name text,
  nickname text,
  email text,
  role text,
  rating numeric,
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
    p.nickname,
    p.email,
    cm.role,
    p.rating,
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

grant execute on function public.list_club_members() to authenticated;

-- Admin-only: set a member's rating.
create or replace function public.set_member_rating(p_profile_id uuid, p_rating numeric)
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

  if p_rating is null or p_rating < 1.0 or p_rating > 7.0 then
    raise exception 'Rating must be between 1.0 and 7.0';
  end if;

  update public.profiles
  set rating = p_rating
  where id = p_profile_id;

  if not found then
    raise exception 'Member not found';
  end if;
end;
$$;

grant execute on function public.set_member_rating(uuid, numeric) to authenticated;

-- Admin-only: set a member's nickname (null / empty clears it).
create or replace function public.set_member_nickname(p_profile_id uuid, p_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
  v_trimmed text := nullif(btrim(p_nickname), '');
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  if v_trimmed is not null and char_length(v_trimmed) > 40 then
    raise exception 'Nickname is too long (max 40 characters)';
  end if;

  update public.profiles
  set nickname = v_trimmed
  where id = p_profile_id;

  if not found then
    raise exception 'Member not found';
  end if;
end;
$$;

grant execute on function public.set_member_nickname(uuid, text) to authenticated;

-- Admin-only: toggle the club's display preference for nicknames.
create or replace function public.set_club_prefer_nicknames(p_value boolean)
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

  update public.clubs
  set prefer_nicknames = coalesce(p_value, true)
  where id = v_club_id;
end;
$$;

grant execute on function public.set_club_prefer_nicknames(boolean) to authenticated;
