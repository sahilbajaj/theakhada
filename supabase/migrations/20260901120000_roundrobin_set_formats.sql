-- Round-robin set-based formats. Adds per-stage format config (points / set /
-- bo3 / bo3_mtb), per-match format snapshot, and set-level aggregates on teams.
-- Existing tournaments keep 'points' across all stages via defaults + backfill.

-- ---------- Schema ----------

alter table public.roundrobin_tournaments
  add column if not exists group_format text not null default 'points'
    check (group_format in ('points','set','bo3','bo3_mtb')),
  add column if not exists semi_format text not null default 'points'
    check (semi_format in ('points','set','bo3','bo3_mtb')),
  add column if not exists final_format text not null default 'points'
    check (final_format in ('points','set','bo3','bo3_mtb'));

alter table public.roundrobin_matches
  add column if not exists format text
    check (format in ('points','set','bo3','bo3_mtb')),
  add column if not exists team_a_sets smallint,
  add column if not exists team_b_sets smallint,
  add column if not exists set_scores jsonb; -- [{"a":6,"b":4}, ...]

update public.roundrobin_matches m
set format = coalesce(m.format,
  case s.stage
    when 'group' then t.group_format
    when 'semi'  then t.semi_format
    when 'final' then t.final_format
  end)
from public.roundrobin_matches s
join public.roundrobin_tournaments t on t.id = s.tournament_id
where m.id = s.id and m.format is null;

alter table public.roundrobin_matches
  alter column format set not null;

alter table public.roundrobin_teams
  add column if not exists sets_for smallint not null default 0,
  add column if not exists sets_against smallint not null default 0,
  add column if not exists games_for integer not null default 0,
  add column if not exists games_against integer not null default 0;

-- ---------- Helpers ----------

-- Winner id for a completed match, format-aware. Returns null if not decidable.
create or replace function public.roundrobin_match_winner(m public.roundrobin_matches)
returns uuid
language sql
immutable
as $$
  select case
    when m.status <> 'completed' then null
    when m.format = 'points' then
      case
        when coalesce(m.team_a_points,0) > coalesce(m.team_b_points,0) then m.team_a_id
        when coalesce(m.team_b_points,0) > coalesce(m.team_a_points,0) then m.team_b_id
        else null end
    else
      case
        when coalesce(m.team_a_sets,0) > coalesce(m.team_b_sets,0) then m.team_a_id
        when coalesce(m.team_b_sets,0) > coalesce(m.team_a_sets,0) then m.team_b_id
        else null end
  end;
$$;

-- ---------- Aggregation ----------

create or replace function public.roundrobin_recompute_stats(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with per_team as (
    select
      tm.id as team_id,
      -- points (only points-format matches contribute)
      sum(case when m.format = 'points' and tm.id = m.team_a_id then coalesce(m.team_a_points,0)
               when m.format = 'points' and tm.id = m.team_b_id then coalesce(m.team_b_points,0)
               else 0 end) as pf,
      sum(case when m.format = 'points' and tm.id = m.team_a_id then coalesce(m.team_b_points,0)
               when m.format = 'points' and tm.id = m.team_b_id then coalesce(m.team_a_points,0)
               else 0 end) as pa,
      -- sets (only set-based matches contribute)
      sum(case when m.format <> 'points' and tm.id = m.team_a_id then coalesce(m.team_a_sets,0)
               when m.format <> 'points' and tm.id = m.team_b_id then coalesce(m.team_b_sets,0)
               else 0 end) as sf,
      sum(case when m.format <> 'points' and tm.id = m.team_a_id then coalesce(m.team_b_sets,0)
               when m.format <> 'points' and tm.id = m.team_b_id then coalesce(m.team_a_sets,0)
               else 0 end) as sa,
      -- games from set_scores (only set-based matches)
      sum(case when m.format <> 'points' and tm.id = m.team_a_id then coalesce(gs.a_games,0)
               when m.format <> 'points' and tm.id = m.team_b_id then coalesce(gs.b_games,0)
               else 0 end) as gf,
      sum(case when m.format <> 'points' and tm.id = m.team_a_id then coalesce(gs.b_games,0)
               when m.format <> 'points' and tm.id = m.team_b_id then coalesce(gs.a_games,0)
               else 0 end) as ga,
      sum(case when m.status = 'completed'
                and public.roundrobin_match_winner(m) = tm.id then 1 else 0 end) as wins,
      sum(case when m.status = 'completed'
                and public.roundrobin_match_winner(m) is not null
                and public.roundrobin_match_winner(m) <> tm.id
                and tm.id in (m.team_a_id, m.team_b_id) then 1 else 0 end) as losses
    from public.roundrobin_teams tm
    left join public.roundrobin_matches m
      on m.tournament_id = tm.tournament_id
     and (m.team_a_id = tm.id or m.team_b_id = tm.id)
     and m.status = 'completed'
    left join lateral (
      select
        coalesce(sum((s->>'a')::int), 0) as a_games,
        coalesce(sum((s->>'b')::int), 0) as b_games
      from jsonb_array_elements(coalesce(m.set_scores, '[]'::jsonb)) s
    ) gs on true
    where tm.tournament_id = p_tournament_id
    group by tm.id
  )
  update public.roundrobin_teams t set
    total_points = coalesce(per_team.pf, 0),
    points_for = coalesce(per_team.pf, 0),
    points_against = coalesce(per_team.pa, 0),
    sets_for = coalesce(per_team.sf, 0),
    sets_against = coalesce(per_team.sa, 0),
    games_for = coalesce(per_team.gf, 0),
    games_against = coalesce(per_team.ga, 0),
    wins = coalesce(per_team.wins, 0),
    losses = coalesce(per_team.losses, 0)
  from per_team
  where t.id = per_team.team_id;

  update public.roundrobin_tournaments tt
  set status = case when not exists (
    select 1 from public.roundrobin_matches m
    where m.tournament_id = tt.id and m.status <> 'completed'
  ) then 'completed' else 'live' end
  where tt.id = p_tournament_id;
end;
$$;

-- ---------- Bracket advancement (format-aware) ----------

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
  v_semi_format text;
  v_final_format text;
  v_semi1 public.roundrobin_matches;
  v_semi2 public.roundrobin_matches;
  v_semi1_winner uuid;
  v_semi2_winner uuid;
  v_semi_pending int;
begin
  select court_count, semi_format, final_format
    into v_court_count, v_semi_format, v_final_format
  from public.roundrobin_tournaments where id = p_tournament_id;

  select count(*) into v_group_pending
  from public.roundrobin_matches
  where tournament_id = p_tournament_id and stage = 'group' and status <> 'completed';

  if v_group_pending > 0 then
    delete from public.roundrobin_matches where tournament_id = p_tournament_id and stage in ('semi', 'final');
    return;
  end if;

  select coalesce(max(round_number), 0) + 1 into v_next_round
  from public.roundrobin_matches
  where tournament_id = p_tournament_id and stage = 'group';

  if not exists (select 1 from public.roundrobin_matches where tournament_id = p_tournament_id and stage = 'semi') then
    with ranked as (
      select id, row_number() over (
        order by wins desc,
                 (sets_for - sets_against) desc,
                 (games_for - games_against) desc,
                 (points_for - points_against) desc,
                 points_for desc,
                 team_number asc
      ) as rk
      from public.roundrobin_teams
      where tournament_id = p_tournament_id
    )
    insert into public.roundrobin_matches (tournament_id, stage, round_number, court_number, bracket_slot, team_a_id, team_b_id, format)
    select p_tournament_id, 'semi', v_next_round,
      case when r.slot = 1 then 1 else least(v_court_count, 2) end,
      r.slot,
      r.team_a_id, r.team_b_id,
      v_semi_format
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

  select * into v_semi1 from public.roundrobin_matches
    where tournament_id = p_tournament_id and stage = 'semi' and bracket_slot = 1;
  select * into v_semi2 from public.roundrobin_matches
    where tournament_id = p_tournament_id and stage = 'semi' and bracket_slot = 2;

  select count(*) into v_semi_pending
  from public.roundrobin_matches
  where tournament_id = p_tournament_id and stage = 'semi' and status <> 'completed';

  if v_semi_pending > 0 then
    delete from public.roundrobin_matches where tournament_id = p_tournament_id and stage = 'final';
    return;
  end if;

  if v_semi1.id is null or v_semi2.id is null then
    return;
  end if;

  v_semi1_winner := public.roundrobin_match_winner(v_semi1);
  v_semi2_winner := public.roundrobin_match_winner(v_semi2);

  select coalesce(max(round_number), 0) + 1 into v_semi_max_round
  from public.roundrobin_matches
  where tournament_id = p_tournament_id and stage = 'semi';

  if v_semi1_winner is not null and v_semi2_winner is not null
     and not exists (select 1 from public.roundrobin_matches where tournament_id = p_tournament_id and stage = 'final') then
    insert into public.roundrobin_matches (tournament_id, stage, round_number, court_number, bracket_slot, team_a_id, team_b_id, format)
    values (p_tournament_id, 'final', v_semi_max_round, 1, 1, v_semi1_winner, v_semi2_winner, v_final_format);
  end if;
end;
$$;

-- ---------- Create / regenerate (new signatures with per-stage formats) ----------

drop function if exists public.create_roundrobin_tournament(text, jsonb, smallint[], integer, integer, integer, jsonb);

create or replace function public.create_roundrobin_tournament(
  p_name text,
  p_team_names jsonb,
  p_group_assignments smallint[],
  p_points_per_match integer,
  p_court_count integer,
  p_group_count integer,
  p_matches jsonb,
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
  v_group_format text;
  v_completed int;
  v_team_ids uuid[] := '{}';
  v_pair jsonb;
  v_team_id uuid;
  v_idx int := 0;
  v_match jsonb;
begin
  select club_id, group_format into v_club_id, v_group_format
  from public.roundrobin_tournaments where id = p_tournament_id;
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
    insert into public.roundrobin_matches (
      tournament_id, stage, group_no, round_number, court_number,
      team_a_id, team_b_id, format
    )
    values (
      p_tournament_id, 'group',
      (v_match->>'group')::smallint,
      (v_match->>'round')::smallint,
      (v_match->>'court')::smallint,
      v_team_ids[(v_match->>'team_a')::int + 1],
      v_team_ids[(v_match->>'team_b')::int + 1],
      v_group_format
    );
  end loop;

  update public.roundrobin_tournaments set status = 'live' where id = p_tournament_id;
end;
$$;

-- ---------- Reads ----------

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
      t.group_format, t.semi_format, t.final_format,
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
    'group_format', t.group_format,
    'semi_format', t.semi_format,
    'final_format', t.final_format,
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
        'sets_for', tm.sets_for,
        'sets_against', tm.sets_against,
        'games_for', tm.games_for,
        'games_against', tm.games_against,
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
        'format', m.format,
        'team_a_points', m.team_a_points,
        'team_b_points', m.team_b_points,
        'team_a_sets', m.team_a_sets,
        'team_b_sets', m.team_b_sets,
        'set_scores', m.set_scores,
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

-- ---------- Submit / reopen ----------

-- Existing points-format submit stays; guard against wrong-format use.
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
  v_match public.roundrobin_matches;
begin
  select * into v_match from public.roundrobin_matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'Match not found';
  end if;
  select t.* into v_tournament
  from public.roundrobin_tournaments t where t.id = v_match.tournament_id;
  if not public.is_club_member(v_tournament.club_id) then
    raise exception 'Not a club member';
  end if;
  if v_match.format <> 'points' then
    raise exception 'This match uses set-based scoring — use submit_roundrobin_set_score';
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
      team_a_sets = null, team_b_sets = null, set_scores = null,
      status = 'completed'
  where id = p_match_id;

  perform public.roundrobin_recompute_stats(v_tournament.id);
  perform public.roundrobin_advance_bracket(v_tournament.id);
  perform public.roundrobin_recompute_stats(v_tournament.id);
end;
$$;

-- Set-based submit. Validates per-format rules and stores set_scores + set totals.
create or replace function public.submit_roundrobin_set_score(
  p_match_id uuid,
  p_set_scores jsonb -- [{"a":6,"b":4}, ...]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.roundrobin_tournaments;
  v_match public.roundrobin_matches;
  v_a int; v_b int;
  v_set jsonb;
  v_sets_a int := 0;
  v_sets_b int := 0;
  v_played int := 0;
  v_max_sets int;
  v_needed_wins int;
  v_is_mtb boolean;
begin
  select * into v_match from public.roundrobin_matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'Match not found';
  end if;
  select t.* into v_tournament
  from public.roundrobin_tournaments t where t.id = v_match.tournament_id;
  if not public.is_club_member(v_tournament.club_id) then
    raise exception 'Not a club member';
  end if;
  if v_match.format = 'points' then
    raise exception 'This match uses points scoring — use submit_roundrobin_score';
  end if;
  if jsonb_typeof(p_set_scores) <> 'array' or jsonb_array_length(p_set_scores) = 0 then
    raise exception 'set_scores must be a non-empty array';
  end if;

  if v_match.format = 'set' then
    v_max_sets := 1; v_needed_wins := 1;
  else
    v_max_sets := 3; v_needed_wins := 2;
  end if;

  if jsonb_array_length(p_set_scores) > v_max_sets then
    raise exception 'Too many sets for this format';
  end if;

  for v_set in select value from jsonb_array_elements(p_set_scores) loop
    v_played := v_played + 1;
    v_a := (v_set->>'a')::int;
    v_b := (v_set->>'b')::int;
    if v_a is null or v_b is null or v_a < 0 or v_b < 0 then
      raise exception 'Set % has invalid scores', v_played;
    end if;

    v_is_mtb := (v_match.format = 'bo3_mtb' and v_played = 3);
    if v_is_mtb then
      -- 10-point match tiebreak, win by 2, min 10.
      if not (
        (v_a >= 10 and v_a - v_b >= 2) or
        (v_b >= 10 and v_b - v_a >= 2)
      ) then
        raise exception 'Set % (match tiebreak) must reach 10 with a 2-point lead', v_played;
      end if;
    else
      -- Standard set to 6, win by 2, tiebreak allowed at 7-6.
      if not (
        (v_a = 6 and v_b <= 4) or
        (v_b = 6 and v_a <= 4) or
        (v_a = 7 and (v_b = 5 or v_b = 6)) or
        (v_b = 7 and (v_a = 5 or v_a = 6))
      ) then
        raise exception 'Set % score %-% is not a valid set result', v_played, v_a, v_b;
      end if;
    end if;

    if v_a > v_b then v_sets_a := v_sets_a + 1;
    elsif v_b > v_a then v_sets_b := v_sets_b + 1;
    else raise exception 'Set % cannot be tied', v_played;
    end if;
  end loop;

  if greatest(v_sets_a, v_sets_b) <> v_needed_wins then
    raise exception 'Match not decided — one team must win % set(s)', v_needed_wins;
  end if;
  -- No dead rubbers: if a team already reached the needed wins, no further sets should be present.
  if v_played > 1 and v_match.format <> 'set' then
    if greatest(v_sets_a, v_sets_b) = v_needed_wins and (v_sets_a + v_sets_b) < v_played then
      raise exception 'Do not record sets after the match has been decided';
    end if;
  end if;

  update public.roundrobin_matches
  set team_a_points = null, team_b_points = null,
      team_a_sets = v_sets_a, team_b_sets = v_sets_b,
      set_scores = p_set_scores,
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
  set team_a_points = null, team_b_points = null,
      team_a_sets = null, team_b_sets = null, set_scores = null,
      status = 'pending'
  where id = p_match_id;

  perform public.roundrobin_recompute_stats(v_tournament_id);
  perform public.roundrobin_advance_bracket(v_tournament_id);
  perform public.roundrobin_recompute_stats(v_tournament_id);
end;
$$;

-- ---------- Grants ----------

grant execute on function public.create_roundrobin_tournament(text, jsonb, smallint[], integer, integer, integer, jsonb, text, text, text) to authenticated;
grant execute on function public.submit_roundrobin_set_score(uuid, jsonb) to authenticated;

revoke execute on function public.create_roundrobin_tournament(text, jsonb, smallint[], integer, integer, integer, jsonb, text, text, text) from anon;
revoke execute on function public.submit_roundrobin_set_score(uuid, jsonb) from anon;

-- Recompute for existing tournaments so aggregates reflect new columns.
do $$
declare r record;
begin
  for r in select id from public.roundrobin_tournaments loop
    perform public.roundrobin_recompute_stats(r.id);
  end loop;
end $$;
