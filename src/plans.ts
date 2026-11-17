/** Áskriftir og kort sem eru í boði (eins og á verðskrá box800.is). months/days = gildistími; ekkert = endurnýjast. */
export interface Plan { name: string; months?: number; days?: number }
export const PLAN_GROUPS: { label: string; plans: Plan[] }[] = [
  { label: 'Almenn áskrift', plans: [
    { name: '12 mánaða samningur' },
    { name: '1 mánuður', months: 1 },
    { name: '3 mánuðir', months: 3 },
    { name: '6 mánuðir', months: 6 },
    { name: 'Árskort – staðgreitt', months: 12 },
    { name: '10 skipta kort', months: 12 },
  ] },
  { label: 'Skólakort 16–19 ára', plans: [
    { name: 'Skólakort 3 mánuðir', months: 3 },
    { name: 'Skólakort 6 mánuðir', months: 6 },
    { name: 'Skólakort 12 mánuðir', months: 12 },
  ] },
  { label: 'Námskeið', plans: [
    { name: 'Heldrihreysti 1 mánuður', months: 1 },
    { name: 'Heldrihreysti 3 mánuðir', months: 3 },
    { name: 'Heldrihreysti 10 skipta kort', months: 12 },
    { name: 'Konuhreysti 1 mánuður', months: 1 },
    { name: 'Konuhreysti 3 mánuðir', months: 3 },
    { name: 'Karlahreysti 1 mánuður', months: 1 },
    { name: 'Karlahreysti 3 mánuðir', months: 3 },
    { name: 'Unglingastyrkur (önn)' },
    { name: 'Mömmugrunnur 4 vikur', days: 28 },
    { name: 'Mömmuhreysti 4 vikur', days: 28 },
    { name: 'Þolþjálfun 5 vikur', days: 35 },
  ] },
  { label: 'Annað', plans: [{ name: 'Prufukort', days: 7 }, { name: 'Þjálfari' }] },
]

/** Lokadagur út frá upphafsdegi (YYYY-MM-DD), eða '' ef áskriftin endurnýjast */
export function planEnd(p: Plan | undefined, start: string): string {
  if (!p || (!p.months && !p.days)) return ''
  const d = new Date(start + 'T00:00:00Z')
  if (p.months) d.setUTCMonth(d.getUTCMonth() + p.months)
  if (p.days) d.setUTCDate(d.getUTCDate() + p.days)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
export const findPlan = (name: string) => PLAN_GROUPS.flatMap((g) => g.plans).find((p) => p.name === name)
