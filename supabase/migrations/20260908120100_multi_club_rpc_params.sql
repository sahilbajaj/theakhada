-- Multi-club rollout — Phase 1b.
--
-- Adds an optional `p_club_id uuid default null` parameter to every RPC that
-- currently resolves the active club via `public.default_club_id()`. Existing
-- callers that omit the argument keep working (fallback to default_club_id()),
-- while new callers can pass an explicit club id. This is a
-- backwards-compatible transitional step; a later phase will make the
-- parameter required and drop the fallback.
--
-- Transformation rule applied to every function below:
--   * `p_club_id uuid default null` is inserted as the FIRST parameter.
--   * `v_club_id uuid := public.default_club_id();` becomes
--     `v_club_id uuid := coalesce(p_club_id, public.default_club_id());`.
--   * Inline `public.default_club_id()` calls inside queries become
--     `coalesce(p_club_id, public.default_club_id())`.
-- All other logic, comments, RLS checks, language / security-definer /
-- search_path declarations are preserved verbatim from the latest definition
-- of each function.
--
-- Explicitly NOT touched by this migration (owns club selection differently):
--   default_club_id, is_club_member, is_club_admin, current_profile_id,
--   is_superadmin, create_club, request_access, accept_invite,
--   approve_signup_request, claim_current_access, recompute_seeds (already
--   takes p_club_id), _insights_player_matches (already takes p_club_id).

------------------------------------------------------------
-- list_club_members
------------------------------------------------------------

drop function if exists public.list_club_members();

create or replace function public.list_club_members(p_club_id uuid default null)
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
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
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

grant execute on function public.list_club_members(uuid) to authenticated;

------------------------------------------------------------
-- set_member_role
------------------------------------------------------------

drop function if exists public.set_member_role(uuid, text);

create or replace function public.set_member_role(p_club_id uuid default null, p_profile_id uuid default null, p_role text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
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

grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;

------------------------------------------------------------
-- set_member_rating
------------------------------------------------------------

drop function if exists public.set_member_rating(uuid, numeric);

create or replace function public.set_member_rating(p_club_id uuid default null, p_profile_id uuid default null, p_rating numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
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

grant execute on function public.set_member_rating(uuid, uuid, numeric) to authenticated;

------------------------------------------------------------
-- set_member_nickname
------------------------------------------------------------

drop function if exists public.set_member_nickname(uuid, text);

create or replace function public.set_member_nickname(p_club_id uuid default null, p_profile_id uuid default null, p_nickname text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
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

grant execute on function public.set_member_nickname(uuid, uuid, text) to authenticated;

------------------------------------------------------------
-- set_club_prefer_nicknames
------------------------------------------------------------

drop function if exists public.set_club_prefer_nicknames(boolean);

create or replace function public.set_club_prefer_nicknames(p_club_id uuid default null, p_value boolean default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  update public.clubs
  set prefer_nicknames = coalesce(p_value, true)
  where id = v_club_id;
end;
$$;

grant execute on function public.set_club_prefer_nicknames(uuid, boolean) to authenticated;

------------------------------------------------------------
-- set_member_avatar
------------------------------------------------------------

drop function if exists public.set_member_avatar(uuid, text);

create or replace function public.set_member_avatar(p_club_id uuid default null, p_profile_id uuid default null, p_avatar_url text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
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

grant execute on function public.set_member_avatar(uuid, uuid, text) to authenticated;

------------------------------------------------------------
-- set_member_full_name
------------------------------------------------------------

drop function if exists public.set_member_full_name(uuid, text);

create or replace function public.set_member_full_name(p_club_id uuid default null, p_profile_id uuid default null, p_full_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
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

grant execute on function public.set_member_full_name(uuid, uuid, text) to authenticated;
revoke execute on function public.set_member_full_name(uuid, uuid, text) from anon;

------------------------------------------------------------
-- delete_player
------------------------------------------------------------

drop function if exists public.delete_player(uuid);

create or replace function public.delete_player(p_club_id uuid default null, p_profile_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
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

grant execute on function public.delete_player(uuid, uuid) to authenticated;
revoke execute on function public.delete_player(uuid, uuid) from anon;

------------------------------------------------------------
-- create_guest_member
------------------------------------------------------------

drop function if exists public.create_guest_member(text);

create or replace function public.create_guest_member(p_club_id uuid default null, p_full_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
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

grant execute on function public.create_guest_member(uuid, text) to authenticated;
revoke execute on function public.create_guest_member(uuid, text) from anon;

------------------------------------------------------------
-- set_all_seeds
------------------------------------------------------------

drop function if exists public.set_all_seeds(uuid[]);

create or replace function public.set_all_seeds(p_club_id uuid default null, p_profile_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
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

grant execute on function public.set_all_seeds(uuid, uuid[]) to authenticated;

------------------------------------------------------------
-- clear_all_seeds
------------------------------------------------------------

drop function if exists public.clear_all_seeds();

create or replace function public.clear_all_seeds(p_club_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
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

grant execute on function public.clear_all_seeds(uuid) to authenticated;

------------------------------------------------------------
-- create_match
------------------------------------------------------------

drop function if exists public.create_match(text, uuid[], uuid[], smallint, uuid, timestamptz);

create or replace function public.create_match(
  p_club_id uuid default null,
  p_format text default null,
  p_side_a uuid[] default null,
  p_side_b uuid[] default null,
  p_best_of smallint default 3,
  p_court_id uuid default null,
  p_starts_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_self uuid := public.current_profile_id();
  v_match_id uuid;
  v_expected smallint := case when p_format = 'doubles' then 2 else 1 end;
  v_all uuid[] := p_side_a || p_side_b;
  v_i int;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;
  if v_club_id is null then raise exception 'No club configured'; end if;
  if not public.is_club_member(v_club_id) then raise exception 'Not authorized'; end if;
  if p_format not in ('singles', 'doubles') then raise exception 'Invalid format'; end if;
  if p_best_of not in (1, 3, 5) then raise exception 'best_of must be 1, 3, or 5'; end if;
  if array_length(p_side_a, 1) is distinct from v_expected
     or array_length(p_side_b, 1) is distinct from v_expected then
    raise exception 'Each side needs % player(s)', v_expected;
  end if;
  if (select count(distinct id) from unnest(v_all) as id) <> (v_expected * 2) then
    raise exception 'Players must be distinct';
  end if;
  if exists (
    select 1 from unnest(v_all) as pid
    left join public.club_memberships cm
      on cm.profile_id = pid and cm.club_id = v_club_id
    where cm.profile_id is null
  ) then
    raise exception 'All players must be members of the club';
  end if;

  insert into public.matches (club_id, court_id, format, starts_at, status, best_of)
  values (v_club_id, p_court_id, p_format, p_starts_at, 'live', p_best_of)
  returning id into v_match_id;

  for v_i in 1 .. v_expected loop
    insert into public.match_participants (match_id, profile_id, side, position)
    values (v_match_id, p_side_a[v_i], 'A', v_i);
    insert into public.match_participants (match_id, profile_id, side, position)
    values (v_match_id, p_side_b[v_i], 'B', v_i);
  end loop;

  insert into public.match_events (match_id, actor_profile_id, kind, payload)
  values (v_match_id, v_self, 'match_created', jsonb_build_object('format', p_format, 'best_of', p_best_of));

  return v_match_id;
end;
$$;

grant execute on function public.create_match(uuid, text, uuid[], uuid[], smallint, uuid, timestamptz) to authenticated;

------------------------------------------------------------
-- list_recent_matches
-- (latest definition: 20260903050000_match_suspension.sql)
------------------------------------------------------------

drop function if exists public.list_recent_matches(int);

create or replace function public.list_recent_matches(p_club_id uuid default null, p_limit int default 25)
returns table (
  match_id uuid,
  format text,
  status text,
  starts_at timestamptz,
  court_id uuid,
  best_of smallint,
  side_a jsonb,
  side_b jsonb,
  sets jsonb,
  winner_side char(1),
  reviewed_at timestamptz,
  suspended_reason text,
  suspended_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_is_admin boolean;
begin
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  v_is_admin := public.is_club_admin(v_club_id);

  return query
  with participants as (
    select
      mp.match_id,
      mp.side,
      jsonb_agg(
        jsonb_build_object(
          'profile_id', p.id,
          'full_name', p.full_name,
          'nickname', p.nickname,
          'avatar_url', p.avatar_url,
          'position', mp.position
        )
        order by mp.position
      ) as roster
    from public.match_participants mp
    join public.profiles p on p.id = mp.profile_id
    group by mp.match_id, mp.side
  ),
  sides as (
    select
      participants.match_id,
      (array_agg(roster) filter (where side = 'A'))[1] as side_a,
      (array_agg(roster) filter (where side = 'B'))[1] as side_b
    from participants
    group by participants.match_id
  ),
  set_rows as (
    select
      ms.match_id,
      jsonb_agg(
        jsonb_build_object(
          'set_index', ms.set_index,
          'side_a_games', ms.side_a_games,
          'side_b_games', ms.side_b_games,
          'tiebreak_a', ms.tiebreak_a,
          'tiebreak_b', ms.tiebreak_b
        )
        order by ms.set_index
      ) as sets,
      count(*) filter (
        where ms.side_a_games > ms.side_b_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_a, 0) > coalesce(ms.tiebreak_b, 0))
      ) as sets_a,
      count(*) filter (
        where ms.side_b_games > ms.side_a_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_b, 0) > coalesce(ms.tiebreak_a, 0))
      ) as sets_b
    from public.match_sets ms
    group by ms.match_id
  )
  select
    m.id,
    m.format,
    m.status,
    m.starts_at,
    m.court_id,
    m.best_of,
    coalesce(s.side_a, '[]'::jsonb),
    coalesce(s.side_b, '[]'::jsonb),
    coalesce(sr.sets, '[]'::jsonb),
    case
      when m.status <> 'final' then null
      when coalesce(sr.sets_a, 0) > coalesce(sr.sets_b, 0) then 'A'::char(1)
      when coalesce(sr.sets_b, 0) > coalesce(sr.sets_a, 0) then 'B'::char(1)
      else null
    end as winner_side,
    case when v_is_admin then m.reviewed_at else null end as reviewed_at,
    m.suspended_reason,
    m.suspended_note
  from public.matches m
  left join sides s on s.match_id = m.id
  left join set_rows sr on sr.match_id = m.id
  where m.club_id = v_club_id
    and exists (select 1 from public.match_participants mp where mp.match_id = m.id)
  order by m.starts_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100));
end;
$$;

grant execute on function public.list_recent_matches(uuid, int) to authenticated;

------------------------------------------------------------
-- list_unreviewed_matches
-- (latest definition: 20260903050000_match_suspension.sql)
------------------------------------------------------------

drop function if exists public.list_unreviewed_matches(int);

create or replace function public.list_unreviewed_matches(p_club_id uuid default null, p_limit int default 200)
returns table (
  match_id uuid,
  format text,
  status text,
  starts_at timestamptz,
  court_id uuid,
  best_of smallint,
  side_a jsonb,
  side_b jsonb,
  sets jsonb,
  winner_side char(1),
  reviewed_at timestamptz,
  suspended_reason text,
  suspended_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  return query
  with participants as (
    select
      mp.match_id,
      mp.side,
      jsonb_agg(
        jsonb_build_object(
          'profile_id', p.id,
          'full_name', p.full_name,
          'nickname', p.nickname,
          'avatar_url', p.avatar_url,
          'position', mp.position
        )
        order by mp.position
      ) as roster
    from public.match_participants mp
    join public.profiles p on p.id = mp.profile_id
    group by mp.match_id, mp.side
  ),
  sides as (
    select
      participants.match_id,
      (array_agg(roster) filter (where side = 'A'))[1] as side_a,
      (array_agg(roster) filter (where side = 'B'))[1] as side_b
    from participants
    group by participants.match_id
  ),
  set_rows as (
    select
      ms.match_id,
      jsonb_agg(
        jsonb_build_object(
          'set_index', ms.set_index,
          'side_a_games', ms.side_a_games,
          'side_b_games', ms.side_b_games,
          'tiebreak_a', ms.tiebreak_a,
          'tiebreak_b', ms.tiebreak_b
        )
        order by ms.set_index
      ) as sets,
      count(*) filter (
        where ms.side_a_games > ms.side_b_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_a, 0) > coalesce(ms.tiebreak_b, 0))
      ) as sets_a,
      count(*) filter (
        where ms.side_b_games > ms.side_a_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_b, 0) > coalesce(ms.tiebreak_a, 0))
      ) as sets_b
    from public.match_sets ms
    group by ms.match_id
  )
  select
    m.id,
    m.format,
    m.status,
    m.starts_at,
    m.court_id,
    m.best_of,
    coalesce(s.side_a, '[]'::jsonb),
    coalesce(s.side_b, '[]'::jsonb),
    coalesce(sr.sets, '[]'::jsonb),
    case
      when coalesce(sr.sets_a, 0) > coalesce(sr.sets_b, 0) then 'A'::char(1)
      when coalesce(sr.sets_b, 0) > coalesce(sr.sets_a, 0) then 'B'::char(1)
      else null
    end as winner_side,
    m.reviewed_at,
    m.suspended_reason,
    m.suspended_note
  from public.matches m
  left join sides s on s.match_id = m.id
  left join set_rows sr on sr.match_id = m.id
  where m.club_id = v_club_id
    and m.status = 'final'
    and m.reviewed_at is null
    and exists (select 1 from public.match_participants mp where mp.match_id = m.id)
  order by m.starts_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

grant execute on function public.list_unreviewed_matches(uuid, int) to authenticated;
revoke execute on function public.list_unreviewed_matches(uuid, int) from anon;

------------------------------------------------------------
-- review_match
------------------------------------------------------------

drop function if exists public.review_match(uuid);

create or replace function public.review_match(p_club_id uuid default null, p_match_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_profile_id uuid;
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  select id into v_profile_id from public.profiles where auth_user_id = auth.uid();

  update public.matches
  set reviewed_at = now(),
      reviewed_by = v_profile_id
  where id = p_match_id
    and club_id = v_club_id
    and status = 'final'
    and reviewed_at is null;
end;
$$;

grant execute on function public.review_match(uuid, uuid) to authenticated;
revoke execute on function public.review_match(uuid, uuid) from anon;

------------------------------------------------------------
-- review_matches_for_day
------------------------------------------------------------

drop function if exists public.review_matches_for_day(date);

create or replace function public.review_matches_for_day(p_club_id uuid default null, p_day date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_timezone text;
  v_profile_id uuid;
  v_count integer;
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  if p_day is null then
    raise exception 'Day is required';
  end if;

  select coalesce(timezone, 'UTC') into v_timezone from public.clubs where id = v_club_id;
  select id into v_profile_id from public.profiles where auth_user_id = auth.uid();

  with updated as (
    update public.matches
    set reviewed_at = now(),
        reviewed_by = v_profile_id
    where club_id = v_club_id
      and status = 'final'
      and reviewed_at is null
      and (starts_at at time zone coalesce(v_timezone, 'UTC'))::date = p_day
    returning 1
  )
  select count(*)::integer into v_count from updated;

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.review_matches_for_day(uuid, date) to authenticated;
revoke execute on function public.review_matches_for_day(uuid, date) from anon;

------------------------------------------------------------
-- record_set
-- (latest definition: 20260903050000_match_suspension.sql)
-- Note: record_set does not use default_club_id() — it derives club_id from
-- the match row. Included here only because the task specification enumerates
-- functions that reference default_club_id(); record_set does not, so it is
-- deliberately SKIPPED. See report for detail.
------------------------------------------------------------

------------------------------------------------------------
-- create_americano_tournament
------------------------------------------------------------

drop function if exists public.create_americano_tournament(text, text[], integer, integer, jsonb);

create or replace function public.create_americano_tournament(
  p_club_id uuid default null,
  p_name text default null,
  p_player_names text[] default null,
  p_points_per_match integer default null,
  p_court_count integer default null,
  p_matches jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_tournament_id uuid;
  v_player_ids uuid[] := '{}';
  v_new_id uuid;
  v_name text;
  v_idx int := 0;
  v_match jsonb;
  v_match_id uuid;
  v_player_index int;
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Only club admins can create tournaments';
  end if;
  if coalesce(array_length(p_player_names, 1), 0) < 4 then
    raise exception 'At least 4 players are required';
  end if;
  if p_points_per_match not in (16, 24, 32) then
    raise exception 'Points per match must be 16, 24 or 32';
  end if;

  insert into public.americano_tournaments (club_id, name, points_per_match, court_count, created_by)
  values (
    v_club_id,
    coalesce(nullif(btrim(p_name), ''), 'Americano'),
    p_points_per_match,
    p_court_count,
    public.current_profile_id()
  )
  returning id into v_tournament_id;

  foreach v_name in array p_player_names loop
    insert into public.americano_players (tournament_id, name, sort_order)
    values (v_tournament_id, btrim(v_name), v_idx)
    returning id into v_new_id;
    v_player_ids := v_player_ids || v_new_id;
    v_idx := v_idx + 1;
  end loop;

  for v_match in select value from jsonb_array_elements(p_matches) loop
    insert into public.americano_matches (tournament_id, round_number, court_number)
    values (v_tournament_id, (v_match->>'round')::smallint, (v_match->>'court')::smallint)
    returning id into v_match_id;

    for v_player_index in select (value)::int from jsonb_array_elements_text(v_match->'team_a') loop
      insert into public.americano_match_players (match_id, player_id, team_designation)
      values (v_match_id, v_player_ids[v_player_index + 1], 'A');
    end loop;
    for v_player_index in select (value)::int from jsonb_array_elements_text(v_match->'team_b') loop
      insert into public.americano_match_players (match_id, player_id, team_designation)
      values (v_match_id, v_player_ids[v_player_index + 1], 'B');
    end loop;
  end loop;

  return v_tournament_id;
end;
$$;

revoke execute on function public.create_americano_tournament(uuid, text, text[], integer, integer, jsonb) from anon;

------------------------------------------------------------
-- list_americano_tournaments
-- Inline default_club_id() in the where clause is replaced by
-- coalesce(p_club_id, public.default_club_id()).
------------------------------------------------------------

drop function if exists public.list_americano_tournaments();

create or replace function public.list_americano_tournaments(p_club_id uuid default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  from (
    select
      t.id,
      t.name,
      t.points_per_match,
      t.court_count,
      t.status,
      t.created_at,
      (select count(*) from public.americano_players p where p.tournament_id = t.id) as player_count,
      (select count(*) from public.americano_matches m where m.tournament_id = t.id) as match_count,
      (select count(*) from public.americano_matches m where m.tournament_id = t.id and m.status = 'completed') as completed_count
    from public.americano_tournaments t
    where t.club_id = coalesce(p_club_id, public.default_club_id())
      and public.is_club_member(t.club_id)
  ) x;
$$;

revoke execute on function public.list_americano_tournaments(uuid) from anon;

------------------------------------------------------------
-- create_roundrobin_tournament
------------------------------------------------------------

drop function if exists public.create_roundrobin_tournament(text, jsonb, smallint[], integer, integer, integer, jsonb, text, text, text);

create or replace function public.create_roundrobin_tournament(
  p_club_id uuid default null,
  p_name text default null,
  p_team_names jsonb default null,
  p_group_assignments smallint[] default null,
  p_points_per_match integer default null,
  p_court_count integer default null,
  p_group_count integer default null,
  p_matches jsonb default null,
  p_group_format text default 'points',
  p_semi_format text default 'points',
  p_final_format text default 'points'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_tournament_id uuid;
  v_team_ids uuid[] := '{}';
  v_pair jsonb;
  v_team_id uuid;
  v_idx int := 0;
  v_match jsonb;
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Only club admins can create tournaments';
  end if;
  if jsonb_array_length(p_team_names) < 4 then
    raise exception 'At least 4 teams are required';
  end if;
  if p_points_per_match not in (16, 24, 32) then
    raise exception 'Points per match must be 16, 24 or 32';
  end if;
  if p_group_format not in ('points','set','bo3','bo3_mtb')
     or p_semi_format not in ('points','set','bo3','bo3_mtb')
     or p_final_format not in ('points','set','bo3','bo3_mtb') then
    raise exception 'Invalid stage format';
  end if;

  insert into public.roundrobin_tournaments (
    club_id, name, points_per_match, court_count, group_count,
    group_format, semi_format, final_format, created_by
  )
  values (
    v_club_id,
    coalesce(nullif(btrim(p_name), ''), 'Round Robin'),
    p_points_per_match,
    p_court_count,
    p_group_count,
    p_group_format, p_semi_format, p_final_format,
    public.current_profile_id()
  )
  returning id into v_tournament_id;

  for v_pair in select value from jsonb_array_elements(p_team_names) loop
    insert into public.roundrobin_teams (tournament_id, team_number, group_no, player_a, player_b)
    values (
      v_tournament_id,
      v_idx + 1,
      p_group_assignments[v_idx + 1],
      btrim(v_pair->>0),
      btrim(v_pair->>1)
    )
    returning id into v_team_id;
    v_team_ids := v_team_ids || v_team_id;
    v_idx := v_idx + 1;
  end loop;

  for v_match in select value from jsonb_array_elements(p_matches) loop
    insert into public.roundrobin_matches (
      tournament_id, stage, group_no, round_number, court_number,
      team_a_id, team_b_id, format
    )
    values (
      v_tournament_id, 'group',
      (v_match->>'group')::smallint,
      (v_match->>'round')::smallint,
      (v_match->>'court')::smallint,
      v_team_ids[(v_match->>'team_a')::int + 1],
      v_team_ids[(v_match->>'team_b')::int + 1],
      p_group_format
    );
  end loop;

  return v_tournament_id;
end;
$$;

grant execute on function public.create_roundrobin_tournament(uuid, text, jsonb, smallint[], integer, integer, integer, jsonb, text, text, text) to authenticated;
revoke execute on function public.create_roundrobin_tournament(uuid, text, jsonb, smallint[], integer, integer, integer, jsonb, text, text, text) from anon;

------------------------------------------------------------
-- list_roundrobin_tournaments
-- Inline default_club_id() replaced with
-- coalesce(p_club_id, public.default_club_id()).
------------------------------------------------------------

drop function if exists public.list_roundrobin_tournaments();

create or replace function public.list_roundrobin_tournaments(p_club_id uuid default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  from (
    select
      t.id, t.name, t.points_per_match, t.court_count, t.group_count, t.status, t.created_at,
      t.group_format, t.semi_format, t.final_format,
      (select count(*) from public.roundrobin_teams tm where tm.tournament_id = t.id) as team_count,
      (select count(*) from public.roundrobin_matches m where m.tournament_id = t.id) as match_count,
      (select count(*) from public.roundrobin_matches m where m.tournament_id = t.id and m.status = 'completed') as completed_count
    from public.roundrobin_tournaments t
    where t.club_id = coalesce(p_club_id, public.default_club_id())
      and public.is_club_member(t.club_id)
  ) x;
$$;

------------------------------------------------------------
-- get_club_insights
-- (latest definition: 20260830180000_insights_exclude_guests.sql)
------------------------------------------------------------

drop function if exists public.get_club_insights();

create or replace function public.get_club_insights(p_club_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_result jsonb;
begin
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  with set_wins as (
    select
      ms.match_id,
      sum(case
        when ms.side_a_games > ms.side_b_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_a, 0) > coalesce(ms.tiebreak_b, 0))
        then 1 else 0 end)::int as sets_a,
      sum(case
        when ms.side_b_games > ms.side_a_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_b, 0) > coalesce(ms.tiebreak_a, 0))
        then 1 else 0 end)::int as sets_b
    from public.match_sets ms
    group by ms.match_id
  ),
  match_outcomes as (
    select
      m.id as match_id,
      m.starts_at,
      m.format,
      case
        when sw.sets_a > sw.sets_b then 'A'::char(1)
        when sw.sets_b > sw.sets_a then 'B'::char(1)
        else null::char(1)
      end as winner_side,
      case
        when sw.sets_a > sw.sets_b and sw.sets_b = 0 then true
        when sw.sets_b > sw.sets_a and sw.sets_a = 0 then true
        else false
      end as straight
    from public.matches m
    join set_wins sw on sw.match_id = m.id
    where m.club_id = v_club_id and m.status = 'final'
  ),
  eligible_participants as (
    -- Non-guest match_participants for this club's finalized matches.
    select mp.match_id, mp.profile_id, mp.side
    from public.match_participants mp
    join public.profiles p on p.id = mp.profile_id
    left join public.club_memberships cm on cm.profile_id = mp.profile_id and cm.club_id = v_club_id
    where coalesce(p.role, '') <> 'guest'
      and coalesce(cm.role, '') <> 'guest'
  ),
  player_matches as (
    select
      ep.profile_id,
      mo.match_id,
      mo.starts_at,
      mo.format,
      (ep.side = mo.winner_side) as is_win,
      mo.straight
    from eligible_participants ep
    join match_outcomes mo on mo.match_id = ep.match_id
    where mo.winner_side is not null
  ),
  window_week as (
    select pm.profile_id,
           count(*) as matches,
           count(*) filter (where pm.is_win) as wins
    from player_matches pm
    where pm.starts_at >= now() - interval '7 days'
    group by pm.profile_id
    having count(*) >= 3
    order by (count(*) filter (where pm.is_win))::numeric / greatest(count(*), 1) desc,
             count(*) filter (where pm.is_win) desc
    limit 1
  ),
  window_month as (
    select pm.profile_id,
           count(*) as matches,
           count(*) filter (where pm.is_win) as wins
    from player_matches pm
    where pm.starts_at >= now() - interval '30 days'
    group by pm.profile_id
    having count(*) >= 3
    order by (count(*) filter (where pm.is_win))::numeric / greatest(count(*), 1) desc,
             count(*) filter (where pm.is_win) desc
    limit 1
  ),
  consistent_top as (
    select pm.profile_id,
           count(*) filter (where pm.is_win) as wins,
           count(*) filter (where pm.is_win and pm.straight) as straight_wins
    from player_matches pm
    group by pm.profile_id
    having count(*) filter (where pm.is_win) >= 3
    order by (count(*) filter (where pm.is_win and pm.straight))::numeric /
             greatest(count(*) filter (where pm.is_win), 1) desc,
             count(*) filter (where pm.is_win) desc
    limit 1
  ),
  dedicated_top as (
    select pm.profile_id, count(*) as matches
    from player_matches pm
    where pm.starts_at >= now() - interval '30 days'
    group by pm.profile_id
    order by count(*) desc, max(pm.starts_at) desc
    limit 1
  ),
  last_loss as (
    select profile_id, max(starts_at) as ts
    from player_matches
    where not is_win
    group by profile_id
  ),
  streak_top as (
    select pm.profile_id, count(*) as streak
    from player_matches pm
    left join last_loss ll on ll.profile_id = pm.profile_id
    where pm.is_win and (ll.ts is null or pm.starts_at > ll.ts)
    group by pm.profile_id
    having count(*) >= 2
    order by count(*) desc, max(pm.starts_at) desc
    limit 1
  ),
  doubles_pairs as (
    select
      ep1.profile_id as a,
      ep2.profile_id as b,
      (ep1.side = mo.winner_side) as is_win
    from match_outcomes mo
    join eligible_participants ep1 on ep1.match_id = mo.match_id
    join eligible_participants ep2 on ep2.match_id = mo.match_id
      and ep2.side = ep1.side and ep2.profile_id > ep1.profile_id
    where mo.format = 'doubles' and mo.winner_side is not null
  ),
  partner_stats as (
    select a, b,
           count(*) as matches,
           count(*) filter (where is_win) as wins
    from doubles_pairs
    group by a, b
    having count(*) >= 2
    order by count(*) filter (where is_win) desc,
             count(*) desc,
             a asc, b asc
    limit 1
  ),
  player_json as (
    select p.id,
           jsonb_build_object(
             'profile_id', p.id,
             'full_name', p.full_name,
             'nickname', p.nickname,
             'avatar_url', p.avatar_url
           ) as payload
    from public.profiles p
  )
  select jsonb_build_object(
    'player_of_week',
      (select jsonb_build_object('player', pj.payload, 'wins', ww.wins, 'matches', ww.matches)
       from window_week ww join player_json pj on pj.id = ww.profile_id),
    'player_of_month',
      (select jsonb_build_object('player', pj.payload, 'wins', wm.wins, 'matches', wm.matches)
       from window_month wm join player_json pj on pj.id = wm.profile_id),
    'most_consistent',
      (select jsonb_build_object('player', pj.payload, 'wins', ct.wins, 'straight_wins', ct.straight_wins)
       from consistent_top ct join player_json pj on pj.id = ct.profile_id),
    'most_dedicated',
      (select jsonb_build_object('player', pj.payload, 'matches', dt.matches)
       from dedicated_top dt join player_json pj on pj.id = dt.profile_id),
    'longest_streak',
      (select jsonb_build_object('player', pj.payload, 'streak', st.streak)
       from streak_top st join player_json pj on pj.id = st.profile_id),
    'best_partner',
      (select jsonb_build_object(
                'player_a', pja.payload, 'player_b', pjb.payload,
                'wins', ps.wins, 'matches', ps.matches)
       from partner_stats ps
       join player_json pja on pja.id = ps.a
       join player_json pjb on pjb.id = ps.b)
  )
  into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

------------------------------------------------------------
-- get_club_insights_rivalry
------------------------------------------------------------

drop function if exists public.get_club_insights_rivalry();

create or replace function public.get_club_insights_rivalry(p_club_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_result jsonb;
begin
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  with base as (select * from public._insights_player_matches(v_club_id)),
  singles_pairs as (
    select
      a.profile_id as p1,
      b.profile_id as p2,
      a.is_win as p1_won
    from base a
    join base b on b.match_id = a.match_id and a.side <> b.side
    where a.format = 'singles' and a.profile_id < b.profile_id
  ),
  rivalry_top as (
    select p1, p2,
           count(*) as meetings,
           count(*) filter (where p1_won) as p1_wins,
           count(*) filter (where not p1_won) as p2_wins
    from singles_pairs
    group by p1, p2
    having count(*) >= 2
    order by count(*) desc,
             greatest(
               count(*) filter (where p1_won),
               count(*) filter (where not p1_won)
             ) desc
    limit 1
  ),
  most_active_singles as (
    select profile_id
    from base
    where format = 'singles' and starts_at >= now() - interval '30 days'
    group by profile_id
    order by count(*) desc, max(starts_at) desc
    limit 1
  ),
  nemesis_top as (
    select b1.profile_id as target,
           b2.profile_id as opponent,
           count(*) as losses
    from base b1
    join base b2 on b2.match_id = b1.match_id and b2.side <> b1.side
    where b1.format = 'singles'
      and b1.profile_id = (select profile_id from most_active_singles)
      and not b1.is_win
    group by b1.profile_id, b2.profile_id
    having count(*) >= 2
    order by count(*) desc
    limit 1
  ),
  doubles_pairs as (
    select b1.profile_id as a, b2.profile_id as b, b1.is_win
    from base b1
    join base b2 on b2.match_id = b1.match_id
      and b2.side = b1.side
      and b2.profile_id > b1.profile_id
    where b1.format = 'doubles'
  ),
  kryptonite_top as (
    select a, b,
           count(*) as matches,
           count(*) filter (where is_win) as wins
    from doubles_pairs
    group by a, b
    having count(*) >= 3
    order by (count(*) filter (where is_win))::numeric / greatest(count(*), 1) desc,
             count(*) filter (where is_win) desc
    limit 1
  ),
  player_json as (
    select p.id,
           jsonb_build_object(
             'profile_id', p.id,
             'full_name', p.full_name,
             'nickname', p.nickname,
             'avatar_url', p.avatar_url
           ) as payload
    from public.profiles p
  )
  select jsonb_build_object(
    'fiercest_rivalry',
      (select jsonb_build_object(
                'player_a', pja.payload,
                'player_b', pjb.payload,
                'meetings', rt.meetings,
                'a_wins', rt.p1_wins,
                'b_wins', rt.p2_wins)
       from rivalry_top rt
       join player_json pja on pja.id = rt.p1
       join player_json pjb on pjb.id = rt.p2),
    'nemesis',
      (select jsonb_build_object(
                'player', pjt.payload,
                'opponent', pjo.payload,
                'losses', nt.losses)
       from nemesis_top nt
       join player_json pjt on pjt.id = nt.target
       join player_json pjo on pjo.id = nt.opponent),
    'kryptonite_duo',
      (select jsonb_build_object(
                'player_a', pja.payload,
                'player_b', pjb.payload,
                'wins', kt.wins,
                'matches', kt.matches)
       from kryptonite_top kt
       join player_json pja on pja.id = kt.a
       join player_json pjb on pjb.id = kt.b)
  ) into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

grant execute on function public.get_club_insights_rivalry(uuid) to authenticated;
revoke execute on function public.get_club_insights_rivalry(uuid) from anon;

------------------------------------------------------------
-- get_club_insights_form
------------------------------------------------------------

drop function if exists public.get_club_insights_form();

create or replace function public.get_club_insights_form(p_club_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_result jsonb;
begin
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  with base as (select * from public._insights_player_matches(v_club_id)),
  recent as (
    select profile_id, is_win, starts_at,
           row_number() over (partition by profile_id order by starts_at desc, match_id) as rn
    from base
  ),
  hot_hand_top as (
    select profile_id,
           count(*) filter (where is_win) as wins,
           count(*) as matches
    from recent
    where rn <= 5
    group by profile_id
    having count(*) = 5
    order by count(*) filter (where is_win) desc,
             max(starts_at) desc
    limit 1
  ),
  first_set as (
    select ms.match_id,
      case
        when ms.side_a_games > ms.side_b_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_a, 0) > coalesce(ms.tiebreak_b, 0))
        then 'A'::char(1)
        when ms.side_b_games > ms.side_a_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_b, 0) > coalesce(ms.tiebreak_a, 0))
        then 'B'::char(1)
      end as set1_winner
    from public.match_sets ms
    where ms.set_index = 1
  ),
  comeback_top as (
    select b.profile_id, count(*) as comebacks
    from base b
    join first_set fs on fs.match_id = b.match_id
    where b.is_win
      and fs.set1_winner is not null
      and fs.set1_winner <> b.side
    group by b.profile_id
    having count(*) >= 1
    order by count(*) desc, max(b.starts_at) desc
    limit 1
  ),
  singles_wins as (
    select b1.profile_id as winner, b2.profile_id as loser
    from base b1
    join base b2 on b2.match_id = b1.match_id and b2.side <> b1.side
    where b1.format = 'singles' and b1.is_win
  ),
  giant_slayer_top as (
    select sw.winner as profile_id, count(*) as upsets
    from singles_wins sw
    join public.profiles pw on pw.id = sw.winner
    join public.profiles pl on pl.id = sw.loser
    where pw.seed is not null and pl.seed is not null and pl.seed < pw.seed
    group by sw.winner
    having count(*) >= 1
    order by count(*) desc
    limit 1
  ),
  current_seeds as (
    select p.id as profile_id, p.seed as current_seed
    from public.profiles p
    where p.seed is not null and coalesce(p.role, '') <> 'guest'
  ),
  past_seeds as (
    select distinct on (profile_id) profile_id, seed as past_seed
    from public.profile_seed_snapshots
    where captured_at <= now() - interval '30 days'
    order by profile_id, captured_at desc
  ),
  on_the_rise_top as (
    select cs.profile_id,
           ps.past_seed,
           cs.current_seed,
           (ps.past_seed - cs.current_seed) as climb
    from current_seeds cs
    join past_seeds ps on ps.profile_id = cs.profile_id
    where cs.current_seed < ps.past_seed
    order by (ps.past_seed - cs.current_seed) desc, cs.current_seed asc
    limit 1
  ),
  player_json as (
    select p.id,
           jsonb_build_object(
             'profile_id', p.id,
             'full_name', p.full_name,
             'nickname', p.nickname,
             'avatar_url', p.avatar_url
           ) as payload
    from public.profiles p
  )
  select jsonb_build_object(
    'hot_hand',
      (select jsonb_build_object(
                'player', pj.payload,
                'wins', hh.wins,
                'matches', hh.matches)
       from hot_hand_top hh
       join player_json pj on pj.id = hh.profile_id),
    'comeback_kid',
      (select jsonb_build_object(
                'player', pj.payload,
                'comebacks', ct.comebacks)
       from comeback_top ct
       join player_json pj on pj.id = ct.profile_id),
    'giant_slayer',
      (select jsonb_build_object(
                'player', pj.payload,
                'upsets', gs.upsets)
       from giant_slayer_top gs
       join player_json pj on pj.id = gs.profile_id),
    'on_the_rise',
      (select jsonb_build_object(
                'player', pj.payload,
                'past_seed', ot.past_seed,
                'current_seed', ot.current_seed,
                'climb', ot.climb)
       from on_the_rise_top ot
       join player_json pj on pj.id = ot.profile_id)
  ) into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

grant execute on function public.get_club_insights_form(uuid) to authenticated;
revoke execute on function public.get_club_insights_form(uuid) from anon;

------------------------------------------------------------
-- get_club_insights_style
------------------------------------------------------------

drop function if exists public.get_club_insights_style();

create or replace function public.get_club_insights_style(p_club_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_result jsonb;
begin
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  with base as (select * from public._insights_player_matches(v_club_id)),
  tiebreak_sets as (
    select ms.match_id,
      case
        when coalesce(ms.tiebreak_a, 0) > coalesce(ms.tiebreak_b, 0) then 'A'::char(1)
        when coalesce(ms.tiebreak_b, 0) > coalesce(ms.tiebreak_a, 0) then 'B'::char(1)
      end as tb_winner
    from public.match_sets ms
    where ms.tiebreak_a is not null or ms.tiebreak_b is not null
  ),
  tiebreak_player as (
    select b.profile_id, (b.side = ts.tb_winner) as won_tb
    from tiebreak_sets ts
    join base b on b.match_id = ts.match_id
    where ts.tb_winner is not null
  ),
  tiebreak_top as (
    select profile_id,
           count(*) as tb_sets,
           count(*) filter (where won_tb) as tb_wins
    from tiebreak_player
    group by profile_id
    having count(*) >= 3
    order by (count(*) filter (where won_tb))::numeric / greatest(count(*), 1) desc,
             count(*) filter (where won_tb) desc
    limit 1
  ),
  grinder_top as (
    select profile_id,
           count(*) as matches,
           count(*) filter (where not straight) as long_matches
    from base
    group by profile_id
    having count(*) >= 5 and count(*) filter (where not straight) >= 1
    order by (count(*) filter (where not straight))::numeric / greatest(count(*), 1) desc,
             count(*) filter (where not straight) desc
    limit 1
  ),
  decider_matches as (
    select match_id
    from base
    where sets_a + sets_b >= 3
    group by match_id
  ),
  closer_top as (
    select b.profile_id,
           count(*) as deciders,
           count(*) filter (where b.is_win) as decider_wins
    from base b
    join decider_matches dm on dm.match_id = b.match_id
    group by b.profile_id
    having count(*) >= 3
    order by (count(*) filter (where b.is_win))::numeric / greatest(count(*), 1) desc,
             count(*) filter (where b.is_win) desc
    limit 1
  ),
  bagel_top as (
    select b.profile_id, count(*) as bagels
    from base b
    join public.match_sets ms on ms.match_id = b.match_id
    where (b.side = 'A' and ms.side_a_games = 6 and ms.side_b_games = 0)
       or (b.side = 'B' and ms.side_b_games = 6 and ms.side_a_games = 0)
    group by b.profile_id
    having count(*) >= 1
    order by count(*) desc
    limit 1
  ),
  player_json as (
    select p.id,
           jsonb_build_object(
             'profile_id', p.id,
             'full_name', p.full_name,
             'nickname', p.nickname,
             'avatar_url', p.avatar_url
           ) as payload
    from public.profiles p
  )
  select jsonb_build_object(
    'tiebreak_king',
      (select jsonb_build_object(
                'player', pj.payload,
                'tb_wins', tt.tb_wins,
                'tb_sets', tt.tb_sets)
       from tiebreak_top tt
       join player_json pj on pj.id = tt.profile_id),
    'grinder',
      (select jsonb_build_object(
                'player', pj.payload,
                'long_matches', gt.long_matches,
                'matches', gt.matches)
       from grinder_top gt
       join player_json pj on pj.id = gt.profile_id),
    'closer',
      (select jsonb_build_object(
                'player', pj.payload,
                'decider_wins', ct.decider_wins,
                'deciders', ct.deciders)
       from closer_top ct
       join player_json pj on pj.id = ct.profile_id),
    'bagel_king',
      (select jsonb_build_object(
                'player', pj.payload,
                'bagels', bt.bagels)
       from bagel_top bt
       join player_json pj on pj.id = bt.profile_id)
  ) into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

grant execute on function public.get_club_insights_style(uuid) to authenticated;
revoke execute on function public.get_club_insights_style(uuid) from anon;

------------------------------------------------------------
-- get_club_insights_participation
------------------------------------------------------------

drop function if exists public.get_club_insights_participation();

create or replace function public.get_club_insights_participation(p_club_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_tz text;
  v_result jsonb;
begin
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  select coalesce(timezone, 'UTC') into v_tz from public.clubs where id = v_club_id;
  v_tz := coalesce(v_tz, 'UTC');

  with base as (select * from public._insights_player_matches(v_club_id)),
  local_hour as (
    select profile_id, starts_at, format,
           extract(hour from starts_at at time zone v_tz)::int as hr,
           extract(dow from starts_at at time zone v_tz)::int as dow
    from base
  ),
  early_bird_top as (
    select profile_id, count(*) as matches
    from local_hour
    where hr < 9
    group by profile_id
    having count(*) >= 2
    order by count(*) desc, max(starts_at) desc
    limit 1
  ),
  night_owl_top as (
    select profile_id, count(*) as matches
    from local_hour
    where hr >= 20
    group by profile_id
    having count(*) >= 2
    order by count(*) desc, max(starts_at) desc
    limit 1
  ),
  weekend_top as (
    select profile_id,
           count(*) filter (where dow in (0, 6)) as weekend_matches,
           count(*) as matches
    from local_hour
    group by profile_id
    having count(*) >= 5 and count(*) filter (where dow in (0, 6)) >= 1
    order by (count(*) filter (where dow in (0, 6)))::numeric / greatest(count(*), 1) desc,
             count(*) filter (where dow in (0, 6)) desc
    limit 1
  ),
  social_butterfly_top as (
    select b1.profile_id, count(distinct b2.profile_id) as partners
    from base b1
    join base b2 on b2.match_id = b1.match_id
      and b2.side = b1.side
      and b2.profile_id <> b1.profile_id
    where b1.format = 'doubles'
      and b1.starts_at >= now() - interval '30 days'
    group by b1.profile_id
    having count(distinct b2.profile_id) >= 2
    order by count(distinct b2.profile_id) desc
    limit 1
  ),
  recent_joiners as (
    select cm.profile_id, cm.created_at as joined_at
    from public.club_memberships cm
    join public.profiles p on p.id = cm.profile_id
    where cm.club_id = v_club_id
      and cm.created_at >= now() - interval '30 days'
      and coalesce(p.role, '') <> 'guest'
      and coalesce(cm.role, '') <> 'guest'
  ),
  new_face_top as (
    select rj.profile_id,
           rj.joined_at,
           count(b.match_id) as matches
    from recent_joiners rj
    left join base b on b.profile_id = rj.profile_id
      and b.starts_at >= now() - interval '30 days'
    group by rj.profile_id, rj.joined_at
    order by count(b.match_id) desc, rj.joined_at desc
    limit 1
  ),
  player_json as (
    select p.id,
           jsonb_build_object(
             'profile_id', p.id,
             'full_name', p.full_name,
             'nickname', p.nickname,
             'avatar_url', p.avatar_url
           ) as payload
    from public.profiles p
  )
  select jsonb_build_object(
    'early_bird',
      (select jsonb_build_object('player', pj.payload, 'matches', eb.matches)
       from early_bird_top eb
       join player_json pj on pj.id = eb.profile_id),
    'night_owl',
      (select jsonb_build_object('player', pj.payload, 'matches', no.matches)
       from night_owl_top no
       join player_json pj on pj.id = no.profile_id),
    'weekend_warrior',
      (select jsonb_build_object(
                'player', pj.payload,
                'weekend_matches', wt.weekend_matches,
                'matches', wt.matches)
       from weekend_top wt
       join player_json pj on pj.id = wt.profile_id),
    'social_butterfly',
      (select jsonb_build_object('player', pj.payload, 'partners', sb.partners)
       from social_butterfly_top sb
       join player_json pj on pj.id = sb.profile_id),
    'new_face',
      (select jsonb_build_object(
                'player', pj.payload,
                'matches', nf.matches,
                'joined_at', nf.joined_at)
       from new_face_top nf
       join player_json pj on pj.id = nf.profile_id)
  ) into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

grant execute on function public.get_club_insights_participation(uuid) to authenticated;
revoke execute on function public.get_club_insights_participation(uuid) from anon;

------------------------------------------------------------
-- get_club_insights_milestones
------------------------------------------------------------

drop function if exists public.get_club_insights_milestones();

create or replace function public.get_club_insights_milestones(p_club_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_result jsonb;
begin
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  with base as (select * from public._insights_player_matches(v_club_id)),
  enumerated as (
    select
      profile_id, match_id, starts_at, is_win, straight, format,
      row_number() over (
        partition by profile_id
        order by starts_at, match_id
      ) as match_num,
      row_number() over (
        partition by profile_id, is_win
        order by starts_at, match_id
      ) as by_result,
      row_number() over (
        partition by profile_id, is_win, straight
        order by starts_at, match_id
      ) as by_result_straight,
      row_number() over (
        partition by profile_id, is_win, format
        order by starts_at, match_id
      ) as by_result_format
    from base
  ),
  events as (
    select profile_id, starts_at, match_id, 'nth_match'::text as kind, match_num as value
    from enumerated
    where match_num in (10, 25, 50, 100, 250, 500, 1000)
    union all
    select profile_id, starts_at, match_id, 'first_win', 1
    from enumerated
    where is_win and by_result = 1
    union all
    select profile_id, starts_at, match_id, 'first_straight_win', 1
    from enumerated
    where is_win and straight and by_result_straight = 1
    union all
    select profile_id, starts_at, match_id, 'first_doubles_win', 1
    from enumerated
    where is_win and format = 'doubles' and by_result_format = 1
  ),
  recent_events as (
    select *
    from events
    where starts_at >= now() - interval '30 days'
  ),
  player_json as (
    select p.id,
           jsonb_build_object(
             'profile_id', p.id,
             'full_name', p.full_name,
             'nickname', p.nickname,
             'avatar_url', p.avatar_url
           ) as payload
    from public.profiles p
  )
  select jsonb_build_object(
    'items',
    coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'player', pj.payload,
                  'kind', re.kind,
                  'value', re.value,
                  'at', re.starts_at,
                  'match_id', re.match_id
                )
                order by re.starts_at desc
              )
       from (
         select * from recent_events order by starts_at desc limit 25
       ) re
       join player_json pj on pj.id = re.profile_id),
      '[]'::jsonb
    )
  ) into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

grant execute on function public.get_club_insights_milestones(uuid) to authenticated;
revoke execute on function public.get_club_insights_milestones(uuid) from anon;
