import { useState } from 'react'
import type { Result } from '../api'
import { useApp } from '../ctx'
import { Icon } from './Icon'
import { errMsg, today } from '../util'
import { fmtTime, kg, rxOptions } from '../score'

const num = (s: string) => { const n = Number(String(s).replace(',', '.').trim()); return s.trim() === '' || !isFinite(n) ? null : n }

/**
 * Skrá eða breyta skori. Reitirnir fara eftir tegund:
 * lyfta (sett x endurt. @ kg), tími (mín:sek), umferðir + endurtekningar, fjöldi eða „lokið“.
 */
export default function ScoreSheet({ title, sub, initial, scaling, withDate, onClose, onSaved }: {
  title: string; sub?: string; initial: Result; scaling?: string; withDate?: boolean
  onClose: () => void; onSaved?: () => void
}) {
  const { api, toast, refresh } = useApp()
  const k = initial.kind
  const n0 = Number(initial.score_num ?? 0)
  const [f, setF] = useState({
    day: initial.day || today(),
    sets: String(initial.sets ?? 1), reps: String(initial.reps ?? (k === 'weight' ? 5 : '')), w: kg(initial.weight),
    min: initial.score_num != null && k === 'time' ? String(Math.floor(n0 / 60)) : '', sec: initial.score_num != null && k === 'time' ? String(Math.round(n0 % 60)) : '',
    rounds: initial.score_num != null && k === 'rounds' ? String(Math.floor(n0 / 1000)) : '', rr: initial.score_num != null && k === 'rounds' ? String(n0 % 1000) : '',
    val: initial.score_num != null && ['reps', 'cal', 'dist'].includes(k) ? String(n0) : '',
    rx: initial.rx ?? (rxOptions(scaling).includes('Rx') ? 'Rx' : null) as Result['rx'], note: initial.note ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p })
  const rxs = rxOptions(scaling)

  function build(): Result | string {
    const base: Result = { ...initial, day: f.day, rx: rxs.length ? f.rx : null, note: f.note.trim() || null }
    if (k === 'weight') {
      const w = num(f.w), s = num(f.sets), r = num(f.reps)
      if (w == null || w <= 0) return 'Sláðu inn þyngd'
      if (!r || r < 1) return 'Sláðu inn fjölda endurtekninga'
      return { ...base, weight: w, sets: s || 1, reps: r, score_num: w, score_text: null }
    }
    if (k === 'time') {
      const m = num(f.min) ?? 0, s = num(f.sec) ?? 0, t = m * 60 + s
      if (t <= 0) return 'Sláðu inn tíma'
      return { ...base, score_num: t, score_text: fmtTime(t) }
    }
    if (k === 'rounds') {
      const ro = num(f.rounds) ?? 0, re = num(f.rr) ?? 0
      if (ro <= 0 && re <= 0) return 'Sláðu inn umferðir'
      return { ...base, score_num: ro * 1000 + re, score_text: `${ro} + ${re}` }
    }
    if (k === 'done') return { ...base, score_num: 1, score_text: 'Lokið' }
    const v = num(f.val)
    if (v == null) return 'Sláðu inn tölu'
    return { ...base, score_num: v, score_text: null }
  }

  async function save() {
    const r = build()
    if (typeof r === 'string') { toast(r); return }
    setBusy(true)
    try { await api.saveResult(r); toast('Skor vistað'); refresh(); onSaved?.(); onClose() } catch (e) { toast(errMsg(e)) } finally { setBusy(false) }
  }
  async function del() {
    if (!initial.id) return
    setBusy(true)
    try { await api.deleteResult(initial.id); toast('Skori eytt'); refresh(); onSaved?.(); onClose() } catch (e) { toast(errMsg(e)) } finally { setBusy(false) }
  }

  const big = { fontSize: 22, fontWeight: 800, textAlign: 'center' as const, height: 56 }
  return (
    <>
      <button className="sheet-back" aria-label="Loka" onClick={onClose} />
      <form className="sheet" role="dialog" aria-label={'Skrá skor: ' + title} onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="grip" />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><div className="display" style={{ fontSize: 26 }}>{title}</div>{sub && <div className="muted" style={{ marginTop: 2 }}>{sub}</div>}</div>
          <button type="button" className="icon-btn" aria-label="Loka" onClick={onClose}><Icon name="x" /></button>
        </div>

        {withDate && <label className="field" style={{ marginTop: 14 }}><span>Dagsetning</span><input className="input" type="date" value={f.day} max={today()} onChange={(e) => set({ day: e.target.value })} /></label>}

        {k === 'weight' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 10, marginTop: 14, alignItems: 'end' }}>
            <label className="field"><span>Sett</span><input className="input" inputMode="numeric" style={big} value={f.sets} onChange={(e) => set({ sets: e.target.value })} /></label>
            <label className="field"><span>Endurt.</span><input className="input" inputMode="numeric" style={big} value={f.reps} onChange={(e) => set({ reps: e.target.value })} /></label>
            <label className="field"><span>Þyngd (kg)</span><input className="input" inputMode="decimal" style={big} value={f.w} onChange={(e) => set({ w: e.target.value })} autoFocus placeholder="0" /></label>
          </div>
        )}
        {k === 'time' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            <label className="field"><span>Mínútur</span><input className="input" inputMode="numeric" style={big} value={f.min} onChange={(e) => set({ min: e.target.value })} autoFocus /></label>
            <label className="field"><span>Sekúndur</span><input className="input" inputMode="numeric" style={big} value={f.sec} onChange={(e) => set({ sec: e.target.value })} /></label>
          </div>
        )}
        {k === 'rounds' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            <label className="field"><span>Umferðir</span><input className="input" inputMode="numeric" style={big} value={f.rounds} onChange={(e) => set({ rounds: e.target.value })} autoFocus /></label>
            <label className="field"><span>+ Endurtekningar</span><input className="input" inputMode="numeric" style={big} value={f.rr} onChange={(e) => set({ rr: e.target.value })} /></label>
          </div>
        )}
        {(k === 'reps' || k === 'cal' || k === 'dist') && (
          <label className="field" style={{ marginTop: 14 }}><span>{k === 'reps' ? 'Endurtekningar' : k === 'cal' ? 'Kaloríur' : 'Metrar'}</span>
            <input className="input" inputMode="decimal" style={big} value={f.val} onChange={(e) => set({ val: e.target.value })} autoFocus /></label>
        )}
        {k === 'done' && <div className="stat" style={{ marginTop: 14 }}>Merktu við að þú hafir klárað æfinguna.</div>}

        {rxs.length > 0 && (
          <div className="row" style={{ marginTop: 14, gap: 8 }}>
            {rxs.map((x) => <button type="button" key={x} className={`chip${f.rx === x ? ' on' : ''}`} aria-pressed={f.rx === x} onClick={() => set({ rx: x })}>{x}</button>)}
          </div>
        )}
        <label className="field" style={{ marginTop: 14 }}><span>Athugasemd (valfrjálst)</span><input className="input" value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="T.d. með belti, skalaði í 40 kg" /></label>

        <div className="row" style={{ marginTop: 18 }}>
          {initial.id && <button type="button" className="btn btn-danger" disabled={busy} onClick={del}>Eyða</button>}
          <button type="submit" className="btn btn-primary grow" disabled={busy}>{initial.id ? 'Vista breytingu' : 'Vista skor'}</button>
        </div>
      </form>
    </>
  )
}
