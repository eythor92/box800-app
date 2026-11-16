import { createClient } from '@supabase/supabase-js'
import type { Api, Profile } from './types'

export function supabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })

  const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
    if (r.error) throw new Error(r.error.message)
    return r.data as NonNullable<T>
  }
  const rpc = async <T>(fn: string, args?: Record<string, unknown>) => must<T>(await sb.rpc(fn, args) as never)
  const uid = async () => (await sb.auth.getUser()).data.user?.id ?? null

  return {
    demo: false,
    async session() { return (await sb.auth.getSession()).data.session?.user.id ?? null },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb())
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Rangt netfang eða lykilorð' : error.message)
    },
    async signUp(email, password, fullName) {
      const { data, error } = await sb.auth.signUp({
        email, password, options: { data: { full_name: fullName }, emailRedirectTo: location.origin + location.pathname },
      })
      if (error) throw new Error(error.message)
      return data.session ? 'ok' : 'confirm'
    },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/nytt-lykilord' })
      if (error) throw new Error(error.message)
    },
    async signOut() { await sb.auth.signOut() },

    async myProfile() {
      const id = await uid()
      if (!id) return null
      const r = await sb.from('profiles').select('*').eq('auth_id', id).maybeSingle()
      if (r.error) throw new Error(r.error.message)
      return r.data as Profile | null
    },
    classList: (from, to) => rpc('class_list', { p_from: from.toISOString(), p_to: to.toISOString() }),
    book: (classId, profileId) => rpc('book_class', { p_class: classId, p_profile: profileId ?? null }),
    cancelBooking: (classId, profileId) => rpc('cancel_booking', { p_class: classId, p_profile: profileId ?? null }),
    roster: (classId) => rpc('class_roster', { p_class: classId }),
    setCap: (classId, cap, scope) => rpc('set_class_cap', { p_class: classId, p_cap: cap, p_scope: scope }),
    cancelClass: (classId, cancel, reason) => rpc('cancel_class', { p_class: classId, p_cancel: cancel, p_reason: reason ?? null }),
    setCoach: (classId, coachId) => rpc('set_class_coach', { p_class: classId, p_coach: coachId }),
    checkIn: (classId, profileId, on) => rpc('check_in', { p_class: classId, p_profile: profileId, p_on: on }),
    kioskSignIn: (classId, profileId) => rpc('kiosk_sign_in', { p_class: classId, p_profile: profileId }),
    async staff() {
      return must(await sb.from('profiles').select('*').in('role', ['coach', 'owner']).order('full_name')) as Profile[]
    },
    async programs() { return must(await sb.from('programs').select('*').eq('active', true).order('sort')) },
    async updateProgramCap(id, cap) { must(await sb.from('programs').update({ default_cap: cap }).eq('id', id)) },
    async workouts(from, to) {
      return must(await sb.from('workouts').select('*').gte('day', from).lte('day', to))
    },
    async saveWorkout(w) {
      const { id: _id, publish_at: _p, ...rest } = w
      void _id; void _p
      must(await sb.from('workouts').upsert(rest, { onConflict: 'program_id,day' }))
    },
    async settings() { return must(await sb.from('settings').select('*').eq('id', 1).single()) },
    async saveSettings(s) { must(await sb.from('settings').update(s).eq('id', 1)) },
    members: () => rpc('member_overview'),
    async createMember(m) {
      must(await sb.from('profiles').insert({ ...m, email: m.email.trim().toLowerCase() }))
    },
    async searchProfiles(q) {
      return must(await sb.from('profiles').select('*').ilike('full_name', `%${q}%`).order('full_name').limit(8)) as Profile[]
    },
    myAttendance: () => rpc('my_attendance'),
    async notifications() {
      const me = await rpc<string>('me')
      return must(await sb.from('notifications').select('*').eq('profile_id', me).order('created_at', { ascending: false }).limit(40))
    },
    async markNotificationsRead() {
      const me = await rpc<string>('me')
      must(await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('profile_id', me).is('read_at', null))
    },
    subscribe(cb) {
      const ch = sb.channel('box800')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workouts' }, cb)
        .subscribe()
      // Fjöldi í tímum annarra sést ekki í rauntíma (persónuvernd), svo uppfært reglulega líka
      const t = setInterval(cb, 30000)
      return () => { clearInterval(t); sb.removeChannel(ch) }
    },
  }
}
