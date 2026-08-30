-- Round-robin (doubles) tournaments: fixed random pairs, k configurable groups,
-- single round-robin inside each group, then a 4-team knockout (semis + final).
-- Scoring is Americano-style (points per match, server-enforced sum).

create table if not exists public.roundrobin_tournaments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  points_per_match smallint not null check (points_per_match in (16, 24, 32)),
  court_count smallint not null check (court_count between 1 and 12),
  group_count smallint not null check (group_count between 1 and 8),
  status text not null default 'live' check (status in ('live', 'completed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists roundrobin_tournaments_club_idx
  on public.roundrobin_tournaments (club_id, created_at desc);

create table if not exists public.roundrobin_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.roundrobin_tournaments(id) on delete cascade,
  team_number smallint not null,
  group_no smallint not null,
  player_a text not null,
  player_b text not null,
  total_points integer not null default 0,
  wins smallint not null default 0,
  losses smallint not null default 0,
  points_for integer not null default 0,
  points_against integer not null default 0,
  unique (tournament_id, team_number)
);

create index if not exists roundrobin_teams_tournament_idx
  on public.roundrobin_teams (tournament_id, group_no, team_number);

create table if not exists public.roundrobin_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.roundrobin_tournaments(id) on delete cascade,
  stage text not null check (stage in ('group', 'semi', 'final')),
  group_no smallint,
  round_number smallint not null check (round_number > 0),
  court_number smallint not null check (court_number > 0),
  bracket_slot smallint,
  team_a_id uuid references public.roundrobin_teams(id) on delete cascade,
  team_b_id uuid references public.roundrobin_teams(id) on delete cascade,
  team_a_points integer,
  team_b_points integer,
  status text not null default 'pending' check (status in ('pending', 'completed'))
);

create index if not exists roundrobin_matches_tournament_idx
  on public.roundrobin_matches (tournament_id, stage, round_number, court_number);

grant select on public.roundrobin_tournaments to authenticated;
grant select on public.roundrobin_teams to authenticated;
grant select on public.roundrobin_matches to authenticated;
grant all on public.roundrobin_tournaments to service_role;
grant all on public.roundrobin_teams to service_role;
grant all on public.roundrobin_matches to service_role;

alter table public.roundrobin_tournaments enable row level security;
alter table public.roundrobin_teams enable row level security;
alter table public.roundrobin_matches enable row level security;

drop policy if exists "members read roundrobin tournaments" on public.roundrobin_tournaments;
create policy "members read roundrobin tournaments" on public.roundrobin_tournaments
  for select to authenticated
  using (public.is_club_member(club_id));

drop policy if exists "members read roundrobin teams" on public.roundrobin_teams;
create policy "members read roundrobin teams" on public.roundrobin_teams
  for select to authenticated
  using (public.is_club_member((select t.club_id from public.roundrobin_tournaments t where t.id = tournament_id)));

drop policy if exists "members read roundrobin matches" on public.roundrobin_matches;
create policy "members read roundrobin matches" on public.roundrobin_matches
  for select to authenticated
  using (public.is_club_member((select t.club_id from public.roundrobin_tournaments t where t.id = tournament_id)));

-- Internal helper: recompute team stats and tournament status.
create or replace function public.roundrobin_recompute_stats(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.roundrobin_teams t set
    total_points = coalesce(a.pf, 0),
    points_for = coalesce(a.pf, 0),
    points_against = coalesce(a.pa, 0),
    wins = coalesce(a.wins, 0),
    losses = coalesce(a.losses, 0)
  from (
    select
      tm.id as team_id,
      sum(case when tm.id = m.team_a_id then coalesce(m.team_a_points, 0)
               when tm.id = m.team_b_id then coalesce(m.team_b_points, 0) else 0 end) as pf,
      sum(case when tm.id = m.team_a_id then coalesce(m.team_b_points, 0)
               when tm.id = m.team_b_id then coalesce(m.team_a_points, 0) else 0 end) as pa,
      sum(case
        when m.status = 'completed' and tm.id = m.team_a_id and m.team_a_points > m.team_b_points then 1
        when m.status = 'completed' and tm.id = m.team_b_id and m.team_b_points > m.team_a_points then 1
        else 0 end) as wins,
      sum(case
        when m.status = 'completed' and tm.id = m.team_a_id and m.team_a_points < m.team_b_points then 1
        when m.status = 'completed' and tm.id = m.team_b_id and m.team_b_points < m.team_a_points then 1
        else 0 end) as losses
    from public.roundrobin_teams tm
    left join public.roundrobin_matches m
      on m.tournament_id = tm.tournament_id
     and (m.team_a_id = tm.id or m.team_b_id = tm.id)
     and m.status = 'completed'
    where tm.tournament_id = p_tournament_id
    group by tm.id
  ) a
  where t.id = a.team_id;

  update public.roundrobin_tournaments tt
  set status = case when not exists (
    select 1 from public.roundrobin_matches m
    where m.tournament_id = tt.id and m.status <> 'completed'
  ) then 'completed' else 'live' end
  where tt.id = p_tournament_id;
end;
$$;

-- Internal helper: seed the top 4 group teams into semi matches (or wipe if
-- prerequisites are no longer met). Also handles final creation from the semis.
create or replace function public.roundrobin_advance_bracket(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_pending int;
  v_semi_max_round smallint;
  v_court_count smallint;
  v_next_round smallint;
  v_semi1_id uuid;
  v_semi2_id uuid;
  v_semi1_winner uuid;
  v_semi2_winner uuid;
  v_semi_pending int;
begin
  select court_count into v_court_count from public.roundrobin_tournaments where id = p_tournament_id;

  select count(*) into v_group_pending
  from public.roundrobin_matches
  where tournament_id = p_tournament_id and stage = 'group' and status <> 'completed';

  if v_group_pending > 0 then
    -- Group stage not done: any existing semis/final become invalid.
    delete from public.roundrobin_matches where tournament_id = p_tournament_id and stage in ('semi', 'final');
    return;
  end if;

  -- Compute semi round number (next available round after group stage).
  select coalesce(max(round_number), 0) + 1 into v_next_round
  from public.roundrobin_matches
  where tournament_id = p_tournament_id and stage = 'group';

  -- Create semis if not already present.
  if not exists (select 1 from public.roundrobin_matches where tournament_id = p_tournament_id and stage = 'semi') then
    with ranked as (
      select id, row_number() over (
        order by wins desc, (points_for - points_against) desc, points_for desc, team_number asc
      ) as rk
      from public.roundrobin_teams
      where tournament_id = p_tournament_id
    )
    insert into public.roundrobin_matches (tournament_id, stage, round_number, court_number, bracket_slot, team_a_id, team_b_id)
    select p_tournament_id, 'semi', v_next_round,
      case when r.slot = 1 then 1 else least(v_court_count, 2) end,
      r.slot,
      r.team_a_id, r.team_b_id
    from (
      select 1 as slot,
        (select id from ranked where rk = 1) as team_a_id,
        (select id from ranked where rk = 4) as team_b_id
      union all
      select 2 as slot,
        (select id from ranked where rk = 2) as team_a_id,
        (select id from ranked where rk = 3) as team_b_id
    ) r
    where r.team_a_id is not null and r.team_b_id is not null;
  end if;

  -- If we now have both semis complete, create the final (once).
  select id into v_semi1_id from public.roundrobin_matches
    where tournament_id = p_tournament_id and stage = 'semi' and bracket_slot = 1;
  select id into v_semi2_id from public.roundrobin_matches
    where tournament_id = p_tournament_id and stage = 'semi' and bracket_slot = 2;

  select count(*) into v_semi_pending
  from public.roundrobin_matches
  where tournament_id = p_tournament_id and stage = 'semi' and status <> 'completed';

  if v_semi_pending > 0 then
    -- Semis in flight or one reopened: wipe any final so it can regenerate later.
    delete from public.roundrobin_matches where tournament_id = p_tournament_id and stage = 'final';
    return;
  end if;

  if v_semi1_id is null or v_semi2_id is null then
    return;
  end if;

  select case when team_a_points > team_b_points then team_a_id else team_b_id end
    into v_semi1_winner from public.roundrobin_matches where id = v_semi1_id;
  select case when team_a_points > team_b_points then team_a_id else team_b_id end
    into v_semi2_winner from public.roundrobin_matches where id = v_semi2_id;

  select coalesce(max(round_number), 0) + 1 into v_semi_max_round
  from public.roundrobin_matches
  where tournament_id = p_tournament_id and stage = 'semi';

  if not exists (select 1 from public.roundrobin_matches where tournament_id = p_tournament_id and stage = 'final') then
    insert into public.roundrobin_matches (tournament_id, stage, round_number, court_number, bracket_slot, team_a_id, team_b_id)
    values (p_tournament_id, 'final', v_semi_max_round, 1, 1, v_semi1_winner, v_semi2_winner);
  end if;
end;
$$;

-- create_roundrobin_tournament: client posts team_names (2N strings paired
-- into N teams in order) and matches (round/court/group/team_a_index/team_b_index).
create or replace function public.create_roundrobin_tournament(
  p_name text,
  p_team_names jsonb, -- [[playerA, playerB], ...]
  p_group_assignments smallint[], -- one per team, same order as p_team_names
  p_points_per_match integer,
  p_court_count integer,
  p_group_count integer,
  p_matches jsonb -- [{ round, court, group, team_a, team_b }, ...] where team_a/team_b are indexes
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid := public.default_club_id();
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

  insert into public.roundrobin_tournaments (club_id, name, points_per_match, court_count, group_count, created_by)
  values (
    v_club_id,
    coalesce(nullif(btrim(p_name), ''), 'Round Robin'),
    p_points_per_match,
    p_court_count,
    p_group_count,
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
    insert into public.roundrobin_matches (tournament_id, stage, group_no, round_number, court_number, team_a_id, team_b_id)
    values (
      v_tournament_id,
      'group',
      (v_match->>'group')::smallint,
      (v_match->>'round')::smallint,
      (v_match->>'court')::smallint,
      v_team_ids[(v_match->>'team_a')::int + 1],
      v_team_ids[(v_match->>'team_b')::int + 1]
    );
  end loop;

  return v_tournament_id;
end;
$$;

-- regenerate_roundrobin_pairings: allowed only if no scores submitted yet.
create or replace function public.regenerate_roundrobin_pairings(
  p_tournament_id uuid,
  p_team_names jsonb,
  p_group_assignments smallint[],
  p_matches jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_completed int;
  v_team_ids uuid[] := '{}';
  v_pair jsonb;
  v_team_id uuid;
  v_idx int := 0;
  v_match jsonb;
begin
  select club_id into v_club_id from public.roundrobin_tournaments where id = p_tournament_id;
  if v_club_id is null then
    raise exception 'Tournament not found';
  end if;
  if not public.is_club_admin(v_club_id) then
    raise exception 'Only club admins can regenerate pairings';
  end if;

  select count(*) into v_completed
  from public.roundrobin_matches
  where tournament_id = p_tournament_id and status = 'completed';
  if v_completed > 0 then
    raise exception 'Cannot regenerate after scores have been submitted';
  end if;

  delete from public.roundrobin_matches where tournament_id = p_tournament_id;
  delete from public.roundrobin_teams where tournament_id = p_tournament_id;

  for v_pair in select value from jsonb_array_elements(p_team_names) loop
    insert into public.roundrobin_teams (tournament_id, team_number, group_no, player_a, player_b)
    values (p_tournament_id, v_idx + 1, p_group_assignments[v_idx + 1], btrim(v_pair->>0), btrim(v_pair->>1))
    returning id into v_team_id;
    v_team_ids := v_team_ids || v_team_id;
    v_idx := v_idx + 1;
  end loop;

  for v_match in select value from jsonb_array_elements(p_matches) loop
    insert into public.roundrobin_matches (tournament_id, stage, group_no, round_number, court_number, team_a_id, team_b_id)
    values (
      p_tournament_id, 'group',
      (v_match->>'group')::smallint,
      (v_match->>'round')::smallint,
      (v_match->>'court')::smallint,
      v_team_ids[(v_match->>'team_a')::int + 1],
      v_team_ids[(v_match->>'team_b')::int + 1]
    );
  end loop;

  update public.roundrobin_tournaments set status = 'live' where id = p_tournament_id;
end;
$$;

create or replace function public.list_roundrobin_tournaments()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  from (
    select
      t.id, t.name, t.points_per_match, t.court_count, t.group_count, t.status, t.created_at,
      (select count(*) from public.roundrobin_teams tm where tm.tournament_id = t.id) as team_count,
      (select count(*) from public.roundrobin_matches m where m.tournament_id = t.id) as match_count,
      (select count(*) from public.roundrobin_matches m where m.tournament_id = t.id and m.status = 'completed') as completed_count
    from public.roundrobin_tournaments t
    where t.club_id = public.default_club_id()
      and public.is_club_member(t.club_id)
  ) x;
$$;

create or replace function public.get_roundrobin_tournament(p_tournament_id uuid)
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
    'group_count', t.group_count,
    'status', t.status,
    'created_at', t.created_at,
    'teams', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', tm.id,
        'team_number', tm.team_number,
        'group_no', tm.group_no,
        'player_a', tm.player_a,
        'player_b', tm.player_b,
        'total_points', tm.total_points,
        'points_for', tm.points_for,
        'points_against', tm.points_against,
        'wins', tm.wins,
        'losses', tm.losses
      ) order by tm.group_no, tm.team_number), '[]'::jsonb)
      from public.roundrobin_teams tm where tm.tournament_id = t.id
    ),
    'matches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'stage', m.stage,
        'group_no', m.group_no,
        'round_number', m.round_number,
        'court_number', m.court_number,
        'bracket_slot', m.bracket_slot,
        'team_a_id', m.team_a_id,
        'team_b_id', m.team_b_id,
        'team_a_points', m.team_a_points,
        'team_b_points', m.team_b_points,
        'status', m.status
      ) order by
        case m.stage when 'group' then 1 when 'semi' then 2 when 'final' then 3 end,
        m.round_number, m.court_number, m.bracket_slot), '[]'::jsonb)
      from public.roundrobin_matches m where m.tournament_id = t.id
    )
  )
  from public.roundrobin_tournaments t
  where t.id = p_tournament_id and public.is_club_member(t.club_id);
$$;

create or replace function public.submit_roundrobin_score(
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
  v_tournament public.roundrobin_tournaments;
begin
  select t.* into v_tournament
  from public.roundrobin_matches m
  join public.roundrobin_tournaments t on t.id = m.tournament_id
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
  if p_team_a_points = p_team_b_points then
    raise exception 'Round-robin matches cannot end in a tie';
  end if;

  update public.roundrobin_matches
  set team_a_points = p_team_a_points,
      team_b_points = p_team_b_points,
      status = 'completed'
  where id = p_match_id;

  perform public.roundrobin_recompute_stats(v_tournament.id);
  perform public.roundrobin_advance_bracket(v_tournament.id);
  perform public.roundrobin_recompute_stats(v_tournament.id);
end;
$$;

create or replace function public.reopen_roundrobin_match(p_match_id uuid)
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
  from public.roundrobin_matches m
  join public.roundrobin_tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;

  if v_tournament_id is null then
    raise exception 'Match not found';
  end if;
  if not public.is_club_member(v_club_id) then
    raise exception 'Not a club member';
  end if;

  update public.roundrobin_matches
  set team_a_points = null, team_b_points = null, status = 'pending'
  where id = p_match_id;

  perform public.roundrobin_recompute_stats(v_tournament_id);
  perform public.roundrobin_advance_bracket(v_tournament_id);
  perform public.roundrobin_recompute_stats(v_tournament_id);
end;
$$;

create or replace function public.delete_roundrobin_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  select club_id into v_club_id from public.roundrobin_tournaments where id = p_tournament_id;
  if v_club_id is null then
    return;
  end if;
  if not public.is_club_admin(v_club_id) then
    raise exception 'Only club admins can delete tournaments';
  end if;
  delete from public.roundrobin_tournaments where id = p_tournament_id;
end;
$$;

grant execute on function public.create_roundrobin_tournament(text, jsonb, smallint[], integer, integer, integer, jsonb) to authenticated;
grant execute on function public.regenerate_roundrobin_pairings(uuid, jsonb, smallint[], jsonb) to authenticated;
grant execute on function public.list_roundrobin_tournaments() to authenticated;
grant execute on function public.get_roundrobin_tournament(uuid) to authenticated;
grant execute on function public.submit_roundrobin_score(uuid, integer, integer) to authenticated;
grant execute on function public.reopen_roundrobin_match(uuid) to authenticated;
grant execute on function public.delete_roundrobin_tournament(uuid) to authenticated;

revoke execute on function public.create_roundrobin_tournament(text, jsonb, smallint[], integer, integer, integer, jsonb) from anon;
revoke execute on function public.regenerate_roundrobin_pairings(uuid, jsonb, smallint[], jsonb) from anon;
revoke execute on function public.list_roundrobin_tournaments() from anon;
revoke execute on function public.get_roundrobin_tournament(uuid) from anon;
revoke execute on function public.submit_roundrobin_score(uuid, integer, integer) from anon;
revoke execute on function public.reopen_roundrobin_match(uuid) from anon;
revoke execute on function public.delete_roundrobin_tournament(uuid) from anon;
