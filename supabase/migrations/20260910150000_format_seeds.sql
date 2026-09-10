-- Introduce format-specific rankings: singles_seed, doubles_seed alongside
-- the existing seed column (which now represents the "combined" ranking).
--
-- * profiles gains singles_seed / doubles_seed (int, nullable).
-- * recompute_seeds now computes all three orderings in one pass, each
--   scoped to the corresponding slice of matches (all / singles / doubles).
-- * set_all_seeds and clear_all_seeds take a p_format argument
--   ('combined' | 'singles' | 'doubles') and write to the matching column.

alter table public.profiles
  add column if not exists singles_seed int,
  add column if not exists doubles_seed int;

------------------------------------------------------------
-- recompute_seeds — compute combined / singles / doubles seeds
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
begin
  if p_club_id is null then
    return;
  end if;

  for v_format, v_column in
    select * from (values
      ('all',     'seed'),
      ('singles', 'singles_seed'),
      ('doubles', 'doubles_seed')
    ) as t(fmt, col)
  loop
    with match_totals as (
      select
        m.id as match_id,
        m.starts_at,
        coalesce(sum(ms.side_a_games), 0) as games_a,
        coalesce(sum(ms.side_b_games), 0) as games_b
      from public.matches m
      left join public.match_sets ms on ms.match_id = m.id
      where m.club_id = p_club_id
        and m.status = 'final'
        and (v_format = 'all' or m.format = v_format)
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
    played as (
      select distinct profile_id from member_matches
    ),
    scored as (
      select
        cm.profile_id,
        coalesce(p.rating, 0) * 0.4
          + coalesce(f.form, 0) * 5 * 0.45
          + coalesce(r.recency, 0) * 0.15
          as score,
        (pl.profile_id is not null) as has_played
      from public.club_memberships cm
      left join public.profiles p on p.id = cm.profile_id
      left join form f on f.profile_id = cm.profile_id
      left join recency r on r.profile_id = cm.profile_id
      left join played pl on pl.profile_id = cm.profile_id
      where cm.club_id = p_club_id
        and cm.role <> 'guest'
        and coalesce(p.role, '') <> 'guest'
    )
    -- Combined seed: rank everyone in the club (even members with no
    -- matches yet) so the roster always has a full ordering.
    -- Singles / doubles seeds: only rank members who've played that
    -- format; others get null.
    select array_agg(profile_id order by score desc, profile_id)
    into v_ordered
    from scored
    where v_format = 'all' or has_played;

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

    -- Null the column for anyone in the club not in the ordered list
    -- (guests, or — for singles/doubles — members who haven't played that format).
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

------------------------------------------------------------
-- set_all_seeds — now format-aware
------------------------------------------------------------

drop function if exists public.set_all_seeds(uuid, uuid[]);

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
    'update public.profiles p
       set %I = ord.seed
     from (
       select ord.value::uuid as profile_id, ord.ordinality::int as seed
       from unnest($1) with ordinality as ord(value, ordinality)
     ) as ord
     where p.id = ord.profile_id',
    v_column
  ) using p_profile_ids;

  execute format(
    'update public.profiles p
       set %I = null
     where p.id in (
       select cm.profile_id from public.club_memberships cm where cm.club_id = $1
     )
     and (p.id <> all(coalesce($2, ''{}''::uuid[])))',
    v_column
  ) using v_club_id, p_profile_ids;
end;
$$;

grant execute on function public.set_all_seeds(uuid, uuid[], text) to authenticated;

------------------------------------------------------------
-- clear_all_seeds — now format-aware
------------------------------------------------------------

drop function if exists public.clear_all_seeds(uuid);

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
    'update public.profiles
       set %I = null
     where id in (
       select cm.profile_id from public.club_memberships cm where cm.club_id = $1
     )',
    v_column
  ) using v_club_id;
end;
$$;

grant execute on function public.clear_all_seeds(uuid, text) to authenticated;

notify pgrst, 'reload schema';
