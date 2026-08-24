create index if not exists profiles_auth_user_id_idx on public.profiles (auth_user_id);
create index if not exists club_memberships_profile_id_idx on public.club_memberships (profile_id);
create index if not exists courts_club_id_idx on public.courts (club_id);
create index if not exists bookings_court_id_idx on public.bookings (court_id);
create index if not exists matches_tournament_id_idx on public.matches (tournament_id);
create index if not exists matches_court_id_idx on public.matches (court_id);
create index if not exists attendance_records_session_id_idx on public.attendance_records (session_id);
create index if not exists attendance_records_profile_id_idx on public.attendance_records (profile_id);

drop policy if exists "authenticated users can manage bookings" on public.bookings;
drop policy if exists "authenticated users can manage matches" on public.matches;
drop policy if exists "authenticated users can manage attendance sessions" on public.attendance_sessions;
drop policy if exists "authenticated users can manage attendance records" on public.attendance_records;

create policy "authenticated users can insert bookings" on public.bookings
  for insert to authenticated
  with check (true);

create policy "authenticated users can update bookings" on public.bookings
  for update to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete bookings" on public.bookings
  for delete to authenticated
  using (true);

create policy "authenticated users can insert matches" on public.matches
  for insert to authenticated
  with check (true);

create policy "authenticated users can update matches" on public.matches
  for update to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete matches" on public.matches
  for delete to authenticated
  using (true);

create policy "authenticated users can insert attendance sessions" on public.attendance_sessions
  for insert to authenticated
  with check (true);

create policy "authenticated users can update attendance sessions" on public.attendance_sessions
  for update to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete attendance sessions" on public.attendance_sessions
  for delete to authenticated
  using (true);

create policy "authenticated users can insert attendance records" on public.attendance_records
  for insert to authenticated
  with check (true);

create policy "authenticated users can update attendance records" on public.attendance_records
  for update to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete attendance records" on public.attendance_records
  for delete to authenticated
  using (true);
