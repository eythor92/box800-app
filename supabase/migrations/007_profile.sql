-- =====================================================================
-- BOX800 – prófíll iðkanda í stjórnborði (eins og „Client profile“ í Wodify)
-- Persónuupplýsingar, staða (virkur / í bið / óvirkur) og hlutverk.
-- Keyrt á eftir 001, 002 og 005. Má keyra aftur án skaða.
-- =====================================================================

alter table profiles add column if not exists address         text;
alter table profiles add column if not exists birth_date      date;
alter table profiles add column if not exists gender          text check (gender in ('kona', 'karl', 'annað'));
alter table profiles add column if not exists member_since    date;
alter table profiles add column if not exists emergency_phone text;
alter table profiles add column if not exists status          text not null default 'active' check (status in ('active', 'suspended', 'inactive'));

-- Iðkandi í bið eða óvirkur getur ekki bókað sig (þjálfarar geta samt bætt honum við)
create or replace function bookings_status_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('booked', 'waitlist') and not is_staff()
     and exists (select 1 from profiles where id = new.profile_id and status <> 'active') then
    raise exception 'Aðgangurinn þinn er ekki virkur. Hafðu samband við BOX800.';
  end if;
  return new;
end $$;
drop trigger if exists bookings_status_guard on bookings;
create trigger bookings_status_guard before insert or update of status on bookings
for each row execute function bookings_status_guard();

-- Eigandi má ekki taka eigandahlutverkið af sjálfum sér (svo enginn læsist úti)
create or replace function profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() and auth.uid() is not null then
    new.role := old.role; new.auth_id := old.auth_id; new.wodify_id := old.wodify_id; new.status := old.status;
  end if;
  if old.role = 'owner' and new.role <> 'owner' and old.auth_id = auth.uid() then
    raise exception 'Þú getur ekki tekið eigandahlutverkið af sjálfum þér';
  end if;
  return new;
end $$;

-- Yfirlit iðkenda: nú líka mynd og staða
drop function if exists member_overview();
create function member_overview()
returns table (id uuid, full_name text, email text, phone text, role app_role, is_dependent boolean, created_at timestamptz,
               plan text, ends_on date, membership_status text, last_class timestamptz, visits_30 int, total int, note text,
               avatar_url text, status text, member_since date)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.full_name, pr.email, pr.phone, pr.role, pr.is_dependent, pr.created_at,
         m.plan, m.ends_on, m.status,
         (select max(c.starts_at) from bookings b join classes c on c.id = b.class_id where b.profile_id = pr.id and b.status = 'booked' and c.starts_at < now()),
         (select count(*)::int from bookings b join classes c on c.id = b.class_id where b.profile_id = pr.id and b.status = 'booked' and c.starts_at between now() - interval '30 days' and now()),
         (select count(*)::int from bookings b join classes c on c.id = b.class_id where b.profile_id = pr.id and b.status = 'booked' and c.starts_at < now()),
         pr.note, pr.avatar_url, pr.status, coalesce(pr.member_since, pr.created_at::date)
  from profiles pr
  left join lateral (select plan, ends_on, status from memberships mm where mm.profile_id = pr.id
                     order by (mm.status = 'active' and (mm.ends_on is null or mm.ends_on >= current_date)) desc, mm.starts_on desc limit 1) m on true
  where is_staff()
  order by pr.full_name
$$;
revoke execute on function member_overview() from public, anon;
grant execute on function member_overview() to authenticated;
