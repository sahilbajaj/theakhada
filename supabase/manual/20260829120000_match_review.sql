-- Admin-only match review stamps.
-- Adds reviewed_at / reviewed_by to matches plus RPCs to list and stamp reviews.

alter table public.matches add column if not exists reviewed_at timestamptz;
alter table public.matches add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

create index if not exists matches_unreviewed_idx
  on public.matches (club_id, starts_at desc)
  where reviewed_at is null;

-- list_recent_matches: same as before, plus reviewed_at (admins only).
drop function if exists public.list_recent_matches(int);

create or replace function public.list_recent_matches(p_limit int default 25)
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
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
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
      match_id,
      (array_agg(roster) filter (where side = 'A'))[1] as side_a,
      (array_agg(roster) filter (where side = 'B'))[1] as side_b
    from participants
    group by match_id
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
        where side_a_games > side_b_games
          or (side_a_games = side_b_games and coalesce(tiebreak_a, 0) > coalesce(tiebreak_b, 0))
      ) as sets_a,
      count(*) filter (
        where side_b_games > side_a_games
          or (side_a_games = side_b_games and coalesce(tiebreak_b, 0) > coalesce(tiebreak_a, 0))
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
    case when v_is_admin then m.reviewed_at else null end as reviewed_at
  from public.matches m
  left join sides s on s.match_id = m.id
  left join set_rows sr on sr.match_id = m.id
  where m.club_id = v_club_id
    and exists (select 1 from public.match_participants mp where mp.match_id = m.id)
  order by m.starts_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100));
end;
$$;

grant execute on function public.list_recent_matches(int) to authenticated;
revoke execute on function public.list_recent_matches(int) from anon;

-- list_unreviewed_matches: finalized matches without a review stamp (admins only).
drop function if exists public.list_unreviewed_matches(int);

create or replace function public.list_unreviewed_matches(p_limit int default 200)
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
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
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
      match_id,
      (array_agg(roster) filter (where side = 'A'))[1] as side_a,
      (array_agg(roster) filter (where side = 'B'))[1] as side_b
    from participants
    group by match_id
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
        where side_a_games > side_b_games
          or (side_a_games = side_b_games and coalesce(tiebreak_a, 0) > coalesce(tiebreak_b, 0))
      ) as sets_a,
      count(*) filter (
        where side_b_games > side_a_games
          or (side_a_games = side_b_games and coalesce(tiebreak_b, 0) > coalesce(tiebreak_a, 0))
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
    m.reviewed_at
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

grant execute on function public.list_unreviewed_matches(int) to authenticated;
revoke execute on function public.list_unreviewed_matches(int) from anon;

-- review_match: stamp a single finalized match as reviewed (idempotent).
create or replace function public.review_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
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

grant execute on function public.review_match(uuid) to authenticated;
revoke execute on function public.review_match(uuid) from anon;

-- review_matches_for_day: stamp every unreviewed finalized match on a club-local day.
create or replace function public.review_matches_for_day(p_day date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
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

grant execute on function public.review_matches_for_day(date) to authenticated;
revoke execute on function public.review_matches_for_day(date) from anon;
