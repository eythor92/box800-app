// Ísland er alltaf á UTC, en við tilgreinum tímabeltið svo símar erlendis sýni rétt
const TZ = 'Atlantic/Reykjavik'

export const DAYS_SHORT = ['Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau', 'Sun']
export const DAYS_LONG = ['mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur', 'sunnudagur']
export const MONTHS = ['jan.', 'feb.', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'sept.', 'okt.', 'nóv.', 'des.']

/** Dagsetning á Íslandi sem 'YYYY-MM-DD' */
export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
export function parseDay(key: string): Date { return new Date(key.slice(0, 10) + 'T12:00:00Z') }
export function addDays(key: string, n: number): string {
  const d = parseDay(key); d.setUTCDate(d.getUTCDate() + n); return dayKey(d)
}
/** 0 = mánudagur */
export function weekdayIdx(key: string): number { return (parseDay(key).getUTCDay() + 6) % 7 }
export function mondayOf(key: string): string { return addDays(key, -weekdayIdx(key)) }
export function today(): string { return dayKey(new Date()) }
export function dayStart(key: string): Date { return new Date(key + 'T00:00:00Z') }

export function hhmm(iso: string): string {
  return new Intl.DateTimeFormat('is-IS', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}
export function shortTime(iso: string): string { const t = hhmm(iso); return t.startsWith('0') ? t.slice(1) : t }
export function minutesBetween(a: string, b: string): number { return Math.round((+new Date(b) - +new Date(a)) / 60000) }

export function dayLabel(key: string, long = false): string {
  const d = parseDay(key)
  const w = weekdayIdx(key)
  return (long ? DAYS_LONG[w] : DAYS_SHORT[w].toLowerCase() + '.') + ' ' + d.getUTCDate() + '. ' + MONTHS[d.getUTCMonth()]
}
export function relDay(iso: string): string {
  const k = dayKey(new Date(iso)), t = today()
  if (k === t) return 'Í dag'
  if (k === addDays(t, 1)) return 'Á morgun'
  if (k === addDays(t, -1)) return 'Í gær'
  const s = dayLabel(k)
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export function whenText(iso: string): string { return relDay(iso) + ' kl. ' + shortTime(iso) }

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase() || '?'
}
export function cap1(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }

export function errMsg(e: unknown): string { return e instanceof Error ? e.message : String(e) }

/** *Feitletrað* → { text, bold } */
export function parseLines(body = ''): { t: string; b: boolean }[] {
  return body.split('\n').map((x) => {
    const s = x.trim(); const b = s.length > 1 && s.startsWith('*') && s.endsWith('*')
    return { t: b ? s.slice(1, -1) : x, b }
  })
}
