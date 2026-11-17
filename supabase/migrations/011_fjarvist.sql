-- =====================================================================
-- BOX800 – fjarvist (no-show): sá sem bókaði en mætti ekki fær vinsamlega
-- áminningu í appinu. Engin refsing.
-- Skráð klukkustund eftir að tíminn endar, og AÐEINS ef þjálfari skráði
-- mætingu í tímanum (annars vitum við ekki hver mætti).
-- Keyrt á eftir 010. Má keyra aftur án skaða.
-- =====================================================================

alter table notifications add column if not exists kind text;
alter table settings add column if not exists no_show_on boolean not null default true;

create or replace function mark_no_shows() returns int
language plpgsql security definer set search_path = public as $$
declare s settings; r record; n int := 0;
begin
  select * into s from settings where id = 1;
  if not s.no_show_on then return 0; end if;
  for r in
    select b.id, b.profile_id, c as cl, pr.gender
    from bookings b join classes c on c.id = b.class_id join profiles pr on pr.id = b.profile_id
    where b.status = 'booked' and b.checked_in_at is null
      and c.cancelled_at is null
      and c.ends_at < now() - interval '60 minutes'
      and c.ends_at > now() - interval '3 days'
      and exists (select 1 from bookings x where x.class_id = c.id and x.checked_in_at is not null)
  loop
    update bookings set status = 'no_show', updated_at = now() where id = r.id;
    insert into notifications (profile_id, title, body, class_id, kind)
    values (r.profile_id, 'Við söknuðum þín í ' || class_label(r.cl),
            'Þú varst ' || case r.gender when 'kona' then 'skráð' when 'karl' then 'skráður' else 'skráð/ur' end || ' en komst ekki. Ekkert mál! Mundu bara að afbóka ef þú kemst ekki.',
            (r.cl).id, 'no_show');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function mark_no_shows() from public, anon, authenticated;

-- Þjálfari getur leiðrétt: skrá inn þann sem var merktur fjarverandi
create or replace function check_in(p_class bigint, p_profile uuid, p_on boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  update bookings set checked_in_at = case when p_on then now() end,
         status = case when p_on and status = 'no_show' then 'booked' else status end, updated_at = now()
  where class_id = p_class and profile_id = p_profile and status in ('booked', 'no_show');
end $$;

-- Fjöldi fjarvista (fyrir prófíl iðkanda í stjórnborði)
create or replace function no_show_count(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from bookings where profile_id = p_profile and status = 'no_show' and is_staff()
$$;
revoke execute on function no_show_count(uuid) from public, anon;
grant execute on function no_show_count(uuid) to authenticated;

-- Keyra á 10 mín. fresti (ef pg_cron er virkt)
do $$
begin
  if to_regnamespace('cron') is null then return; end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'box800-fjarvist';
  perform cron.schedule('box800-fjarvist', '*/10 * * * *', 'select public.mark_no_shows()');
end $$;
