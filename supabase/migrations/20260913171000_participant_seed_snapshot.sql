-- Snapshot each participant's per-club seed at match finalize time, so
-- points/opp_strength stop churning when unrelated activity moves the
-- club's seeds around. Once a match is finalized, its contribution to
-- everyone's score is frozen.
--
-- 1. Add nullable snapshot columns to match_participants.
-- 2. Backfill existing final matches from current club_memberships.
-- 3. Redefine finalize_match to snapshot participants' seeds *before*
--    flipping matches.status to 'final' (which fires the autoseed
--    trigger).

alter table public.match_participants
  add column if not exists seed_at_match         int,
  add column if not exists singles_seed_at_match int,
  add column if not exists doubles_seed_at_match int;

update public.match_participants mp
   set seed_at_match         = cm.seed,
       singles_seed_at_match = cm.singles_seed,
       doubles_seed_at_match = cm.doubles_seed
  from public.matches m,
       public.club_memberships cm
 where m.id = mp.match_id
   and cm.profile_id = mp.profile_id
   and cm.club_id = m.club_id
   and m.status = 'final'
   and mp.seed_at_match is null
   and mp.singles_seed_at_match is null
   and mp.doubles_seed_at_match is null;

create or replace function public.finalize_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_status text;
  v_self uuid := public.current_profile_id();
  v_sets_a smallint := 0;
  v_sets_b smallint := 0;
  v_winner char(1);
begin
  select club_id, status into v_club_id, v_status from public.matches where id = p_match_id;
  if v_club_id is null then
    raise exception 'Match not found';
  end if;
  if not public.is_club_member(v_club_id) then
    raise exception 'Not authorized';
  end if;
  if v_status = 'suspended' then
    raise exception 'Match is suspended — resume it before finalizing';
  end if;

  select
    count(*) filter (
      where side_a_games > side_b_games
        or (side_a_games = side_b_games and coalesce(tiebreak_a, 0) > coalesce(tiebreak_b, 0))
    ),
    count(*) filter (
      where side_b_games > side_a_games
        or (side_a_games = side_b_games and coalesce(tiebreak_b, 0) > coalesce(tiebreak_a, 0))
    )
  into v_sets_a, v_sets_b
  from public.match_sets
  where match_id = p_match_id;

  if v_sets_a + v_sets_b = 0 then
    raise exception 'Record at least one set before finalizing';
  end if;

  v_winner := case when v_sets_a > v_sets_b then 'A' when v_sets_b > v_sets_a then 'B' else null end;

  -- Freeze participants' seeds as-of match completion. Do this BEFORE the
  -- status flip so the autoseed trigger (which reshuffles club seeds) sees
  -- the snapshot already in place.
  update public.match_participants mp
     set seed_at_match         = cm.seed,
         singles_seed_at_match = cm.singles_seed,
         doubles_seed_at_match = cm.doubles_seed
    from public.club_memberships cm
   where mp.match_id = p_match_id
     and cm.profile_id = mp.profile_id
     and cm.club_id = v_club_id;

  update public.matches
  set status = 'final',
      suspended_reason = null,
      suspended_note = null
  where id = p_match_id;

  insert into public.match_events (match_id, actor_profile_id, kind, payload)
  values (
    p_match_id,
    v_self,
    'match_finalized',
    jsonb_build_object('winner_side', v_winner, 'sets_a', v_sets_a, 'sets_b', v_sets_b)
  );
end;
$$;

grant execute on function public.finalize_match(uuid) to authenticated;

notify pgrst, 'reload schema';
