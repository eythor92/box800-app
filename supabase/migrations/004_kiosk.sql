-- BOX800 – kiosk-innskráning. Aðeins þarf að keyra þetta ef 001 var keyrt fyrir 16. nóv. 2026.
-- Kiosk: iðkandi skráir sig inn á stöðinni (líka án bókunar eða af biðlista).
-- Viðkomandi er mættur, svo hann fær pláss þó tíminn sé fullur.
create or replace function kiosk_sign_in(p_class bigint, p_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c classes;
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  select * into c from classes where id = p_class for update;
  if not found then raise exception 'Tíminn fannst ekki'; end if;
  if c.cancelled_at is not null then raise exception 'Tímanum hefur verið aflýst'; end if;
  insert into bookings (class_id, profile_id, status, checked_in_at)
  values (p_class, p_profile, 'booked', now())
  on conflict (class_id, profile_id) do update
    set status = 'booked', waitlist_at = null, updated_at = now(),
        checked_in_at = coalesce(bookings.checked_in_at, now());
end $$;

revoke execute on function kiosk_sign_in(bigint, uuid) from public, anon;
grant execute on function kiosk_sign_in(bigint, uuid) to authenticated;
