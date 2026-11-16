-- Prufugögn fyrir sýniútgáfuna (keyrt BARA í vafranum í demo-ham, aldrei í Supabase)

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'eigandi@box800.demo'),
  ('00000000-0000-0000-0000-000000000002', 'alda@box800.demo'),
  ('00000000-0000-0000-0000-000000000003', 'idkandi@box800.demo');

update profiles set role = 'owner', full_name = 'Eyþór Stefánsson', avatar_url = 'myndir/eythor.jpg' where email = 'eigandi@box800.demo';
update profiles set role = 'coach', full_name = 'Alda Kristinsdóttir', avatar_url = 'myndir/alda.jpg' where email = 'alda@box800.demo';
update profiles set full_name = 'Sigrún Prufa' where email = 'idkandi@box800.demo';

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
  {"type":"metcon","title":"Vikan framundan","body":"Mán: hyrox amrap\nÞri: bekkpressa + styrkur\nMið: amröp\nFim: hnébeygjur + emom\nFös: interval","scoring":"Engin skráning"},
  {"type":"metcon","title":"Æfing dagsins","body":"AMRAP 28\n20 thrusters m. 1 db / goblet squat\n*15/12 cal tæki*\n20 alt. db snatch / hang db snatch\n*15/12 cal tæki*\n20 framstig m. 1 db / án db\n*15/12 cal tæki*\n20 burpees / sprawl\n*15/12 cal tæki*","scoring":"Umferðir + endurtekningar","scaling":"Scaled / Rx"}
]'::jsonb from programs where name in ('Hreysti', 'Karlahreysti');

insert into workouts (program_id, day, status, publish_mode, components)
select id, current_date + 1, 'draft', 'evening_before', '[
  {"type":"metcon","title":"Styrkur","body":"Bekkpressa 5x5\nSíðan:\n3 umferðir\n10 róður m. lóðum\n12 axlapressa\n*200 m hlaup*","scoring":"Þyngd (kg)"}
]'::jsonb from programs where name = 'Hreysti';
