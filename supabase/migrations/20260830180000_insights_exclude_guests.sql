-- Insights: exclude guests from all six leader boards. Guests still appear in
-- match participation but shouldn't win Player-of-the-Week etc, and a doubles
-- pair with a guest partner shouldn't count for Best Partner either.

create or replace function public.get_club_insights()
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
