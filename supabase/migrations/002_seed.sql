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
  ('Barre', '#c0c7d1', 16, 8),
  ('Parahreysti', '#f2a65a', 16, 9)
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
  ('Parahreysti', 6, '08:30', '09:30'),
  ('Parahreysti', 6, '09:35', '10:35'),
  ('Hreysti', 7, '10:00', '11:00')
) as v(prog, wd, st, et) join programs p on p.name = v.prog
on conflict (program_id, weekday, start_time) do nothing;

select generate_classes(28);
