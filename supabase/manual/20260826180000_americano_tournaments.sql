-- Americano tournaments: relational players / matches / match_players model.
-- Apply manually: paste into the Supabase SQL editor (external project),
-- then move this file into supabase/migrations/ to keep history in sync.

create table if not exists public.americano_tournaments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  points_per_match smallint not null check (points_per_match in (16, 24, 32)),
  court_count smallint not null check (court_count between 1 and 12),
  status text not null default 'live' check (status in ('live', 'completed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists americano_tournaments_club_idx
  on public.americano_tournaments (club_id, created_at desc);

create table if not exists public.americano_players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.americano_tournaments(id) on delete cascade,
  name text not null,
  total_points integer not null default 0,
  sort_order smallint not null default 0,
  unique (tournament_id, name)
);

create index if not exists americano_players_tournament_idx
  on public.americano_players (tournament_id);

create table if not exists public.americano_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.americano_tournaments(id) on delete cascade,
  round_number smallint not null check (round_number > 0),
  court_number smallint not null check (court_number > 0),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  unique (tournament_id, round_number, court_number)
);

create index if not exists americano_matches_tournament_idx
  on public.americano_matches (tournament_id, round_number, court_number);

create table if not exists public.americano_match_players (
  match_id uuid not null references public.americano_matches(id) on delete cascade,
  player_id uuid not null references public.americano_players(id) on delete cascade,
  team_designation char(1) not null check (team_designation in ('A', 'B')),
  points_scored integer not null default 0,
  primary key (match_id, player_id)
);

create index if not exists americano_match_players_player_idx
  on public.americano_match_players (player_id);

grant select on public.americano_tournaments to authenticated;
grant select on public.americano_players to authenticated;
grant select on public.americano_matches to authenticated;
grant select on public.americano_match_players to authenticated;
grant all on public.americano_tournaments to service_role;
grant all on public.americano_players to service_role;
grant all on public.americano_matches to service_role;
grant all on public.americano_match_players to service_role;

alter table public.americano_tournaments enable row level security;
alter table public.americano_players enable row level security;
alter table public.americano_matches enable row level security;
alter table public.americano_match_players enable row level security;

drop policy if exists "members read americano tournaments" on public.americano_tournaments;
create policy "members read americano tournaments" on public.americano_tournaments
  for select to authenticated
  using (public.is_club_member(club_id));

drop policy if exists "members read americano players" on public.americano_players;
create policy "members read americano players" on public.americano_players
  for select to authenticated
  using (public.is_club_member((select t.club_id from public.americano_tournaments t where t.id = tournament_id)));

drop policy if exists "members read americano matches" on public.americano_matches;
create policy "members read americano matches" on public.americano_matches
  for select to authenticated
  using (public.is_club_member((select t.club_id from public.americano_tournaments t where t.id = tournament_id)));

drop policy if exists "members read americano match players" on public.americano_match_players;
create policy "members read americano match players" on public.americano_match_players
  for select to authenticated
  using (public.is_club_member((
    select t.club_id
    from public.americano_matches m
    join public.americano_tournaments t on t.id = m.tournament_id
    where m.id = match_id
  )));

-- create_americano_tournament: the client computes the rotation and passes it as
-- p_matches = [{ "round": 1, "court": 1, "team_a": [0, 3], "team_b": [1, 2] }, ...]
-- where the numbers are indexes into p_player_names.
create or replace function public.create_americano_tournament(
  p_name text,
  p_player_names text[],
  p_points_per_match integer,
  p_court_count integer,
  p_matches jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid := public.default_club_id();
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

-- list_americano_tournaments: newest first, with light progress counters.
create or replace function public.list_americano_tournaments()
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
    where t.club_id = public.default_club_id()
      and public.is_club_member(t.club_id)
  ) x;
$$;

-- get_americano_tournament: full detail payload for the tournament console.
create or replace function public.get_americano_tournament(p_tournament_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'points_per_match', t.points_per_match,
    'court_count', t.court_count,
    'status', t.status,
    'created_at', t.created_at,
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'total_points', p.total_points,
        'matches_played', (
          select count(*)
          from public.americano_match_players mp
          join public.americano_matches m on m.id = mp.match_id
          where mp.player_id = p.id and m.status = 'completed'
        )
      ) order by p.sort_order), '[]'::jsonb)
      from public.americano_players p
      where p.tournament_id = t.id
    ),
    'matches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'round_number', m.round_number,
        'court_number', m.court_number,
        'status', m.status,
        'team_a', (
          select coalesce(jsonb_agg(jsonb_build_object('player_id', mp.player_id, 'name', p2.name, 'points_scored', mp.points_scored) order by p2.sort_order), '[]'::jsonb)
          from public.americano_match_players mp
          join public.americano_players p2 on p2.id = mp.player_id
          where mp.match_id = m.id and mp.team_designation = 'A'
        ),
        'team_b', (
          select coalesce(jsonb_agg(jsonb_build_object('player_id', mp.player_id, 'name', p2.name, 'points_scored', mp.points_scored) order by p2.sort_order), '[]'::jsonb)
          from public.americano_match_players mp
          join public.americano_players p2 on p2.id = mp.player_id
          where mp.match_id = m.id and mp.team_designation = 'B'
        )
      ) order by m.round_number, m.court_number), '[]'::jsonb)
      from public.americano_matches m
      where m.tournament_id = t.id
    )
  )
  from public.americano_tournaments t
  where t.id = p_tournament_id
    and public.is_club_member(t.club_id);
$$;

-- submit_americano_score: validates the point split and locks the match.
create or replace function public.submit_americano_score(
  p_match_id uuid,
  p_team_a_points integer,
  p_team_b_points integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.americano_tournaments;
begin
  select t.* into v_tournament
  from public.americano_matches m
  join public.americano_tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;

  if v_tournament.id is null then
    raise exception 'Match not found';
  end if;
  if not public.is_club_member(v_tournament.club_id) then
    raise exception 'Not a club member';
  end if;
  if p_team_a_points < 0 or p_team_b_points < 0 then
    raise exception 'Scores must be positive';
  end if;
  if p_team_a_points + p_team_b_points <> v_tournament.points_per_match then
    raise exception 'Scores must add up to % points', v_tournament.points_per_match;
  end if;

  update public.americano_match_players mp
  set points_scored = case when mp.team_designation = 'A' then p_team_a_points else p_team_b_points end
  where mp.match_id = p_match_id;

  update public.americano_matches
  set status = 'completed'
  where id = p_match_id;

  update public.americano_players p
  set total_points = coalesce((
    select sum(mp.points_scored)
    from public.americano_match_players mp
    join public.americano_matches m on m.id = mp.match_id
    where mp.player_id = p.id and m.status = 'completed'
  ), 0)
  where p.tournament_id = v_tournament.id;

  update public.americano_tournaments t
  set status = case
    when not exists (
      select 1 from public.americano_matches m
      where m.tournament_id = t.id and m.status <> 'completed'
    ) then 'completed' else 'live' end
  where t.id = v_tournament.id;
end;
$$;

-- reopen_americano_match: unlock a completed match to correct a score.
create or replace function public.reopen_americano_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_club_id uuid;
begin
  select m.tournament_id, t.club_id into v_tournament_id, v_club_id
  from public.americano_matches m
  join public.americano_tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;

  if v_tournament_id is null then
    raise exception 'Match not found';
  end if;
  if not public.is_club_member(v_club_id) then
    raise exception 'Not a club member';
  end if;

  update public.americano_match_players set points_scored = 0 where match_id = p_match_id;
  update public.americano_matches set status = 'pending' where id = p_match_id;

  update public.americano_players p
  set total_points = coalesce((
    select sum(mp.points_scored)
    from public.americano_match_players mp
    join public.americano_matches m on m.id = mp.match_id
    where mp.player_id = p.id and m.status = 'completed'
  ), 0)
  where p.tournament_id = v_tournament_id;

  update public.americano_tournaments set status = 'live' where id = v_tournament_id;
end;
$$;

create or replace function public.delete_americano_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  select club_id into v_club_id from public.americano_tournaments where id = p_tournament_id;
  if v_club_id is null then
    return;
  end if;
  if not public.is_club_admin(v_club_id) then
    raise exception 'Only club admins can delete tournaments';
  end if;
  delete from public.americano_tournaments where id = p_tournament_id;
end;
$$;

revoke execute on function public.create_americano_tournament(text, text[], integer, integer, jsonb) from anon;
revoke execute on function public.list_americano_tournaments() from anon;
revoke execute on function public.get_americano_tournament(uuid) from anon;
revoke execute on function public.submit_americano_score(uuid, integer, integer) from anon;
revoke execute on function public.reopen_americano_match(uuid) from anon;
revoke execute on function public.delete_americano_tournament(uuid) from anon;
