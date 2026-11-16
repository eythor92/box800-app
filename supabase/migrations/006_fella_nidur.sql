-- BOX800 – uppfærsla 16. nóv.: tími fellur niður 2 klst. fyrir ef 3 eða færri eru skráðir.
-- Keyra einu sinni í Supabase → SQL Editor → Run.
alter table settings alter column auto_cancel_minutes set default 120, alter column auto_cancel_min set default 4;
update settings set auto_cancel_on = true, auto_cancel_minutes = 120, auto_cancel_min = 4 where id = 1;

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
      -- ákveðið einu sinni, við tímamörkin (30 mín. svigrúm ef verk tefst)
      and now() >= cl.starts_at - make_interval(mins => s.auto_cancel_minutes)
      and now() <  cl.starts_at - make_interval(mins => s.auto_cancel_minutes) + interval '30 minutes'
      and now() <  cl.starts_at + interval '5 minutes'
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

revoke execute on function auto_cancel_low() from public, anon, authenticated;
