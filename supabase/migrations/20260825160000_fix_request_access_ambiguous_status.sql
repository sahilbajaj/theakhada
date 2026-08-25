-- Fix `request_access`: the previous function declared `status` as an OUT
-- parameter (via `returns table (request_id uuid, status text)`) which
-- collided with `signup_requests.status` inside the `on conflict ... where`
-- clause. Postgres raised 42702 "column reference \"status\" is ambiguous",
-- surfacing to the client as a 400.
--
-- The caller in the app ignores the return value, so drop the OUT params
-- entirely and return void.

drop function if exists public.request_access(text, text);

create or replace function public.request_access(p_email text, p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_name text := trim(p_full_name);
  v_club_id uuid := public.default_club_id();
begin
  if v_email = '' or v_name = '' then
    raise exception 'Email and name are required';
  end if;

  insert into public.signup_requests (club_id, email, full_name)
  values (v_club_id, v_email, v_name)
  on conflict (club_id, lower(email)) where status = 'pending'
  do update set
    full_name = excluded.full_name,
    updated_at = now();
end;
$$;

revoke all on function public.request_access(text, text) from public;
grant execute on function public.request_access(text, text) to anon, authenticated;
