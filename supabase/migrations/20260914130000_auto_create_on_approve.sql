-- Approving a club creation request now creates the club (name + city
-- from the request, timezone defaults to 'UTC'). Rejection is unchanged.

drop function if exists public.review_club_creation_request(uuid, boolean);

create or replace function public.review_club_creation_request(
  p_id uuid,
  p_approve boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer uuid := public.current_profile_id();
  v_req record;
  v_club_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin only';
  end if;

  select id, proposed_name, city, status
    into v_req
    from public.club_creation_requests
   where id = p_id
   for update;

  if not found then
    raise exception 'Request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Request already reviewed';
  end if;

  if p_approve then
    v_club_id := public.create_club(v_req.proposed_name, v_req.city, 'UTC');
  end if;

  update public.club_creation_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = v_reviewer,
         reviewed_at = now()
   where id = p_id;

  return v_club_id;
end;
$$;

revoke all on function public.review_club_creation_request(uuid, boolean) from public;
grant execute on function public.review_club_creation_request(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
