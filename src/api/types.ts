export type Role = 'member' | 'coach' | 'owner'

export interface Profile {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: Role
  avatar_url: string | null
  note?: string | null
}

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
}

export interface Notification { id: number; title: string; body: string | null; created_at: string; read_at: string | null }
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
  signOut(): Promise<void>
  demoUsers?(): { label: string; email: string }[]
  // gögn
  myProfile(): Promise<Profile | null>
  classList(from: Date, to: Date): Promise<ClassRow[]>
  book(classId: number, profileId?: string): Promise<string>
  cancelBooking(classId: number, profileId?: string): Promise<string>
  roster(classId: number): Promise<RosterRow[]>
  setCap(classId: number, cap: number, scope: 'one' | 'all'): Promise<number>
  cancelClass(classId: number, cancel: boolean, reason?: string): Promise<void>
  setCoach(classId: number, coachId: string): Promise<void>
  checkIn(classId: number, profileId: string, on: boolean): Promise<void>
  attendees(classId: number): Promise<{ profile_id: string; full_name: string; avatar_url: string | null; checked_in: boolean; is_me: boolean }[]>
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
}
