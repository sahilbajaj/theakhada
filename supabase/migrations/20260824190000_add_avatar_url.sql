-- Adds avatar_url to profiles and exposes it via list_club_members plus a
-- set_member_avatar admin RPC. Upload flow (Storage bucket + UI) is a
-- separate slice; for now the URL is set by admins pasting a link.
--
-- Apply manually: paste into the Supabase SQL editor.

alter table public.profiles
  add column if not exists avatar_url text;

-- list_club_members gains avatar_url in its return signature.
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
  avatar_url text,
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
    p.avatar_url,
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

-- Admin-only: set a member's avatar URL. Null / empty clears it.
create or replace function public.set_member_avatar(p_profile_id uuid, p_avatar_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
  v_trimmed text := nullif(btrim(p_avatar_url), '');
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  if v_trimmed is not null and v_trimmed !~* '^https?://' then
    raise exception 'Avatar URL must start with http:// or https://';
  end if;

  update public.profiles
  set avatar_url = v_trimmed
  where id = p_profile_id;

  if not found then
    raise exception 'Member not found';
  end if;
end;
$$;

grant execute on function public.set_member_avatar(uuid, text) to authenticated;
