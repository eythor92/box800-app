import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../ctx'
import { Icon } from '../components/Icon'
import { relDay } from '../util'
import { kg } from '../score'

/** Árangur: allar mínar lyftur og bestu skor */
export default function Results() {
  const nav = useNavigate()
  const { data: lifts } = useData((a) => a.myLifts())
  const { data: movements } = useData((a) => a.movements())
  const [q, setQ] = useState('')
  const mine = new Set((lifts ?? []).map((l) => l.movement_id))
  const others = (movements ?? []).filter((m) => !mine.has(m.id) && (!q || m.name.toLowerCase().includes(q.toLowerCase())))

  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="section-title"><Icon name="chart" size={18} />Mínar lyftur</div>
      {!lifts && <div className="spinner" />}
      {lifts && lifts.length === 0 && <div className="empty" style={{ margin: '0 16px' }}>Engar lyftur skráðar enn. Skráðu skor í æfingu dagsins eða veldu hreyfingu hér fyrir neðan.</div>}
      {(lifts ?? []).map((l) => (
        <button key={l.movement_id} className="list-row" style={{ width: '100%' }} onClick={() => nav('/arangur/' + l.movement_id)}>
          <div className="grow">
            <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 20, textTransform: 'uppercase' }}>{l.name}</div>
            <div className="muted" style={{ fontSize: 13 }}>{l.n} skráningar · síðast {relDay(l.last_day + 'T12:00:00Z').toLowerCase()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{kg(l.best_1rm ?? l.best)} <span className="muted" style={{ fontSize: 13 }}>kg</span></div>
            <div className="muted" style={{ fontSize: 12 }}>{l.best_1rm ? '1RM' : 'þyngst'}</div>
          </div>
          <Icon name="next" size={18} color="var(--muted)" />
        </button>
      ))}

      <div className="section-title" style={{ marginTop: 10 }}><Icon name="plus" size={18} />Skrá í aðra hreyfingu</div>
      <div style={{ padding: '0 16px' }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita, t.d. deadlift" aria-label="Leita að hreyfingu" />
      </div>
      <div className="chips" style={{ flexWrap: 'wrap', padding: '12px 16px' }}>
        {others.map((m) => <button key={m.id} className="chip" onClick={() => nav('/arangur/' + m.id)}>{m.name}</button>)}
      </div>
    </div>
  )
}
