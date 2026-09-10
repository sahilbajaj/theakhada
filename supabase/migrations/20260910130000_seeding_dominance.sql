-- Re-weight recompute_seeds:
--   * form now uses per-match dominance = (games_won - games_lost) / total_games
--     over ALL finalized matches (not just the last 10), weighted by a 14-day
--     half-life so old matches fade smoothly.
--   * rating weight reduced from 0.6 to 0.4.
--   * form weight raised to 0.45; last-match recency raised to 0.15.

create or replace function public.recompute_seeds(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_ordered uuid[];
begin
  if p_club_id is null then
    return;
  end if;

  with match_totals as (
    select
      m.id as match_id,
      m.starts_at,
      coalesce(sum(ms.side_a_games), 0) as games_a,
      coalesce(sum(ms.side_b_games), 0) as games_b
    from public.matches m
    left join public.match_sets ms on ms.match_id = m.id
    where m.club_id = p_club_id and m.status = 'final'
    group by m.id, m.starts_at
  ),
  member_matches as (
    select
      mp.profile_id,
      mt.match_id,
      mt.starts_at,
      case
        when mp.side = 'A' then (mt.games_a - mt.games_b)::numeric / nullif(mt.games_a + mt.games_b, 0)
        else (mt.games_b - mt.games_a)::numeric / nullif(mt.games_a + mt.games_b, 0)
      end as dominance,
      power(0.5::numeric, extract(epoch from (v_now - mt.starts_at)) / (14 * 24 * 3600)) as match_weight
    from public.match_participants mp
    join match_totals mt on mt.match_id = mp.match_id
  ),
  form as (
    select
      profile_id,
      case when sum(match_weight) > 0
        then sum(coalesce(dominance, 0) * match_weight) / sum(match_weight)
        else 0
      end as form
    from member_matches
    group by profile_id
  ),
  recency as (
    select profile_id,
           power(0.5::numeric, extract(epoch from (v_now - max(starts_at))) / (14 * 24 * 3600)) as recency
    from member_matches
    group by profile_id
  ),
  scored as (
    select
      cm.profile_id,
      coalesce(p.rating, 0) * 0.4
        + coalesce(f.form, 0) * 5 * 0.45
        + coalesce(r.recency, 0) * 0.15
        as score
    from public.club_memberships cm
    left join public.profiles p on p.id = cm.profile_id
    left join form f on f.profile_id = cm.profile_id
    left join recency r on r.profile_id = cm.profile_id
    where cm.club_id = p_club_id
      and cm.role <> 'guest'
      and coalesce(p.role, '') <> 'guest'
  )
  select array_agg(profile_id order by score desc, profile_id)
  into v_ordered
  from scored;

  update public.profiles p
  set seed = ord.seed
  from (
    select ord.value::uuid as profile_id, ord.ordinality::int as seed
    from unnest(coalesce(v_ordered, '{}'::uuid[])) with ordinality as ord(value, ordinality)
  ) as ord
  where p.id = ord.profile_id;

  update public.profiles p
  set seed = null
  from public.club_memberships cm
  where cm.club_id = p_club_id
    and cm.profile_id = p.id
    and (cm.role = 'guest' or p.role = 'guest')
    and p.seed is not null;
end;
$$;

notify pgrst, 'reload schema';
