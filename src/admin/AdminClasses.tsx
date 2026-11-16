import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, useData } from '../ctx'
import { Icon } from '../components/Icon'
import { addDays, cap1, dayKey, dayLabel, dayStart, errMsg, hhmm, today, weekdayIdx, DAYS_SHORT } from '../util'

export default function AdminClasses() {
  const { api, toast, refresh } = useApp()
  const [day, setDay] = useState(today())
  const [scope, setScope] = useState<Record<number, 'one' | 'all'>>({})
  const { data, error } = useData((a) => a.classList(dayStart(day), dayStart(addDays(day, 1))), [day])
  const { data: programs } = useData((a) => a.programs())
  const list = useMemo(() => (data ?? []).filter((c) => dayKey(new Date(c.starts_at)) === day), [data, day])

  async function setCap(id: number, cap: number, sc: 'one' | 'all') {
    if (cap < 1) return
    try { const n = await api.setCap(id, cap, sc); toast(`Hámark ${cap}${n ? ` – ${n} ${n === 1 ? 'fór' : 'fóru'} sjálfkrafa inn af biðlista` : ''}`); refresh() } catch (e) { toast(errMsg(e)) }
  }

  const cols = '80px minmax(0,1.4fr) minmax(0,1fr) 100px 160px 90px minmax(0,1.3fr) 110px'
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Tímar og fjöldi</h1>
          <div className="muted" style={{ fontSize: 14 }}>Breyttu hámarksfjölda hvenær sem er, fyrir hvern tíma. Ef plássum fjölgar fer fólk sjálfkrafa inn af biðlista.</div>
        </div>
        <div className="row" style={{ gap: 4, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 3, padding: 4 }}>
          <button className="icon-btn" aria-label="Fyrri dagur" onClick={() => setDay(addDays(day, -1))}><Icon name="back" /></button>
          <div style={{ minWidth: 210, textAlign: 'center', fontWeight: 700 }}>{cap1(dayLabel(day, true))}</div>
          <button className="icon-btn" aria-label="Næsti dagur" onClick={() => setDay(addDays(day, 1))}><Icon name="next" /></button>
        </div>
      </div>
      {error && <div className="error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="a-table" style={{ marginTop: 22 }}>
        <div style={{ minWidth: 980 }}>
          <div className="thead" style={{ gridTemplateColumns: cols }}>
            <div>TÍMI</div><div>NÁMSKEIÐ</div><div>ÞJÁLFARI</div><div>SKRÁÐIR</div><div>HÁMARK</div><div>BIÐLISTI</div><div>BREYTING GILDIR FYRIR</div><div></div>
          </div>
          {!data && !error && <div className="spinner" />}
          {data && list.length === 0 && <div className="tr muted">Engir tímar þennan dag.</div>}
          {list.map((c) => {
            const sc = scope[c.id] ?? 'one'
            return (
              <div key={c.id} className="tr" style={{ gridTemplateColumns: cols }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{hhmm(c.starts_at)}</div>
                <Link to={`/thjalfari/timi/${c.id}`} className="row" style={{ fontWeight: 700, textDecoration: 'none', gap: 8 }}><span className="dot" style={{ background: c.color }} />{c.program}{c.cancelled && <span className="badge badge-danger">AFLÝST</span>}</Link>
                <div style={{ color: '#c3cad1' }}>{c.coach_name ?? '–'}</div>
                <div style={{ fontWeight: 700, color: c.booked > c.cap ? 'var(--warn)' : undefined }}>{c.booked} / {c.cap}</div>
                <div className="stepper">
                  <button aria-label="Fækka plássum" onClick={() => setCap(c.id, c.cap - 1, sc)}>−</button>
                  <span>{c.cap}</span>
                  <button aria-label="Fjölga plássum" onClick={() => setCap(c.id, c.cap + 1, sc)}>+</button>
                </div>
                <div style={{ fontWeight: 700, color: c.waiting ? 'var(--warn)' : 'var(--muted)' }}>{c.waiting ? `${c.waiting} bíða` : '–'}</div>
                <select className="select" style={{ height: 40, fontSize: 14 }} value={sc} aria-label="Breyting gildir fyrir" onChange={(e) => setScope({ ...scope, [c.id]: e.target.value as 'one' | 'all' })}>
                  <option value="one">Bara þennan tíma</option>
                  <option value="all">Alla {DAYS_SHORT[weekdayIdx(day)].toLowerCase()}. kl. {hhmm(c.starts_at)}</option>
                </select>
                <button className="btn btn-sm btn-danger" onClick={async () => { try { await api.cancelClass(c.id, !c.cancelled); toast(c.cancelled ? 'Tíminn er aftur virkur' : 'Tíma aflýst – skráðir fá tilkynningu'); refresh() } catch (e) { toast(errMsg(e)) } }}>{c.cancelled ? 'Endurvekja' : 'Aflýsa'}</button>
              </div>
            )
          })}
        </div>
      </div>
      {list.some((c) => c.booked > c.cap) && <div className="muted" style={{ marginTop: 8, fontSize: 13, color: 'var(--warn)' }}>Fleiri skráðir en hámark í sumum tímum. Enginn er afskráður sjálfkrafa, en enginn nýr kemst inn fyrr en losnar.</div>}

      <section className="a-card" style={{ marginTop: 26 }}>
        <h2 className="display" style={{ margin: 0, fontSize: 24 }}>Sjálfgefinn hámarksfjöldi</h2>
        <div className="muted" style={{ fontSize: 14 }}>Gildir fyrir alla tíma námskeiðsins nema þá sem þú hefur breytt sérstaklega.</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
          {(programs ?? []).map((p) => (
            <div key={p.id} className="row" style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 3, padding: '8px 10px' }}>
              <span className="dot" style={{ background: p.color }} /><span style={{ fontWeight: 600, minWidth: 120 }}>{p.name}</span>
              <div className="stepper">
                <button aria-label={`Fækka í ${p.name}`} onClick={async () => { if (p.default_cap > 1) { await api.updateProgramCap(p.id, p.default_cap - 1); refresh() } }}>−</button>
                <span>{p.default_cap}</span>
                <button aria-label={`Fjölga í ${p.name}`} onClick={async () => { await api.updateProgramCap(p.id, p.default_cap + 1); refresh() }}>+</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
