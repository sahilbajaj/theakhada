-- Exclude guests from club seeding.
-- - recompute_seeds now filters out club members with role 'guest' (either at
--   the membership level or on the profile itself).
-- - Any existing guest with a non-null seed is nulled out so the board no
--   longer shows them among seeded players.

update public.profiles p
set seed = null
from public.club_memberships cm
where cm.profile_id = p.id
  and (cm.role = 'guest' or p.role = 'guest')
  and p.seed is not null;

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

  with match_results as (
    select
      m.id as match_id,
      m.starts_at,
      (
        select count(*) filter (
          where ms.side_a_games > ms.side_b_games
             or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_a, 0) > coalesce(ms.tiebreak_b, 0))
        )
        from public.match_sets ms where ms.match_id = m.id
      ) as sets_a,
      (
        select count(*) filter (
          where ms.side_b_games > ms.side_a_games
             or (ms.side_a_games = ms.side_b_games and coalesce(ms.tiebreak_b, 0) > coalesce(ms.tiebreak_a, 0))
        )
        from public.match_sets ms where ms.match_id = m.id
      ) as sets_b
    from public.matches m
    where m.club_id = p_club_id and m.status = 'final'
  ),
  member_matches as (
    select
      mp.profile_id,
      mr.match_id,
      mr.starts_at,
      case
        when mp.side = 'A' and mr.sets_a > mr.sets_b then true
        when mp.side = 'B' and mr.sets_b > mr.sets_a then true
        else false
      end as won
    from public.match_participants mp
    join match_results mr on mr.match_id = mp.match_id
  ),
  last_ten as (
    select profile_id, won,
           row_number() over (partition by profile_id order by starts_at desc) as rn
    from member_matches
  ),
  form as (
    select
      profile_id,
      coalesce(
        sum(case when won then 1 else 0 end)::numeric / nullif(count(*), 0),
        0
      ) as win_rate
    from last_ten
    where rn <= 10
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
      coalesce(p.rating, 0) * 0.6
        + coalesce(f.win_rate, 0) * 5 * 0.3
        + coalesce(r.recency, 0) * 0.1
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

  -- Even if v_ordered is empty (no eligible players), we still want to null
  -- out any stale seeds for guests in this club below.
  update public.profiles p
  set seed = ord.seed
  from (
    select ord.value::uuid as profile_id, ord.ordinality::int as seed
    from unnest(coalesce(v_ordered, '{}'::uuid[])) with ordinality as ord(value, ordinality)
  ) as ord
  where p.id = ord.profile_id;

  -- Make sure guests in this club never carry a seed.
  update public.profiles p
  set seed = null
  from public.club_memberships cm
  where cm.club_id = p_club_id
    and cm.profile_id = p.id
    and (cm.role = 'guest' or p.role = 'guest')
    and p.seed is not null;
end;
$$;
