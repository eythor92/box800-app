import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp, useData } from '../ctx'
import { DayBar } from './Schedule'
import { WorkoutRender } from './WorkoutView'
import { addDays, dayLabel, mondayOf, today } from '../util'
import { useSwipeDays } from '../swipe'
import PtVideos from '../components/PtVideos'

/** 1 on 1: æfingar sem þjálfarinn skrifar bara fyrir þig */
export default function PtView() {
  const { me } = useApp()
  const qd = new URLSearchParams(useLocation().search).get('d')
  const [day, setDay] = useState(qd && /^\d{4}-\d{2}-\d{2}$/.test(qd) ? qd : today())
  useSwipeDays(() => setDay((d) => addDays(d, 1)), () => setDay((d) => addDays(d, -1)))
  const week = mondayOf(day)
  const { data: ws } = useData((a) => a.ptWorkouts(me.id, week, addDays(week, 6)), [week, me.id])
  const w = (ws ?? []).find((x) => x.day === day)
  const days = new Set((ws ?? []).map((x) => x.day))

  return (
    <>
      <div style={{ background: 'var(--card-2)', borderBottom: '1px solid var(--line)', padding: '8px 0 0' }}>
        <DayBar week={week} day={day} setDay={setDay} />
        <div className="row" style={{ gap: 6, padding: '0 16px 10px', fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap' }}>
          {days.size ? <>Æfingar þessa viku: {[...days].sort().map((d) => <button key={d} className={`chip${d === day ? ' on' : ''}`} style={{ minHeight: 30, padding: '0 10px' }} onClick={() => setDay(d)}>{dayLabel(d).split(' ')[0]}</button>)}</> : 'Engin 1 on 1 æfing þessa viku.'}
        </div>
      </div>
      <div style={{ padding: '20px 16px 0' }}>
        <div className="label">1 on 1 · {me.full_name.split(' ')[0]}</div>
        <div className="display" style={{ fontSize: 28 }}>{dayLabel(day)}</div>
        {w ? <WorkoutRender w={w} /> : <div className="empty" style={{ marginTop: 18 }}>Engin æfing fyrir þennan dag. Þjálfarinn þinn setur æfingarnar hér inn.</div>}
        <PtVideos profileId={me.id} day={day} />
        <div style={{ height: 24 }} />
      </div>
    </>
  )
}
