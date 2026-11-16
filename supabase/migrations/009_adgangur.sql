-- =====================================================================
-- BOX800 – aðeins iðkendur með virkt kort eða áskrift sjá tímatöflu,
-- skráða, mætingu og æfingar. Aðrir sjá aðeins forsíðuna og prófílinn sinn.
-- Keyrt á eftir 008. Má keyra aftur án skaða.
-- =====================================================================

-- Hefur innskráður notandi aðgang? (þjálfari/eigandi, eða virk áskrift, eða forráðamaður barns með áskrift)
create or replace function has_access() returns boolean
language sql stable security definer set search_path = public as $$
  select is_staff() or exists (
    select 1 from memberships m join profiles p on p.id = m.profile_id
    where (p.id = me() or p.guardian_id = me())
      and m.status = 'active' and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
  )
$$;
revoke execute on function has_access() from public, anon;
grant execute on function has_access() to authenticated;

-- Tímatafla og fjöldi skráðra: aðeins með aðgang
create or replace function class_list(p_from timestamptz, p_to timestamptz)
returns table (
  id bigint, program_id int, program text, color text, starts_at timestamptz, ends_at timestamptz,
  coach_id uuid, coach_name text, coach_avatar text, cap int, booked int, waiting int,
  cancelled boolean, my_status text, my_position int, slot_id int
)
language sql stable security definer set search_path = public as $$
  select c.id, c.program_id, p.name, p.color, c.starts_at, c.ends_at,
         c.coach_id, co.full_name, co.avatar_url, class_cap(c),
         (select count(*)::int from bookings b where b.class_id = c.id and b.status = 'booked'),
         (select count(*)::int from bookings b where b.class_id = c.id and b.status = 'waitlist'),
         c.cancelled_at is not null,
         mb.status,
         case when mb.status = 'waitlist' then
           (select count(*)::int from bookings b where b.class_id = c.id and b.status = 'waitlist'
              and (b.waitlist_at, b.id) <= (mb.waitlist_at, mb.id)) end,
         c.slot_id
  from classes c
  join programs p on p.id = c.program_id
  left join profiles co on co.id = c.coach_id
  left join bookings mb on mb.class_id = c.id and mb.profile_id = me()
  where c.starts_at >= p_from and c.starts_at < p_to and has_access()
  order by c.starts_at, p.sort
$$;

-- Hverjir eru skráðir: aðeins með aðgang
create or replace function class_attendees(p_class bigint)
returns table (profile_id uuid, full_name text, avatar_url text, checked_in boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  select b.profile_id, pr.full_name, pr.avatar_url, b.checked_in_at is not null, b.profile_id = me()
  from bookings b join profiles pr on pr.id = b.profile_id
  where b.class_id = p_class and b.status = 'booked' and has_access()
  order by b.created_at, b.id
$$;

-- Stigatafla: aðeins með aðgang
create or replace function component_leaderboard(p_workout bigint, p_key text)
returns table (profile_id uuid, full_name text, avatar_url text, kind text, score_num numeric, score_text text,
               sets int, reps int, weight numeric, rx text, is_me boolean)
language sql stable security definer set search_path = public as $$
  select r.profile_id, pr.full_name, pr.avatar_url, r.kind, r.score_num, r.score_text, r.sets, r.reps, r.weight, r.rx,
         r.profile_id = me()
  from results r join profiles pr on pr.id = r.profile_id
  where r.workout_id = p_workout and r.comp_key = p_key and has_access()
$$;

-- Æfingar: aðeins með aðgang (þjálfarar sjá líka drög)
drop policy if exists p_workouts_read on workouts;
create policy p_workouts_read on workouts for select to authenticated
  using (is_staff() or (status = 'published' and publish_at <= now() and has_access()));
