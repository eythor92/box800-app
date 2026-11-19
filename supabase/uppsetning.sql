-- BOX800 – uppsetning gagnagrunns (001 + 002 + 005 + 007 – 021). Líma allt í Supabase → SQL Editor → Run.
-- =====================================================================
-- BOX800 – gagnagrunnur
-- Keyrt einu sinni í Supabase: SQL Editor → New query → líma → Run.
-- Allar bókunarreglur eru hér í gagnagrunninum (ekki í appinu), svo
-- tveir geta aldrei fengið sama plássið og enginn kemst framhjá reglum.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Töflur
-- ---------------------------------------------------------------------

do $$ begin
  create type app_role as enum ('member', 'coach', 'owner');
exception when duplicate_object then null; end $$;

-- Iðkendur, þjálfarar og eigandi. Börn/aðstandendur hafa engan auth-notanda.
create table if not exists profiles (
  id           uuid primary key default gen_random_uuid(),
  auth_id      uuid unique references auth.users(id) on delete set null,
  full_name    text not null default '',
  email        text,
  phone        text,
  kennitala    text,
  role         app_role not null default 'member',
  avatar_url   text,
  note         text,              -- athugasemd fyrir þjálfara (meiðsli o.fl.)
  emergency    text,              -- neyðartengiliður
  is_dependent boolean not null default false,
  guardian_id  uuid references profiles(id) on delete set null,
  wodify_id    bigint unique,     -- fyrir innflutning úr Wodify
  created_at   timestamptz not null default now()
);
create unique index if not exists profiles_email_idx on profiles (lower(email)) where email is not null and not is_dependent;

create table if not exists programs (
  id          serial primary key,
  name        text not null unique,
  color       text not null default '#c0c7d1',
  default_cap int  not null default 16 check (default_cap > 0),
  sort        int  not null default 0,
  active      boolean not null default true
);

-- Áskriftir. Koma frá Abler (source='abler') eða skráðar handvirkt.
create table if not exists memberships (
  id          bigserial primary key,
  profile_id  uuid not null references profiles(id) on delete cascade,
  plan        text not null,
  program_ids int[],              -- null = öll námskeið
  starts_on   date not null default current_date,
  ends_on     date,               -- null = endurnýjast þar til sagt upp
  status      text not null default 'active' check (status in ('active', 'cancelled')),
  source      text not null default 'manual',
  external_id text,
  created_at  timestamptz not null default now(),
  unique (source, external_id)
);

-- Föst tímatafla: „Hreysti mán. kl. 16:30“
create table if not exists class_slots (
  id          serial primary key,
  program_id  int  not null references programs(id),
  weekday     smallint not null check (weekday between 1 and 7),  -- 1 = mánudagur
  start_time  time not null,
  end_time    time not null,
  coach_id    uuid references profiles(id) on delete set null,
  cap         int check (cap > 0),          -- null = sjálfgefið námskeiðsins
  active      boolean not null default true,
  unique (program_id, weekday, start_time)
);

-- Einstakir tímar (búnir til úr class_slots, eða stakir)
create table if not exists classes (
  id            bigserial primary key,
  slot_id       int references class_slots(id) on delete set null,
  program_id    int not null references programs(id),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  coach_id      uuid references profiles(id) on delete set null,
  cap           int check (cap > 0),        -- null = frá slot eða námskeiði
  cancelled_at  timestamptz,
  cancel_reason text,
  unique (slot_id, starts_at)
);
create index if not exists classes_starts_idx on classes (starts_at);

create table if not exists bookings (
  id            bigserial primary key,
  class_id      bigint not null references classes(id) on delete cascade,
  profile_id    uuid   not null references profiles(id) on delete cascade,
  status        text   not null check (status in ('booked', 'waitlist', 'cancelled', 'late_cancel', 'no_show')),
  waitlist_at   timestamptz,
  checked_in_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (class_id, profile_id)
);
create index if not exists bookings_profile_idx on bookings (profile_id);

create table if not exists workouts (
  id           bigserial primary key,
  program_id   int  not null references programs(id),
  day          date not null,
  components   jsonb not null default '[]',
  status       text not null default 'draft' check (status in ('draft', 'published')),
  publish_mode text not null default 'evening_before' check (publish_mode in ('evening_before', 'now', 'morning')),
  publish_at   timestamptz,
  updated_at   timestamptz not null default now(),
  unique (program_id, day)
);

-- Bókunarstillingar (ein lína)
create table if not exists settings (
  id                  int primary key default 1 check (id = 1),
  open_mode           text not null default 'fixed' check (open_mode in ('fixed', 'relative')),
  open_days           int not null default 1,     -- 'fixed': opna X dögum fyrir tímann …
  open_time           time not null default '12:00', -- … á þessum tíma (t.d. kl. 12:00 daginn áður)
  open_minutes        int not null default 1230,  -- 'relative': bókanir opna X mín. fyrir tíma
  close_minutes       int not null default 0,     -- bókanir loka X mín. fyrir tíma
  cancel_minutes      int not null default 10,    -- biðlisti færist sjálfkrafa inn til X mín. fyrir
  waitlist_on         boolean not null default true,
  waitlist_mode       text not null default 'auto' check (waitlist_mode in ('auto', 'all')),
  waitlist_limit      int not null default 0,     -- 0 = ekkert hámark
  auto_cancel_on      boolean not null default true,
  auto_cancel_minutes int not null default 120,   -- aflýsa X mín. fyrir tímann …
  auto_cancel_min     int not null default 4,     -- … ef færri en þetta eru skráðir (4 = „3 eða færri“)
  auto_cancel_stop    int not null default 20     -- síðustu X mín. fyrir tímann heldur hann sér
);
insert into settings (id) values (1) on conflict do nothing;

create table if not exists notifications (
  id         bigserial primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  title      text not null,
  body       text,
  class_id   bigint references classes(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_profile_idx on notifications (profile_id, created_at desc);

create table if not exists audit_log (
  id       bigserial primary key,
  actor_id uuid references profiles(id) on delete set null,
  action   text not null,
  class_id bigint references classes(id) on delete set null,
  detail   jsonb,
  at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Hjálparföll
-- ---------------------------------------------------------------------

create or replace function me() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where auth_id = auth.uid()
$$;

create or replace function my_role() returns app_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where auth_id = auth.uid()), 'member'::app_role)
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select my_role() in ('coach', 'owner')
$$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select my_role() = 'owner'
$$;

-- Má notandinn bóka fyrir þennan prófíl? (sjálfan sig, barn sitt, eða þjálfari)
create or replace function can_act_for(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p = me() or is_staff() or exists (select 1 from profiles where id = p and guardian_id = me())
$$;

-- Hvenær opna bókanir í tímann?
create or replace function booking_opens_at(c classes) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case when s.open_mode = 'fixed'
    then (((c.starts_at at time zone 'Atlantic/Reykjavik')::date - s.open_days) + s.open_time) at time zone 'Atlantic/Reykjavik'
    else c.starts_at - make_interval(mins => s.open_minutes) end
  from settings s where s.id = 1
$$;

create or replace function class_cap(c classes) returns int
language sql stable set search_path = public as $$
  select coalesce(c.cap, (select s.cap from class_slots s where s.id = c.slot_id),
                  (select p.default_cap from programs p where p.id = c.program_id))
$$;

create or replace function has_membership(p uuid, prog int, d date) returns boolean
language sql stable set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.profile_id = p and m.status = 'active'
      and m.starts_on <= d and (m.ends_on is null or m.ends_on >= d)
      and (m.program_ids is null or prog = any (m.program_ids))
  )
$$;

create or replace function notify(p uuid, t text, b text, c bigint) returns void
language sql security definer set search_path = public as $$
  insert into notifications (profile_id, title, body, class_id) values (p, t, b, c)
$$;

create or replace function class_label(c classes) returns text
language sql stable set search_path = public as $$
  select pr.name || ' ' || to_char(c.starts_at at time zone 'Atlantic/Reykjavik', 'HH24:MI')
         || ' (' || to_char(c.starts_at at time zone 'Atlantic/Reykjavik', 'DD.MM.') || ')'
  from programs pr where pr.id = c.program_id
$$;

-- ---------------------------------------------------------------------
-- Biðlisti: fyllir laus pláss í réttri röð
-- ---------------------------------------------------------------------
create or replace function promote_waitlist(p_class bigint) returns int
language plpgsql security definer set search_path = public as $$
declare
  c classes; s settings; n int := 0; free int; w record;
begin
  select * into c from classes where id = p_class for update;
  select * into s from settings where id = 1;
  if c.cancelled_at is not null or not s.waitlist_on then return 0; end if;
  -- Sjálfvirkt bara þar til afbókunarfrestur hefst (t.d. 30 mín. fyrir tíma)
  if now() > c.starts_at - make_interval(mins => s.cancel_minutes) then return 0; end if;

  free := class_cap(c) - (select count(*) from bookings where class_id = p_class and status = 'booked');
  if free <= 0 then return 0; end if;

  if s.waitlist_mode = 'all' then
    for w in select profile_id from bookings where class_id = p_class and status = 'waitlist' loop
      perform notify(w.profile_id, 'Pláss laust í ' || class_label(c), 'Fyrstur kemur, fyrstur fær – bókaðu í appinu.', p_class);
    end loop;
    return 0;
  end if;

  for w in
    select id, profile_id from bookings
    where class_id = p_class and status = 'waitlist'
    order by waitlist_at, id
    limit free
    for update skip locked
  loop
    update bookings set status = 'booked', updated_at = now() where id = w.id;
    perform notify(w.profile_id, 'Þú fékkst pláss í ' || class_label(c) || '!', 'Þú varst fyrst(ur) á biðlista. Sjáumst!', p_class);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Bóka / fara á biðlista
-- ---------------------------------------------------------------------
create or replace function book_class(p_class bigint, p_profile uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  who uuid := coalesce(p_profile, me());
  staff boolean := is_staff();
  c classes; s settings; b bookings; cap int; booked int; waiting int; new_status text;
begin
  if who is null then raise exception 'Ekki innskráð(ur)'; end if;
  if not can_act_for(who) then raise exception 'Þú mátt ekki bóka fyrir þennan iðkanda'; end if;

  select * into c from classes where id = p_class for update;   -- læsir tímanum
  if not found then raise exception 'Tíminn fannst ekki'; end if;
  select * into s from settings where id = 1;

  if c.cancelled_at is not null then raise exception 'Tímanum hefur verið aflýst'; end if;
  if not staff then
    if now() < booking_opens_at(c) then
      raise exception 'Bókanir eru ekki opnar enn'; end if;
    if now() > c.starts_at - make_interval(mins => s.close_minutes) then
      raise exception 'Bókunum er lokað fyrir þennan tíma'; end if;
    if not has_membership(who, c.program_id, (c.starts_at at time zone 'Atlantic/Reykjavik')::date) then
      raise exception 'Engin gild áskrift fyrir þetta námskeið'; end if;
  end if;

  select * into b from bookings where class_id = p_class and profile_id = who;
  if found and b.status = 'booked' then return 'booked'; end if;

  cap := class_cap(c);
  booked := (select count(*) from bookings where class_id = p_class and status = 'booked');

  if booked < cap and not exists (
        -- ef aðrir bíða og þú ert ekki á biðlista, fara þeir á undan
        select 1 from bookings where class_id = p_class and status = 'waitlist'
          and (b.id is null or b.status <> 'waitlist' or waitlist_at < b.waitlist_at)
          and s.waitlist_mode = 'auto'
          -- síðustu 30 mín. fyrir tíma fær hver sem er laust pláss
          and now() <= c.starts_at - make_interval(mins => s.cancel_minutes)) then
    new_status := 'booked';
  elsif staff and p_profile is not null and booked < cap then
    new_status := 'booked';
  else
    if not s.waitlist_on then raise exception 'Tíminn er fullur'; end if;
    if found and b.status = 'waitlist' then return 'waitlist'; end if;
    waiting := (select count(*) from bookings where class_id = p_class and status = 'waitlist');
    if s.waitlist_limit > 0 and waiting >= s.waitlist_limit then raise exception 'Biðlistinn er fullur'; end if;
    new_status := 'waitlist';
  end if;

  insert into bookings (class_id, profile_id, status, waitlist_at)
  values (p_class, who, new_status, case when new_status = 'waitlist' then now() end)
  on conflict (class_id, profile_id) do update
    set status = excluded.status,
        waitlist_at = case when excluded.status = 'waitlist' then coalesce(bookings.waitlist_at, now()) end,
        checked_in_at = null, updated_at = now();

  if staff and p_profile is not null and p_profile <> me() then
    insert into audit_log (actor_id, action, class_id, detail) values (me(), 'add_person', p_class, jsonb_build_object('profile', who, 'status', new_status));
  end if;
  return new_status;
end $$;

-- ---------------------------------------------------------------------
-- Afbóka (eða fara af biðlista). Laust pláss fer sjálfkrafa á biðlista.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Þjálfarar og eigandi: hámark, aflýsa, skipta um þjálfara, mæting
-- ---------------------------------------------------------------------
create or replace function set_class_cap(p_class bigint, p_cap int, p_scope text default 'one') returns int
language plpgsql security definer set search_path = public as $$
declare c classes; old int;
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  if p_cap is null or p_cap < 1 then raise exception 'Hámark verður að vera a.m.k. 1'; end if;
  select * into c from classes where id = p_class for update;
  old := class_cap(c);
  if p_scope = 'all' and c.slot_id is not null then
    update class_slots set cap = p_cap where id = c.slot_id;
    update classes set cap = null where slot_id = c.slot_id and starts_at >= c.starts_at;
  else
    update classes set cap = p_cap where id = p_class;
  end if;
  insert into audit_log (actor_id, action, class_id, detail)
  values (me(), 'set_cap', p_class, jsonb_build_object('from', old, 'to', p_cap, 'scope', p_scope));
  return promote_waitlist(p_class);
end $$;

create or replace function cancel_class(p_class bigint, p_cancel boolean default true, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c classes; r record;
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  update classes set cancelled_at = case when p_cancel then now() end, cancel_reason = p_reason
  where id = p_class returning * into c;
  if p_cancel then
    for r in select profile_id from bookings where class_id = p_class and status in ('booked', 'waitlist') loop
      perform notify(r.profile_id, class_label(c) || ' hefur verið aflýst', coalesce(p_reason, 'Við biðjumst velvirðingar.'), p_class);
    end loop;
  end if;
  insert into audit_log (actor_id, action, class_id, detail) values (me(), case when p_cancel then 'cancel_class' else 'restore_class' end, p_class, jsonb_build_object('reason', p_reason));
end $$;

create or replace function set_class_coach(p_class bigint, p_coach uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  if not exists (select 1 from profiles where id = p_coach and role in ('coach', 'owner')) then raise exception 'Ekki þjálfari'; end if;
  update classes set coach_id = p_coach where id = p_class;
  insert into audit_log (actor_id, action, class_id, detail) values (me(), 'set_coach', p_class, jsonb_build_object('coach', p_coach));
end $$;

create or replace function check_in(p_class bigint, p_profile uuid, p_on boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  update bookings set checked_in_at = case when p_on then now() end, updated_at = now()
  where class_id = p_class and profile_id = p_profile and status = 'booked';
end $$;

-- Hverjir eru skráðir í tímann (nafn og mynd, eins og „Attendees“ í Wodify)
create or replace function class_attendees(p_class bigint)
returns table (profile_id uuid, full_name text, avatar_url text, checked_in boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  select b.profile_id, pr.full_name, pr.avatar_url, b.checked_in_at is not null, b.profile_id = me()
  from bookings b join profiles pr on pr.id = b.profile_id
  where b.class_id = p_class and b.status = 'booked' and me() is not null
  order by b.created_at, b.id
$$;

-- Iðkandi skráir sig sjálfur inn (frá 30 mín. fyrir tímann þar til 30 mín. eftir að hann endar)
create or replace function self_check_in(p_class bigint) returns void
language plpgsql security definer set search_path = public as $$
declare c classes;
begin
  select * into c from classes where id = p_class;
  if not found then raise exception 'Tíminn fannst ekki'; end if;
  if now() < c.starts_at - interval '30 minutes' then raise exception 'Hægt er að skrá sig inn 30 mín. fyrir tímann'; end if;
  if now() > c.ends_at + interval '30 minutes' then raise exception 'Tíminn er búinn'; end if;
  update bookings set checked_in_at = coalesce(checked_in_at, now()), updated_at = now()
  where class_id = p_class and profile_id = me() and status = 'booked';
  if not found then raise exception 'Þú ert ekki bókuð/bókaður í þennan tíma'; end if;
end $$;

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

-- ---------------------------------------------------------------------
-- Tímatafla fyrir appið: tímar + fjöldi + mín staða, í einu kalli
-- ---------------------------------------------------------------------
create or replace function class_list(p_from timestamptz, p_to timestamptz)
returns table (
  id bigint, program_id int, program text, color text, starts_at timestamptz, ends_at timestamptz,
  coach_id uuid, coach_name text, coach_avatar text, cap int, booked int, waiting int,
  cancelled boolean, my_status text, my_position int, slot_id int
)
language sql stable security definer set search_path = public as $$
  select c.id, c.program_id, p.name, p.color, c.starts_at, c.ends_at,
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
  where c.starts_at >= p_from and c.starts_at < p_to
  order by c.starts_at, p.sort
$$;

-- Nafnalisti tíma (þjálfarar)
create or replace function class_roster(p_class bigint)
returns table (profile_id uuid, full_name text, avatar_url text, status text, checked_in boolean,
               wait_pos int, note text, first_class boolean, plan text)
language sql stable security definer set search_path = public as $$
  select b.profile_id, pr.full_name, pr.avatar_url, b.status, b.checked_in_at is not null,
         case when b.status = 'waitlist' then row_number() over (partition by b.status order by b.waitlist_at, b.id)::int end,
         pr.note,
         not exists (select 1 from bookings x join classes xc on xc.id = x.class_id
                     where x.profile_id = b.profile_id and x.status = 'booked' and xc.starts_at < (select starts_at from classes where id = p_class)),
         (select m.plan from memberships m where m.profile_id = b.profile_id and m.status = 'active' order by m.starts_on desc limit 1)
  from bookings b join profiles pr on pr.id = b.profile_id
  where b.class_id = p_class and b.status in ('booked', 'waitlist') and is_staff()
  order by b.status, b.waitlist_at, pr.full_name
$$;

-- Mæting iðkanda (eigin saga)
create or replace function my_attendance(p_profile uuid default null)
returns table (class_id bigint, program text, starts_at timestamptz, checked_in boolean)
language sql stable security definer set search_path = public as $$
  select c.id, p.name, c.starts_at, b.checked_in_at is not null
  from bookings b join classes c on c.id = b.class_id join programs p on p.id = c.program_id
  where b.profile_id = coalesce(p_profile, me()) and can_act_for(coalesce(p_profile, me()))
    and b.status = 'booked' and c.starts_at < now() and c.cancelled_at is null
  order by c.starts_at desc
$$;

-- Yfirlit iðkenda fyrir stjórnborð
create or replace function member_overview()
returns table (id uuid, full_name text, email text, phone text, role app_role, is_dependent boolean, created_at timestamptz,
               plan text, ends_on date, membership_status text, last_class timestamptz, visits_30 int, total int, note text)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.full_name, pr.email, pr.phone, pr.role, pr.is_dependent, pr.created_at,
         m.plan, m.ends_on, m.status,
         (select max(c.starts_at) from bookings b join classes c on c.id = b.class_id where b.profile_id = pr.id and b.status = 'booked' and c.starts_at < now()),
         (select count(*)::int from bookings b join classes c on c.id = b.class_id where b.profile_id = pr.id and b.status = 'booked' and c.starts_at between now() - interval '30 days' and now()),
         (select count(*)::int from bookings b join classes c on c.id = b.class_id where b.profile_id = pr.id and b.status = 'booked' and c.starts_at < now()),
         pr.note
  from profiles pr
  left join lateral (select plan, ends_on, status from memberships mm where mm.profile_id = pr.id
                     order by (mm.status = 'active' and (mm.ends_on is null or mm.ends_on >= current_date)) desc, mm.starts_on desc limit 1) m on true
  where is_staff()
  order by pr.full_name
$$;

-- ---------------------------------------------------------------------
-- Býr til tíma úr föstu tímatöflunni (keyrt daglega)
-- ---------------------------------------------------------------------
create or replace function generate_classes(p_days int default 28) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into classes (slot_id, program_id, starts_at, ends_at, coach_id)
  select s.id, s.program_id,
         (d + s.start_time) at time zone 'Atlantic/Reykjavik',
         (d + s.end_time) at time zone 'Atlantic/Reykjavik',
         s.coach_id
  from class_slots s
  cross join generate_series(current_date, current_date + p_days, interval '1 day') g(d0)
  cross join lateral (select g.d0::date as d) x
  where s.active and extract(isodow from x.d) = s.weekday
  on conflict (slot_id, starts_at) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

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

-- ---------------------------------------------------------------------
-- Æfingar: hvenær birtast þær iðkendum
-- ---------------------------------------------------------------------
create or replace function workouts_set_publish_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'published' then
    new.publish_at := case new.publish_mode
      when 'now' then coalesce(case when old.status = 'published' then old.publish_at end, now())
      when 'morning' then (new.day + time '05:00') at time zone 'Atlantic/Reykjavik'
      else ((new.day - 1) + time '20:00') at time zone 'Atlantic/Reykjavik'
    end;
  else
    new.publish_at := null;
  end if;
  return new;
end $$;
drop trigger if exists workouts_publish on workouts;
create trigger workouts_publish before insert or update on workouts
for each row execute function workouts_set_publish_at();

-- ---------------------------------------------------------------------
-- Ný innskráning: tengja við prófíl með sama netfangi (t.d. úr Wodify)
-- ---------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set auth_id = new.id
  where lower(email) = lower(new.email) and auth_id is null and not is_dependent;
  if not found then
    insert into profiles (auth_id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

-- Iðkandi má ekki breyta eigin hlutverki
create or replace function profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() and auth.uid() is not null then
    new.role := old.role; new.auth_id := old.auth_id; new.wodify_id := old.wodify_id;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard before update on profiles
for each row execute function profiles_guard();

-- ---------------------------------------------------------------------
-- Aðgangsreglur (Row Level Security)
-- ---------------------------------------------------------------------
alter table profiles      enable row level security;
alter table programs      enable row level security;
alter table memberships   enable row level security;
alter table class_slots   enable row level security;
alter table classes       enable row level security;
alter table bookings      enable row level security;
alter table workouts      enable row level security;
alter table settings      enable row level security;
alter table notifications enable row level security;
alter table audit_log     enable row level security;

drop policy if exists p_profiles_read on profiles;
create policy p_profiles_read on profiles for select to authenticated
  using (auth_id = auth.uid() or guardian_id = me() or is_staff() or role in ('coach', 'owner'));
drop policy if exists p_profiles_self on profiles;
create policy p_profiles_self on profiles for update to authenticated
  using (auth_id = auth.uid() or is_owner()) with check (auth_id = auth.uid() or is_owner());
drop policy if exists p_profiles_owner on profiles;
create policy p_profiles_owner on profiles for insert to authenticated with check (is_owner());
drop policy if exists p_profiles_owner_del on profiles;
create policy p_profiles_owner_del on profiles for delete to authenticated using (is_owner());

drop policy if exists p_programs_read on programs;
create policy p_programs_read on programs for select to authenticated using (true);
drop policy if exists p_programs_owner on programs;
create policy p_programs_owner on programs for all to authenticated using (is_owner()) with check (is_owner());

drop policy if exists p_members_read on memberships;
create policy p_members_read on memberships for select to authenticated using (profile_id = me() or is_staff());
drop policy if exists p_members_owner on memberships;
create policy p_members_owner on memberships for all to authenticated using (is_owner()) with check (is_owner());

drop policy if exists p_slots_read on class_slots;
create policy p_slots_read on class_slots for select to authenticated using (true);
drop policy if exists p_slots_owner on class_slots;
create policy p_slots_owner on class_slots for all to authenticated using (is_owner()) with check (is_owner());

drop policy if exists p_classes_read on classes;
create policy p_classes_read on classes for select to authenticated using (true);
drop policy if exists p_classes_owner on classes;
create policy p_classes_owner on classes for all to authenticated using (is_owner()) with check (is_owner());

-- Bókanir eru bara skrifaðar í gegnum föllin hér að ofan
drop policy if exists p_bookings_read on bookings;
create policy p_bookings_read on bookings for select to authenticated using (can_act_for(profile_id));

drop policy if exists p_workouts_read on workouts;
create policy p_workouts_read on workouts for select to authenticated
  using (is_staff() or (status = 'published' and publish_at <= now()));
drop policy if exists p_workouts_owner on workouts;
create policy p_workouts_owner on workouts for all to authenticated using (is_owner()) with check (is_owner());

drop policy if exists p_settings_read on settings;
create policy p_settings_read on settings for select to authenticated using (true);
drop policy if exists p_settings_owner on settings;
create policy p_settings_owner on settings for update to authenticated using (is_owner()) with check (is_owner());

drop policy if exists p_notif_read on notifications;
create policy p_notif_read on notifications for select to authenticated using (profile_id = me());
drop policy if exists p_notif_update on notifications;
create policy p_notif_update on notifications for update to authenticated using (profile_id = me()) with check (profile_id = me());

drop policy if exists p_audit_read on audit_log;
create policy p_audit_read on audit_log for select to authenticated using (is_staff());

-- Föll sem appið má kalla (önnur eru bara notuð innan gagnagrunnsins)
revoke execute on all functions in schema public from public, anon;
grant execute on function book_class(bigint, uuid), cancel_booking(bigint, uuid), set_class_cap(bigint, int, text),
  cancel_class(bigint, boolean, text), set_class_coach(bigint, uuid), check_in(bigint, uuid, boolean), kiosk_sign_in(bigint, uuid), class_attendees(bigint), self_check_in(bigint),
  class_list(timestamptz, timestamptz), class_roster(bigint), my_attendance(uuid), member_overview(), me(), my_role(), is_staff(), is_owner(), can_act_for(uuid),
  class_cap(classes), booking_opens_at(classes), has_membership(uuid, int, date), class_label(classes) to authenticated;
revoke execute on function promote_waitlist(bigint), generate_classes(int), auto_cancel_low(), notify(uuid, text, text, bigint) from authenticated;

-- Rauntímauppfærslur (appið sér breytingar strax)
do $$ begin
  alter publication supabase_realtime add table bookings, classes, notifications, workouts;
exception when others then null; end $$;

-- BOX800 – námskeið og föst tímatafla (úr timatafla-data.js á vefnum)

insert into programs (name, color, default_cap, sort) values
  ('Hreysti', '#c0c7d1', 24, 0),
  ('Mömmuhreysti', '#e07470', 18, 1),
  ('Unglingastyrkur', '#7fae8a', 16, 2),
  ('Karlahreysti', '#5b93ea', 24, 3),
  ('Heldrihreysti', '#f5d33f', 16, 4),
  ('Mömmugrunnur', '#ff99d6', 18, 5),
  ('Konuhreysti', '#c372ea', 16, 6),
  ('Þolþjálfun', '#5ce0e6', 16, 7),
  ('Barre', '#c0c7d1', 16, 8)
on conflict (name) do update set color = excluded.color, default_cap = excluded.default_cap, sort = excluded.sort;

insert into class_slots (program_id, weekday, start_time, end_time)
select p.id, v.wd, v.st::time, v.et::time from (values
  ('Hreysti', 1, '06:00', '06:50'),
  ('Hreysti', 1, '08:30', '09:30'),
  ('Mömmuhreysti', 1, '09:30', '10:20'),
  ('Mömmuhreysti', 1, '10:30', '11:30'),
  ('Hreysti', 1, '12:00', '12:50'),
  ('Unglingastyrkur', 1, '14:50', '15:40'),
  ('Hreysti', 1, '16:30', '17:30'),
  ('Hreysti', 1, '17:35', '18:35'),
  ('Karlahreysti', 1, '19:45', '20:35'),
  ('Hreysti', 2, '06:00', '06:50'),
  ('Hreysti', 2, '08:30', '09:30'),
  ('Heldrihreysti', 2, '09:30', '10:20'),
  ('Mömmugrunnur', 2, '10:30', '11:30'),
  ('Hreysti', 2, '12:00', '12:50'),
  ('Konuhreysti', 2, '16:30', '17:30'),
  ('Hreysti', 2, '16:30', '17:30'),
  ('Þolþjálfun', 2, '17:35', '18:35'),
  ('Hreysti', 2, '17:35', '18:35'),
  ('Barre', 2, '19:45', '20:35'),
  ('Hreysti', 3, '06:00', '06:50'),
  ('Hreysti', 3, '08:30', '09:30'),
  ('Mömmuhreysti', 3, '09:30', '10:20'),
  ('Mömmuhreysti', 3, '10:30', '11:30'),
  ('Hreysti', 3, '12:00', '12:50'),
  ('Unglingastyrkur', 3, '14:50', '15:40'),
  ('Hreysti', 3, '16:30', '17:30'),
  ('Hreysti', 3, '17:35', '18:35'),
  ('Karlahreysti', 3, '19:45', '20:35'),
  ('Hreysti', 4, '06:00', '06:50'),
  ('Hreysti', 4, '08:30', '09:30'),
  ('Heldrihreysti', 4, '09:30', '10:20'),
  ('Mömmugrunnur', 4, '10:30', '11:30'),
  ('Hreysti', 4, '12:00', '12:50'),
  ('Konuhreysti', 4, '16:30', '17:30'),
  ('Hreysti', 4, '16:30', '17:30'),
  ('Þolþjálfun', 4, '17:35', '18:35'),
  ('Hreysti', 4, '17:35', '18:35'),
  ('Barre', 4, '17:35', '18:35'),
  ('Hreysti', 5, '06:00', '06:50'),
  ('Hreysti', 5, '08:30', '09:30'),
  ('Mömmuhreysti', 5, '09:30', '10:20'),
  ('Mömmuhreysti', 5, '10:30', '11:30'),
  ('Hreysti', 5, '12:00', '12:50'),
  ('Hreysti', 5, '16:30', '17:30'),
  ('Hreysti', 6, '08:30', '09:30'),
  ('Hreysti', 6, '09:35', '10:35'),
  ('Hreysti', 7, '10:00', '11:00')
) as v(prog, wd, st, et) join programs p on p.name = v.prog
on conflict (program_id, weekday, start_time) do nothing;

select generate_classes(28);

-- =====================================================================
-- BOX800 – skor og árangur (eins og „Performance“ í Wodify)
-- Hreyfingar (Back Squat, Deadlift…), skor iðkenda, saga og stigatafla.
-- Keyrt á eftir 001 og 002. Má keyra aftur án skaða.
-- =====================================================================

create table if not exists movements (
  id    serial primary key,
  name  text not null unique,
  sort  int  not null default 100,
  active boolean not null default true
);

create table if not exists results (
  id          bigserial primary key,
  profile_id  uuid   not null references profiles(id) on delete cascade,
  day         date   not null,
  workout_id  bigint references workouts(id) on delete set null,
  comp_key    text,                                   -- hvaða hluti æfingarinnar
  movement_id int    references movements(id),        -- lyftur: hvaða hreyfing
  sets        int,
  reps        int,
  weight      numeric(6,2),                           -- kg
  kind        text   not null default 'weight'
              check (kind in ('weight', 'time', 'rounds', 'reps', 'cal', 'dist', 'done')),
  score_num   numeric,                                -- til röðunar (sek., umf*1000+endurt., kg …)
  score_text  text,                                   -- eins og það birtist: „12:34“, „5 + 12“
  rx          text check (rx in ('Rx+', 'Rx', 'Scaled')),
  note        text,
  source      text   not null default 'app',          -- 'app' eða 'wodify'
  ext_id      text   unique,                          -- auðkenni úr Wodify (svo innflutningur tvítaki ekki)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists results_profile_idx  on results (profile_id, movement_id, day);
create index if not exists results_workout_idx  on results (workout_id, comp_key);
create unique index if not exists results_one_per_comp on results (profile_id, workout_id, comp_key) where workout_id is not null;

alter table movements enable row level security;
alter table results   enable row level security;
drop policy if exists p_mov_read on movements;
create policy p_mov_read on movements for select to authenticated using (true);
drop policy if exists p_mov_owner on movements;
create policy p_mov_owner on movements for all to authenticated using (is_owner()) with check (is_owner());
drop policy if exists p_res_read on results;
create policy p_res_read on results for select to authenticated using (can_act_for(profile_id));

-- Vista skor (nýtt eða breyta). Eitt skor á hvern hluta æfingar á hvern iðkanda.
create or replace function save_result(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  who uuid := coalesce((p->>'profile_id')::uuid, me());
  rid bigint := (p->>'id')::bigint;
  wid bigint := (p->>'workout_id')::bigint;
  k   text   := nullif(p->>'comp_key', '');
begin
  if who is null or not can_act_for(who) then raise exception 'Þú mátt ekki skrá skor fyrir þennan iðkanda'; end if;
  if rid is not null and not exists (select 1 from results where id = rid and profile_id = who) then
    raise exception 'Skorið fannst ekki'; end if;
  if rid is null and wid is not null then
    select id into rid from results where profile_id = who and workout_id = wid and comp_key = k;
  end if;
  if rid is null then
    insert into results (profile_id, day, workout_id, comp_key, movement_id, sets, reps, weight, kind, score_num, score_text, rx, note)
    values (who, coalesce((p->>'day')::date, (now() at time zone 'Atlantic/Reykjavik')::date), wid, k,
            (p->>'movement_id')::int, (p->>'sets')::int, (p->>'reps')::int, (p->>'weight')::numeric,
            coalesce(p->>'kind', 'weight'), (p->>'score_num')::numeric, p->>'score_text', nullif(p->>'rx', ''), nullif(p->>'note', ''))
    returning id into rid;
  else
    update results set
      day = coalesce((p->>'day')::date, day), movement_id = (p->>'movement_id')::int,
      sets = (p->>'sets')::int, reps = (p->>'reps')::int, weight = (p->>'weight')::numeric,
      kind = coalesce(p->>'kind', kind), score_num = (p->>'score_num')::numeric, score_text = p->>'score_text',
      rx = nullif(p->>'rx', ''), note = nullif(p->>'note', ''), updated_at = now()
    where id = rid;
  end if;
  return rid;
end $$;

create or replace function delete_result(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from results where id = p_id and can_act_for(profile_id);
end $$;

-- Mín skor í æfingum á tímabili (til að sýna „Þitt skor“ í æfingunni)
create or replace function my_component_results(p_from date, p_to date, p_profile uuid default null)
returns setof results
language sql stable security definer set search_path = public as $$
  select * from results
  where profile_id = coalesce(p_profile, me()) and can_act_for(coalesce(p_profile, me()))
    and workout_id is not null and day between p_from and p_to
$$;

-- Öll saga einnar hreyfingar (fyrir línurit og PR)
create or replace function lift_history(p_movement int, p_profile uuid default null)
returns setof results
language sql stable security definer set search_path = public as $$
  select * from results
  where profile_id = coalesce(p_profile, me()) and can_act_for(coalesce(p_profile, me()))
    and movement_id = p_movement and weight is not null
  order by day, id
$$;

-- Yfirlit: bestu lyftur í hverri hreyfingu
create or replace function my_lifts(p_profile uuid default null)
returns table (movement_id int, name text, best numeric, best_1rm numeric, last_day date, n int)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, max(r.weight), max(r.weight) filter (where r.reps = 1), max(r.day), count(*)::int
  from results r join movements m on m.id = r.movement_id
  where r.profile_id = coalesce(p_profile, me()) and can_act_for(coalesce(p_profile, me())) and r.weight is not null
  group by m.id, m.name
  order by max(r.day) desc
$$;

-- Stigatafla fyrir einn hluta æfingar (allir innskráðir sjá, eins og í Wodify)
create or replace function component_leaderboard(p_workout bigint, p_key text)
returns table (profile_id uuid, full_name text, avatar_url text, kind text, score_num numeric, score_text text,
               sets int, reps int, weight numeric, rx text, is_me boolean)
language sql stable security definer set search_path = public as $$
  select r.profile_id, pr.full_name, pr.avatar_url, r.kind, r.score_num, r.score_text, r.sets, r.reps, r.weight, r.rx,
         r.profile_id = me()
  from results r join profiles pr on pr.id = r.profile_id
  where r.workout_id = p_workout and r.comp_key = p_key and me() is not null
$$;

revoke execute on function save_result(jsonb), delete_result(bigint), my_component_results(date, date, uuid),
  lift_history(int, uuid), my_lifts(uuid), component_leaderboard(bigint, text) from public, anon;
grant execute on function save_result(jsonb), delete_result(bigint), my_component_results(date, date, uuid),
  lift_history(int, uuid), my_lifts(uuid), component_leaderboard(bigint, text) to authenticated;
grant select on movements, results to authenticated;
grant insert, update, delete on movements to authenticated;

do $$ begin
  alter publication supabase_realtime add table results;
exception when others then null; end $$;

-- Algengar hreyfingar (nöfn eins og í Wodify svo innflutningur passi)
insert into movements (name, sort) values
  ('Back Squat', 1), ('Front Squat', 2), ('Overhead Squat', 3), ('Deadlift', 4), ('Sumo Deadlift', 5), ('Romanian Deadlift', 6),
  ('Bench Press', 7), ('Strict Press', 8), ('Push Press', 9), ('Push Jerk', 10), ('Split Jerk', 11),
  ('Clean', 12), ('Power Clean', 13), ('Hang Power Clean', 14), ('Squat Clean', 15), ('Clean & Jerk', 16),
  ('Snatch', 17), ('Power Snatch', 18), ('Hang Power Snatch', 19), ('Squat Snatch', 20),
  ('Thruster', 21), ('Hip Thrust', 22), ('Weighted Pull-up', 23), ('Bent Over Row', 24), ('Front Rack Lunge', 25)
on conflict (name) do nothing;

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

-- =====================================================================
-- BOX800 – myndir iðkenda, drop-in og biðlisti frá þjálfara
-- Keyrt á eftir 007. Má keyra aftur án skaða.
-- =====================================================================

-- Drop-in: gestur sem er ekki með aðgang (netfang valfrjálst)
alter table profiles add column if not exists drop_in boolean not null default false;

-- Þjálfari bætir við iðkanda: beint í tímann eða á biðlista (aftast)
create or replace function staff_add(p_class bigint, p_profile uuid, p_waitlist boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare c classes; b bookings;
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  if not p_waitlist then return book_class(p_class, p_profile); end if;
  select * into c from classes where id = p_class for update;
  if not found then raise exception 'Tíminn fannst ekki'; end if;
  if c.cancelled_at is not null then raise exception 'Tímanum hefur verið aflýst'; end if;
  select * into b from bookings where class_id = p_class and profile_id = p_profile;
  if found and b.status in ('booked', 'waitlist') then return b.status; end if;
  insert into bookings (class_id, profile_id, status, waitlist_at)
  values (p_class, p_profile, 'waitlist', now())
  on conflict (class_id, profile_id) do update set status = 'waitlist', waitlist_at = now(), checked_in_at = null, updated_at = now();
  insert into audit_log (actor_id, action, class_id, detail) values (me(), 'add_waitlist', p_class, jsonb_build_object('profile', p_profile));
  return 'waitlist';
end $$;

-- Þjálfari stofnar drop-in gest (eða finnur þann sem er til með sama netfangi)
create or replace function create_dropin(p_name text, p_email text default null, p_phone text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; e text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nafn vantar'; end if;
  if e is not null then
    select id into pid from profiles where lower(email) = e and not is_dependent;
    if found then return pid; end if;
  end if;
  insert into profiles (full_name, email, phone, drop_in, note)
  values (trim(p_name), e, nullif(trim(coalesce(p_phone, '')), ''), true, 'Drop-in')
  returning id into pid;
  return pid;
end $$;

revoke execute on function staff_add(bigint, uuid, boolean), create_dropin(text, text, text) from public, anon;
grant execute on function staff_add(bigint, uuid, boolean), create_dropin(text, text, text) to authenticated;

-- Myndir: geymsla í Supabase Storage („avatars“, opin til lesturs).
-- Hver má aðeins setja inn mynd í sína möppu (prófíl-id); eigandi má setja inn fyrir alla.
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;   -- t.d. prófunarumhverfi án Storage
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = true;

  execute 'drop policy if exists "avatars lesa" on storage.objects';
  execute 'create policy "avatars lesa" on storage.objects for select using (bucket_id = ''avatars'')';
  execute 'drop policy if exists "avatars setja inn" on storage.objects';
  execute 'create policy "avatars setja inn" on storage.objects for insert to authenticated
           with check (bucket_id = ''avatars'' and ((storage.foldername(name))[1] = public.me()::text or public.is_owner()))';
  execute 'drop policy if exists "avatars breyta" on storage.objects';
  execute 'create policy "avatars breyta" on storage.objects for update to authenticated
           using (bucket_id = ''avatars'' and ((storage.foldername(name))[1] = public.me()::text or public.is_owner()))';
  execute 'drop policy if exists "avatars eyða" on storage.objects';
  execute 'create policy "avatars eyða" on storage.objects for delete to authenticated
           using (bucket_id = ''avatars'' and ((storage.foldername(name))[1] = public.me()::text or public.is_owner()))';
end $$;

-- =====================================================================
-- BOX800 – aðeins iðkendur með virkt kort eða áskrift sjá tímatöflu,
-- skráða, mætingu og æfingar. Aðrir sjá aðeins forsíðuna og prófílinn sinn.
-- Keyrt á eftir 008. Má keyra aftur án skaða.
-- =====================================================================

-- Hefur innskráður notandi aðgang? (þjálfari/eigandi, eða virk áskrift, eða forráðamaður barns með áskrift)
create or replace function has_access() returns boolean
language sql stable security definer set search_path = public as $$
  select is_staff() or exists (
    select 1 from memberships m join profiles p on p.id = m.profile_id
    where (p.id = me() or p.guardian_id = me())
      and m.status = 'active' and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
  )
$$;
revoke execute on function has_access() from public, anon;
grant execute on function has_access() to authenticated;

-- Tímatafla og fjöldi skráðra: aðeins með aðgang
create or replace function class_list(p_from timestamptz, p_to timestamptz)
returns table (
  id bigint, program_id int, program text, color text, starts_at timestamptz, ends_at timestamptz,
  coach_id uuid, coach_name text, coach_avatar text, cap int, booked int, waiting int,
  cancelled boolean, my_status text, my_position int, slot_id int
)
language sql stable security definer set search_path = public as $$
  select c.id, c.program_id, p.name, p.color, c.starts_at, c.ends_at,
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

-- Hverjir eru skráðir: aðeins með aðgang
create or replace function class_attendees(p_class bigint)
returns table (profile_id uuid, full_name text, avatar_url text, checked_in boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  select b.profile_id, pr.full_name, pr.avatar_url, b.checked_in_at is not null, b.profile_id = me()
  from bookings b join profiles pr on pr.id = b.profile_id
  where b.class_id = p_class and b.status = 'booked' and has_access()
  order by b.created_at, b.id
$$;

-- Stigatafla: aðeins með aðgang
create or replace function component_leaderboard(p_workout bigint, p_key text)
returns table (profile_id uuid, full_name text, avatar_url text, kind text, score_num numeric, score_text text,
               sets int, reps int, weight numeric, rx text, is_me boolean)
language sql stable security definer set search_path = public as $$
  select r.profile_id, pr.full_name, pr.avatar_url, r.kind, r.score_num, r.score_text, r.sets, r.reps, r.weight, r.rx,
         r.profile_id = me()
  from results r join profiles pr on pr.id = r.profile_id
  where r.workout_id = p_workout and r.comp_key = p_key and has_access()
$$;

-- Æfingar: aðeins með aðgang (þjálfarar sjá líka drög)
drop policy if exists p_workouts_read on workouts;
create policy p_workouts_read on workouts for select to authenticated
  using (is_staff() or (status = 'published' and publish_at <= now() and has_access()));

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

-- =====================================================================
-- BOX800 – samstarf: lítil kynning frá samstarfsaðila á forsíðu
-- (merki, texti, afsláttarkóði, hlekkur). Eigandi velur hverjir sjá:
-- allir með aðgang, eða aðeins þau sem eru með áskrift sem heitir t.d. „Mömmuhreysti“.
-- Keyrt á eftir 013. Má keyra aftur án skaða.
-- =====================================================================

create table if not exists promos (
  id            bigserial primary key,
  partner       text not null,
  title         text not null,
  body          text,
  code          text,
  url           text,
  logo_url      text,
  audience_plan text,               -- null = allir með aðgang; annars hluti af nafni áskriftar
  starts_on     date not null default current_date,
  ends_on       date,
  active        boolean not null default true,
  clicks        int not null default 0,
  copies        int not null default 0,
  created_at    timestamptz not null default now()
);

alter table promos enable row level security;
drop policy if exists p_promos_owner on promos;
create policy p_promos_owner on promos for all to authenticated using (is_owner()) with check (is_owner());

-- Kynningar sem innskráður iðkandi á að sjá núna
create or replace function my_promos() returns table (
  id bigint, partner text, title text, body text, code text, url text, logo_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.partner, p.title, p.body, p.code, p.url, p.logo_url
  from promos p
  where p.active and p.starts_on <= current_date and (p.ends_on is null or p.ends_on >= current_date)
    and has_access()
    and (coalesce(trim(p.audience_plan), '') = '' or exists (
      select 1 from memberships m join profiles pr on pr.id = m.profile_id
      where (pr.id = me() or pr.guardian_id = me())
        and m.status = 'active' and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
        and m.plan ilike '%' || trim(p.audience_plan) || '%'))
  order by p.created_at desc
$$;
revoke execute on function my_promos() from public, anon;
grant execute on function my_promos() to authenticated;

-- Telja smelli á hlekk eða afritun á kóða
create or replace function promo_event(p_id bigint, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from my_promos() x where x.id = p_id) then return; end if;
  update promos set clicks = clicks + (p_kind = 'click')::int, copies = copies + (p_kind = 'copy')::int where id = p_id;
end $$;
revoke execute on function promo_event(bigint, text) from public, anon;
grant execute on function promo_event(bigint, text) to authenticated;

-- Hversu margir sjá kynninguna (fyrir eiganda)
create or replace function promo_reach(p_plan text) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct pr.id)::int from profiles pr
  where is_owner() and exists (
    select 1 from memberships m where m.profile_id = pr.id
      and m.status = 'active' and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
      and (coalesce(trim(p_plan), '') = '' or m.plan ilike '%' || trim(p_plan) || '%'))
$$;
revoke execute on function promo_reach(text) from public, anon;
grant execute on function promo_reach(text) to authenticated;

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

-- =====================================================================
-- BOX800 – samstarf: kynning getur miðað á fleiri en eina áskrift/námskeið.
-- audience_plan geymir nöfnin aðskilin með „|“ (t.d. „Mömmuhreysti 4 vikur|Mömmugrunnur 4 vikur“).
-- Keyrt á eftir 015. Má keyra aftur án skaða.
-- =====================================================================

create or replace function plan_matches(p_plan text, p_audience text) returns boolean
language sql immutable as $$
  select coalesce(trim(p_audience), '') = '' or exists (
    select 1 from unnest(string_to_array(p_audience, '|')) a
    where trim(a) <> '' and p_plan ilike '%' || trim(a) || '%')
$$;

create or replace function my_promos() returns table (
  id bigint, partner text, title text, body text, code text, url text, logo_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.partner, p.title, p.body, p.code, p.url, p.logo_url
  from promos p
  where p.active and p.starts_on <= current_date and (p.ends_on is null or p.ends_on >= current_date)
    and has_access()
    and (coalesce(trim(p.audience_plan), '') = '' or exists (
      select 1 from memberships m join profiles pr on pr.id = m.profile_id
      where (pr.id = me() or pr.guardian_id = me())
        and m.status = 'active' and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
        and plan_matches(m.plan, p.audience_plan)))
  order by p.created_at desc
$$;

create or replace function promo_reach(p_plan text) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct pr.id)::int from profiles pr
  where is_owner() and exists (
    select 1 from memberships m where m.profile_id = pr.id
      and m.status = 'active' and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
      and plan_matches(m.plan, p_plan))
$$;

-- =====================================================================
-- BOX800 – Parahreysti fellur út. Laugardagstímarnir verða venjulegt Hreysti.
-- Laugardagstímar Hreysti: hámark 28.
-- Má keyra aftur án skaða.
-- =====================================================================
do $$
declare para int; hrey int; para_cap int;
begin
  select id, default_cap into para, para_cap from programs where name = 'Parahreysti';
  select id into hrey from programs where name = 'Hreysti';
  if para is null or hrey is null then return; end if;

  -- Fastir tímar (laugardagar) og stakir tímar
  update class_slots set program_id = hrey, cap = coalesce(cap, para_cap) where program_id = para;
  update classes set program_id = hrey, cap = coalesce(cap, para_cap) where program_id = para;

  -- Æfingar: færa á Hreysti ef sá dagur er laus, annars eyða Parahreysti-æfingunni
  update workouts w set program_id = hrey
  where w.program_id = para and not exists (select 1 from workouts x where x.program_id = hrey and x.day = w.day);
  delete from workouts where program_id = para;

  -- Taka námskeiðið út (eða fela ef eitthvað vísar enn á það)
  begin
    delete from programs where id = para;
  exception when foreign_key_violation then
    update programs set active = false where id = para;
  end;
end $$;

-- Laugardagar í Hreysti: hámark 28 (fastir tímar og tímar sem eru komnir í töflu)
update class_slots s set cap = 28
from programs p where p.id = s.program_id and p.name = 'Hreysti' and s.weekday = 6;
update classes c set cap = 28
from programs p where p.id = c.program_id and p.name = 'Hreysti'
  and extract(isodow from c.starts_at at time zone 'Atlantic/Reykjavik') = 6 and c.starts_at >= date_trunc('day', now());

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

-- =====================================================================
-- BOX800 – einkaþjálfun (1 on 1): æfingar fyrir einn iðkanda.
-- Iðkandi með áskrift sem heitir „Einkaþjálfun …“ fær flipann „1 on 1“ í appinu.
-- Eigandi/þjálfari skrifar æfingarnar á prófíl iðkandans.
-- Keyrt á eftir 018. Má keyra aftur án skaða.
-- =====================================================================

create table if not exists pt_workouts (
  id          bigserial primary key,
  profile_id  uuid not null references profiles(id) on delete cascade,
  day         date not null,
  components  jsonb not null default '[]',
  status      text not null default 'draft' check (status in ('draft', 'published')),
  updated_by  uuid references profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (profile_id, day)
);

alter table pt_workouts enable row level security;
drop policy if exists p_pt_read on pt_workouts;
create policy p_pt_read on pt_workouts for select to authenticated
  using (is_staff() or (status = 'published' and profile_id in (select id from profiles where id = me() or guardian_id = me())));
drop policy if exists p_pt_write on pt_workouts;
create policy p_pt_write on pt_workouts for all to authenticated using (is_staff()) with check (is_staff());

-- Er iðkandi með virka einkaþjálfun?
create or replace function has_pt(p_profile uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.profile_id = coalesce(p_profile, me()) and m.status = 'active'
      and m.starts_on <= current_date and (m.ends_on is null or m.ends_on >= current_date)
      and m.plan ilike '%einkaþjálfun%'
  ) and (p_profile is null or p_profile = me() or is_staff())
$$;
revoke execute on function has_pt(uuid) from public, anon;
grant execute on function has_pt(uuid) to authenticated;

-- Vista æfingu (eigandi/þjálfari)
create or replace function save_pt_workout(p_profile uuid, p_day date, p_components jsonb, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  if jsonb_array_length(coalesce(p_components, '[]')) = 0 then
    delete from pt_workouts where profile_id = p_profile and day = p_day; return;
  end if;
  insert into pt_workouts (profile_id, day, components, status, updated_by, updated_at)
  values (p_profile, p_day, p_components, p_status, me(), now())
  on conflict (profile_id, day) do update set components = excluded.components, status = excluded.status, updated_by = excluded.updated_by, updated_at = now();
  -- Láta iðkandann vita þegar ný æfing er birt
  if p_status = 'published' then
    insert into notifications (profile_id, title, body, kind)
    select p_profile, 'Ný 1 on 1 æfing', 'Æfing fyrir ' || to_char(p_day, 'DD.MM.') || ' er komin í appið.', 'pt'
    where not exists (select 1 from notifications n where n.profile_id = p_profile and n.kind = 'pt' and n.created_at > now() - interval '10 minutes');
  end if;
end $$;
revoke execute on function save_pt_workout(uuid, date, jsonb, text) from public, anon;
grant execute on function save_pt_workout(uuid, date, jsonb, text) to authenticated;

-- =====================================================================
-- BOX800 – myndbönd í einkaþjálfun: iðkandi sendir myndband, þjálfari gefur endurgjöf.
-- Myndböndin eru læst (aðeins iðkandinn sjálfur og þjálfarar/eigendur sjá þau).
-- Keyrt á eftir 019. Má keyra aftur án skaða.
-- =====================================================================

create table if not exists pt_videos (
  id           bigserial primary key,
  profile_id   uuid not null references profiles(id) on delete cascade,
  day          date not null,
  path         text not null,          -- slóð í Storage: <prófíl-id>/<skrá>
  note         text,                   -- skilaboð frá iðkanda
  size_bytes   bigint,
  created_at   timestamptz not null default now(),
  feedback     text,
  feedback_by  uuid references profiles(id) on delete set null,
  feedback_at  timestamptz,
  seen_at      timestamptz             -- iðkandi hefur séð endurgjöfina
);
create index if not exists pt_videos_profile_idx on pt_videos (profile_id, created_at desc);

alter table pt_videos enable row level security;
drop policy if exists p_ptv_read on pt_videos;
create policy p_ptv_read on pt_videos for select to authenticated using (profile_id = me() or is_staff());
drop policy if exists p_ptv_insert on pt_videos;
create policy p_ptv_insert on pt_videos for insert to authenticated with check (profile_id = me() and has_pt());
drop policy if exists p_ptv_delete on pt_videos;
create policy p_ptv_delete on pt_videos for delete to authenticated using (profile_id = me() or is_staff());

-- Iðkandi sendir inn: eigendur fá tilkynningu
create or replace function pt_video_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select full_name into nm from profiles where id = new.profile_id;
  insert into notifications (profile_id, title, body, kind)
  select o.id, 'Nýtt myndband: ' || coalesce(nm, 'Iðkandi'), coalesce(left(new.note, 140), '1 on 1 · ' || to_char(new.day, 'DD.MM.')), 'pt_video'
  from profiles o where o.role = 'owner';
  return new;
end $$;
drop trigger if exists pt_video_added on pt_videos;
create trigger pt_video_added after insert on pt_videos for each row execute function pt_video_added();

-- Þjálfari gefur endurgjöf: iðkandinn fær tilkynningu
create or replace function pt_video_feedback(p_id bigint, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare v pt_videos;
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  update pt_videos set feedback = nullif(trim(p_text), ''), feedback_by = me(), feedback_at = now(), seen_at = null
  where id = p_id returning * into v;
  if v.id is not null and v.feedback is not null then
    insert into notifications (profile_id, title, body, kind)
    values (v.profile_id, 'Endurgjöf á myndbandið þitt', left(v.feedback, 160), 'pt_feedback');
  end if;
end $$;
revoke execute on function pt_video_feedback(bigint, text) from public, anon;
grant execute on function pt_video_feedback(bigint, text) to authenticated;

create or replace function pt_video_seen(p_id bigint) returns void
language sql security definer set search_path = public as $$
  update pt_videos set seen_at = now() where id = p_id and profile_id = me() and seen_at is null
$$;
grant execute on function pt_video_seen(bigint) to authenticated;

-- Geymsla: læst hólf „pt-videos“, mest 100 MB á myndband
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('pt-videos', 'pt-videos', false, 104857600, array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "pt-videos lesa" on storage.objects';
  execute 'create policy "pt-videos lesa" on storage.objects for select to authenticated
           using (bucket_id = ''pt-videos'' and ((storage.foldername(name))[1] = public.me()::text or public.is_staff()))';
  execute 'drop policy if exists "pt-videos setja inn" on storage.objects';
  execute 'create policy "pt-videos setja inn" on storage.objects for insert to authenticated
           with check (bucket_id = ''pt-videos'' and (storage.foldername(name))[1] = public.me()::text and public.has_pt())';
  execute 'drop policy if exists "pt-videos eyða" on storage.objects';
  execute 'create policy "pt-videos eyða" on storage.objects for delete to authenticated
           using (bucket_id = ''pt-videos'' and ((storage.foldername(name))[1] = public.me()::text or public.is_staff()))';
end $$;

-- =====================================================================
-- BOX800 – tilkynningar með hlekk: smellt á tilkynningu → beint á rétta síðu.
-- Keyrt á eftir 020. Má keyra aftur án skaða.
-- =====================================================================

alter table notifications add column if not exists link text;

-- Nýtt myndband → prófíl iðkandans, 1 on 1 flipinn
create or replace function pt_video_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select full_name into nm from profiles where id = new.profile_id;
  insert into notifications (profile_id, title, body, kind, link)
  select o.id, 'Nýtt myndband: ' || coalesce(nm, 'Iðkandi'), coalesce(left(new.note, 140), '1 on 1 · ' || to_char(new.day, 'DD.MM.')), 'pt_video',
         '/stjorn/idkendur/' || new.profile_id || '?t=pt'
  from profiles o where o.role = 'owner';
  return new;
end $$;

-- Endurgjöf → 1 on 1 síða iðkandans, á réttum degi
create or replace function pt_video_feedback(p_id bigint, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare v pt_videos;
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  update pt_videos set feedback = nullif(trim(p_text), ''), feedback_by = me(), feedback_at = now(), seen_at = null
  where id = p_id returning * into v;
  if v.id is not null and v.feedback is not null then
    insert into notifications (profile_id, title, body, kind, link)
    values (v.profile_id, 'Endurgjöf á myndbandið þitt', left(v.feedback, 160), 'pt_feedback', '/einkathjalfun?d=' || v.day);
  end if;
end $$;

-- Eldri tilkynningar fá hlekk líka
update notifications n set link = '/stjorn/idkendur/' || v.profile_id || '?t=pt'
from pt_videos v
where n.kind = 'pt_video' and n.link is null and n.title = 'Nýtt myndband: ' || (select full_name from profiles where id = v.profile_id);
update notifications set link = '/einkathjalfun' where kind in ('pt', 'pt_feedback') and link is null;
update notifications set link = '/stjorn/idkendur' where kind = 'support' and link is null;

-- Ný 1 on 1 æfing → réttur dagur
create or replace function save_pt_workout(p_profile uuid, p_day date, p_components jsonb, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Aðeins þjálfarar'; end if;
  if jsonb_array_length(coalesce(p_components, '[]')) = 0 then
    delete from pt_workouts where profile_id = p_profile and day = p_day; return;
  end if;
  insert into pt_workouts (profile_id, day, components, status, updated_by, updated_at)
  values (p_profile, p_day, p_components, p_status, me(), now())
  on conflict (profile_id, day) do update set components = excluded.components, status = excluded.status, updated_by = excluded.updated_by, updated_at = now();
  if p_status = 'published' then
    insert into notifications (profile_id, title, body, kind, link)
    select p_profile, 'Ný 1 on 1 æfing', 'Æfing fyrir ' || to_char(p_day, 'DD.MM.') || ' er komin í appið.', 'pt', '/einkathjalfun?d=' || p_day
    where not exists (select 1 from notifications n where n.profile_id = p_profile and n.kind = 'pt' and n.created_at > now() - interval '10 minutes');
  end if;
end $$;

