-- Match v1: relational participants, per-set records, and an event log
-- that will feed the notification feed. The existing matches.home_players /
-- .away_players / .sets columns stay for now (unused by new code) and can be
-- dropped later once nothing else reads them.
--
-- Apply manually: paste into the Supabase SQL editor.

create table if not exists public.match_participants (
  match_id uuid not null references public.matches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  side char(1) not null check (side in ('A', 'B')),
  position smallint not null check (position in (1, 2)),
  primary key (match_id, side, position)
);

create index if not exists match_participants_profile_idx on public.match_participants (profile_id);
create index if not exists match_participants_match_idx on public.match_participants (match_id);

create table if not exists public.match_sets (
  match_id uuid not null references public.matches(id) on delete cascade,
  set_index smallint not null check (set_index between 1 and 5),
  side_a_games smallint not null check (side_a_games between 0 and 7),
  side_b_games smallint not null check (side_b_games between 0 and 7),
  tiebreak_a smallint,
  tiebreak_b smallint,
  primary key (match_id, set_index)
);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('match_created', 'set_recorded', 'set_edited', 'match_finalized', 'match_reopened')),
  payload jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create index if not exists match_events_match_at_idx on public.match_events (match_id, at desc);
create index if not exists match_events_club_at_idx on public.match_events (match_id, kind, at desc);

alter table public.match_participants enable row level security;
alter table public.match_sets enable row level security;
alter table public.match_events enable row level security;

-- Club members can see everything about matches in their club, but writes go
-- through the SECURITY DEFINER RPCs below rather than direct table access.
create policy "members read match participants" on public.match_participants
  for select to authenticated
  using (public.is_club_member((select club_id from public.matches m where m.id = match_id)));

create policy "members read match sets" on public.match_sets
  for select to authenticated
  using (public.is_club_member((select club_id from public.matches m where m.id = match_id)));

create policy "members read match events" on public.match_events
  for select to authenticated
  using (public.is_club_member((select club_id from public.matches m where m.id = match_id)));

-- create_match: any signed-in club member can start a match.
create or replace function public.create_match(
  p_format text,
  p_side_a uuid[],
  p_side_b uuid[],
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
  if v_self is null then
    raise exception 'Not authenticated';
  end if;
  if v_club_id is null then
    raise exception 'No club configured';
  end if;
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;
  if p_format not in ('singles', 'doubles') then
    raise exception 'Invalid format';
  end if;
  if array_length(p_side_a, 1) is distinct from v_expected or array_length(p_side_b, 1) is distinct from v_expected then
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

  insert into public.matches (club_id, court_id, format, starts_at, status)
  values (v_club_id, p_court_id, p_format, p_starts_at, 'live')
  returning id into v_match_id;

  for v_i in 1 .. v_expected loop
    insert into public.match_participants (match_id, profile_id, side, position)
    values (v_match_id, p_side_a[v_i], 'A', v_i);
    insert into public.match_participants (match_id, profile_id, side, position)
    values (v_match_id, p_side_b[v_i], 'B', v_i);
  end loop;

  insert into public.match_events (match_id, actor_profile_id, kind, payload)
  values (v_match_id, v_self, 'match_created', jsonb_build_object('format', p_format));

  return v_match_id;
end;
$$;

grant execute on function public.create_match(text, uuid[], uuid[], uuid, timestamptz) to authenticated;

-- record_set: upsert a single set. Any club member can record.
create or replace function public.record_set(
  p_match_id uuid,
  p_set_index smallint,
  p_side_a_games smallint,
  p_side_b_games smallint,
  p_tiebreak_a smallint default null,
  p_tiebreak_b smallint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_self uuid := public.current_profile_id();
  v_edited boolean := false;
begin
  select club_id into v_club_id from public.matches where id = p_match_id;
  if v_club_id is null then
    raise exception 'Match not found';
  end if;
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  select true into v_edited
  from public.match_sets
  where match_id = p_match_id and set_index = p_set_index;

  insert into public.match_sets (match_id, set_index, side_a_games, side_b_games, tiebreak_a, tiebreak_b)
  values (p_match_id, p_set_index, p_side_a_games, p_side_b_games, p_tiebreak_a, p_tiebreak_b)
  on conflict (match_id, set_index) do update set
    side_a_games = excluded.side_a_games,
    side_b_games = excluded.side_b_games,
    tiebreak_a = excluded.tiebreak_a,
    tiebreak_b = excluded.tiebreak_b;

  insert into public.match_events (match_id, actor_profile_id, kind, payload)
  values (
    p_match_id,
    v_self,
    case when v_edited then 'set_edited' else 'set_recorded' end,
    jsonb_build_object(
      'set_index', p_set_index,
      'side_a_games', p_side_a_games,
      'side_b_games', p_side_b_games,
      'tiebreak_a', p_tiebreak_a,
      'tiebreak_b', p_tiebreak_b
    )
  );
end;
$$;

grant execute on function public.record_set(uuid, smallint, smallint, smallint, smallint, smallint) to authenticated;

-- finalize_match: mark match as final. Winner side computed from stored sets.
create or replace function public.finalize_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_self uuid := public.current_profile_id();
  v_sets_a smallint := 0;
  v_sets_b smallint := 0;
  v_winner char(1);
begin
  select club_id into v_club_id from public.matches where id = p_match_id;
  if v_club_id is null then
    raise exception 'Match not found';
  end if;
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  select
    count(*) filter (
      where side_a_games > side_b_games
        or (side_a_games = side_b_games and coalesce(tiebreak_a, 0) > coalesce(tiebreak_b, 0))
    ),
    count(*) filter (
      where side_b_games > side_a_games
        or (side_a_games = side_b_games and coalesce(tiebreak_b, 0) > coalesce(tiebreak_a, 0))
    )
  into v_sets_a, v_sets_b
  from public.match_sets
  where match_id = p_match_id;

  if v_sets_a + v_sets_b = 0 then
    raise exception 'Record at least one set before finalizing';
  end if;

  v_winner := case when v_sets_a > v_sets_b then 'A' when v_sets_b > v_sets_a then 'B' else null end;

  update public.matches set status = 'final' where id = p_match_id;

  insert into public.match_events (match_id, actor_profile_id, kind, payload)
  values (
    p_match_id,
    v_self,
    'match_finalized',
    jsonb_build_object('winner_side', v_winner, 'sets_a', v_sets_a, 'sets_b', v_sets_b)
  );
end;
$$;

grant execute on function public.finalize_match(uuid) to authenticated;

-- list_recent_matches: reads shaped for the Scores page / feed.
drop function if exists public.list_recent_matches(int);

create or replace function public.list_recent_matches(p_limit int default 25)
returns table (
  match_id uuid,
  format text,
  status text,
  starts_at timestamptz,
  court_id uuid,
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
  if not public.is_club_member(v_club_id) then
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
