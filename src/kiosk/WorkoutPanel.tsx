import { useRef, useState } from 'react'
import { useData } from '../ctx'
import { Icon } from '../components/Icon'
import { addDays, cap1, dayKey, dayLabel, dayStart } from '../util'
import { BigWorkout, currentClass, isLive, useNow, useSize } from './shared'
import { PanelHead, type PanelProps } from './panel'
import { PanelSettings } from './Settings'

/**
 * Æfing dagsins í stóru letri (sjónvarpið).
 * Sjálfvirkt: námskeið tímans sem er í gangi eða næstur, og skiptir yfir á nýjan dag á miðnætti.
 */
export default function WorkoutPanel(pp: PanelProps) {
  const { cfg, setCfg } = pp
  const now = useNow()
  const today = dayKey(now)
  const [settings, setSettings] = useState<null | 'type' | 'day' | 'prog'>(null)
  const day = cfg.autoDay || !cfg.day ? today : cfg.day

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
  const step = (n: number) => setCfg({ ...cfg, day: addDays(day, n), autoDay: false })

  return (
    <div className="kp-panel">
      <PanelHead {...pp} title="Æfing" onSettings={() => setSettings('prog')} sub={
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          <button className="kp-mini" aria-label="Fyrri dagur" onClick={() => step(-1)}><Icon name="back" size={18} /></button>
          <button className="kp-date" onClick={() => setSettings('day')}>{cap1(dayLabel(day))}{cfg.autoDay ? '' : ' · fastur'}</button>
          <button className="kp-mini" aria-label="Næsti dagur" onClick={() => step(1)}><Icon name="next" size={18} /></button>
          <button className="kp-prog" onClick={() => setSettings('prog')} aria-label="Skipta um námskeið">
            <span className="cb-dot" style={{ background: prog?.color, width: 11, height: 11, border: 0 }} />{prog?.name ?? 'Námskeið'}{cfg.prog ? '' : ' · sjálfvirkt'}<Icon name="down" size={16} />
          </button>
        </div>
      } />
      <div className="kp-body wp-body" ref={body}>
        {live
          ? <BigWorkout w={live} title={`${prog?.name ?? ''} – ${cap1(dayLabel(day))}`} scale={cfg.zoom} columns={cols} />
          : <div className="cb-none" style={{ margin: 'auto' }}>Engin birt æfing fyrir {prog?.name ?? 'þetta námskeið'} {dayLabel(day)}</div>}
      </div>
      {settings && programs && (
        <PanelSettings cfg={cfg} day={day} programs={programs} autoName={cur?.program} startOpen={settings}
          onApply={(c) => setCfg(c)} onClose={() => setSettings(null)} />
      )}
    </div>
  )
}
