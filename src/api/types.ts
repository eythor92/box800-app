export type Role = 'member' | 'coach' | 'owner'

export interface Profile {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: Role
  avatar_url: string | null
  note?: string | null
  kennitala?: string | null
  address?: string | null
  birth_date?: string | null
  gender?: 'kona' | 'karl' | 'annað' | null
  member_since?: string | null
  emergency?: string | null
  emergency_phone?: string | null
  status?: 'active' | 'suspended' | 'inactive'
  is_dependent?: boolean
  created_at?: string
}
export interface Membership { id: number; plan: string; starts_on: string; ends_on: string | null; status: string; source: string; punches?: number | null; punches_before?: number }
export interface PunchCard { id: number; plan: string; punches: number; used: number; booked_ahead: number; ends_on: string | null }

export interface ClassRow {
  id: number
  program_id: number
  program: string
  color: string
  starts_at: string
  ends_at: string
  coach_id: string | null
  coach_name: string | null
  coach_avatar: string | null
  cap: number
  booked: number
  waiting: number
  cancelled: boolean
  my_status: 'booked' | 'waitlist' | 'cancelled' | 'late_cancel' | 'no_show' | null
  my_position: number | null
  slot_id: number | null
}

export interface RosterRow {
  profile_id: string
  full_name: string
  avatar_url: string | null
  status: 'booked' | 'waitlist'
  checked_in: boolean
  wait_pos: number | null
  note: string | null
  first_class: boolean
  plan: string | null
}

export interface Program { id: number; name: string; color: string; default_cap: number; sort: number }

export type ComponentType = 'metcon' | 'header' | 'lift' | 'video' | 'image'
export interface WorkoutComponent {
  type: ComponentType
  /** Fast auðkenni hlutans (skor tengjast því) */
  key?: string
  /** Lyftur: hreyfing og sett x endurtekningar */
  movement_id?: number
  sets?: number
  reps?: number
  prefix?: string
  title?: string
  body?: string
  comment?: string
  scoring?: string
  rounds?: number
  scaling?: string
  url?: string
}
export interface Workout {
  id?: number
  program_id: number
  day: string
  components: WorkoutComponent[]
  status: 'draft' | 'published'
  publish_mode: 'evening_before' | 'now' | 'morning'
  publish_at?: string | null
}

export interface Settings {
  open_mode: 'fixed' | 'relative'
  open_days: number
  open_time: string
  open_minutes: number
  close_minutes: number
  cancel_minutes: number
  waitlist_on: boolean
  waitlist_mode: 'auto' | 'all'
  waitlist_limit: number
  auto_cancel_on: boolean
  auto_cancel_minutes: number
  auto_cancel_min: number
  auto_cancel_stop: number
}

export interface MemberRow {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: Role
  is_dependent: boolean
  created_at: string
  plan: string | null
  ends_on: string | null
  membership_status: string | null
  last_class: string | null
  visits_30: number
  total: number
  note: string | null
  avatar_url?: string | null
  status?: 'active' | 'suspended' | 'inactive'
  member_since?: string | null
}

export interface Notification { id: number; title: string; body: string | null; created_at: string; read_at: string | null; kind?: string | null }
export interface Promo { id: number; partner: string; title: string; body: string | null; code: string | null; url: string | null; logo_url: string | null }
export interface PromoInput { id?: number; partner: string; title: string; body: string | null; code: string | null; url: string | null; logo_url: string | null; audience_plan: string | null; starts_on: string; ends_on: string | null; active: boolean }
export interface PromoAdmin extends PromoInput { id: number; clicks: number; copies: number; created_at: string }
export interface SupportMessage { id: number; profile_id: string; full_name: string; email: string | null; phone: string | null; avatar_url: string | null; what: string | null; body: string | null; created_at: string; has_access: boolean }
export interface Attendance { class_id: number; program: string; starts_at: string; checked_in: boolean }

export interface NewMember {
  full_name: string
  email: string
  phone?: string
  kennitala?: string
  note?: string
  emergency?: string
  is_dependent?: boolean
}

export interface Movement { id: number; name: string; sort: number }
export type ScoreKind = 'weight' | 'time' | 'rounds' | 'reps' | 'cal' | 'dist' | 'done'
export interface Result {
  id?: number
  profile_id?: string
  day: string
  workout_id?: number | null
  comp_key?: string | null
  movement_id?: number | null
  sets?: number | null
  reps?: number | null
  weight?: number | null
  kind: ScoreKind
  score_num?: number | null
  score_text?: string | null
  rx?: 'Rx+' | 'Rx' | 'Scaled' | null
  note?: string | null
  source?: string
}
export interface LiftSummary { movement_id: number; name: string; best: number; best_1rm: number | null; last_day: string; n: number }
export interface LeaderRow { profile_id: string; full_name: string; avatar_url: string | null; kind: ScoreKind; score_num: number | null; score_text: string | null; sets: number | null; reps: number | null; weight: number | null; rx: Result['rx']; is_me: boolean }

export interface Api {
  demo: boolean
  // innskráning
  session(): Promise<string | null>
  onAuthChange(cb: () => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, fullName: string): Promise<'confirm' | 'ok'>
  resetPassword(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  signOut(): Promise<void>
  demoUsers?(): { label: string; email: string }[]
  // gögn
  myProfile(): Promise<Profile | null>
  /** Má innskráður notandi sjá tímatöflu og æfingar? (þjálfari eða virk áskrift) */
  hasAccess(): Promise<boolean>
  classList(from: Date, to: Date): Promise<ClassRow[]>
  book(classId: number, profileId?: string): Promise<string>
  cancelBooking(classId: number, profileId?: string): Promise<string>
  roster(classId: number): Promise<RosterRow[]>
  setCap(classId: number, cap: number, scope: 'one' | 'all'): Promise<number>
  cancelClass(classId: number, cancel: boolean, reason?: string): Promise<void>
  setCoach(classId: number, coachId: string): Promise<void>
  checkIn(classId: number, profileId: string, on: boolean): Promise<void>
  attendees(classId: number): Promise<{ profile_id: string; full_name: string; avatar_url: string | null; checked_in: boolean; is_me: boolean }[]>
  waitlist(classId: number): Promise<{ profile_id: string; full_name: string; avatar_url: string | null; pos: number; is_me: boolean }[]>
  selfCheckIn(classId: number): Promise<void>
  /** Kiosk: skrá inn á stöðinni, líka án bókunar */
  kioskSignIn(classId: number, profileId: string): Promise<void>
  staff(): Promise<Profile[]>
  programs(): Promise<Program[]>
  updateProgramCap(id: number, cap: number): Promise<void>
  workouts(from: string, to: string): Promise<Workout[]>
  saveWorkout(w: Workout): Promise<void>
  settings(): Promise<Settings>
  saveSettings(s: Settings): Promise<void>
  members(): Promise<MemberRow[]>
  createMember(m: NewMember): Promise<void>
  searchProfiles(q: string): Promise<Profile[]>
  myAttendance(): Promise<Attendance[]>
  notifications(): Promise<Notification[]>
  markNotificationsRead(): Promise<void>
  markNotificationRead(id: number): Promise<void>
  noShowCount(profileId: string): Promise<number>
  // skilaboð frá þeim sem komast ekki inn
  sendSupport(what: string, phone: string, body: string): Promise<void>
  supportPending(): Promise<string | null>
  supportInbox(): Promise<SupportMessage[]>
  supportHandled(id: number): Promise<void>
  // samstarf / kynningar á forsíðu
  myPromos(): Promise<Promo[]>
  promoEvent(id: number, kind: 'click' | 'copy'): Promise<void>
  promos(): Promise<PromoAdmin[]>
  savePromo(p: PromoInput): Promise<void>
  deletePromo(id: number): Promise<void>
  promoReach(plan: string | null): Promise<number>
  uploadPromoLogo(img: Blob): Promise<string>
  // innsýn (aðeins eigandi)
  insights(from: string, to: string): Promise<{ kind: 'attend' | 'noshow' | 'pr'; profile_id: string; full_name: string; avatar_url: string | null; n: number }[]>
  insightsSummary(from: string, to: string): Promise<{ visits: number; active_members: number; no_shows: number; prs: number; classes: number } | null>
  subscribe(cb: () => void): () => void
  // skor og árangur
  movements(): Promise<Movement[]>
  addMovement(name: string): Promise<Movement>
  saveResult(r: Result): Promise<number>
  deleteResult(id: number): Promise<void>
  myComponentResults(from: string, to: string): Promise<Result[]>
  liftHistory(movementId: number): Promise<Result[]>
  myLifts(): Promise<LiftSummary[]>
  leaderboard(workoutId: number, key: string): Promise<LeaderRow[]>
  // prófíll iðkanda (eigandi)
  getProfile(id: string): Promise<Profile>
  updateProfile(id: string, patch: Partial<Profile>): Promise<void>
  deleteProfile(id: string): Promise<void>
  membershipsOf(id: string): Promise<Membership[]>
  attendanceOf(id: string): Promise<Attendance[]>
  liftsOf(id: string): Promise<LiftSummary[]>
  addMembership(m: { profile_id: string; plan: string; starts_on: string; ends_on: string | null; punches?: number | null }): Promise<void>
  updateMembership(id: number, patch: { punches?: number | null; punches_before?: number }): Promise<void>
  myPunchCards(): Promise<PunchCard[]>
  punchUsage(profileId: string): Promise<{ id: number; used: number; booked_ahead: number }[]>
  endMembership(id: number): Promise<void>
  /** Hleður upp mynd (JPEG) og setur sem prófílmynd. Skilar slóðinni. */
  uploadAvatar(profileId: string, jpeg: Blob): Promise<string>
  // þjálfari: bæta við í tíma eða á biðlista, og drop-in gestir
  staffAdd(classId: number, profileId: string, waitlist: boolean): Promise<string>
  /** Eigandi: stakur aukatími (ekki í föstu tímatöflunni) */
  addClass(c: { program_id: number; starts_at: string; ends_at: string; cap: number | null; coach_id: string | null; title: string | null }): Promise<void>
  /** Eigandi: eigið nafn á tíma (null = nafn námskeiðsins) */
  renameClass(id: number, title: string | null): Promise<void>
  createDropin(name: string, email?: string, phone?: string): Promise<string>
}
