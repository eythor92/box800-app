import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Workout } from '../api'
import { useData } from '../ctx'
import { Icon } from '../components/Icon'
import ClassSheet from '../components/ClassSheet'
import { ClassRowView, DayBar } from './Schedule'
import { addDays, cap1, dayKey, dayLabel, dayStart, mondayOf, parseLines, today } from '../util'

export function WorkoutRender({ w }: { w: Workout }) {
  return (
    <>
      {w.components.map((c, i) => {
        if (c.type === 'header') return <div key={i} className="workout-sec">{(c.title || 'KAFLI').toUpperCase()}</div>
        const head = ((c.prefix ? c.prefix + '. ' : '') + (c.title || (c.type === 'video' ? 'Myndband' : c.type === 'image' ? 'Mynd' : 'Æfing'))).trim()
        const sc = c.scoring && c.scoring !== 'Engin skráning' ? c.scoring : ''
        return (
          <div key={i} className="workout-box">
            <div className="h">{head}</div>
            <div className="b">
              {c.type === 'video' && c.url && <a href={c.url} target="_blank" rel="noreferrer">▶ Horfa á myndband</a>}
              {(c.type === 'metcon' || c.type === 'lift') && parseLines(c.body).map((l, j) => <div key={j} style={{ fontWeight: l.b ? 700 : 400, minHeight: 6 }}>{l.t}</div>)}
              {c.comment && <div style={{ marginTop: 8, color: '#c3cad1', fontStyle: 'italic' }}>{c.comment}</div>}
              {sc && <div className="score">Skráðu: {sc}{sc === 'Tími' && (c.rounds ?? 1) > 1 ? ` fyrir ${c.rounds} umferðir` : ''}{c.scaling && c.scaling !== 'Engin' ? ' · ' + c.scaling : ''}</div>}
            </div>
          </div>
        )
      })}
    </>
  )
}

export default function WorkoutView({ coach = false }: { coach?: boolean }) {
  const [params] = useSearchParams()
  const [day, setDay] = useState(params.get('d') ?? today())
  const [prog, setProg] = useState<number | null>(params.get('p') ? Number(params.get('p')) : null)
  const [open, setOpen] = useState<number | null>(null)
  const week = mondayOf(day)
  const { data: programs } = useData((a) => a.programs())
  const { data: workouts } = useData((a) => a.workouts(week, addDays(week, 6)), [week])
  const { data: classes } = useData((a) => a.classList(dayStart(day), dayStart(addDays(day, 1))), [day])
  const pid = prog ?? programs?.[0]?.id ?? null
  const p = programs?.find((x) => x.id === pid)
  const w = (workouts ?? []).find((x) => x.program_id === pid && x.day === day)
  const visible = w && (coach || w.status === 'published')
  const cls = useMemo(() => (classes ?? []).filter((c) => c.program_id === pid && dayKey(new Date(c.starts_at)) === day), [classes, pid, day])
  const sel = (classes ?? []).find((c) => c.id === open)

  return (
    <>
      <div style={{ background: 'var(--card-2)', borderBottom: '1px solid var(--line)', padding: '12px 0 0' }}>
        <div className="chips" style={{ padding: '0 16px' }}>
          {(programs ?? []).map((x) => (
            <button key={x.id} className={`chip${x.id === pid ? ' on' : ''}`} onClick={() => setProg(x.id)} aria-pressed={x.id === pid}>{x.name}</button>
          ))}
        </div>
        <DayBar week={week} day={day} setDay={setDay} />
      </div>
      <div style={{ padding: '20px 16px 0' }}>
        <div className="display" style={{ fontSize: 28 }}>{p?.name} – {dayLabel(day)}</div>
        {coach && <div className="stat" style={{ marginTop: 10, fontSize: 14, color: '#b9c1ca' }}>Aðeins eigandi skrifar og breytir æfingum, í stjórnborðinu.{w && w.status !== 'published' ? ' Þessi æfing er enn í drögum.' : ''}</div>}
        {visible ? <WorkoutRender w={w!} /> : (
          <div className="empty" style={{ marginTop: 18 }}>
            {day > today() ? 'Æfingin birtist kl. 20:00 kvöldið áður.' : 'Engin æfing skráð fyrir þennan dag.'}
          </div>
        )}
      </div>
      {cls.length > 0 && (
        <>
          <div style={{ marginTop: 26, background: 'var(--card-2)', padding: '14px 16px', fontWeight: 700, fontSize: 17, borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
            <Icon name="cal" size={18} style={{ verticalAlign: -3, marginRight: 8 }} />{cap1(dayLabel(day, true))} – tímar með þessari æfingu
          </div>
          {cls.map((c) => <ClassRowView key={c.id} c={c} onOpen={() => setOpen(c.id)} />)}
        </>
      )}
      {sel && <ClassSheet c={sel} onClose={() => setOpen(null)} />}
    </>
  )
}
