-- Prufugögn fyrir sýniútgáfuna (keyrt BARA í vafranum í demo-ham, aldrei í Supabase)

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'eigandi@box800.demo'),
  ('00000000-0000-0000-0000-000000000002', 'alda@box800.demo'),
  ('00000000-0000-0000-0000-000000000003', 'idkandi@box800.demo');

update profiles set role = 'owner', full_name = 'Eyþór Stefánsson', avatar_url = 'myndir/eythor.jpg' where email = 'eigandi@box800.demo';
update profiles set role = 'coach', full_name = 'Alda Kristinsdóttir', avatar_url = 'myndir/alda.jpg' where email = 'alda@box800.demo';
update profiles set full_name = 'Jón Jónsson' where email = 'idkandi@box800.demo';

insert into profiles (full_name, role, avatar_url) values
  ('Valgerður Jónsdóttir', 'coach', 'myndir/valla.jpg'),
  ('Elísa Dagmar Björgvinsdóttir', 'coach', 'myndir/elisa.jpg'),
  ('Jóhanna', 'coach', 'myndir/johanna.jpg'),
  ('Hermann Valdi Valbjörnsson', 'coach', 'myndir/valdi.jpg'),
  ('Heiðar Halldórsson', 'coach', 'myndir/heidar.jpg'),
  ('Hjördís Björg Viðjudóttir', 'coach', 'myndir/hjordis.jpg');

-- Þjálfarar á föstu tímatöflunni (dreift)
update class_slots s set coach_id = (
  select id from profiles where role in ('coach', 'owner') order by md5(s.id::text || full_name) limit 1);
update classes c set coach_id = s.coach_id from class_slots s where s.id = c.slot_id;

-- Iðkendur með áskrift
insert into profiles (full_name, email)
select f || ' ' || l, lower(f) || i || '@demo.is'
from unnest(array['Anna','Arnar','Ásdís','Birgir','Bryndís','Dagný','Davíð','Edda','Einar','Elín','Fanney','Gísli','Guðrún','Halldóra','Hildur','Ingvar','Jóhanna','Karen','Kristján','Lilja','Margrét','Ólafur','Ragnhildur','Sara','Sigurður','Sólrún','Steinunn','Tómas'])
  with ordinality as a(f, i)
cross join lateral (select (array['Jónsdóttir','Sigurðsson','Magnúsdóttir','Gunnarsson','Ólafsdóttir','Helgason','Björnsdóttir','Einarsson'])[1 + (i % 8)] as l) x;

insert into memberships (profile_id, plan, ends_on)
select id, (array['12 mánaða samningur','1 mánuður','3 mánuðir','10 skipta kort'])[1 + (abs(hashtext(full_name)) % 4)],
       case when abs(hashtext(full_name)) % 7 = 0 then current_date + 6 end
from profiles where role = 'member';

-- Bókanir í tímum dagsins og morgundagsins (fyllum suma)
insert into bookings (class_id, profile_id, status)
select c.id, p.id, 'booked'
from classes c
cross join lateral (
  select id from profiles where role = 'member' and email <> 'idkandi@box800.demo'
  order by md5(c.id::text || id::text)
  limit least(class_cap(c), 4 + abs(hashtext(c.id::text)) % (class_cap(c) - 2))
) p
where c.starts_at::date between current_date - 1 and current_date + 1;

-- Einn fullur tími á morgun með biðlista
with t as (
  select c.id from classes c join programs p on p.id = c.program_id
  where p.name = 'Hreysti' and c.starts_at::date = current_date + 1 order by c.starts_at desc limit 1
)
insert into bookings (class_id, profile_id, status)
select t.id, pr.id, 'booked' from t cross join lateral (
  select id from profiles where role = 'member' and email <> 'idkandi@box800.demo'
    and id not in (select profile_id from bookings where class_id = t.id) limit 30) pr
on conflict do nothing;
with t as (
  select c.id, class_cap(c) cap from classes c join programs p on p.id = c.program_id
  where p.name = 'Hreysti' and c.starts_at::date = current_date + 1 order by c.starts_at desc limit 1
), extra as (
  select b.id, row_number() over (order by b.id) rn from bookings b join t on t.id = b.class_id where b.status = 'booked'
)
update bookings set status = 'waitlist', waitlist_at = now() - (rn || ' minutes')::interval
from extra, t where bookings.id = extra.id and extra.rn > t.cap;

-- Saga prufuiðkandans
insert into bookings (class_id, profile_id, status, checked_in_at)
select c.id, (select id from profiles where email = 'idkandi@box800.demo'), 'booked', c.starts_at
from classes c where c.starts_at < now() and c.starts_at > now() - interval '2 days'
order by c.starts_at desc limit 2 on conflict do nothing;

-- Æfing dagsins
insert into workouts (program_id, day, status, publish_mode, components)
select id, current_date, 'published', 'evening_before', '[
  {"type":"metcon","key":"vika","title":"Vikan framundan","body":"Mán: hyrox amrap\nÞri: bekkpressa + styrkur\nMið: amröp\nFim: hnébeygjur + emom\nFös: interval","scoring":"Engin skráning"},
  {"type":"metcon","key":"wod","title":"Æfing dagsins","body":"AMRAP 28\n20 thrusters m. 1 db / goblet squat\n*15/12 cal tæki*\n20 alt. db snatch / hang db snatch\n*15/12 cal tæki*\n20 framstig m. 1 db / án db\n*15/12 cal tæki*\n20 burpees / sprawl\n*15/12 cal tæki*","scoring":"Umferðir + endurtekningar","scaling":"Scaled / Rx"}
]'::jsonb from programs where name in ('Hreysti', 'Karlahreysti');

insert into workouts (program_id, day, status, publish_mode, components)
select id, current_date + 1, 'draft', 'evening_before', '[
  {"type":"metcon","title":"Styrkur","body":"Bekkpressa 5x5\nSíðan:\n3 umferðir\n10 róður m. lóðum\n12 axlapressa\n*200 m hlaup*","scoring":"Þyngd (kg)"}
]'::jsonb from programs where name = 'Hreysti';

-- Skor og árangur (demo þarf 005_results.sql)
update workouts w set components = jsonb_build_array(jsonb_build_object(
    'type', 'lift', 'key', 'bs', 'title', 'Back Squat', 'movement_id', (select id from movements where name = 'Back Squat'),
    'sets', 1, 'reps', 5, 'body', E'Á hverjum 3:00 x 5\n5 back squat\n20/20s copenhagen plank', 'scoring', 'Þyngd (kg)')) || w.components
from programs p where p.id = w.program_id and p.name = 'Hreysti' and w.day = current_date;

-- Saga Jóns (prufuiðkanda)
insert into results (profile_id, day, movement_id, sets, reps, weight, kind, score_num)
select (select id from profiles where email = 'idkandi@box800.demo'), current_date - d, m.id, 1, r, w, 'weight', w
from (values
  ('Back Squat', 300, 5, 60), ('Back Squat', 240, 5, 65), ('Back Squat', 180, 1, 80), ('Back Squat', 120, 5, 70), ('Back Squat', 60, 1, 85), ('Back Squat', 21, 3, 80),
  ('Deadlift', 200, 5, 80), ('Deadlift', 100, 1, 110), ('Deadlift', 30, 3, 105),
  ('Bench Press', 150, 5, 40), ('Bench Press', 45, 5, 45), ('Bench Press', 14, 1, 52.5)
) v(mv, d, r, w) join movements m on m.name = v.mv;

-- Aðrir iðkendur á stigatöflu dagsins
insert into results (profile_id, day, workout_id, comp_key, movement_id, sets, reps, weight, kind, score_num)
select pr.id, current_date, w.id, 'bs', (select id from movements where name = 'Back Squat'), 1, 5,
       (array[105, 90, 70, 70, 70, 60, 55, 82.5])[row_number() over (order by pr.full_name)], 'weight',
       (array[105, 90, 70, 70, 70, 60, 55, 82.5])[row_number() over (order by pr.full_name)]
from (select id, full_name from profiles where role = 'member' and email <> 'idkandi@box800.demo' order by full_name limit 8) pr,
     workouts w join programs p on p.id = w.program_id
where p.name = 'Hreysti' and w.day = current_date;
insert into results (profile_id, day, workout_id, comp_key, kind, score_num, score_text, rx)
select pr.id, current_date, w.id, 'wod', 'rounds', v.n, (v.n / 1000) || ' + ' || (v.n % 1000), v.rx
from (select id, row_number() over (order by full_name desc) rn from profiles where role = 'member' and email <> 'idkandi@box800.demo' limit 6) pr
join (values (1, 6040, 'Rx'), (2, 5120, 'Rx'), (3, 6010, 'Scaled'), (4, 5120, 'Rx'), (5, 4300, 'Scaled'), (6, 7002, 'Rx')) v(rn, n, rx) on v.rn = pr.rn,
     workouts w join programs p on p.id = w.program_id
where p.name = 'Hreysti' and w.day = current_date;


-- Nýr iðkandi sem hefur stofnað aðgang en er ekki kominn með áskrift (sér aðeins forsíðu)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000004', 'nyr@box800.demo');
update profiles set full_name = 'Nýr Iðkandi' where email = 'nyr@box800.demo';

-- Áminning um fjarvist fyrir Jón (prufa á glugganum)
insert into notifications (profile_id, title, body, kind)
select id, 'Við söknuðum þín í Hreysti 17:35 (' || to_char(current_date - 1, 'DD.MM.') || ')',
       'Þú varst skráður en komst ekki. Ekkert mál! Mundu bara að afbóka ef þú kemst ekki.', 'no_show'
from profiles where email = 'idkandi@box800.demo';
update profiles set gender = 'karl' where email = 'idkandi@box800.demo';

-- Nokkrar fjarvistir í gær (fyrir Innsýn)
update bookings set status = 'no_show'
where id in (select b.id from bookings b join classes c on c.id = b.class_id
             where c.starts_at::date = current_date - 1 and b.status = 'booked' order by md5(b.id::text) limit 9);

-- Skilaboð frá iðkanda sem kemst ekki inn (fyrir innhólf eiganda)
insert into support_messages (profile_id, what, phone, body, created_at)
select id, 'Áskrift', '8671234', 'Keypti áskrift á Abler í gær en appið segir að ég sé ekki með kort.', now() - interval '2 hours'
from profiles where role = 'member' and full_name <> 'Jón Jónsson' order by full_name offset 3 limit 1;

-- Samstarf: dæmi um kynningu fyrir Mömmuhreysti-áskrift
insert into promos (partner, title, body, code, url, audience_plan, copies, clicks)
values ('Yrja', '20% afsláttur í vefverslun', 'Fyrir mömmurnar í Mömmuhreysti. Gildir út desember.', 'BOX800', 'yrja.is', 'Mömmuhreysti', 7, 12);
insert into memberships (profile_id, plan)
select id, 'Mömmuhreysti' from profiles where role = 'member' and full_name like '%dóttir' order by full_name limit 4;

-- Klippikort fyrir Jón (sýnir „skipti eftir“ á forsíðu)
update memberships m set plan = '10 skipta kort', punches = 10, punches_before = 3, ends_on = current_date + 325
from profiles p where p.id = m.profile_id and p.full_name = 'Jón Jónsson';

-- Einkaþjálfun fyrir Jón (1 on 1)
insert into memberships (profile_id, plan) select id, 'Einkaþjálfun' from profiles where full_name = 'Jón Jónsson';
insert into pt_workouts (profile_id, day, status, components)
select id, current_date, 'published', '[{"type":"header","title":"Upphitun","key":"p1"},{"type":"metcon","title":"10 mín","body":"Hjól rólega\n10 air squats\n10 armbeygjur","key":"p2"},{"type":"metcon","title":"Styrkur","body":"*4 umferðir*\n8 goblet squat\n10 róður á hvora hendi\n30s planki","key":"p3"}]'
from profiles where full_name = 'Jón Jónsson';

-- Myndband frá Jóni með endurgjöf
insert into pt_videos (profile_id, day, path, note, size_bytes, created_at, feedback, feedback_at)
select id, current_date - 1, id || '/demo.mp4', 'Er bakið nógu beint í neðstu stöðu?', 24000000, now() - interval '20 hours',
       'Mjög flott! Bakið er beint. Prófaðu að ýta hnjánum aðeins meira út í botninum.', now() - interval '18 hours'
from profiles where full_name = 'Jón Jónsson';

-- Tilkynning til eiganda um myndband (með hlekk)
insert into notifications (profile_id, title, body, kind, link)
select o.id, 'Nýtt myndband: Jón Jónsson', 'Er bakið nógu beint í neðstu stöðu?', 'pt_video', '/stjorn/idkendur/' || j.id || '?t=pt'
from profiles o, profiles j where o.role = 'owner' and j.full_name = 'Jón Jónsson';
