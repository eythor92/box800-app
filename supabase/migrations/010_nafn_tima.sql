-- =====================================================================
-- BOX800 – eigið nafn á tíma (t.d. „Hreysti: Jólaæfing“). Autt = nafn námskeiðsins.
-- Keyrt á eftir 009. Má keyra aftur án skaða.
-- =====================================================================
alter table classes add column if not exists title text;

create or replace function class_list(p_from timestamptz, p_to timestamptz)
returns table (
  id bigint, program_id int, program text, color text, starts_at timestamptz, ends_at timestamptz,
  coach_id uuid, coach_name text, coach_avatar text, cap int, booked int, waiting int,
  cancelled boolean, my_status text, my_position int, slot_id int
)
language sql stable security definer set search_path = public as $$
  select c.id, c.program_id, coalesce(nullif(trim(c.title), ''), p.name), p.color, c.starts_at, c.ends_at,
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

create or replace function class_label(c classes) returns text
language sql stable set search_path = public as $$
  select coalesce(nullif(trim(c.title), ''), pr.name) || ' ' || to_char(c.starts_at at time zone 'Atlantic/Reykjavik', 'HH24:MI')
         || ' (' || to_char(c.starts_at at time zone 'Atlantic/Reykjavik', 'DD.MM.') || ')'
  from programs pr where pr.id = c.program_id
$$;
