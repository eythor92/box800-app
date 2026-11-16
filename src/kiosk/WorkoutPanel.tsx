import { useRef, useState } from 'react'
import { useData } from '../ctx'
import { Icon } from '../components/Icon'
import { addDays, cap1, dayKey, dayLabel, dayStart } from '../util'
import { BigWorkout, currentClass, isLive, useNow, useSize } from './shared'
import { PanelHead, type PanelProps } from './panel'

/**
 * Æfing dagsins í stóru letri (sjónvarpið).
 * Sjálfvirkt: námskeið tímans sem er í gangi eða næstur, og æfing morgundagsins eftir kl. 21.
 */
export default function WorkoutPanel(pp: PanelProps) {
  const { cfg, setCfg } = pp
  const now = useNow()
  const today = dayKey(now)
  const [manualDay, setManualDay] = useState(today)
  const day = cfg.autoDay ? (now.getUTCHours() >= 21 ? addDays(today, 1) : today) : manualDay

  const { data: programs } = useData((a) => a.programs())
  const { data: classes } = useData((a) => a.classList(dayStart(day), dayStart(addDays(day, 1))), [day])
  const { data: workouts } = useData((a) => a.workouts(day, day), [day])

  const cur = classes ? currentClass(classes, day === today ? now : new Date(0)) : undefined
  const pid = cfg.prog || cur?.program_id || programs?.[0]?.id
  const prog = programs?.find((p) => p.id === pid)
  const w = (workouts ?? []).find((x) => x.program_id === pid && x.day === day)
  const live = isLive(w, now) ? w : undefined

  const body = useRef<HTMLDivElement>(null)
  const [bw, bh] = useSize(body)
  const cols = bw > bh * 1.15 && (live?.components.length ?? 0) >= 2 ? 2 : 1
  const step = (n: number) => { setManualDay(addDays(day, n)); setCfg({ ...cfg, autoDay: false }) }

  return (
    <div className="kp-panel">
      <PanelHead {...pp} title="Æfing" sub={
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          <button className="kp-mini" aria-label="Fyrri dagur" onClick={() => step(-1)}><Icon name="back" size={18} /></button>
          <button className="kp-date" onClick={() => { setCfg({ ...cfg, autoDay: !cfg.autoDay }); setManualDay(day) }} title={cfg.autoDay ? 'Sjálfvirkur dagur' : 'Smelltu til að fylgja deginum sjálfkrafa'}>
            {cap1(dayLabel(day))}{cfg.autoDay ? '' : ' ·  fastur'}
          </button>
          <button className="kp-mini" aria-label="Næsti dagur" onClick={() => step(1)}><Icon name="next" size={18} /></button>
          <select className="kp-prog" value={cfg.prog} onChange={(e) => setCfg({ ...cfg, prog: Number(e.target.value) })} aria-label="Námskeið">
            <option value={0}>{cfg.prog ? 'Sjálfvirkt' : (prog?.name ?? 'Námskeið') + ' (sjálfvirkt)'}</option>
            {(programs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      } />
      <div className="kp-body wp-body" ref={body}>
        {live
          ? <BigWorkout w={live} title={`${prog?.name ?? ''} – ${cap1(dayLabel(day))}`} scale={cfg.zoom} columns={cols} />
          : <div className="cb-none" style={{ margin: 'auto' }}>Engin birt æfing fyrir {prog?.name ?? 'þetta námskeið'} {dayLabel(day)}</div>}
      </div>
    </div>
  )
}
