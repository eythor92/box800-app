import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Result, WorkoutComponent } from '../api'
import { useApp, useData } from '../ctx'
import { Avatar, Icon } from '../components/Icon'
import ScoreSheet from '../components/ScoreSheet'
import { cap1, dayLabel, kyn, parseLines } from '../util'
import { compKey, compTitle, fmtResult, kindOf, rankCmp } from '../score'

/** Stigatafla fyrir æfingu dagsins, eins og „Leaderboard“ í Wodify */
export default function Leaderboard() {
  const wid = Number(useParams().id)
  const [params] = useSearchParams()
  const day = params.get('d') ?? ''
  const nav = useNavigate()
  const { me } = useApp()
  const { data: ws } = useData((a) => a.workouts(day, day), [day])
  const { data: programs } = useData((a) => a.programs())
  const w = ws?.find((x) => x.id === wid)
  const parts = (w?.components ?? []).map((c, i) => ({ c, i })).filter(({ c }) => kindOf(c) && kindOf(c) !== 'done')
  const [sel, setSel] = useState(0)
  const [more, setMore] = useState(false)
  const [log, setLog] = useState<null | { c: WorkoutComponent; i: number; r?: Result }>(null)
  const cur = parts[Math.min(sel, parts.length - 1)]
  const key = cur ? compKey(cur.c, cur.i) : ''
  const { data: rows } = useData((a) => (cur ? a.leaderboard(wid, key) : Promise.resolve([])), [wid, key])
  const { data: mineAll } = useData((a) => a.myComponentResults(day, day), [day])
  const mine = mineAll?.find((r) => r.workout_id === wid && r.comp_key === key)

  const sorted = [...(rows ?? [])].sort(rankCmp)
  // Jöfn sæti: „T-3“
  const ranks = sorted.map((r, i) => {
    let first = i
    while (first > 0 && rankCmp(sorted[first - 1], r) === 0) first--
    const tied = (first < i) || (i + 1 < sorted.length && rankCmp(sorted[i + 1], r) === 0)
    return (tied ? 'T-' : '') + (first + 1)
  })
  const lines = cur ? parseLines(cur.c.body) : []
  const pname = programs?.find((p) => p.id === w?.program_id)?.name

  return (
    <div style={{ paddingBottom: 30 }}>
      <div className="row" style={{ padding: '10px 8px 0' }}>
        <button className="icon-btn" aria-label="Til baka" onClick={() => nav(-1)}><Icon name="back" /></button>
        <span className="muted" style={{ fontWeight: 700 }}>{pname}{day ? ' · ' + cap1(dayLabel(day)) : ''}</span>
      </div>
      {ws && parts.length === 0 && <div className="empty" style={{ margin: 16 }}>Enginn hluti æfingarinnar er með skráningu.</div>}
      {parts.length > 1 && (
        <div className="chips" style={{ padding: '8px 16px', flexWrap: 'wrap' }}>
          {parts.map((p, j) => <button key={j} className={`chip${j === sel ? ' on' : ''}`} onClick={() => { setSel(j); setMore(false) }}>{p.c.title || compTitle(p.c)}</button>)}
        </div>
      )}
      {cur && (
        <>
          <div style={{ padding: '6px 16px 14px', borderBottom: '1px solid var(--line)' }}>
            <h1 className="display" style={{ fontSize: 34, margin: 0 }}>{cur.c.title || compTitle(cur.c)}</h1>
            {cur.c.type === 'lift' && cur.c.sets && <div className="muted" style={{ fontSize: 17 }}>{cur.c.sets} x {cur.c.reps}</div>}
            <div style={{ marginTop: 8, color: 'var(--text-2)' }}>
              {(more ? lines : lines.slice(0, 3)).map((l, j) => <div key={j} style={{ fontWeight: l.b ? 700 : 400 }}>{l.t}</div>)}
              {lines.length > 3 && <button style={{ color: 'var(--accent)', fontWeight: 700, marginTop: 4 }} onClick={() => setMore(!more)}>{more ? 'minna' : 'meira'}</button>}
            </div>
            {w?.id && <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => setLog({ c: cur.c, i: cur.i, r: mine })}>{mine ? 'Breyta mínu skori' : '+ Skrá mitt skor'}</button>}
          </div>
          {!rows && <div className="spinner" />}
          {rows && sorted.length === 0 && <div className="empty" style={{ margin: 16 }}>Engin skor skráð enn. Vertu {kyn(me.gender, 'fyrst', 'fyrstur')}!</div>}
          {sorted.map((r, i) => (
            <div key={r.profile_id} className={`lb-row${r.is_me ? ' me' : ''}`}>
              <span className="rk">{ranks[i]}</span>
              <Avatar src={r.avatar_url} name={r.full_name} size={48} />
              <span className="grow" style={{ fontWeight: 700, fontSize: 17 }}>{r.full_name}{r.rx && <span className="badge badge-outline" style={{ marginLeft: 8 }}>{r.rx}</span>}</span>
              <b>{r.kind === 'weight' ? fmtResult({ ...r, sets: null, reps: null }) : fmtResult(r)}</b>
            </div>
          ))}
        </>
      )}
      {log && w?.id && (
        <ScoreSheet title={compTitle(log.c)} sub={pname + ' · ' + dayLabel(day)} scaling={log.c.scaling} onClose={() => setLog(null)}
          initial={log.r ?? { day, workout_id: w.id, comp_key: compKey(log.c, log.i), kind: kindOf(log.c)!, movement_id: log.c.movement_id ?? null, sets: log.c.sets ?? 1, reps: log.c.reps ?? null }} />
      )}
    </div>
  )
}
