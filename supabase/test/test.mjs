// Prófar gagnagrunninn í PGlite (Postgres í minni) – engin tenging við Supabase
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const dir = new URL('../migrations/', import.meta.url);
const db = new PGlite();
const q = (s, p) => db.query(s, p).then(r => r.rows);
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const as = async (authId) => db.exec(`select set_config('request.jwt.claim.sub', '${authId || ''}', false)`);
const expectErr = async (fn, txt, msg) => { try { await fn(); ok(false, msg + ' (engin villa)'); } catch (e) { ok(e.message.includes(txt), msg + ' → ' + e.message); } };

await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`);
try { await db.exec(fs.readFileSync(new URL('001_init.sql', dir), 'utf8')); } catch (e) { console.log('VILLA 001:', e.message, e.position); process.exit(1); }
await db.exec(fs.readFileSync(new URL('002_seed.sql', dir), 'utf8'));
try { await db.exec(fs.readFileSync(new URL('005_results.sql', dir), 'utf8')); } catch (e) { console.log('VILLA 005:', e.message, e.position); process.exit(1); }
console.log('Uppsetning tókst');

// Notendur
const U = { eythor: '00000000-0000-0000-0000-000000000001', alda: '00000000-0000-0000-0000-000000000002' };
const members = [];
await q(`insert into profiles (full_name, email, wodify_id) values ('Sigrún Wodify', 'sigrun@test.is', 42)`);
await q(`insert into auth.users (id, email) values ($1, 'eythor@test.is'), ($2, 'alda@test.is')`, [U.eythor, U.alda]);
await q(`update profiles set role = 'owner', full_name = 'Eyþór' where auth_id = $1`, [U.eythor]);
await q(`update profiles set role = 'coach', full_name = 'Alda' where auth_id = $1`, [U.alda]);
for (let i = 0; i < 6; i++) {
  const id = `10000000-0000-0000-0000-00000000000${i}`;
  await q(`insert into auth.users (id, email) values ($1, $2)`, [id, i === 0 ? 'SIGRUN@test.is' : `m${i}@test.is`]);
  members.push(id);
}
const linked = await q(`select full_name, auth_id from profiles where wodify_id = 42`);
ok(linked[0].auth_id === members[0], 'Nýr notandi tengist prófíl úr Wodify með sama netfangi (óháð há/lágstöfum)');
const pid = async (a) => (await q(`select id from profiles where auth_id = $1`, [a]))[0].id;

// Áskrift fyrir alla nema m5
for (let i = 0; i < 5; i++) await q(`insert into memberships (profile_id, plan) values ($1, '12 mánaða samningur')`, [await pid(members[i])]);

const n = (await q(`select count(*)::int c from classes`))[0].c;
ok(n > 150, `generate_classes bjó til ${n} tíma`);

// Tími á morgun kl. 16:30 sem er ekki of langt fram í tímann: búum til tíma eftir 10 klst. með hámarki 2
const [cls] = await q(`insert into classes (program_id, starts_at, ends_at, cap) select id, now() + interval '10 hours', now() + interval '11 hours', 2 from programs where name = 'Hreysti' returning id`);
const C = cls.id;

await as(members[0]); ok(await q(`select book_class($1) s`, [C]).then(r => r[0].s) === 'booked', 'm0 bókar → booked');
await as(members[1]); ok(await q(`select book_class($1) s`, [C]).then(r => r[0].s) === 'booked', 'm1 bókar → booked (fullt núna)');
await as(members[2]); ok(await q(`select book_class($1) s`, [C]).then(r => r[0].s) === 'waitlist', 'm2 → biðlisti');
await as(members[3]); ok(await q(`select book_class($1) s`, [C]).then(r => r[0].s) === 'waitlist', 'm3 → biðlisti');
await as(members[5]); await expectErr(() => q(`select book_class($1)`, [C]), 'áskrift', 'm5 án áskriftar fær ekki að bóka');

await as(members[3]);
let list = await q(`select booked, waiting, my_status, my_position, cap from class_list(now(), now() + interval '1 day') where id = $1`, [C]);
ok(list[0].booked === 2 && list[0].waiting === 2 && list[0].my_position === 2, 'class_list: 2 skráðir, 2 á biðlista, m3 er nr. 2');

await as(members[0]); await q(`select cancel_booking($1)`, [C]);
const st = async (i) => (await q(`select status from bookings where class_id = $1 and profile_id = $2`, [C, await pid(members[i])]))[0]?.status;
ok(await st(0) === 'cancelled' && await st(2) === 'booked' && await st(3) === 'waitlist', 'm0 afbókar → m2 (fyrst á biðlista) fer sjálfkrafa inn');
const notif = await q(`select title from notifications where profile_id = $1`, [await pid(members[2])]);
ok(notif.length === 1 && notif[0].title.includes('fékkst pláss'), 'm2 fær tilkynningu: ' + notif[0]?.title);

await as(members[0]); ok(await q(`select book_class($1) s`, [C]).then(r => r[0].s) === 'waitlist', 'm0 bókar aftur → aftast á biðlista (á eftir m3)');

await as(members[4]); await expectErr(() => q(`select set_class_cap($1, 5)`, [C]), 'þjálfar', 'Iðkandi má ekki breyta hámarki');
await as(U.alda); const prom = await q(`select set_class_cap($1, 4) n`, [C]);
ok(prom[0].n === 2 && await st(3) === 'booked' && await st(0) === 'booked', 'Þjálfari hækkar hámark í 4 → 2 fara sjálfkrafa inn af biðlista');

await as(U.alda); await q(`select cancel_booking($1, $2)`, [C, await pid(members[1])]);
ok(await st(1) === 'cancelled', 'Þjálfari afskráir iðkanda');
await as(U.alda); ok(await q(`select book_class($1, $2) s`, [C, await pid(members[5])]).then(r => r[0].s) === 'booked', 'Þjálfari bætir við iðkanda án áskriftar (má)');

const roster = await q(`select full_name, status from class_roster($1)`, [C]);
ok(roster.length === 4, 'Nafnalisti sýnir 4 skráða');
await as(members[4]); ok((await q(`select * from class_roster($1)`, [C])).length === 0, 'Iðkandi sér ekki nafnalista');

// Afbókun of seint
const [late] = await q(`insert into classes (program_id, starts_at, ends_at) select id, now() + interval '10 minutes', now() + interval '1 hour' from programs where name = 'Hreysti' returning id`);
await as(U.alda); await q(`select book_class($1, $2)`, [late.id, await pid(members[4])]);
await as(members[4]); ok(await q(`select cancel_booking($1) s`, [late.id]).then(r => r[0].s) === 'late_cancel', 'Afbókun innan 30 mín. → late_cancel');

// Síðustu 30 mín.: laust pláss fer til þess sem bókar, þó aðrir bíði
await q(`insert into bookings (class_id, profile_id, status, waitlist_at) values ($1, $2, 'waitlist', now())`, [late.id, await pid(members[3])]);
await as(members[2]); ok(await q(`select book_class($1) s`, [late.id]).then(r => r[0].s) === 'booked', 'Innan 30 mín.: laust pláss bókast beint');

// Bókanir ekki opnar
const [far] = await q(`insert into classes (program_id, starts_at, ends_at) select id, now() + interval '3 days', now() + interval '3 days 1 hour' from programs where name = 'Hreysti' returning id`);
await as(members[4]); await expectErr(() => q(`select book_class($1)`, [far.id]), 'ekki opnar', 'Ekki hægt að bóka 3 dögum fyrir (opnar 1230 mín. fyrir)');

// Aflýsa tíma
await as(U.alda); await q(`select cancel_class($1, true, 'Veikindi')`, [C]);
const cn = await q(`select count(*)::int c from notifications where class_id = $1 and title like '%aflýst%'`, [C]);
ok(cn[0].c >= 4, `Aflýsing: ${cn[0].c} fengu tilkynningu`);
await as(members[4]); await expectErr(() => q(`select book_class($1)`, [C]), 'aflýst', 'Ekki hægt að bóka aflýstan tíma');

// Æfingar: birtast kl. 20 kvöldið áður
await as(U.eythor);
await q(`insert into workouts (program_id, day, components, status) select id, current_date + 1, '[]', 'published' from programs where name = 'Hreysti'`);
const w = await q(`select publish_at at time zone 'Atlantic/Reykjavik' t from workouts`);
ok(String(w[0].t).includes('20:00') || new Date(w[0].t).getUTCHours() === 20, 'Æfing birtist kl. 20:00 kvöldið áður: ' + w[0].t);

// Hlutverk
await as(members[4]); await q(`update profiles set role = 'owner' where auth_id = $1`, [members[4]]);
ok((await q(`select role from profiles where auth_id = $1`, [members[4]]))[0].role === 'member', 'Iðkandi getur ekki gert sig að eiganda');

await as(U.eythor); const ov = await q(`select * from member_overview()`); ok(ov.length >= 8, 'member_overview: ' + ov.length + ' prófílar');
await as(members[4]); ok((await q(`select * from member_overview()`)).length === 0, 'Iðkandi sér ekki iðkendalista');
// Bókanir opna á föstum tíma (kl. 12:00 daginn áður)
await as(U.eythor);
const [oa] = await q(`select booking_opens_at(c) t, (c.starts_at at time zone 'Atlantic/Reykjavik')::date d from classes c where id = $1`, [far.id]);
const exp = new Date(new Date(oa.d).getTime() - 86400000); exp.setUTCHours(12, 0, 0, 0);
ok(new Date(oa.t).getTime() === exp.getTime(), 'Opnar kl. 12:00 daginn áður: ' + new Date(oa.t).toISOString());
await q(`update settings set open_mode = 'relative', open_minutes = 60`);
const [ob] = await q(`select booking_opens_at(c) t, c.starts_at s from classes c where id = $1`, [far.id]);
ok(new Date(ob.s) - new Date(ob.t) === 3600000, 'Afstætt: 60 mín. fyrir tímann');
await q(`update settings set open_mode = 'fixed'`);

// Biðlisti færist sjálfkrafa inn þar til 10 mín. fyrir tímann
await as(U.eythor);
const [w20] = await q(`insert into classes (program_id, starts_at, ends_at, cap) select id, now() + interval '20 minutes', now() + interval '80 minutes', 1 from programs where name = 'Hreysti' returning id`);
await as(members[0]); await q(`select book_class($1)`, [w20.id]);
await as(members[1]); ok((await q(`select book_class($1) s`, [w20.id]))[0].s === 'waitlist', '20 mín. fyrir: fullt → biðlisti');
await as(members[0]); await q(`select cancel_booking($1)`, [w20.id]);
ok((await q(`select status from bookings where class_id = $1 and profile_id = $2`, [w20.id, await pid(members[1])]))[0].status === 'booked', 'Afbókun 20 mín. fyrir: fyrsti á biðlista fer sjálfkrafa inn');

// Fellur niður 2 klst. fyrir ef 3 eða færri eru skráðir
await as(U.eythor);
const mk = async (mins) => (await q(`insert into classes (program_id, starts_at, ends_at) select id, now() + make_interval(mins => $1), now() + make_interval(mins => $1 + 60) from programs where name = 'Hreysti' returning id`, [mins]))[0].id;
const few = await mk(115), many = await mk(116), early = await mk(200);
for (let i = 0; i < 3; i++) await q(`insert into bookings (class_id, profile_id, status) values ($1, $2, 'booked')`, [few, await pid(members[i])]);
for (let i = 0; i < 4; i++) await q(`insert into bookings (class_id, profile_id, status) values ($1, $2, 'booked')`, [many, await pid(members[i])]);
await q(`select auto_cancel_low()`);
const cs = async (id) => (await q(`select cancelled_at is not null c from classes where id = $1`, [id]))[0].c;
ok(await cs(few) === true, '3 skráðir, 2 klst. fyrir → tíminn fellur niður');
ok(await cs(many) === false, '4 skráðir → tíminn heldur');
ok(await cs(early) === false, '3+ klst. fyrir → ekki ákveðið enn');
ok((await q(`select count(*)::int n from notifications where class_id = $1`, [few]))[0].n >= 3, 'Þeir skráðu fá tilkynningu');

// Skráðir og innskráning iðkanda sjálfs
await as(members[2]);
ok((await q(`select * from class_attendees($1)`, [late.id])).length >= 1, 'Iðkandi sér hverjir eru skráðir');
await q(`select self_check_in($1)`, [late.id]);
ok((await q(`select checked_in from class_attendees($1) where is_me`, [late.id]))[0].checked_in === true, 'Iðkandi skráði sig sjálf(ur) inn');
await expectErr(() => q(`select self_check_in($1)`, [far.id]), '30 mín', 'Ekki hægt að skrá sig inn löngu fyrir tímann');

// Skor
const [bs] = await q(`select id from movements where name = 'Back Squat'`);
const [wk] = await q(`select id from workouts limit 1`);
await as(members[1]);
const r1 = (await q(`select save_result($1) id`, [{ workout_id: wk.id, comp_key: 'a', movement_id: bs.id, sets: 1, reps: 5, weight: 80, kind: 'weight', score_num: 80, score_text: '1 x 5 @ 80' }]))[0].id;
const r1b = (await q(`select save_result($1) id`, [{ workout_id: wk.id, comp_key: 'a', movement_id: bs.id, sets: 1, reps: 5, weight: 85, kind: 'weight', score_num: 85 }]))[0].id;
ok(String(r1) === String(r1b), 'Sama hluta skráð aftur → skorið uppfærist (ekki tvítekið)');
await q(`select save_result($1)`, [{ movement_id: bs.id, sets: 1, reps: 1, weight: 110, day: '2026-01-10', kind: 'weight', score_num: 110 }]);
ok((await q(`select * from lift_history($1)`, [bs.id])).length === 2, 'Saga: 2 skráningar í Back Squat');
ok(Number((await q(`select * from my_lifts()`))[0].best_1rm) === 110, 'Besta 1RM = 110');
await as(members[2]);
await q(`select save_result($1)`, [{ workout_id: wk.id, comp_key: 'a', movement_id: bs.id, sets: 1, reps: 5, weight: 100, kind: 'weight', score_num: 100 }]);
ok((await q(`select * from component_leaderboard($1, 'a')`, [wk.id])).length === 2, 'Stigatafla sýnir alla sem skráðu');
ok((await q(`select * from lift_history($1, $2)`, [bs.id, await pid(members[1])])).length === 0, 'Iðkandi sér ekki sögu annarra');
await expectErr(() => q(`select save_result($1)`, [{ id: r1, weight: 1 }]), 'fannst ekki', 'Iðkandi getur ekki breytt skori annars');
await as(U.alda); ok((await q(`select * from lift_history($1, $2)`, [bs.id, await pid(members[1])])).length === 2, 'Þjálfari sér sögu iðkanda');

console.log(fails ? `\n${fails} próf féllu` : '\nÖll próf stóðust');
process.exit(fails ? 1 : 0);
