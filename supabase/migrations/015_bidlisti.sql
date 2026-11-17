-- =====================================================================
-- BOX800 – biðlisti sýnilegur í tímanum (nöfn í röð), eins og í Wodify.
-- Aðeins fyrir þau sem hafa aðgang. Keyrt á eftir 014. Má keyra aftur án skaða.
-- =====================================================================

create or replace function class_waitlist(p_class bigint)
returns table (profile_id uuid, full_name text, avatar_url text, pos int, is_me boolean)
language sql stable security definer set search_path = public as $$
  select b.profile_id, pr.full_name, pr.avatar_url,
         (row_number() over (order by b.waitlist_at, b.id))::int, b.profile_id = me()
  from bookings b join profiles pr on pr.id = b.profile_id
  where b.class_id = p_class and b.status = 'waitlist' and has_access()
  order by b.waitlist_at, b.id
$$;
revoke execute on function class_waitlist(bigint) from public, anon;
grant execute on function class_waitlist(bigint) to authenticated;
