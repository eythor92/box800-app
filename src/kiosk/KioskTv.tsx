import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../ctx'
import { Icon } from '../components/Icon'
import { addDays, cap1, dayKey, dayLabel, dayStart, hhmm } from '../util'
import { BigWorkout, currentClass, fullscreen, isLive, useLocal, useNow, useWakeLock } from './shared'

/**
 * Sjónvarpið: æfing dagsins í stóru letri.
 * Sjálfvirkt: sýnir námskeið tímans sem er í gangi/næstur, og æfingu morgundagsins eftir kl. 21.
 * Stillingar birtast þegar mús er hreyfð eða skjár snertur, og þetta tæki man þær.
 */
export default function KioskTv() {
  const nav = useNavigate()
  const now = useNow()
  useWakeLock()
  const [cfg, setCfg] = useLocal('box800-kiosk-tv', { prog: 0, autoDay: true, scale: 1, cols: 0 })
  const [manualDay, setManualDay] = useState(dayKey(new Date()))
  const today = dayKey(now)
  const day = cfg.autoDay ? (now.getUTCHours() >= 21 ? addDays(today, 1) : today) : manualDay

  const { data: programs } = useData((a) => a.programs())
  const { data: classes } = useData((a) => a.classList(dayStart(day), dayStart(addDays(day, 1))), [day])
  const { data: workouts } = useData((a) => a.workouts(day, day), [day])

  const cur = classes ? currentClass(day === today ? classes : classes.filter((c) => !c.cancelled), day === today ? now : new Date(0)) : undefined
  const pid = cfg.prog || cur?.program_id || programs?.[0]?.id
  const prog = programs?.find((p) => p.id === pid)
  const w = (workouts ?? []).find((x) => x.program_id === pid && x.day === day)
  const live = isLive(w, now) ? w : undefined
  const [wh, setWh] = useState(() => [window.innerWidth, window.innerHeight])
  useEffect(() => { const f = () => setWh([window.innerWidth, window.innerHeight]); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  const landscape = wh[0] > wh[1] * 1.15
  const cols = cfg.cols || (landscape && (live?.components.length ?? 0) >= 2 ? 2 : 1)

  // Stjórnstika: birtist við hreyfingu, hverfur eftir 4 sek.
  const [bar, setBar] = useState(true)
  const t = useRef<number>()
  useEffect(() => {
    const show = () => { setBar(true); clearTimeout(t.current); t.current = window.setTimeout(() => setBar(false), 4000) }
    show()
    window.addEventListener('mousemove', show); window.addEventListener('touchstart', show); window.addEventListener('keydown', show)
    return () => { window.removeEventListener('mousemove', show); window.removeEventListener('touchstart', show); window.removeEventListener('keydown', show); clearTimeout(t.current) }
  }, [])

  const title = `${prog?.name ?? ''} – ${cap1(dayLabel(day, true))}`
  return (
    <div className="kiosk-tv" style={{ cursor: bar ? 'default' : 'none' }}>
      <div className="tv-top">
        <img src="myndir/logo-white.png" alt="BOX800" />
        {cur && day === today && <span className="tv-next">{cur.program} kl. {hhmm(cur.starts_at)}</span>}
        <span className="tv-clock">{hhmm(now.toISOString())}</span>
      </div>
      <div className="tv-body">
        {live
          ? <BigWorkout w={live} title={title} scale={cfg.scale} columns={cols} />
          : <div className="tv-empty"><div className="display" style={{ fontSize: '6vmin' }}>{title}</div><div style={{ fontSize: '3vmin', color: 'var(--muted)', marginTop: '2vmin' }}>Æfingin birtist hér um leið og hún er birt</div></div>}
      </div>

      {bar && (
        <div className="tv-bar" role="toolbar" aria-label="Stillingar sjónvarps">
          <select className="select" value={cfg.prog} onChange={(e) => setCfg({ ...cfg, prog: Number(e.target.value) })} aria-label="Námskeið">
            <option value={0}>Námskeið: sjálfvirkt</option>
            {(programs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn" aria-label="Fyrri dagur" onClick={() => { setManualDay(addDays(day, -1)); setCfg({ ...cfg, autoDay: false }) }}><Icon name="back" /></button>
            <button className={`chip${cfg.autoDay ? ' on' : ''}`} onClick={() => { setCfg({ ...cfg, autoDay: !cfg.autoDay }); setManualDay(day) }}>{cfg.autoDay ? 'Dagur: sjálfvirkt' : dayLabel(day)}</button>
            <button className="icon-btn" aria-label="Næsti dagur" onClick={() => { setManualDay(addDays(day, 1)); setCfg({ ...cfg, autoDay: false }) }}><Icon name="next" /></button>
          </div>
          <div className="row" style={{ gap: 4 }}>
            <button className="btn btn-ghost btn-sm" aria-label="Minna letur" onClick={() => setCfg({ ...cfg, scale: Math.max(0.5, +(cfg.scale - 0.1).toFixed(2)) })}>A−</button>
            <span style={{ minWidth: 48, textAlign: 'center', fontWeight: 800 }}>{Math.round(cfg.scale * 100)}%</span>
            <button className="btn btn-ghost btn-sm" aria-label="Stærra letur" onClick={() => setCfg({ ...cfg, scale: Math.min(1.6, +(cfg.scale + 0.1).toFixed(2)) })}>A+</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setCfg({ ...cfg, cols: cols === 1 ? 2 : 1 })}>{cols === 1 ? '1 dálkur' : '2 dálkar'}</button>
          <button className="btn btn-ghost btn-sm" onClick={fullscreen}>Fullur skjár</button>
          <button className="icon-btn" aria-label="Loka kiosk" onClick={() => nav('/thjalfari')}><Icon name="x" /></button>
        </div>
      )}
    </div>
  )
}
