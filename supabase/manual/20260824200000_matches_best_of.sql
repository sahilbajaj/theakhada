-- Match refinements: configurable set count (best_of) + reopen flow.
--
-- Apply manually: paste into the Supabase SQL editor.

alter table public.matches
  add column if not exists best_of smallint not null default 3
    check (best_of in (1, 3, 5));

-- create_match now takes best_of. Signature change → drop + recreate.
drop function if exists public.create_match(text, uuid[], uuid[], uuid, timestamptz);

create or replace function public.create_match(
  p_format text,
  p_side_a uuid[],
  p_side_b uuid[],
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
  v_club_id uuid := public.default_club_id();
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

grant execute on function public.create_match(text, uuid[], uuid[], smallint, uuid, timestamptz) to authenticated;

-- reopen_match: flip a finalized match back to live so scores can be corrected.
create or replace function public.reopen_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_self uuid := public.current_profile_id();
  v_status text;
begin
  select club_id, status into v_club_id, v_status from public.matches where id = p_match_id;
  if v_club_id is null then raise exception 'Match not found'; end if;
  if not public.is_club_member(v_club_id) then raise exception 'Not authorized'; end if;
  if v_status <> 'final' then raise exception 'Match is not finalized'; end if;

  update public.matches set status = 'live' where id = p_match_id;

  insert into public.match_events (match_id, actor_profile_id, kind, payload)
  values (p_match_id, v_self, 'match_reopened', '{}'::jsonb);
end;
$$;

grant execute on function public.reopen_match(uuid) to authenticated;

-- list_recent_matches now includes best_of.
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
  winner_side char(1)
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
begin
  if not public.is_club_member(v_club_id) then raise exception 'Not authorized'; end if;

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
      max(case when side = 'A' then roster end) as side_a,
      max(case when side = 'B' then roster end) as side_b
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
    end as winner_side
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
