create index if not exists signup_requests_reviewed_by_idx on public.signup_requests (reviewed_by);
create index if not exists club_invites_created_by_idx on public.club_invites (created_by);
create index if not exists club_invites_accepted_profile_id_idx on public.club_invites (accepted_profile_id);

drop policy if exists "members can manage bookings" on public.bookings;
drop policy if exists "members can manage matches" on public.matches;
drop policy if exists "members can manage attendance sessions" on public.attendance_sessions;
drop policy if exists "members can manage attendance records" on public.attendance_records;

create policy "members can insert bookings" on public.bookings for insert to authenticated
with check (public.is_club_member(club_id));

create policy "members can update bookings" on public.bookings for update to authenticated
using (public.is_club_member(club_id))
with check (public.is_club_member(club_id));

create policy "members can delete bookings" on public.bookings for delete to authenticated
using (public.is_club_member(club_id));

create policy "members can insert matches" on public.matches for insert to authenticated
with check (public.is_club_member(club_id));

create policy "members can update matches" on public.matches for update to authenticated
using (public.is_club_member(club_id))
with check (public.is_club_member(club_id));

create policy "members can delete matches" on public.matches for delete to authenticated
using (public.is_club_member(club_id));

create policy "members can insert attendance sessions" on public.attendance_sessions for insert to authenticated
with check (public.is_club_member(club_id));

create policy "members can update attendance sessions" on public.attendance_sessions for update to authenticated
using (public.is_club_member(club_id))
with check (public.is_club_member(club_id));

create policy "members can delete attendance sessions" on public.attendance_sessions for delete to authenticated
using (public.is_club_member(club_id));

create policy "members can insert attendance records" on public.attendance_records for insert to authenticated
with check (
  exists (
    select 1
    from public.attendance_sessions s
    where s.id = session_id
      and public.is_club_member(s.club_id)
  )
);

create policy "members can update attendance records" on public.attendance_records for update to authenticated
using (
  exists (
    select 1
    from public.attendance_sessions s
    where s.id = session_id
      and public.is_club_member(s.club_id)
  )
)
with check (
  exists (
    select 1
    from public.attendance_sessions s
    where s.id = session_id
      and public.is_club_member(s.club_id)
  )
);

create policy "members can delete attendance records" on public.attendance_records for delete to authenticated
using (
  exists (
    select 1
    from public.attendance_sessions s
    where s.id = session_id
      and public.is_club_member(s.club_id)
  )
);

revoke execute on function public.default_club_id() from anon;
revoke execute on function public.current_profile_id() from anon;
revoke execute on function public.is_club_member(uuid) from anon;
revoke execute on function public.is_club_admin(uuid) from anon;
revoke execute on function public.claim_current_access() from anon;
revoke execute on function public.approve_signup_request(uuid, text) from anon;
revoke execute on function public.reject_signup_request(uuid) from anon;
revoke execute on function public.create_invite(text, text, timestamptz, text) from anon;
revoke execute on function public.accept_invite(text, text) from anon;
