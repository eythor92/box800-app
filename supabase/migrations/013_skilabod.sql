-- =====================================================================
-- BOX800 – skilaboð frá iðkanda sem kemst ekki inn („Búin/n að kaupa?“).
-- Skilaboðin vistast og eigendur fá tilkynningu í appinu.
-- Keyrt á eftir 012. Má keyra aftur án skaða.
-- =====================================================================

create table if not exists support_messages (
  id          bigserial primary key,
  profile_id  uuid not null references profiles(id) on delete cascade,
  what        text,            -- hvað var keypt
  phone       text,
  body        text,
  created_at  timestamptz not null default now(),
  handled_at  timestamptz,
  handled_by  uuid references profiles(id) on delete set null
);
create index if not exists support_messages_open_idx on support_messages (created_at desc) where handled_at is null;

alter table support_messages enable row level security;
drop policy if exists p_support_read on support_messages;
create policy p_support_read on support_messages for select to authenticated using (profile_id = me() or is_owner());

-- Iðkandi sendir skilaboð
create or replace function send_support_message(p_what text, p_phone text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare who uuid := me(); nm text; o record;
begin
  if who is null then raise exception 'Þú þarft að vera innskráð/ur'; end if;
  if (select count(*) from support_messages where profile_id = who and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Þú hefur þegar sent okkur skilaboð. Við höfum samband fljótlega.';
  end if;
  insert into support_messages (profile_id, what, phone, body)
  values (who, nullif(trim(p_what), ''), nullif(trim(p_phone), ''), left(nullif(trim(p_body), ''), 2000));
  update profiles set phone = trim(p_phone) where id = who and coalesce(phone, '') = '' and coalesce(trim(p_phone), '') <> '';
  select full_name into nm from profiles where id = who;
  for o in select id from profiles where role = 'owner' loop
    insert into notifications (profile_id, title, body, kind)
    values (o.id, 'Kemst ekki inn: ' || coalesce(nm, 'Iðkandi'),
            concat_ws(' · ', nullif(trim(p_what), ''), left(nullif(trim(p_body), ''), 140)), 'support');
  end loop;
end $$;
revoke execute on function send_support_message(text, text, text) from public, anon;
grant execute on function send_support_message(text, text, text) to authenticated;

-- Opin skilaboð fyrir eiganda
create or replace function support_inbox() returns table (
  id bigint, profile_id uuid, full_name text, email text, phone text, avatar_url text,
  what text, body text, created_at timestamptz, has_access boolean)
language sql stable security definer set search_path = public as $$
  select m.id, p.id, p.full_name, p.email, coalesce(m.phone, p.phone), p.avatar_url, m.what, m.body, m.created_at,
         exists (select 1 from memberships ms where ms.profile_id = p.id and ms.status = 'active' and ms.starts_on <= current_date
                 and (ms.ends_on is null or ms.ends_on >= current_date))
  from support_messages m join profiles p on p.id = m.profile_id
  where m.handled_at is null and is_owner()
  order by m.created_at desc
$$;
revoke execute on function support_inbox() from public, anon;
grant execute on function support_inbox() to authenticated;

create or replace function support_handled(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'Aðeins eigandi'; end if;
  update support_messages set handled_at = now(), handled_by = me() where id = p_id;
end $$;
revoke execute on function support_handled(bigint) from public, anon;
grant execute on function support_handled(bigint) to authenticated;

-- Síðustu skilaboð mín (til að sýna „Skilaboðin eru send“)
create or replace function my_support_pending() returns timestamptz
language sql stable security definer set search_path = public as $$
  select max(created_at) from support_messages where profile_id = me() and handled_at is null
$$;
grant execute on function my_support_pending() to authenticated;
