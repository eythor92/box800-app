import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../ctx'
import { Icon } from '../components/Icon'
import ClassSheet from '../components/ClassSheet'
import { addDays, dayKey, dayStart, DAYS_SHORT, hhmm, mondayOf, parseLines, relDay, today } from '../util'
import { kg } from '../score'
import { useNow } from '../kiosk/shared'

const MILESTONES = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000]
const MONTHS_LONG = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember']

export default function Home() {
    const nav = useNavigate()
  const now = useNow(30000)
  const [open, setOpen] = useState<number | null>(null)
  const t = today()
  const week = mondayOf(t)
  const { data } = useData((a) => a.classList(dayStart(week), dayStart(addDays(t, 14))), [week, t])
  const { data: att } = useData((a) => a.myAttendance())
  const { data: lifts } = useData((a) => a.myLifts())
  const { data: programs } = useData((a) => a.programs())
  const { data: wods } = useData((a) => a.workouts(t, t), [t])

  const upcoming = useMemo(() => (data ?? []).filter((c) => (c.my_status === 'booked' || c.my_status === 'waitlist') && new Date(c.ends_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [data, now])
  const next = upcoming[0]
  const bookedDays = new Set((data ?? []).filter((c) => c.my_status === 'booked').map((c) => dayKey(new Date(c.starts_at))))
  const attendedDays = new Set((att ?? []).map((a) => dayKey(new Date(a.starts_at))))

  // Vikuröð: vikur í röð með mætingu
  const streak = useMemo(() => {
    const weeks = new Set((att ?? []).map((a) => mondayOf(dayKey(new Date(a.starts_at)))))
    let n = 0, w = mondayOf(t)
    if (!weeks.has(w)) w = addDays(w, -7)
    while (weeks.has(w)) { n++; w = addDays(w, -7) }
    return n
  }, [att, t])
  const thisWeek = (att ?? []).some((a) => mondayOf(dayKey(new Date(a.starts_at))) === week)

  // Tölur
  const total = att?.length ?? 0
  const month = t.slice(0, 7)
  const inMonth = (att ?? []).filter((a) => dayKey(new Date(a.starts_at)).startsWith(month)).length
  const goal = MILESTONES.find((m) => m > total) ?? total + 500
  const prevGoal = [...MILESTONES].reverse().find((m) => m <= total) ?? 0
  const pct = Math.round(((total - prevGoal) / (goal - prevGoal)) * 100)

  // Æfing dagsins: námskeið næsta tíma í dag, annars fyrsta námskeiðið
  const todayProg = (next && dayKey(new Date(next.starts_at)) === t ? next.program_id : null) ?? programs?.[0]?.id
  const wod = (wods ?? []).find((w) => w.program_id === todayProg && w.status === 'published' && (!w.publish_at || new Date(w.publish_at) <= now))
  const wodName = programs?.find((p) => p.id === todayProg)?.name
  const wodLines = wod ? wod.components.filter((c) => c.type !== 'header').flatMap((c) => [{ t: c.title ?? '', b: true, h: true }, ...parseLines(c.body).filter((l) => l.t.trim()).map((l) => ({ ...l, h: false }))]).filter((l) => l.t).slice(0, 7) : []

  const sel = (data ?? []).find((c) => c.id === open)

  return (
    <>
      {/* Vikuröð */}
      <section className="h-streak" style={{ marginTop: 18 }}>
        <div className="h-flame"><Icon name="flame" size={34} color={streak ? '#f2b84b' : 'var(--muted)'} /><b>{streak}</b></div>
        <div className="grow">
          <div className="h-sh">{streak ? `${streak} ${streak === 1 ? 'vika' : 'vikur'} í röð` : 'Byrjaðu nýja röð'}</div>
          <div className="muted" style={{ fontSize: 13 }}>{thisWeek ? 'Vikan er komin á blað. Vel gert!' : 'Mættu í vikunni til að halda röðinni.'}</div>
          <div className="h-week">
            {DAYS_SHORT.map((d, i) => {
              const k = addDays(week, i), done = attendedDays.has(k), booked = bookedDays.has(k) && k >= t
              return (
                <button key={k} onClick={() => nav('/timatafla')} className={`${done ? 'done' : booked ? 'booked' : ''}${k === t ? ' today' : ''}`}
                  aria-label={`${d}${done ? ', mætt' : booked ? ', bókað' : ''}`}>
                  {done ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6"><path d="M5 12l5 5L20 7" /></svg> : d[0]}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Tölur */}
      <section className="h-stats">
        <div><span>Í {MONTHS_LONG[Number(month.slice(5)) - 1]}</span><b>{inMonth}</b><small>tímar</small></div>
        <div><span>Samtals</span><b>{total}</b><small>tímar</small></div>
        <div><span>Markmið</span><b>{goal}</b><small>vantar {goal - total}</small><i style={{ width: pct + '%' }} /></div>
      </section>

      {/* Æfing dagsins */}
      <div className="section-title"><Icon name="dumb" size={20} />Æfing dagsins{wodName ? ' · ' + wodName : ''}</div>
      <div style={{ padding: '0 16px' }}>
        {wod ? (
          <button className="h-wod" onClick={() => nav(`/aefing?p=${todayProg}&d=${t}`)}>
            {wodLines.map((l, i) => <div key={i} className={l.h ? 'hh' : l.b ? 'b' : ''}>{l.t}</div>)}
            <div className="h-wod-f">Skoða alla æfinguna og skrá skor <Icon name="next" size={16} /></div>
          </button>
        ) : <div className="empty">Æfing dagsins birtist kl. 20:00 kvöldið áður.</div>}
      </div>

      {/* Bókanir þínar */}
      {upcoming.length > 0 && (
        <>
          <div className="section-title"><Icon name="cal" size={20} />Bókanir þínar</div>
          {upcoming.slice(0, 4).map((c) => (
            <button key={c.id} className="list-row" style={{ width: '100%' }} onClick={() => setOpen(c.id)}>
              <span className="dot" style={{ background: c.color }} />
              <span className="grow"><b>{c.program} {hhmm(c.starts_at)}</b><span className="muted"> · {relDay(c.starts_at)}</span></span>
              <span className={`badge ${c.my_status === 'waitlist' ? 'badge-outline' : 'badge-grey'}`}>{c.my_status === 'waitlist' ? `BIÐLISTI #${c.my_position}` : 'SKRÁÐ'}</span>
            </button>
          ))}
        </>
      )}

      {/* Bestu lyfturnar */}
      {lifts && lifts.length > 0 && (
        <>
          <div className="section-title" style={{ justifyContent: 'space-between' }}><span className="row" style={{ gap: 10 }}><Icon name="chart" size={20} />Bestu lyfturnar þínar</span><Link to="/arangur" className="h-more">Allt</Link></div>
          <div className="h-scroll">
            {lifts.slice(0, 8).map((l) => (
              <button key={l.movement_id} className="h-lift" onClick={() => nav('/arangur/' + l.movement_id)}>
                <span>{l.name}</span><b>{kg(l.best_1rm ?? l.best)}<small> kg</small></b><em>{l.best_1rm ? '1RM' : 'Þyngst'} · {relDay(l.last_day + 'T12:00:00Z').toLowerCase()}</em>
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ height: 10 }} />
      {sel && <ClassSheet c={sel} onClose={() => setOpen(null)} />}
    </>
  )
}
