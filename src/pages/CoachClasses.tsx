import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useData } from '../ctx'
import { Avatar } from '../components/Icon'
import { DayBar } from './Schedule'
import { addDays, dayKey, dayStart, hhmm, minutesBetween, mondayOf, shortTime, today } from '../util'

export default function CoachClasses() {
  const { me } = useApp()
  const nav = useNavigate()
  const [day, setDay] = useState(today())
  const [mine, setMine] = useState(false)
  const week = mondayOf(day)
  const { data, error } = useData((a) => a.classList(dayStart(week), dayStart(addDays(week, 7))), [week])
  const list = useMemo(() => (data ?? []).filter((c) => dayKey(new Date(c.starts_at)) === day && (!mine || c.coach_id === me.id)), [data, day, mine, me.id])

  return (
    <>
      <div className="row" style={{ padding: '14px 16px 6px' }}>
        <Avatar src={me.avatar_url} name={me.full_name} />
        <div className="grow"><div style={{ fontWeight: 700 }}>{me.full_name}</div><div className="muted" style={{ fontSize: 14 }}>{me.role === 'owner' ? 'Eigandi og þjálfari' : 'Þjálfari'}</div></div>
        <button className={`chip${mine ? ' on' : ''}`} onClick={() => setMine(!mine)} aria-pressed={mine}>Mínir tímar</button>
      </div>
      <div style={{ borderBottom: '1px solid var(--line)' }}><DayBar week={week} day={day} setDay={setDay} /></div>
      {error && <div className="error" style={{ margin: 16 }}>{error}</div>}
      {!data && !error && <div className="spinner" />}
      {data && list.length === 0 && <div className="empty" style={{ margin: 16 }}>Engir tímar.</div>}
      {list.map((c) => {
        const past = new Date(c.ends_at) < new Date(), full = c.booked >= c.cap
        return (
          <button key={c.id} className="class-row" onClick={() => nav(`/thjalfari/timi/${c.id}`)}>
            <div className="time"><b>{shortTime(c.starts_at)}</b><span>{minutesBetween(c.starts_at, c.ends_at)} mín</span></div>
            <div className="grow">
              <div className="display" style={{ fontSize: 20 }}>{c.program}: {hhmm(c.starts_at)}</div>
              <div className="muted" style={{ fontSize: 14 }}>{c.coach_name ?? 'Enginn þjálfari'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{c.booked} | {c.cap}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.cancelled ? 'var(--danger)' : full ? 'var(--warn)' : 'var(--muted)' }}>
                {c.cancelled ? 'Aflýst' : past ? 'Lokið' : full ? (c.waiting ? `Fullt · ${c.waiting} bíða` : 'Fullt') : `${c.cap - c.booked} laus`}
              </div>
            </div>
          </button>
        )
      })}
    </>
  )
}
