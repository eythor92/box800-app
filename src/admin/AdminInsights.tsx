import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../ctx'
import { Avatar } from '../components/Icon'
import { addDays, dayLabel, today } from '../util'

type Preset = '30' | '90' | 'year' | 'month' | 'all' | 'custom'

/** Innsýn: aðeins fyrir eiganda. Hverjir mæta oftast, skrópa oftast og eiga flest PR. */
export default function AdminInsights() {
  const nav = useNavigate()
  const t = today()
  const [preset, setPreset] = useState<Preset>('30')
  const [custom, setCustom] = useState({ from: addDays(t, -30), to: t })
  const range = (() => {
    switch (preset) {
      case '30': return { from: addDays(t, -29), to: t }
      case '90': return { from: addDays(t, -89), to: t }
      case 'month': return { from: t.slice(0, 8) + '01', to: t }
      case 'year': return { from: t.slice(0, 5) + '01-01', to: t }
      case 'all': return { from: '2000-01-01', to: t }
      default: return custom
    }
  })()
  const { data: rows } = useData((a) => a.insights(range.from, range.to), [range.from, range.to])
  const { data: sum } = useData((a) => a.insightsSummary(range.from, range.to), [range.from, range.to])
  const list = (k: 'attend' | 'noshow' | 'pr') => (rows ?? []).filter((r) => r.kind === k)

  const presets: [Preset, string][] = [['30', 'Síðustu 30 dagar'], ['month', 'Þessi mánuður'], ['90', 'Síðustu 90 dagar'], ['year', 'Þetta ár'], ['all', 'Frá upphafi'], ['custom', 'Velja tímabil']]
  const cards: ['attend' | 'noshow' | 'pr', string, string, string][] = [
    ['attend', 'Mæta oftast', 'tímar', 'var(--ok)'],
    ['noshow', 'Skrópa oftast', 'sinnum', 'var(--warn)'],
    ['pr', 'Flest PR', 'PR', '#f2b84b'],
  ]

  return (
    <>
      <h1>Innsýn</h1>
      <div className="muted" style={{ fontSize: 14 }}>Aðeins þú sérð þetta. Iðkendur og þjálfarar sjá hvorki fjarvistir né þessa lista.</div>

      <div className="row" style={{ flexWrap: 'wrap', marginTop: 18, gap: 8 }}>
        {presets.map(([p, l]) => <button key={p} className={`chip${preset === p ? ' on' : ''}`} onClick={() => setPreset(p)}>{l}</button>)}
      </div>
      {preset === 'custom' && (
        <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="field"><span>Frá</span><input className="input" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value || custom.from })} /></label>
          <label className="field"><span>Til</span><input className="input" type="date" value={custom.to} min={custom.from} max={t} onChange={(e) => setCustom({ ...custom, to: e.target.value || custom.to })} /></label>
        </div>
      )}
      <div className="muted" style={{ marginTop: 10, fontSize: 14 }}>{preset === 'all' ? 'Frá upphafi' : `${dayLabel(range.from)} – ${dayLabel(range.to)}`}</div>

      <div className="ins-stats">
        <div><span>Mætingar</span><b>{sum?.visits ?? '…'}</b></div>
        <div><span>Virkir iðkendur</span><b>{sum?.active_members ?? '…'}</b><small>mættu a.m.k. einu sinni</small></div>
        <div><span>Tímar</span><b>{sum?.classes ?? '…'}</b><small>{sum && sum.classes ? `${(sum.visits / sum.classes).toFixed(1).replace('.', ',')} að meðaltali í tíma` : ''}</small></div>
        <div><span>Fjarvistir</span><b>{sum?.no_shows ?? '…'}</b></div>
        <div><span>PR</span><b>{sum?.prs ?? '…'}</b></div>
      </div>

      <div className="ins-grid">
        {cards.map(([k, title, unit, color]) => (
          <section key={k} className="a-card">
            <h2 className="mp-h" style={{ marginTop: 0 }}>{title}</h2>
            {rows && list(k).length === 0 && <div className="muted">Ekkert á þessu tímabili.</div>}
            {!rows && <div className="spinner" />}
            {list(k).map((r, i) => (
              <button key={r.profile_id} className="ins-row" onClick={() => nav('/stjorn/idkendur/' + r.profile_id)}>
                <span className="rk">{i + 1}.</span>
                <Avatar src={r.avatar_url} name={r.full_name} size={36} />
                <span className="grow ellipsis">{r.full_name}</span>
                <b style={{ color }}>{r.n}</b><small className="muted">{unit}</small>
              </button>
            ))}
          </section>
        ))}
      </div>
    </>
  )
}
