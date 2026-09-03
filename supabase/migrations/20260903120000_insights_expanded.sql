-- Insights v2: five new RPCs powering the Rivalry, Form, Style, Participation,
-- and Milestones tabs, plus seed snapshot infra powering "on the rise".
--
-- Shared helper _insights_player_matches(club_id) returns per-player rows for
-- every finalized match, excluding guests, with win / straight-set flags and
-- set counts. All RPCs derive from it.

--------------------------------------------------------------------
-- Seed snapshots
--------------------------------------------------------------------

create table if not exists public.profile_seed_snapshots (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  seed integer,
  captured_at timestamptz not null default now(),
  primary key (profile_id, captured_at)
);

create index if not exists profile_seed_snapshots_profile_time_idx
  on public.profile_seed_snapshots (profile_id, captured_at desc);

alter table public.profile_seed_snapshots enable row level security;

drop policy if exists "members read seed snapshots" on public.profile_seed_snapshots;
create policy "members read seed snapshots" on public.profile_seed_snapshots
  for select to authenticated using (true);

create or replace function public._snapshot_seed_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.seed is distinct from old.seed then
    insert into public.profile_seed_snapshots (profile_id, seed, captured_at)
    values (new.id, new.seed, now())
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_seed_snapshot on public.profiles;
create trigger profiles_seed_snapshot
  after update of seed on public.profiles
  for each row execute function public._snapshot_seed_change();

-- Baseline back-dated 31 days so "on the rise" can compute immediately.
insert into public.profile_seed_snapshots (profile_id, seed, captured_at)
select id, seed, now() - interval '31 days'
from public.profiles
where seed is not null
on conflict do nothing;

--------------------------------------------------------------------
-- Shared helper: per-player finalized-match rows (guests excluded)
--------------------------------------------------------------------

create or replace function public._insights_player_matches(p_club_id uuid)
returns table (
  profile_id uuid,
  match_id uuid,
  starts_at timestamptz,
  format text,
  side char(1),
  is_win boolean,
  straight boolean,
  sets_a smallint,
  sets_b smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  with set_wins as (
    select
      ms.match_id,
      sum(case
        when ms.side_a_games > ms.side_b_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_a, 0) > coalesce(ms.tiebreak_b, 0))
        then 1 else 0 end)::smallint as sets_a,
      sum(case
        when ms.side_b_games > ms.side_a_games
          or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_b, 0) > coalesce(ms.tiebreak_a, 0))
        then 1 else 0 end)::smallint as sets_b
    from public.match_sets ms
    group by ms.match_id
  ),
  match_outcomes as (
    select
      m.id as match_id,
      m.starts_at,
      m.format,
      sw.sets_a,
      sw.sets_b,
      case
        when sw.sets_a > sw.sets_b then 'A'::char(1)
        when sw.sets_b > sw.sets_a then 'B'::char(1)
      end as winner_side,
      (sw.sets_a = 0 or sw.sets_b = 0) as straight
    from public.matches m
    join set_wins sw on sw.match_id = m.id
    where m.club_id = p_club_id and m.status = 'final'
  )
  select
    mp.profile_id,
    mo.match_id,
    mo.starts_at,
    mo.format,
    mp.side,
    (mp.side = mo.winner_side) as is_win,
    mo.straight,
    mo.sets_a,
    mo.sets_b
  from match_outcomes mo
  join public.match_participants mp on mp.match_id = mo.match_id
  join public.profiles p on p.id = mp.profile_id
  left join public.club_memberships cm on cm.profile_id = mp.profile_id and cm.club_id = p_club_id
  where mo.winner_side is not null
    and coalesce(p.role, '') <> 'guest'
    and coalesce(cm.role, '') <> 'guest';
$$;

grant execute on function public._insights_player_matches(uuid) to authenticated;

--------------------------------------------------------------------
-- Rivalry & Social
--------------------------------------------------------------------

create or replace function public.get_club_insights_rivalry()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
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

grant execute on function public.get_club_insights_rivalry() to authenticated;
revoke execute on function public.get_club_insights_rivalry() from anon;

--------------------------------------------------------------------
-- Form & Momentum
--------------------------------------------------------------------

create or replace function public.get_club_insights_form()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
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

grant execute on function public.get_club_insights_form() to authenticated;
revoke execute on function public.get_club_insights_form() from anon;

--------------------------------------------------------------------
-- Playing Style
--------------------------------------------------------------------

create or replace function public.get_club_insights_style()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
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

grant execute on function public.get_club_insights_style() to authenticated;
revoke execute on function public.get_club_insights_style() from anon;

--------------------------------------------------------------------
-- Participation & Community
--------------------------------------------------------------------

create or replace function public.get_club_insights_participation()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
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

grant execute on function public.get_club_insights_participation() to authenticated;
revoke execute on function public.get_club_insights_participation() from anon;

--------------------------------------------------------------------
-- Milestones — chronological feed for the last 30 days
--------------------------------------------------------------------

create or replace function public.get_club_insights_milestones()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := public.default_club_id();
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

grant execute on function public.get_club_insights_milestones() to authenticated;
revoke execute on function public.get_club_insights_milestones() from anon;
