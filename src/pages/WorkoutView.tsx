import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Result, Workout, WorkoutComponent } from '../api'
import { useData } from '../ctx'
import { useNavigate } from 'react-router-dom'
import ScoreSheet from '../components/ScoreSheet'
import { compKey, compTitle, fmtResult, kindOf } from '../score'
import { Icon } from '../components/Icon'
import ClassSheet from '../components/ClassSheet'
import { ClassRowView, DayBar } from './Schedule'
import { addDays, cap1, dayKey, dayLabel, dayStart, mondayOf, parseLines, today } from '../util'

export interface ScoreCtx {
  results: Result[]
  onLog: (c: WorkoutComponent, i: number, existing?: Result) => void
  onHistory: (movementId: number) => void
}

export function WorkoutRender({ w, ctx }: { w: Workout; ctx?: ScoreCtx }) {
  return (
    <>
      {w.components.map((c, i) => {
        if (c.type === 'header') return <div key={i} className="workout-sec">{(c.title || 'KAFLI').toUpperCase()}</div>
        const sc = c.scoring && c.scoring !== 'Engin skráning' && c.type === 'metcon' ? c.scoring : ''
        const kind = kindOf(c)
        const mine = ctx?.results.find((r) => r.workout_id === w.id && r.comp_key === compKey(c, i))
        return (
          <div key={i} className="workout-box">
            <div className="h">{compTitle(c)}</div>
            {ctx && c.type === 'lift' && c.movement_id && (
              <button className="wb-link" onClick={() => ctx.onHistory(c.movement_id!)}>Skoða sögu<Icon name="next" size={16} /></button>
            )}
            <div className="b">
              {c.type === 'video' && c.url && <a href={c.url} target="_blank" rel="noreferrer">▶ Horfa á myndband</a>}
              {(c.type === 'metcon' || c.type === 'lift') && parseLines(c.body).map((l, j) => <div key={j} style={{ fontWeight: l.b ? 700 : 400, minHeight: 6 }}>{l.t}</div>)}
              {c.comment && <div style={{ marginTop: 8, color: '#c3cad1', fontStyle: 'italic' }}>{c.comment}</div>}
              {sc && !ctx && <div className="score">Skráðu: {sc}{sc === 'Tími' && (c.rounds ?? 1) > 1 ? ` fyrir ${c.rounds} umferðir` : ''}{c.scaling && c.scaling !== 'Engin' ? ' · ' + c.scaling : ''}</div>}
            </div>
            {ctx && kind && w.id && (
              mine
                ? <button className="wb-score" onClick={() => ctx.onLog(c, i, mine)}><span className="label">Þitt skor</span><b>{fmtResult(mine)}</b>{mine.rx && <span className="badge badge-outline">{mine.rx}</span>}<Icon name="edit" size={16} /></button>
                : <button className="wb-log" onClick={() => ctx.onLog(c, i)}>+ Skrá skor</button>
            )}
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
  const nav = useNavigate()
  const { data: results } = useData((a) => a.myComponentResults(day, day), [day])
  const [log, setLog] = useState<null | { c: WorkoutComponent; i: number; r?: Result }>(null)
  const scorable = visible && w!.components.some((c) => kindOf(c))
  const ctx: ScoreCtx | undefined = visible && !coach ? {
    results: results ?? [],
    onLog: (c, i, r) => setLog({ c, i, r }),
    onHistory: (m) => nav('/arangur/' + m),
  } : undefined

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
        {scorable && w?.id && (
          <button className="lb-link" onClick={() => nav(`/stigatafla/${w.id}?d=${day}`)}><Icon name="chart" size={20} /><span className="grow">Skoða stigatöflu</span><Icon name="next" size={18} /></button>
        )}
        {visible ? <WorkoutRender w={w!} ctx={ctx} /> : (
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
      {log && w?.id && (
        <ScoreSheet title={compTitle(log.c)} sub={p?.name + ' · ' + dayLabel(day)} scaling={log.c.scaling} onClose={() => setLog(null)}
          initial={log.r ?? { day, workout_id: w.id, comp_key: compKey(log.c, log.i), kind: kindOf(log.c)!, movement_id: log.c.movement_id ?? null, sets: log.c.sets ?? 1, reps: log.c.reps ?? null }} />
      )}
    </>
  )
}
