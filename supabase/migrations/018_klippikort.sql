-- =====================================================================
-- BOX800 – klippikort (t.d. 10 skipta kort).
-- Hver bókaður tími (og fjarvist) dregst frá. Afbókun skilar skiptinu.
-- Þegar skiptin eru búin dettur kortið út, þótt gildistíminn sé ekki liðinn.
-- Keyrt á eftir 017. Má keyra aftur án skaða.
-- =====================================================================

alter table memberships add column if not exists punches int check (punches is null or punches > 0);      -- null = ótakmarkað
alter table memberships add column if not exists punches_before int not null default 0 check (punches_before >= 0); -- notuð fyrir appið

-- Notuð skipti á korti. p_past_only: aðeins tímar sem eru byrjaðir (annars líka bókaðir framundan)
create or replace function punches_used(m memberships, p_past_only boolean default false) returns int
language sql stable security definer set search_path = public as $$
  select m.punches_before + count(*)::int
  from bookings b join classes c on c.id = b.class_id
  where b.profile_id = m.profile_id and b.status in ('booked', 'no_show') and c.cancelled_at is null
    and (c.starts_at at time zone 'Atlantic/Reykjavik')::date >= m.starts_on
    and (m.ends_on is null or (c.starts_at at time zone 'Atlantic/Reykjavik')::date <= m.ends_on)
    and (m.program_ids is null or c.program_id = any (m.program_ids))
    and (not p_past_only or c.starts_at <= now())
$$;

-- Má bóka: gild áskrift, og ef það er klippikort þarf að vera skipti eftir (bókanir framundan teljast með)
create or replace function has_membership(p uuid, prog int, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.profile_id = p and m.status = 'active'
      and m.starts_on <= d and (m.ends_on is null or m.ends_on >= d)
      and (m.program_ids is null or prog = any (m.program_ids))
      and (m.punches is null or punches_used(m) < m.punches)
  )
$$;

-- Aðgangur að appinu: klippikort gildir meðan skipti eru eftir, eða bókaður tími er framundan
create or replace function has_access() returns boolean
language sql stable security definer set search_path = public as $$
  select is_staff() or exists (
    select 1 from memberships m join profiles p on p.id = m.profile_id
    where (p.id = me() or p.guardian_id = me())
      and m.status = 'active' and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
      and (m.punches is null or punches_used(m, true) < m.punches)
  )
$$;
revoke execute on function has_access() from public, anon;
grant execute on function has_access() to authenticated;

-- Klippikortin mín (fyrir forsíðuna)
create or replace function my_punch_cards() returns table (id bigint, plan text, punches int, used int, booked_ahead int, ends_on date)
language sql stable security definer set search_path = public as $$
  select m.id, m.plan, m.punches, punches_used(m, true), punches_used(m) - punches_used(m, true), m.ends_on
  from memberships m
  where m.profile_id = me() and m.status = 'active' and m.punches is not null
    and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
  order by m.ends_on nulls last
$$;
grant execute on function my_punch_cards() to authenticated;

-- Staða klippikorta fyrir þjálfara/eiganda (prófíll iðkanda)
create or replace function punch_usage(p_profile uuid) returns table (id bigint, used int, booked_ahead int)
language sql stable security definer set search_path = public as $$
  select m.id, punches_used(m, true), punches_used(m) - punches_used(m, true)
  from memberships m where m.profile_id = p_profile and m.punches is not null and (is_staff() or p_profile = me())
$$;
grant execute on function punch_usage(uuid) to authenticated;

-- Kort sem komu úr Abler: 10 skipti
update memberships set punches = 10 where punches is null and plan ilike '%10 skipta%';
