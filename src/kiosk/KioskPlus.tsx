import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../ctx'
import { Icon } from '../components/Icon'
import { fullscreen, useLocal, useWakeLock } from './shared'
import { PANEL_NAMES, type PanelCfg, type PanelType } from './panel'
import Coachboard from './Coachboard'
import WorkoutPanel from './WorkoutPanel'

interface Layout { panels: PanelCfg[]; split: number; rail: boolean }
const P = (type: PanelType, zoom = 1): PanelCfg => ({ type, zoom, prog: 0, autoDay: true })
const TEMPLATES: { id: string; name: string; desc: string; panels: PanelCfg[] }[] = [
  { id: 'coachboard', name: 'Coachboard', desc: 'Innskráning og mæting', panels: [P('coachboard')] },
  { id: 'aefing', name: 'Æfing', desc: 'Æfing dagsins á sjónvarp', panels: [P('workout')] },
  { id: 'baedi', name: 'Coachboard + æfing', desc: 'Tveir gluggar hlið við hlið', panels: [P('coachboard'), P('workout', 0.8)] },
]

/**
 * Kiosk+: hvert tæki á stöðinni (tölva, sjónvarp) velur sína uppsetningu og man hana.
 * Hægt að opna beint: #/kiosk?t=coachboard, #/kiosk?t=aefing, #/kiosk?t=baedi
 */
export default function KioskPlus() {
  const { me } = useApp()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  useWakeLock()
  const [layout, setLayout] = useLocal<Layout | { panels: null; split: number; rail: boolean }>('box800-kioskplus', { panels: null, split: 0.62, rail: true })
  const [setup, setSetup] = useState(false)
  const [fs, setFs] = useState(!!document.fullscreenElement)
  useEffect(() => { const f = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f) }, [])

  const use = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)
    if (t) { setLayout({ ...layout, panels: t.panels.map((p) => ({ ...p })), split: t.panels.length > 1 ? 0.62 : layout.split }); setSetup(false) }
  }
  useEffect(() => {
    const t = params.get('t')
    if (t) { use(t); setParams({}, { replace: true }) }
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const panels = layout.panels
  const back = () => nav(me.role === 'owner' ? '/stjorn' : '/thjalfari')
  const setPanel = (i: number, c: PanelCfg) => panels && setLayout({ ...layout, panels: panels.map((p, j) => (j === i ? c : p)) })
  const remove = (i: number) => panels && setLayout({ ...layout, panels: panels.length > 1 ? panels.filter((_, j) => j !== i) : null })
  const add = () => panels && panels.length < 2 && setLayout({ ...layout, panels: [...panels, P(panels[0].type === 'workout' ? 'coachboard' : 'workout', 0.8)] })

  // Skilrúm milli glugga (dregið með mús eða fingri)
  const wrap = useRef<HTMLDivElement>(null)
  const drag = (e: React.PointerEvent) => {
    const el = wrap.current
    if (!el) return
    (e.target as HTMLElement).setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect()
      setLayout({ ...layout, split: Math.min(0.85, Math.max(0.15, (ev.clientX - r.left) / r.width)) })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  const showSetup = setup || !panels
  const rail = layout.rail && !(fs && panels)
  return (
    <div className="kp">
      <div className="kp-stage" ref={wrap}>
        {!panels && (
          <div className="kp-splash">
            <img src="myndir/logo-white.png" alt="BOX800" />
            <div className="muted" style={{ marginTop: 24, fontSize: 15, letterSpacing: 2, fontWeight: 800 }}>KIOSK+</div>
          </div>
        )}
        {panels?.map((p, i) => {
          const props = { zoom: p.zoom, cfg: p, setCfg: (c: PanelCfg) => setPanel(i, c), onRemove: () => remove(i) }
          return (
            <div key={i} style={{ display: 'contents' }}>
              {i === 1 && <div className="kp-divider" role="separator" aria-orientation="vertical" aria-label="Draga til að breyta stærð" onPointerDown={drag}><span /></div>}
              <div className="kp-slot" style={{ flex: panels.length === 1 ? 1 : `0 0 calc(${(i === 0 ? layout.split : 1 - layout.split) * 100}% - 6px)` }}>
                {p.type === 'coachboard' ? <Coachboard {...props} /> : <WorkoutPanel {...props} />}
              </div>
            </div>
          )
        })}
      </div>

      {showSetup && (
        <aside className="kp-setup" aria-label="Uppsetning Kiosk+">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontSize: 18 }}>Settu upp Kiosk+ skjáinn</b>
            {panels && <button className="kp-mini" aria-label="Loka" onClick={() => setSetup(false)}><Icon name="x" /></button>}
          </div>
          <p className="muted" style={{ fontSize: 14 }}>Veldu uppsetningu fyrir þennan skjá. Tækið man valið, svo næst opnast hún sjálfkrafa.</p>
          <div className="cb-h" style={{ marginTop: 10 }}>SNIÐMÁT</div>
          <div className="kp-tpls">
            {TEMPLATES.map((t) => (
              <button key={t.id} className="kp-tpl" onClick={() => use(t.id)}>
                <b>{t.name}</b>
                <span className="kp-thumb">{t.panels.map((p, i) => <span key={i} style={{ flex: i === 0 && t.panels.length > 1 ? 1.6 : 1 }}>{p.type === 'workout' ? 'Æ' : 'C'}</span>)}</span>
                <small>{t.panels.length} {t.panels.length === 1 ? 'gluggi' : 'gluggar'} · {t.desc}</small>
              </button>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 18 }}>
            Bein slóð fyrir sjónvarp: <code>#/kiosk?t=aefing</code><br />Fyrir innskráningartölvu: <code>#/kiosk?t=coachboard</code>
          </div>
        </aside>
      )}

      {rail ? (
        <nav className="kp-rail" aria-label="Kiosk+ valmynd">
          <button onClick={() => setSetup(!setup)}><Icon name="gear" /><span>Uppsetning</span></button>
          <button onClick={add} disabled={!panels || panels.length >= 2}><Icon name="plus" /><span>Bæta við glugga</span></button>
          <button onClick={() => { setLayout({ ...layout, panels: null }); setSetup(true) }}><Icon name="grid" /><span>Nýtt</span></button>
          <button onClick={fullscreen}><Icon name="up" /><span>{fs ? 'Hætta fullum skjá' : 'Fullur skjár'}</span></button>
          <hr />
          {panels && panels.map((p, i) => <div key={i} className="kp-rail-note">{i + 1}. {PANEL_NAMES[p.type]}</div>)}
          <div style={{ flex: 1 }} />
          <button onClick={() => setLayout({ ...layout, rail: false })}><Icon name="next" /><span>Fela stiku</span></button>
          <button onClick={back}><Icon name="back" /><span>Til baka</span></button>
        </nav>
      ) : (
        <button className="kp-rail-tab" aria-label="Sýna valmynd" onClick={() => { if (fs) fullscreen(); setLayout({ ...layout, rail: true }) }}><Icon name="back" size={18} /></button>
      )}
    </div>
  )
}
