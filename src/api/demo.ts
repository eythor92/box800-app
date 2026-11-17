// Sýniútgáfa: keyrir NÁKVÆMLEGA sama gagnagrunn og reglur og Supabase,
// en í vafranum (PGlite). Notað til að prófa áður en Supabase er tengt.
import { PGlite } from '@electric-sql/pglite'
import initSql from '../../supabase/migrations/001_init.sql?raw'
import seedSql from '../../supabase/migrations/002_seed.sql?raw'
import resultsSql from '../../supabase/migrations/005_results.sql?raw'
import profileSql from '../../supabase/migrations/007_profile.sql?raw'
import dropinSql from '../../supabase/migrations/008_mynd_dropin.sql?raw'
import accessSql from '../../supabase/migrations/009_adgangur.sql?raw'
import titleSql from '../../supabase/migrations/010_nafn_tima.sql?raw'
import noShowSql from '../../supabase/migrations/011_fjarvist.sql?raw'
import insightSql from '../../supabase/migrations/012_innsyn.sql?raw'
import supportSql from '../../supabase/migrations/013_skilabod.sql?raw'
import promoSql from '../../supabase/migrations/014_samstarf.sql?raw'
import demoSql from '../../supabase/demo/demo_seed.sql?raw'
import type { Api, Profile, Settings, Workout } from './types'

const USERS = [
  { label: 'Eyþór (eigandi)', email: 'eigandi@box800.demo', id: '00000000-0000-0000-0000-000000000001' },
  { label: 'Alda (þjálfari)', email: 'alda@box800.demo', id: '00000000-0000-0000-0000-000000000002' },
  { label: 'Jón Jónsson (iðkandi)', email: 'idkandi@box800.demo', id: '00000000-0000-0000-0000-000000000003' },
  { label: 'Nýr (án áskriftar)', email: 'nyr@box800.demo', id: '00000000-0000-0000-0000-000000000004' },
]

export async function demoApi(): Promise<Api> {
  // Gagnapakki Postgres (sóttur sem .wasm svo allir hýsingaraðilar þjóni honum)
  const fsBundle = await (await fetch(new URL('demo/pgfs.wasm', document.baseURI))).blob()
  const db = new PGlite({ fsBundle })
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `)
  await db.exec(initSql)
  await db.exec(seedSql)
  await db.exec(resultsSql)
  await db.exec(profileSql)
  await db.exec(dropinSql)
  await db.exec(accessSql)
  await db.exec(titleSql)
  await db.exec(noShowSql)
  await db.exec(insightSql)
  await db.exec(supportSql)
  await db.exec(promoSql)
  await db.exec(demoSql)

  let current: string | null = sessionStorageGet()
  const listeners = new Set<() => void>()
  const changed = () => listeners.forEach((f) => f())
  const auth = async () => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [current ?? ''])

  // Raðar köllum svo notandi (jwt) blandist aldrei saman
  let chain: Promise<unknown> = Promise.resolve()
  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(async () => { await auth(); return fn() })
    chain = p.catch(() => undefined)
    return p
  }
  const rows = <T>(sql: string, params: unknown[] = []) =>
    run(async () => {
      try { return (await db.query(sql, params)).rows.map(norm) as T[] } catch (e) { throw new Error((e as Error).message) }
    })
  const one = async <T>(sql: string, params: unknown[] = []) => (await rows<T>(sql, params))[0]
  const write = async (sql: string, params: unknown[] = []) => { await rows(sql, params); changed() }
  const val = async <T>(sql: string, params: unknown[] = []) => {
    const r = await one<Record<string, T>>(sql, params)
    changed()
    return Object.values(r)[0]
  }

  return {
    demo: true,
    demoUsers: () => USERS.map(({ label, email }) => ({ label, email })),
    async session() { return current },
    onAuthChange(cb) { const f = () => cb(); authListeners.add(f); return () => authListeners.delete(f) },
    async signIn(email) {
      const u = USERS.find((x) => x.email === email)
      if (!u) throw new Error('Í prófunarútgáfu: veldu einn af prófunarnotendunum')
      current = u.id; sessionStorageSet(current); authListeners.forEach((f) => f())
    },
    async signUp() { throw new Error('Nýskráning virkar þegar Supabase er tengt') },
    async resetPassword() { throw new Error('Virkar þegar Supabase er tengt') },
    async signOut() { current = null; sessionStorageSet(null); authListeners.forEach((f) => f()) },

    myProfile: () => one<Profile>(`select * from profiles where auth_id = auth.uid()`),
    classList: (from, to) => rows(`select * from class_list($1, $2)`, [from.toISOString(), to.toISOString()]),
    book: (c, p) => val(`select book_class($1, $2)`, [c, p ?? null]),
    cancelBooking: (c, p) => val(`select cancel_booking($1, $2)`, [c, p ?? null]),
    roster: (c) => rows(`select * from class_roster($1)`, [c]),
    setCap: (c, cap, scope) => val(`select set_class_cap($1, $2, $3)`, [c, cap, scope]),
    cancelClass: async (c, cancel, reason) => { await write(`select cancel_class($1, $2, $3)`, [c, cancel, reason ?? null]) },
    setCoach: async (c, coach) => { await write(`select set_class_coach($1, $2)`, [c, coach]) },
    checkIn: async (c, p, on) => { await write(`select check_in($1, $2, $3)`, [c, p, on]) },
    attendees: (c) => rows(`select * from class_attendees($1)`, [c]),
    selfCheckIn: async (c) => { await write(`select self_check_in($1)`, [c]) },
    kioskSignIn: async (c, p) => { await write(`select kiosk_sign_in($1, $2)`, [c, p]) },
    staff: () => rows<Profile>(`select * from profiles where role in ('coach','owner') order by full_name`),
    programs: () => rows(`select * from programs where active order by sort`),
    updateProgramCap: async (id, cap) => { await write(`update programs set default_cap = $2 where id = $1`, [id, cap]) },
    workouts: (from, to) => rows<Workout>(
      `select id, program_id, to_char(day, 'YYYY-MM-DD') as day, components, status, publish_mode, publish_at from workouts
       where day between $1 and $2 and (is_staff() or (status = 'published' and publish_at <= now()))`, [from, to]),
    saveWorkout: async (w) => {
      await write(`insert into workouts (program_id, day, components, status, publish_mode) values ($1, $2, $3, $4, $5)
        on conflict (program_id, day) do update set components = excluded.components, status = excluded.status, publish_mode = excluded.publish_mode`,
        [w.program_id, w.day, JSON.stringify(w.components), w.status, w.publish_mode])
    },
    settings: () => one<Settings>(`select * from settings where id = 1`),
    saveSettings: async (s) => {
      await write(`update settings set auto_cancel_stop=$13, open_mode=$10, open_days=$11, open_time=$12, open_minutes=$1, close_minutes=$2, cancel_minutes=$3, waitlist_on=$4, waitlist_mode=$5,
        waitlist_limit=$6, auto_cancel_on=$7, auto_cancel_minutes=$8, auto_cancel_min=$9 where id = 1`,
        [s.open_minutes, s.close_minutes, s.cancel_minutes, s.waitlist_on, s.waitlist_mode, s.waitlist_limit, s.auto_cancel_on, s.auto_cancel_minutes, s.auto_cancel_min, s.open_mode, s.open_days, s.open_time, s.auto_cancel_stop])
    },
    members: () => rows(`select * from member_overview()`),
    createMember: async (m) => {
      await write(`insert into profiles (full_name, email, phone, kennitala, note, emergency, is_dependent) values ($1, lower($2), $3, $4, $5, $6, $7)`,
        [m.full_name, m.email, m.phone ?? null, m.kennitala ?? null, m.note ?? null, m.emergency ?? null, !!m.is_dependent])
    },
    searchProfiles: (q) => rows<Profile>(`select * from profiles where full_name ilike $1 order by full_name limit 8`, ['%' + q + '%']),
    myAttendance: () => rows(`select * from my_attendance()`),
    notifications: () => rows(`select * from notifications where profile_id = me() order by created_at desc limit 40`),
    insights: (f, t) => rows(`select * from insights($1, $2)`, [f, t]),
    insightsSummary: (f, t) => one(`select * from insights_summary($1, $2)`, [f, t]),
    noShowCount: (id) => one<{ n: number }>(`select no_show_count($1) n`, [id]).then((r) => Number(r?.n ?? 0)),
    sendSupport: async (w, ph, b) => { await write(`select send_support_message($1, $2, $3)`, [w, ph, b]) },
    supportPending: () => one<{ t: string | null }>(`select my_support_pending() t`).then((r) => r?.t ?? null),
    supportInbox: () => rows(`select * from support_inbox()`),
    supportHandled: async (id) => { await write(`select support_handled($1)`, [id]) },
    myPromos: () => rows(`select * from my_promos()`),
    promoEvent: async (id, k) => { await write(`select promo_event($1, $2)`, [id, k]) },
    promos: () => rows(`select *, starts_on::text as starts_on, ends_on::text as ends_on from promos where is_owner() order by created_at desc`),
    savePromo: async (p) => {
      const v = [p.partner, p.title, p.body, p.code, p.url, p.logo_url, p.audience_plan, p.starts_on, p.ends_on, p.active]
      if (p.id) await write(`update promos set partner=$1, title=$2, body=$3, code=$4, url=$5, logo_url=$6, audience_plan=$7, starts_on=$8, ends_on=$9, active=$10 where id=$11 and is_owner()`, [...v, p.id])
      else await write(`insert into promos (partner, title, body, code, url, logo_url, audience_plan, starts_on, ends_on, active) select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 where is_owner()`, v)
    },
    deletePromo: async (id) => { await write(`delete from promos where id = $1 and is_owner()`, [id]) },
    promoReach: (plan) => one<{ n: number }>(`select promo_reach($1) n`, [plan ?? '']).then((r) => Number(r?.n ?? 0)),
    uploadPromoLogo: (img) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(img) }),
    markNotificationRead: async (id) => { await write(`update notifications set read_at = now() where id = $1 and profile_id = me()`, [id]) },
    markNotificationsRead: async () => { await write(`update notifications set read_at = now() where profile_id = me() and read_at is null`) },
    movements: () => rows(`select * from movements where active order by sort, name`),
    addMovement: async (name) => { const r = await one<{ id: number; name: string; sort: number }>(`insert into movements (name) values ($1) returning *`, [name.trim()]); changed(); return r },
    saveResult: (r) => val(`select save_result($1)`, [JSON.stringify(r)]).then(Number),
    deleteResult: async (id) => { await write(`select delete_result($1)`, [id]) },
    myComponentResults: (f, t) => rows(`select *, to_char(day, 'YYYY-MM-DD') as day from my_component_results($1, $2)`, [f, t]).then(numify),
    liftHistory: (m) => rows(`select *, to_char(day, 'YYYY-MM-DD') as day from lift_history($1)`, [m]).then(numify),
    myLifts: () => rows(`select *, to_char(last_day, 'YYYY-MM-DD') as last_day from my_lifts()`).then(numify),
    getProfile: (id) => one<Profile>(`select *, to_char(birth_date, 'YYYY-MM-DD') as birth_date, to_char(member_since, 'YYYY-MM-DD') as member_since from profiles where id = $1`, [id]),
    updateProfile: async (id, patch) => {
      const keys = Object.keys(patch).filter((k) => /^[a-z_]+$/.test(k))
      if (!keys.length) return
      await write(`update profiles set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`, [id, ...keys.map((k) => (patch as Record<string, unknown>)[k] ?? null)])
    },
    deleteProfile: async (id) => { await write(`delete from profiles where id = $1`, [id]) },
    membershipsOf: (id) => rows(`select id, plan, to_char(starts_on, 'YYYY-MM-DD') starts_on, to_char(ends_on, 'YYYY-MM-DD') ends_on, status, source from memberships where profile_id = $1 order by starts_on desc`, [id]),
    attendanceOf: (id) => rows(`select * from my_attendance($1)`, [id]),
    liftsOf: (id) => rows(`select *, to_char(last_day, 'YYYY-MM-DD') as last_day from my_lifts($1)`, [id]).then(numify),
    addMembership: async (m) => { await write(`insert into memberships (profile_id, plan, starts_on, ends_on) values ($1, $2, $3, $4)`, [m.profile_id, m.plan, m.starts_on, m.ends_on]) },
    endMembership: async (id) => { await write(`update memberships set status = 'cancelled' where id = $1`, [id]) },
    uploadAvatar: async (pid, jpeg) => {
      const url = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(jpeg) })
      await write(`update profiles set avatar_url = $2 where id = $1`, [pid, url]); return url
    },
    addClass: async (c) => { await write(`insert into classes (program_id, starts_at, ends_at, cap, coach_id, title) values ($1, $2, $3, $4, $5, $6)`, [c.program_id, c.starts_at, c.ends_at, c.cap, c.coach_id, c.title]) },
    renameClass: async (id, title) => { await write(`update classes set title = $2 where id = $1`, [id, title]) },
    staffAdd: (c, p, w) => val(`select staff_add($1, $2, $3)`, [c, p, w]),
    createDropin: (n, e, ph) => val(`select create_dropin($1, $2, $3)`, [n, e ?? null, ph ?? null]),
    hasAccess: () => one<{ a: boolean }>(`select has_access() a`).then((r) => !!r?.a),
    leaderboard: (w, k) => rows(`select * from component_leaderboard($1, $2)`, [w, k]).then(numify),
    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb) },
  }
}

const authListeners = new Set<() => void>()
// numeric kemur sem strengur; breytum í tölu
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function numify<T>(rs: T[]): any {
  for (const r of rs as Record<string, unknown>[]) for (const k of ['weight', 'score_num', 'best', 'best_1rm', 'id', 'workout_id']) if (typeof r[k] === 'string') r[k] = Number(r[k])
  return rs
}
// PGlite skilar Date-hlutum; Supabase skilar ISO-strengjum. Samræmum.
function norm(r: unknown): unknown {
  const o = r as Record<string, unknown>
  for (const k in o) if (o[k] instanceof Date) o[k] = (o[k] as Date).toISOString()
  return o
}
function sessionStorageGet(): string | null { try { return sessionStorage.getItem('box800-demo-user') } catch { return null } }
function sessionStorageSet(v: string | null) { try { if (v) sessionStorage.setItem('box800-demo-user', v); else sessionStorage.removeItem('box800-demo-user') } catch { /* ekkert */ } }
