import { useState } from 'react'
import { useData } from '../ctx'
import { Icon } from '../components/Icon'
import { DayEditor } from './AdminWorkouts'
import PtVideos from '../components/PtVideos'
import { addDays, dayLabel, mondayOf, today } from '../util'

/** 1 on 1: vikuritill fyrir æfingar eins iðkanda (á prófíl í stjórnborði) */
export default function PtPlanner({ profileId, name }: { profileId: string; name: string }) {
  const [week, setWeek] = useState(mondayOf(today()))
  const [days5, setDays5] = useState(true)
  const { data: workouts } = useData((a) => a.ptWorkouts(profileId, week, addDays(week, 7)), [profileId, week])
  const { data: movements, reload: reloadMov } = useData((a) => a.movements())
  const n = days5 ? 5 : 7
  return (
    <section style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="muted" style={{ fontSize: 14 }}>Æfingar sem aðeins {name.split(' ')[0]} sér, undir <b style={{ color: 'var(--text)' }}>1 on 1</b> í appinu.</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 4, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 3, padding: 4 }}>
            {([[true, 'Mán–fös'], [false, 'Öll vikan']] as const).map(([v, l]) => <button key={l} className={`chip${days5 === v ? ' on' : ''}`} style={{ minHeight: 36 }} onClick={() => setDays5(v)}>{l}</button>)}
          </div>
          <div className="row" style={{ gap: 4, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 3, padding: 4 }}>
            <button className="icon-btn" aria-label="Fyrri vika" onClick={() => setWeek(addDays(week, -7))}><Icon name="back" /></button>
            <div style={{ minWidth: 190, textAlign: 'center', fontWeight: 700 }}>Vika {dayLabel(week)} – {dayLabel(addDays(week, 6))}</div>
            <button className="icon-btn" aria-label="Næsta vika" onClick={() => setWeek(addDays(week, 7))}><Icon name="next" /></button>
          </div>
        </div>
      </div>
      <div className="wk-board" style={{ ['--cols' as string]: n }}>
        {Array.from({ length: n }, (_, i) => addDays(week, i)).map((d) => (
          <DayEditor key={profileId + d} prog={0} day={d} compact pt={{ profileId, name }}
            programs={[]} movements={movements ?? []} workouts={workouts ?? []} reloadMov={reloadMov} />
        ))}
      </div>
      <PtVideos profileId={profileId} staff name={name} />
    </section>
  )
}
