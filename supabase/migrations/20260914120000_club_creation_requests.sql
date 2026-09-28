-- Club creation requests: authenticated users can propose a new club;
-- superadmins review and approve/reject.

create table if not exists public.club_creation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid not null references public.profiles(id) on delete cascade,
  proposed_name text not null check (length(trim(proposed_name)) > 0),
  city text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists club_creation_requests_status_idx
  on public.club_creation_requests (status, created_at desc);

create unique index if not exists club_creation_requests_one_pending_per_user
  on public.club_creation_requests (requester_profile_id)
  where status = 'pending';

alter table public.club_creation_requests enable row level security;

drop policy if exists ccr_select_own_or_super on public.club_creation_requests;
create policy ccr_select_own_or_super
  on public.club_creation_requests
  for select
  to authenticated
  using (
    requester_profile_id = public.current_profile_id()
    or public.is_superadmin()
  );

drop policy if exists ccr_insert_own on public.club_creation_requests;
create policy ccr_insert_own
  on public.club_creation_requests
  for insert
  to authenticated
  with check (requester_profile_id = public.current_profile_id());

drop policy if exists ccr_update_super on public.club_creation_requests;
create policy ccr_update_super
  on public.club_creation_requests
  for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

------------------------------------------------------------
-- request_club_creation — user proposes a new club
------------------------------------------------------------

create or replace function public.request_club_creation(
  p_name text,
  p_city text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_name text := trim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_profile_id is null then
    raise exception 'Sign in first';
  end if;
  if v_name = '' then
    raise exception 'Club name is required';
  end if;

  insert into public.club_creation_requests (requester_profile_id, proposed_name, city, notes)
  values (v_profile_id, v_name, nullif(trim(coalesce(p_city, '')), ''), nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.request_club_creation(text, text, text) from public;
grant execute on function public.request_club_creation(text, text, text) to authenticated;

------------------------------------------------------------
-- list_club_creation_requests — superadmin review list
------------------------------------------------------------

create or replace function public.list_club_creation_requests(p_status text default 'pending')
returns table (
  id uuid,
  requester_profile_id uuid,
  requester_name text,
  proposed_name text,
  city text,
  notes text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.requester_profile_id,
    p.full_name,
    r.proposed_name,
    r.city,
    r.notes,
    r.status,
    r.created_at,
    r.reviewed_at
  from public.club_creation_requests r
  join public.profiles p on p.id = r.requester_profile_id
  where public.is_superadmin()
    and (p_status is null or r.status = p_status)
  order by r.created_at desc
$$;

grant execute on function public.list_club_creation_requests(text) to authenticated;

------------------------------------------------------------
-- review_club_creation_request — superadmin approves/rejects
------------------------------------------------------------

create or replace function public.review_club_creation_request(
  p_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer uuid := public.current_profile_id();
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin only';
  end if;

  update public.club_creation_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = v_reviewer,
      reviewed_at = now()
  where id = p_id and status = 'pending';

  if not found then
    raise exception 'Request not found or already reviewed';
  end if;
end;
$$;

revoke all on function public.review_club_creation_request(uuid, boolean) from public;
grant execute on function public.review_club_creation_request(uuid, boolean) to authenticated;
