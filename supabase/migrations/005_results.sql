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

-- Kastljós á heimasíðu: áfangar annarra síðustu daga (eins og „Spotlight“ í Wodify)
-- Nafn birtist sem fornafn + upphafsstafur (t.d. „Heiðdís B“).
create or replace function spotlight(p_days int default 3)
returns table (profile_id uuid, name text, avatar_url text, kind text, label text, at date)
language sql stable security definer set search_path = public as $$
  with att as (
    select b.profile_id, (c.starts_at at time zone 'Atlantic/Reykjavik')::date d,
           row_number() over (partition by b.profile_id order by c.starts_at) n
    from bookings b join classes c on c.id = b.class_id
    where b.status = 'booked' and b.checked_in_at is not null
  ),
  ev as (
    select profile_id, 'visits' kind, n || ' tímar' label, d at from att
    where d >= current_date - p_days and d <= current_date and (n in (10, 25, 50) or n % 100 = 0)
    union all
    select r.profile_id, 'pr', 'PR · ' || m.name || ' ' || replace(rtrim(rtrim(r.weight::text, '0'), '.'), '.', ',') || ' kg', r.day
    from results r join movements m on m.id = r.movement_id
    where r.day >= current_date - p_days and r.weight is not null
      and exists (select 1 from results x where x.profile_id = r.profile_id and x.movement_id = r.movement_id and x.day < r.day
                  and coalesce(x.reps, 1) = coalesce(r.reps, 1))
      and r.weight > (select max(x.weight) from results x where x.profile_id = r.profile_id and x.movement_id = r.movement_id
                      and coalesce(x.reps, 1) = coalesce(r.reps, 1) and (x.day < r.day or (x.day = r.day and x.id < r.id)))
    union all
    select f.profile_id, 'years', 'Iðkandi í ' || f.y || ' ár', (f.first + make_interval(years => f.y))::date
    from (select profile_id, min(starts_on) first, extract(year from age(current_date, min(starts_on)))::int y
          from memberships group by profile_id) f
    where f.y >= 1 and (f.first + make_interval(years => f.y))::date between current_date - p_days and current_date
  )
  select ev.profile_id, split_part(p.full_name, ' ', 1) || coalesce(' ' || nullif(left(split_part(p.full_name, ' ', 2), 1), ''), ''),
         p.avatar_url, ev.kind, ev.label, ev.at
  from ev join profiles p on p.id = ev.profile_id
  where me() is not null and p.role = 'member'
  order by ev.at desc, ev.kind
  limit 12
$$;
revoke execute on function spotlight(int) from public, anon;
grant execute on function spotlight(int) to authenticated;

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
