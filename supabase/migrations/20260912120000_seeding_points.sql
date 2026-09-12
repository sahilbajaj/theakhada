-- Points-based seeding. Replaces the rating/form/recency weighted formula
-- with per-match points that decay on a 30-day half-life. Each match's
-- points = (1 + margin) * opp_strength * length_weight * decay, and losses
-- contribute 0. Rating is retained only as a cold-start prior that fades to
-- zero once a player has 8 matches in the format being ranked.
--
-- Opponent strength uses the *currently-stored* seed of each opponent
-- (singles_seed for singles points, doubles_seed for doubles, seed for
-- combined). Single pass — the next recompute picks up any rank shifts.
--
-- Signature of recompute_seeds(p_club_id uuid) is unchanged so the
-- matches_autoseed trigger (20260825150000_autoseed_on_finalize.sql) still
-- works.

create or replace function public.recompute_seeds(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_format text;
  v_column text;
  v_ordered uuid[];
  v_n integer;
begin
  if p_club_id is null then
    return;
  end if;

  -- Denominator for opponent-strength: number of non-guest members.
  select count(*)
    into v_n
  from public.club_memberships cm
  left join public.profiles p on p.id = cm.profile_id
  where cm.club_id = p_club_id
    and cm.role <> 'guest'
    and coalesce(p.role, '') <> 'guest';

  v_n := greatest(v_n, 1);

  for v_format, v_column in
    select * from (values
      ('all',     'seed'),
      ('singles', 'singles_seed'),
      ('doubles', 'doubles_seed')
    ) as t(fmt, col)
  loop
    -- The opponent-strength lookup and the seed write both need the same
    -- column name. format(%I) safely quotes it as an identifier.
    execute format($fmt$
      with match_totals as (
        select
          m.id as match_id,
          m.starts_at,
          m.best_of,
          coalesce(sum(ms.side_a_games), 0) as games_a,
          coalesce(sum(ms.side_b_games), 0) as games_b
        from public.matches m
        left join public.match_sets ms on ms.match_id = m.id
        where m.club_id = $1
          and m.status = 'final'
          and ($2 = 'all' or m.format = $2)
        group by m.id, m.starts_at, m.best_of
      ),
      member_matches as (
        select
          mp.profile_id,
          mp.side,
          mt.match_id,
          mt.starts_at,
          mt.best_of,
          mt.games_a,
          mt.games_b
        from public.match_participants mp
        join match_totals mt on mt.match_id = mp.match_id
      ),
      opp_ranks as (
        select
          mm.match_id,
          mm.profile_id,
          mm.side,
          avg(coalesce(p_opp.%1$I, $3)::numeric) as avg_opp_rank
        from member_matches mm
        join public.match_participants opp
          on opp.match_id = mm.match_id and opp.side <> mm.side
        join public.profiles p_opp on p_opp.id = opp.profile_id
        group by mm.match_id, mm.profile_id, mm.side
      ),
      match_points as (
        select
          mm.profile_id,
          case
            when (mm.games_a + mm.games_b) = 0 then null
            when mm.side = 'A' then (mm.games_a - mm.games_b)::numeric / (mm.games_a + mm.games_b)
            else (mm.games_b - mm.games_a)::numeric / (mm.games_a + mm.games_b)
          end as margin,
          case mm.best_of
            when 1 then 0.67::numeric
            when 5 then 1.33::numeric
            else 1.0::numeric
          end as length_weight,
          (1 + ($3 - coalesce(orank.avg_opp_rank, $3::numeric)) / $3::numeric) as opp_strength,
          power(0.5::numeric, extract(epoch from ($4::timestamptz - mm.starts_at)) / (30 * 24 * 3600)) as decay
        from member_matches mm
        left join opp_ranks orank
          on orank.match_id = mm.match_id
         and orank.profile_id = mm.profile_id
         and orank.side = mm.side
      ),
      totals as (
        select
          profile_id,
          sum(
            case when margin is not null and margin > 0
              then (1 + margin) * opp_strength * length_weight * decay
              else 0
            end
          ) as total_points,
          count(*) as match_count
        from match_points
        group by profile_id
      ),
      played as (
        select distinct profile_id from member_matches
      ),
      scored as (
        select
          cm.profile_id,
          coalesce(t.total_points, 0)
            + coalesce(p.rating, 0) * 2 * greatest(0::numeric, 1 - coalesce(t.match_count, 0)::numeric / 8)
            as score,
          (pl.profile_id is not null) as has_played,
          coalesce(t.match_count, 0) as match_count
        from public.club_memberships cm
        left join public.profiles p on p.id = cm.profile_id
        left join totals t on t.profile_id = cm.profile_id
        left join played pl on pl.profile_id = cm.profile_id
        where cm.club_id = $1
          and cm.role <> 'guest'
          and coalesce(p.role, '') <> 'guest'
      )
      select array_agg(profile_id order by score desc, match_count desc, profile_id)
      from scored
      where $2 = 'all' or has_played
    $fmt$, v_column)
    into v_ordered
    using p_club_id, v_format, v_n, v_now;

    execute format(
      'update public.profiles p
         set %I = ord.seed
       from (
         select ord.value::uuid as profile_id, ord.ordinality::int as seed
         from unnest(coalesce($1, ''{}''::uuid[])) with ordinality as ord(value, ordinality)
       ) as ord
       where p.id = ord.profile_id',
      v_column
    ) using v_ordered;

    execute format(
      'update public.profiles p
         set %I = null
       from public.club_memberships cm
       where cm.club_id = $1
         and cm.profile_id = p.id
         and p.%I is not null
         and (p.id <> all(coalesce($2, ''{}''::uuid[])))',
      v_column, v_column
    ) using p_club_id, v_ordered;
  end loop;
end;
$$;

revoke all on function public.recompute_seeds(uuid) from public, anon;
grant execute on function public.recompute_seeds(uuid) to authenticated;

notify pgrst, 'reload schema';
