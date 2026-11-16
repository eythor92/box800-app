import { useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { addDays, cap1, dayKey, dayLabel, mondayOf, parseDay } from '../util'
import type { Program } from '../api'
import { PANEL_NAMES, type PanelCfg, type PanelType } from './panel'

/** Fellanlegur hluti: „DAGSETNING  mán. 16. nóv. ▾“ */
function Section({ label, value, open, onToggle, children }: { label: string; value: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={`ks-sec${open ? ' open' : ''}`}>
      <button className="ks-sec-h" aria-expanded={open} onClick={onToggle}>
        <span className="ks-lbl">{label}</span><span className="grow ks-val">{value}</span>
        <Icon name={open ? 'up' : 'down'} size={20} />
      </button>
      {open && <div className="ks-sec-b">{children}</div>}
    </div>
  )
}

const MONTHS_LONG = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember']

/** Mánaðardagatal (mánudagur fyrstur) */
function Calendar({ value, onPick }: { value: string; onPick: (d: string) => void }) {
  const [month, setMonth] = useState(value.slice(0, 7))
  const first = month + '-01'
  const start = mondayOf(first)
  const today = dayKey(new Date())
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const shift = (n: number) => { const d = parseDay(first); d.setUTCMonth(d.getUTCMonth() + n); setMonth(dayKey(d).slice(0, 7)) }
  const m = parseDay(first)
  return (
    <div className="ks-cal">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="kp-mini" aria-label="Fyrri mánuður" onClick={() => shift(-1)}><Icon name="back" size={18} /></button>
        <b>{cap1(MONTHS_LONG[m.getUTCMonth()])} {m.getUTCFullYear()}</b>
        <button className="kp-mini" aria-label="Næsti mánuður" onClick={() => shift(1)}><Icon name="next" size={18} /></button>
      </div>
      <div className="ks-grid">
        {['Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau', 'Sun'].map((d) => <span key={d} className="wd">{d}</span>)}
        {days.map((d) => (
          <button key={d} className={[d.slice(0, 7) !== month ? 'out' : '', d === value ? 'on' : '', d === today ? 'today' : ''].join(' ')}
            aria-label={dayLabel(d, true)} aria-pressed={d === value} onClick={() => onPick(d)}>{parseDay(d).getUTCDate()}</button>
        ))}
      </div>
      <button className="ks-today" onClick={() => { onPick(today); setMonth(today.slice(0, 7)) }}>Í dag</button>
    </div>
  )
}

/**
 * Stillingar glugga, eins og í Kiosk+: SKJÁR, DAGSETNING, NÁMSKEIÐ og „Nota“.
 * Breytingar taka ekki gildi fyrr en ýtt er á Nota.
 */
export function PanelSettings({ cfg, day, programs, autoName, onApply, onClose, startOpen }: {
  cfg: PanelCfg; day: string; programs: Program[]; autoName?: string
  onApply: (c: PanelCfg) => void; onClose: () => void; startOpen?: 'type' | 'day' | 'prog'
}) {
  const [d, setD] = useState<PanelCfg>({ ...cfg, day: cfg.day ?? day })
  const [open, setOpen] = useState<string | null>(startOpen ?? (cfg.type === 'workout' ? 'prog' : null))
  const tog = (s: string) => setOpen(open === s ? null : s)
  const pname = d.prog ? programs.find((p) => p.id === d.prog)?.name : `Sjálfvirkt${autoName ? ' (' + autoName + ')' : ''}`
  const dayText = d.autoDay ? 'Sjálfvirkt (í dag, morgundagur eftir kl. 21)' : cap1(dayLabel(d.day!, true)) + ' ' + parseDay(d.day!).getUTCFullYear()

  return (
    <>
      <button className="ks-back" aria-label="Loka stillingum" onClick={onClose} />
      <div className="ks" role="dialog" aria-label="Stillingar glugga">
        <Section label="SKJÁR" value={<>{PANEL_NAMES[d.type]}<small>{d.type === 'workout' ? 'Sýnir æfingu dagsins' : 'Innskráning og mæting'}</small></>} open={open === 'type'} onToggle={() => tog('type')}>
          <div className="ks-btns">
            {(Object.keys(PANEL_NAMES) as PanelType[]).map((t) => <button key={t} className={d.type === t ? 'on' : ''} onClick={() => setD({ ...d, type: t })}>{PANEL_NAMES[t]}</button>)}
          </div>
        </Section>
        {d.type === 'workout' && (
          <>
            <Section label="DAGSETNING" value={dayText} open={open === 'day'} onToggle={() => tog('day')}>
              <label className="ks-auto"><input type="checkbox" checked={d.autoDay} onChange={(e) => setD({ ...d, autoDay: e.target.checked })} /> Fylgja deginum sjálfkrafa</label>
              <Calendar value={d.day!} onPick={(x) => setD({ ...d, day: x, autoDay: false })} />
            </Section>
            <Section label="NÁMSKEIÐ" value={pname} open={open === 'prog'} onToggle={() => tog('prog')}>
              <div className="ks-btns">
                <button className={!d.prog ? 'on' : ''} onClick={() => setD({ ...d, prog: 0 })} style={{ gridColumn: '1 / -1' }}>Sjálfvirkt: námskeið næsta tíma</button>
                {programs.map((p) => <button key={p.id} className={d.prog === p.id ? 'on' : ''} onClick={() => setD({ ...d, prog: p.id })}>{p.name}</button>)}
              </div>
            </Section>
          </>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Hætta við</button>
          <button className="btn btn-primary btn-sm" onClick={() => { onApply(d); onClose() }}>Nota</button>
        </div>
      </div>
    </>
  )
}

