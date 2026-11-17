import { useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'

export type PanelType = 'coachboard' | 'workout'
export interface PanelCfg { type: PanelType; zoom: number; prog: number; autoDay: boolean; day?: string }
export interface PanelProps {
  zoom: number
  cfg: PanelCfg
  setCfg: (c: PanelCfg) => void
  onRemove?: () => void
}
export const PANEL_NAMES: Record<PanelType, string> = { coachboard: 'Innskráning', workout: 'Æfing' }

/** Haus á glugga: „⠿ Innskráning ▾“, dagsetning, stærðarsleði og loka */
export function PanelHead({ title, sub, cfg, setCfg, onRemove, onSettings }: PanelProps & { title: string; sub?: ReactNode; onSettings?: () => void }) {
  const [open, setOpen] = useState(false)
  const z = cfg.zoom
  const setZ = (v: number) => setCfg({ ...cfg, zoom: Math.min(2.5, Math.max(0.5, Math.round(v * 20) / 20)) })
  return (
    <div className="kp-head">
      <div style={{ position: 'relative', minWidth: 0 }}>
        <button className="kp-title" aria-haspopup="menu" aria-expanded={open} onClick={() => (onSettings ? onSettings() : setOpen(!open))}>
          <span className="grip" aria-hidden>⠿</span>{title}<Icon name="down" size={20} />
        </button>
        {open && (
          <div className="cb-menu" role="menu" style={{ left: 0, right: 'auto', top: '100%' }}>
            {(Object.keys(PANEL_NAMES) as PanelType[]).map((t) => (
              <button key={t} role="menuitem" aria-current={t === cfg.type} onClick={() => { setOpen(false); setCfg({ ...cfg, type: t }) }}>{PANEL_NAMES[t]}</button>
            ))}
          </div>
        )}
        {sub && <div className="kp-sub">{sub}</div>}
      </div>
      <div className="kp-zoom">
        <button className="kp-mini" aria-label="Minnka" onClick={() => setZ(z - 0.1)}>−</button>
        <input type="range" min={0.5} max={2.5} step={0.05} value={z} onChange={(e) => setZ(Number(e.target.value))} aria-label="Stærð" />
        <button className="kp-mini" aria-label="Stækka" onClick={() => setZ(z + 0.1)}>+</button>
        <span className="pct">{Math.round(z * 100)}%</span>
        <button className="kp-mini" aria-label="Upprunaleg stærð" title="100%" onClick={() => setZ(1)}><Icon name="reuse" size={16} /></button>
        {onRemove && <button className="kp-mini" aria-label="Loka glugga" onClick={onRemove}><Icon name="x" size={18} /></button>}
      </div>
    </div>
  )
}
