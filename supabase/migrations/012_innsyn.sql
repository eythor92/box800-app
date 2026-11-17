-- =====================================================================
-- BOX800 – Innsýn (aðeins eigandi): hverjir mæta oftast, skrópa oftast
-- og eiga flest PR á tímabili. Einnig styttri texti í áminningu um fjarvist.
-- Keyrt á eftir 011. Má keyra aftur án skaða.
-- =====================================================================

-- Tímabil: frá og með p_from til og með p_to (dagsetningar á Íslandi)
drop function if exists insights(int);
create or replace function insights(p_from date, p_to date)
returns table (kind text, profile_id uuid, full_name text, avatar_url text, n int)
language sql stable security definer set search_path = public as $$
  with since as (select (p_from::timestamp at time zone 'Atlantic/Reykjavik') t, ((p_to + 1)::timestamp at time zone 'Atlantic/Reykjavik') t2),
  att as (
    select b.profile_id, count(*)::int n
    from bookings b join classes c on c.id = b.class_id cross join since
    where b.status = 'booked' and c.cancelled_at is null and c.starts_at < now() and c.starts_at >= since.t and c.starts_at < since.t2
    group by 1),
  ns as (
    select b.profile_id, count(*)::int n
    from bookings b join classes c on c.id = b.class_id cross join since
    where b.status = 'no_show' and c.starts_at >= since.t and c.starts_at < since.t2
    group by 1),
  pr as (
    select r.profile_id, count(*)::int n
    from results r cross join since
    where r.weight is not null and r.day between p_from and p_to
      and r.weight > (select max(x.weight) from results x
                      where x.profile_id = r.profile_id and x.movement_id = r.movement_id
                        and coalesce(x.reps, 1) = coalesce(r.reps, 1)
                        and (x.day < r.day or (x.day = r.day and x.id < r.id)))
    group by 1),
  all_k as (
    select 'attend' kind, * from att union all
    select 'noshow', * from ns union all
    select 'pr', * from pr),
  ranked as (select *, row_number() over (partition by kind order by n desc) rk from all_k)
  select k.kind, p.id, p.full_name, p.avatar_url, k.n
  from ranked k join profiles p on p.id = k.profile_id
  where k.rk <= 15 and is_owner()
  order by k.kind, k.n desc, p.full_name
$$;

-- Heildartölur á tímabili
drop function if exists insights_summary(int);
create or replace function insights_summary(p_from date, p_to date)
returns table (visits int, active_members int, no_shows int, prs int, classes int)
language sql stable security definer set search_path = public as $$
  with since as (select (p_from::timestamp at time zone 'Atlantic/Reykjavik') t, ((p_to + 1)::timestamp at time zone 'Atlantic/Reykjavik') t2)
  select
    (select count(*)::int from bookings b join classes c on c.id = b.class_id cross join since where b.status = 'booked' and c.cancelled_at is null and c.starts_at < now() and c.starts_at >= since.t and c.starts_at < since.t2),
    (select count(distinct b.profile_id)::int from bookings b join classes c on c.id = b.class_id cross join since where b.status = 'booked' and c.cancelled_at is null and c.starts_at < now() and c.starts_at >= since.t and c.starts_at < since.t2),
    (select count(*)::int from bookings b join classes c on c.id = b.class_id cross join since where b.status = 'no_show' and c.starts_at >= since.t and c.starts_at < since.t2),
    (select count(*)::int from results r cross join since where r.weight is not null and r.day between p_from and p_to
       and r.weight > (select max(x.weight) from results x where x.profile_id = r.profile_id and x.movement_id = r.movement_id
                       and coalesce(x.reps, 1) = coalesce(r.reps, 1) and (x.day < r.day or (x.day = r.day and x.id < r.id)))),
    (select count(*)::int from classes c cross join since where c.cancelled_at is null and c.starts_at < now() and c.starts_at >= since.t and c.starts_at < since.t2)
  where is_owner()
$$;

revoke execute on function insights(date, date), insights_summary(date, date) from public, anon;
grant execute on function insights(date, date), insights_summary(date, date) to authenticated;

-- Styttri texti í áminningu um fjarvist
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
