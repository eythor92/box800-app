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
