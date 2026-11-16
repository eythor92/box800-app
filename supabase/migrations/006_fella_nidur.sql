-- BOX800 – uppfærsla 16. nóv.: tími fellur niður ef 3 eða færri eru skráðir,
-- frá 2 klst. fyrir tímann og þar til 20 mín. eru í hann (líka ef einhver afbókar).
-- Keyra einu sinni í Supabase → SQL Editor → Run. Má keyra aftur.
alter table settings add column if not exists auto_cancel_stop int not null default 20;
alter table settings alter column auto_cancel_minutes set default 120, alter column auto_cancel_min set default 4;
update settings set auto_cancel_on = true, auto_cancel_minutes = 120, auto_cancel_min = 4, auto_cancel_stop = 20 where id = 1;

-- Aflýsir tímum sjálfkrafa ef of fáir eru skráðir (keyrt á 5 mín. fresti)
create or replace function auto_cancel_low() returns int
language plpgsql security definer set search_path = public as $$
declare s settings; c classes; n int := 0;
begin
  select * into s from settings where id = 1;
  if not s.auto_cancel_on then return 0; end if;
  for c in
    select cl.* from classes cl
    where cl.cancelled_at is null
      -- frá X klst. fyrir tímann og þar til síðustu mínúturnar (þá heldur tíminn sér)
      and now() >= cl.starts_at - make_interval(mins => s.auto_cancel_minutes)
      and now() <  cl.starts_at - make_interval(mins => s.auto_cancel_stop)
      and (select count(*) from bookings b where b.class_id = cl.id and b.status = 'booked') < s.auto_cancel_min
  loop
    update classes set cancelled_at = now(), cancel_reason = 'Of fáir skráðir' where id = c.id;
    -- láta alla vita sem voru skráðir eða á biðlista, og þjálfarann
    perform notify(b.profile_id, class_label(c) || ' fellur niður', 'Of fáir voru skráðir, svo tímanum var aflýst.', c.id)
    from bookings b where b.class_id = c.id and b.status in ('booked', 'waitlist');
    if c.coach_id is not null then
      perform notify(c.coach_id, 'Tíma aflýst sjálfkrafa: ' || class_label(c), 'Of fáir voru skráðir.', c.id);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function cancel_booking(p_class bigint, p_profile uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  who uuid := coalesce(p_profile, me());
  staff boolean := is_staff();
  c classes; s settings; b bookings; new_status text;
begin
  if not can_act_for(who) then raise exception 'Þú mátt ekki afbóka fyrir þennan iðkanda'; end if;
  select * into c from classes where id = p_class for update;
  select * into s from settings where id = 1;
  select * into b from bookings where class_id = p_class and profile_id = who for update;
  if not found or b.status not in ('booked', 'waitlist') then return 'none'; end if;

  if b.status = 'booked' and not staff and now() > c.starts_at - make_interval(mins => s.cancel_minutes) then
    new_status := 'late_cancel';
  else
    new_status := 'cancelled';
  end if;
  update bookings set status = new_status, updated_at = now() where id = b.id;

  if staff and who <> me() then
    insert into audit_log (actor_id, action, class_id, detail) values (me(), 'remove_person', p_class, jsonb_build_object('profile', who));
  end if;
  if b.status = 'booked' then perform promote_waitlist(p_class); perform auto_cancel_low(); end if;
  return new_status;
end $$;

revoke execute on function auto_cancel_low() from public, anon, authenticated;
