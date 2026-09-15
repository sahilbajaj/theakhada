-- Move seeds from public.profiles (global) to public.club_memberships (per club),
-- fixing the cross-club leak where recompute_seeds(club_id) overwrote seeds for
-- every club a profile belonged to.
--
-- After this migration:
--   * club_memberships.seed / .singles_seed / .doubles_seed hold the seeds.
--   * profile_seed_snapshots gains a club_id column and is fed by a trigger on
--     club_memberships instead of profiles.
--   * profiles.seed / .singles_seed / .doubles_seed are dropped.
--   * recompute_seeds is called once per club at the end to reset ordering
--     deterministically (cross-club history is unrecoverable).

------------------------------------------------------------
-- 1. Add per-membership seed columns
------------------------------------------------------------

alter table public.club_memberships
  add column if not exists seed int,
  add column if not exists singles_seed int,
  add column if not exists doubles_seed int;

------------------------------------------------------------
-- 2. Best-effort backfill (all clubs get the current profile seed;
--     the recompute at the end will fix per-club ordering).
------------------------------------------------------------

update public.club_memberships cm
   set seed         = p.seed,
       singles_seed = p.singles_seed,
       doubles_seed = p.doubles_seed
  from public.profiles p
 where p.id = cm.profile_id;

------------------------------------------------------------
-- 3. Redefine recompute_seeds — reads opponent seed from club_memberships,
--    writes to club_memberships. Signature unchanged.
------------------------------------------------------------

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
          avg(coalesce(cm_opp.%1$I, $3)::numeric) as avg_opp_rank
        from member_matches mm
        join public.match_participants opp
          on opp.match_id = mm.match_id and opp.side <> mm.side
        left join public.club_memberships cm_opp
          on cm_opp.profile_id = opp.profile_id and cm_opp.club_id = $1
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
          power(
            0.5::numeric,
            greatest(
              0::numeric,
              extract(epoch from ($4::timestamptz - mm.starts_at)) - (10 * 24 * 3600)
            ) / (30 * 24 * 3600)
          ) as decay
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
          count(*) as match_count,
          count(*) filter (where margin is not null and margin > 0) as win_count
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
            * coalesce(t.win_count, 0)::numeric
            / (coalesce(t.match_count, 0)::numeric + 3)
            + (coalesce(p.rating, 3.0) - 3.0)
              * 1.0
              * greatest(0::numeric, 1 - coalesce(t.match_count, 0)::numeric / 8)
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
      'update public.club_memberships cm
         set %I = ord.seed
       from (
         select ord.value::uuid as profile_id, ord.ordinality::int as seed
         from unnest(coalesce($1, ''{}''::uuid[])) with ordinality as ord(value, ordinality)
       ) as ord
       where cm.profile_id = ord.profile_id
         and cm.club_id = $2',
      v_column
    ) using v_ordered, p_club_id;

    execute format(
      'update public.club_memberships cm
         set %I = null
       where cm.club_id = $1
         and cm.%I is not null
         and (cm.profile_id <> all(coalesce($2, ''{}''::uuid[])))',
      v_column, v_column
    ) using p_club_id, v_ordered;
  end loop;
end;
$$;

revoke all on function public.recompute_seeds(uuid) from public, anon;
grant execute on function public.recompute_seeds(uuid) to authenticated;

------------------------------------------------------------
-- 4. Redefine set_all_seeds / clear_all_seeds to write to club_memberships.
--    Signatures unchanged.
------------------------------------------------------------

create or replace function public.set_all_seeds(
  p_club_id uuid default null,
  p_profile_ids uuid[] default null,
  p_format text default 'combined'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_column text;
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  v_column := case p_format
    when 'singles' then 'singles_seed'
    when 'doubles' then 'doubles_seed'
    else 'seed'
  end;

  execute format(
    'update public.club_memberships cm
       set %I = ord.seed
     from (
       select ord.value::uuid as profile_id, ord.ordinality::int as seed
       from unnest($1) with ordinality as ord(value, ordinality)
     ) as ord
     where cm.profile_id = ord.profile_id
       and cm.club_id = $2',
    v_column
  ) using p_profile_ids, v_club_id;

  execute format(
    'update public.club_memberships cm
       set %I = null
     where cm.club_id = $1
       and (cm.profile_id <> all(coalesce($2, ''{}''::uuid[])))',
    v_column
  ) using v_club_id, p_profile_ids;
end;
$$;

grant execute on function public.set_all_seeds(uuid, uuid[], text) to authenticated;

create or replace function public.clear_all_seeds(
  p_club_id uuid default null,
  p_format text default 'combined'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_column text;
begin
  if not public.is_club_admin(v_club_id) then
    raise exception 'Not authorized';
  end if;

  v_column := case p_format
    when 'singles' then 'singles_seed'
    when 'doubles' then 'doubles_seed'
    else 'seed'
  end;

  execute format(
    'update public.club_memberships cm
       set %I = null
     where cm.club_id = $1',
    v_column
  ) using v_club_id;
end;
$$;

grant execute on function public.clear_all_seeds(uuid, text) to authenticated;

------------------------------------------------------------
-- 5. Rebuild profile_seed_snapshots to be per club.
------------------------------------------------------------

drop trigger if exists profiles_seed_snapshot on public.profiles;
drop function if exists public._snapshot_seed_change();

-- Existing rows are cross-club noise; drop and rebuild the table cleanly.
drop table if exists public.profile_seed_snapshots;

create table public.profile_seed_snapshots (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  club_id     uuid not null references public.clubs(id)    on delete cascade,
  seed        integer,
  captured_at timestamptz not null default now(),
  primary key (profile_id, club_id, captured_at)
);

create index profile_seed_snapshots_lookup_idx
  on public.profile_seed_snapshots (profile_id, club_id, captured_at desc);

alter table public.profile_seed_snapshots enable row level security;

create policy "members read seed snapshots" on public.profile_seed_snapshots
  for select to authenticated using (true);

create or replace function public._snapshot_membership_seed_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.seed is distinct from old.seed then
    insert into public.profile_seed_snapshots (profile_id, club_id, seed, captured_at)
    values (new.profile_id, new.club_id, new.seed, now())
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists club_memberships_seed_snapshot on public.club_memberships;
create trigger club_memberships_seed_snapshot
  after update of seed on public.club_memberships
  for each row execute function public._snapshot_membership_seed_change();

-- Baseline snapshot back-dated 31 days so "on the rise" works immediately.
insert into public.profile_seed_snapshots (profile_id, club_id, seed, captured_at)
select profile_id, club_id, seed, now() - interval '31 days'
from public.club_memberships
where seed is not null
on conflict do nothing;

------------------------------------------------------------
-- 6. Rewire get_club_insights_form giant_slayer + on_the_rise CTEs
--    to read seeds from club_memberships scoped to v_club_id.
------------------------------------------------------------

create or replace function public.get_club_insights_form(p_club_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid := coalesce(p_club_id, public.default_club_id());
  v_result jsonb;
begin
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;

  with base as (select * from public._insights_player_matches(v_club_id)),
  recent as (
    select profile_id, is_win, starts_at, match_id,
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
    join public.club_memberships cmw on cmw.profile_id = sw.winner and cmw.club_id = v_club_id
    join public.club_memberships cml on cml.profile_id = sw.loser  and cml.club_id = v_club_id
    where cmw.seed is not null and cml.seed is not null and cml.seed < cmw.seed
    group by sw.winner
    having count(*) >= 1
    order by count(*) desc
    limit 1
  ),
  current_seeds as (
    select cm.profile_id, cm.seed as current_seed
    from public.club_memberships cm
    join public.profiles p on p.id = cm.profile_id
    where cm.club_id = v_club_id
      and cm.seed is not null
      and coalesce(p.role, '') <> 'guest'
      and cm.role <> 'guest'
  ),
  past_seeds as (
    select distinct on (profile_id) profile_id, seed as past_seed
    from public.profile_seed_snapshots
    where club_id = v_club_id
      and captured_at <= now() - interval '30 days'
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

grant execute on function public.get_club_insights_form(uuid) to authenticated;
revoke execute on function public.get_club_insights_form(uuid) from anon;

------------------------------------------------------------
-- 7. Reset every club deterministically now that writes go to memberships.
------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in select id from public.clubs loop
    perform public.recompute_seeds(r.id);
  end loop;
end;
$$;

------------------------------------------------------------
-- 8. Drop the (now unused) seed columns from profiles.
------------------------------------------------------------

alter table public.profiles
  drop column if exists seed,
  drop column if exists singles_seed,
  drop column if exists doubles_seed;

notify pgrst, 'reload schema';
