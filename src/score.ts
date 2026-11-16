import type { Result, ScoreKind, WorkoutComponent } from './api'

/** Fast auðkenni hluta (eldri hlutar án lykils fá númer) */
export const compKey = (c: WorkoutComponent, i: number) => c.key || 'i' + i
export const newKey = () => Math.random().toString(36).slice(2, 10)

const BY_SCORING: Record<string, ScoreKind | null> = {
  'Hak (lokið)': 'done', 'Tími': 'time', 'Umferðir + endurtekningar': 'rounds', 'Endurtekningar': 'reps',
  'Þyngd (kg)': 'weight', 'Kaloríur': 'cal', 'Vegalengd (m)': 'dist', 'Engin skráning': null,
}
/** Hvernig er skor þessa hluta skráð? null = engin skráning */
export function kindOf(c: WorkoutComponent): ScoreKind | null {
  if (c.type === 'lift') return 'weight'
  if (c.type !== 'metcon') return null
  return BY_SCORING[c.scoring ?? 'Hak (lokið)'] ?? null
}
export const scheme = (sets?: number | null, reps?: number | null) => (sets && reps ? `${sets} x ${reps}` : reps ? `${reps} endurt.` : '')
export function compTitle(c: WorkoutComponent, movementName?: string) {
  const t = (c.prefix ? c.prefix + '. ' : '') + (c.title || movementName || (c.type === 'video' ? 'Myndband' : c.type === 'image' ? 'Mynd' : 'Æfing'))
  return c.type === 'lift' && scheme(c.sets, c.reps) ? `${t} (${scheme(c.sets, c.reps)})` : t
}
export const rxOptions = (scaling?: string): NonNullable<Result['rx']>[] =>
  scaling === 'Scaled / Rx / Rx+' ? ['Rx+', 'Rx', 'Scaled'] : scaling === 'Scaled / Rx' ? ['Rx', 'Scaled'] : []

export const kg = (n: number | null | undefined) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','))
export function fmtTime(sec: number) { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return `${m}:${String(s).padStart(2, '0')}` }

/** Skor eins og það birtist: „1 x 5 @ 90“, „12:34“, „5 + 12“ */
export function fmtResult(r: Pick<Result, 'kind' | 'sets' | 'reps' | 'weight' | 'score_num' | 'score_text'>): string {
  if (r.kind === 'weight') return `${scheme(r.sets, r.reps) ? scheme(r.sets, r.reps) + ' @ ' : ''}${kg(r.weight)}`
  if (r.score_text) return r.score_text
  const n = Number(r.score_num ?? 0)
  if (r.kind === 'time') return fmtTime(n)
  if (r.kind === 'rounds') return `${Math.floor(n / 1000)} + ${n % 1000}`
  if (r.kind === 'reps') return `${n} endurt.`
  if (r.kind === 'cal') return `${n} cal`
  if (r.kind === 'dist') return `${n} m`
  return 'Lokið'
}
/** Raðað á stigatöflu: Rx+ > Rx > Scaled, svo besta skor (tími: lægstur) */
export function rankCmp(a: { kind: ScoreKind; rx?: Result['rx']; score_num?: number | null; weight?: number | null }, b: typeof a): number {
  const rxw = (x?: Result['rx']) => (x === 'Rx+' ? 0 : x === 'Scaled' ? 2 : 1)
  if (rxw(a.rx) !== rxw(b.rx)) return rxw(a.rx) - rxw(b.rx)
  const va = Number(a.kind === 'weight' ? a.weight : a.score_num) || 0, vb = Number(b.kind === 'weight' ? b.weight : b.score_num) || 0
  return a.kind === 'time' ? va - vb : vb - va
}
/** Áætlað 1RM (Epley) þegar engin 1-endurtekningar lyfta er til */
export const est1rm = (w: number, reps: number) => (reps <= 1 ? w : w * (1 + reps / 30))
