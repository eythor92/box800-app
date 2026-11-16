import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Result } from '../api'
import { useData } from '../ctx'
import { Icon } from '../components/Icon'
import ScoreSheet from '../components/ScoreSheet'
import { MONTHS, parseDay, today } from '../util'
import { est1rm, fmtResult, kg } from '../score'

/** Línurit: þyngd yfir tíma */
function LineChart({ pts }: { pts: { d: string; y: number }[] }) {
  if (pts.length === 0) return <div className="muted" style={{ padding: '30px 0', textAlign: 'center' }}>Engin saga enn</div>
  const W = 340, H = 190, L = 40, R = 12, T = 12, B = 26
  const ys = pts.map((p) => p.y), lo = Math.floor(Math.min(...ys) - 2), hi = Math.ceil(Math.max(...ys) + 2)
  const xs = pts.map((p) => +parseDay(p.d)), x0 = Math.min(...xs), x1 = Math.max(...xs)
  const X = (t: number) => (x1 === x0 ? (L + W - R) / 2 : L + ((t - x0) / (x1 - x0)) * (W - L - R))
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B)
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)
  const lbl = (d: string) => { const t = parseDay(d); return `${t.getUTCDate()}. ${MONTHS[t.getUTCMonth()]} ${String(t.getUTCFullYear()).slice(2)}` }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Línurit: ${pts.length} skráningar, frá ${kg(Math.min(...ys))} upp í ${kg(Math.max(...ys))} kg`}>
      {ticks.map((v) => (
        <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line-2)" strokeWidth="1" />
          <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(v)}</text></g>
      ))}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" points={pts.map((p) => `${X(+parseDay(p.d))},${Y(p.y)}`).join(' ')} />
      {pts.map((p, i) => <circle key={i} cx={X(+parseDay(p.d))} cy={Y(p.y)} r="4.5" fill="var(--accent)" />)}
      <text x={L} y={H - 6} fontSize="11" fill="var(--muted)">{lbl(pts[0].d)}</text>
      {pts.length > 1 && <text x={W - R} y={H - 6} fontSize="11" fill="var(--muted)" textAnchor="end">{lbl(pts[pts.length - 1].d)}</text>}
    </svg>
  )
}

/** Saga einnar hreyfingar, eins og „View history“ í Wodify */
export default function LiftHistory() {
  const id = Number(useParams().id)
  const nav = useNavigate()
  const { data: movements } = useData((a) => a.movements())
  const { data: hist } = useData((a) => a.liftHistory(id), [id])
  const [edit, setEdit] = useState<Result | null>(null)
  const name = movements?.find((m) => m.id === id)?.name ?? ''
  const all = useMemo(() => (hist ?? []).filter((r) => r.weight != null), [hist])

  // Besta þyngd fyrir hvern endurtekningafjölda (1RM, 3RM, 5RM …)
  const bestByReps = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of all) m.set(r.reps ?? 1, Math.max(m.get(r.reps ?? 1) ?? 0, Number(r.weight)))
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [all])
  // Raunverulegt 1RM ef það er hæst; annars áætlað út frá þyngstu lyftum með fleiri endurtekningum
  const best1 = bestByReps.find(([r]) => r === 1)?.[1] ?? 0
  const est = all.length ? Math.max(...all.map((r) => est1rm(Number(r.weight), r.reps ?? 1))) : 0
  const real1 = best1 >= est ? best1 : 0
  const oneRm = real1 || est

  const repsOpts = bestByReps.map(([r]) => r)
  const [repSel, setRepSel] = useState<number | null>(null)
  const rs = repSel ?? (repsOpts.includes(1) ? 1 : repsOpts[0])
  const pts = all.filter((r) => (r.reps ?? 1) === rs).map((r) => ({ d: r.day, y: Number(r.weight) }))

  // PR: þyngra en allt áður með sama endurtekningafjölda
  const prIds = useMemo(() => {
    const best = new Map<number, number>(), s = new Set<number | undefined>()
    for (const r of all) { const k = r.reps ?? 1, w = Number(r.weight); if (w > (best.get(k) ?? 0)) { best.set(k, w); s.add(r.id) } }
    return s
  }, [all])
  const byYear = useMemo(() => {
    const g = new Map<string, Result[]>()
    for (const r of [...all].reverse()) { const y = r.day.slice(0, 4); g.set(y, [...(g.get(y) ?? []), r]) }
    return [...g.entries()]
  }, [all])

  return (
    <div style={{ paddingBottom: 90 }}>
      <div className="row" style={{ padding: '14px 8px 0', justifyContent: 'space-between' }}>
        <button className="icon-btn" aria-label="Til baka" onClick={() => nav(-1)}><Icon name="back" /></button>
        <span className="muted" style={{ fontWeight: 700, paddingRight: 12 }}>kg</span>
      </div>
      <h1 className="display" style={{ fontSize: 38, margin: '0 16px' }}>{name}</h1>

      {hist && all.length === 0 && <div className="empty" style={{ margin: 16 }}>Engin skráning enn. Ýttu á <b>Skrá nýtt skor</b> til að byrja.</div>}

      {bestByReps.length > 0 && (
        <>
          <div className="section-title">Þyngstu lyftur</div>
          <div className="lh-grid">
            {bestByReps.slice(0, 6).map(([r, w]) => <div key={r}><span>{r}RM</span><b>{kg(w)}</b></div>)}
          </div>
          <div className="section-title">Prósentur af 1RM{!real1 && oneRm ? ' (áætlað)' : ''}</div>
          <div className="lh-grid">
            {[100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45].map((p) => <div key={p}><span>{p}%</span><b>{Math.round((oneRm * p) / 100)}</b></div>)}
          </div>
          <div className="section-title" style={{ justifyContent: 'space-between' }}>
            <span>Öll saga fyrir</span>
            <select className="select" style={{ width: 'auto', height: 36 }} value={rs} onChange={(e) => setRepSel(Number(e.target.value))} aria-label="Endurtekningar">
              {repsOpts.map((r) => <option key={r} value={r}>{r} endurt.</option>)}
            </select>
          </div>
          <div style={{ padding: '4px 12px 0' }}><LineChart pts={pts} /></div>
          {byYear.map(([y, rows]) => (
            <div key={y}>
              <div className="lh-year">{y}</div>
              {rows.map((r) => {
                const t = parseDay(r.day)
                return (
                  <button key={r.id} className="lh-row" onClick={() => setEdit(r)}>
                    <span>{t.getUTCDate()}. {MONTHS[t.getUTCMonth()]}{r.source === 'wodify' && <small className="muted"> · Wodify</small>}</span>
                    {prIds.has(r.id) && <span className="lh-pr" title="Persónulegt met">PR</span>}
                    <b>{fmtResult(r)}</b>
                  </button>
                )
              })}
            </div>
          ))}
        </>
      )}

      <div className="lh-add"><button className="btn btn-primary btn-block" onClick={() => setEdit({ day: today(), kind: 'weight', movement_id: id, sets: 1, reps: 5 })}>Skrá nýtt skor</button></div>
      {edit && <ScoreSheet title={name} withDate initial={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
