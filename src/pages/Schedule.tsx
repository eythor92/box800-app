import { useMemo, useState } from 'react'
import type { ClassRow } from '../api'
import { useData } from '../ctx'
import { Avatar, Icon } from '../components/Icon'
import ClassSheet, { classState } from '../components/ClassSheet'
import { addDays, dayKey, dayStart, DAYS_SHORT, hhmm, minutesBetween, mondayOf, parseDay, shortTime, today } from '../util'
import { useSwipeDays } from '../swipe'

export function ClassRowView({ c, onOpen }: { c: ClassRow; onOpen: () => void }) {
  const st = classState(c)
  return (
    <button className={`class-row${st.past && !st.booked ? ' past' : ''}`} onClick={onOpen}>
      <div className="time"><b>{shortTime(c.starts_at)}</b><span>{minutesBetween(c.starts_at, c.ends_at)} mín</span></div>
      <div className="grow">
        <div className="row" style={{ gap: 8 }}>
          {c.color && c.color !== '#c0c7d1' && <span className="dot" style={{ background: c.color }} />}
          <span className="name ellipsis">{c.program}: {hhmm(c.starts_at)}</span>
        </div>
        <div className="meta"><Icon name="people" size={18} />{c.booked} | {c.cap}{c.waiting && !st.past ? `  ·  ${c.waiting} á biðlista` : ''}</div>
      </div>
      {st.badge ? <span className={`badge ${st.badge.cls}`}>{st.badge.text}</span> : <Avatar src={c.coach_avatar} name={c.coach_name ?? '?'} />}
    </button>
  )
}

export function DayBar({ week, day, setDay }: { week: string; day: string; setDay: (d: string) => void }) {
  return (
    <div className="daybar">
      {DAYS_SHORT.map((d, i) => {
        const k = addDays(week, i)
        return (
          <button key={k} className={k === day ? 'on' : ''} onClick={() => setDay(k)} aria-label={`${d} ${parseDay(k).getUTCDate()}.`} aria-pressed={k === day}>
            <span className="d">{d}</span><span className="n">{parseDay(k).getUTCDate()}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function Schedule() {
  const [day, setDay] = useState(today())
  useSwipeDays(() => setDay((d) => addDays(d, 1)), () => setDay((d) => addDays(d, -1)))
  const [prog, setProg] = useState<number | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const week = mondayOf(day)
  const { data, error } = useData((a) => a.classList(dayStart(week), dayStart(addDays(week, 7))), [week])
  const classes = useMemo(() => (data ?? []).filter((c) => dayKey(new Date(c.starts_at)) === day && (prog == null || c.program_id === prog)), [data, day, prog])
  const programs = useMemo(() => {
    const m = new Map<number, string>(); (data ?? []).forEach((c) => m.set(c.program_id, c.program)); return [...m]
  }, [data])
  const sel = (data ?? []).find((c) => c.id === open)

  return (
    <>
      <div style={{ background: 'var(--card-2)', borderBottom: '1px solid var(--line)' }}>
        <div className="row" style={{ justifyContent: 'space-between', padding: '10px 10px 0' }}>
          <button className="icon-btn" aria-label="Fyrri vika" onClick={() => setDay(addDays(week, -7))}><Icon name="back" /></button>
          <select className="select" style={{ width: 'auto', border: 0, background: 'transparent', color: 'var(--accent)', fontWeight: 700, textAlign: 'center' }}
            value={prog ?? ''} onChange={(e) => setProg(e.target.value ? Number(e.target.value) : null)} aria-label="Námskeið">
            <option value="">Allir tímar</option>
            {programs.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <button className="icon-btn" aria-label="Næsta vika" onClick={() => setDay(addDays(week, 7))}><Icon name="next" /></button>
        </div>
        <DayBar week={week} day={day} setDay={setDay} />
      </div>
      {error && <div className="error" style={{ margin: 16 }}>{error}</div>}
      {!data && !error && <div className="spinner" />}
      {data && classes.length === 0 && <div className="empty" style={{ margin: 16 }}>Engir tímar þennan dag.</div>}
      {classes.map((c) => <ClassRowView key={c.id} c={c} onOpen={() => setOpen(c.id)} />)}
      {sel && <ClassSheet c={sel} onClose={() => setOpen(null)} />}
    </>
  )
}
