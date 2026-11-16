import { useEffect, useMemo, useState } from 'react'
import type { Profile, RosterRow } from '../api'
import { useApp, useData } from '../ctx'
import { Avatar, Icon } from '../components/Icon'
import { addDays, cap1, dayKey, dayLabel, dayStart, errMsg, hhmm, initials, shortTime } from '../util'
import { currentClass, useNow } from './shared'
import { PanelHead, type PanelProps } from './panel'

/** Coachboard (eins og „Results“ í Kiosk+): tímar dagsins, innskráning, listi og myndir af mættum */
export default function Coachboard(pp: PanelProps) {
  const { api, toast, refresh } = useApp()
  const now = useNow(20000)
  const today = dayKey(now)
  const [day, setDay] = useState(today)
  const [picked, setPicked] = useState<{ id: number; at: number } | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Profile[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState<string | null>(null)

  useEffect(() => { if (day < today) setDay(today) }, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: classes } = useData((a) => a.classList(dayStart(day), dayStart(addDays(day, 1))), [day])
  const list = useMemo(() => (classes ?? []).filter((c) => !c.cancelled).sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [classes])
  // Fylgir tímanum sem er í gangi, nema annar hafi verið valinn síðustu 15 mín.
  const auto = day === today ? currentClass(list, now) : list[0]
  const manual = picked && +now - picked.at < 15 * 60000 ? list.find((c) => c.id === picked.id) : undefined
  const sel = manual ?? auto

  const { data: roster } = useData((a) => (sel ? a.roster(sel.id) : Promise.resolve([] as RosterRow[])), [sel?.id])
  const booked = (roster ?? []).filter((r) => r.status === 'booked')
  const waiting = (roster ?? []).filter((r) => r.status === 'waitlist')
  const inside = booked.filter((r) => r.checked_in).sort((a, b) => a.full_name.localeCompare(b.full_name, 'is'))

  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return }
    let live = true
    const t = setTimeout(() => api.searchProfiles(q.trim()).then((r) => live && setHits(r), () => undefined), 200)
    return () => { live = false; clearTimeout(t) }
  }, [q, api])

  async function signIn(id: string, name: string) {
    if (!sel || busy) return
    setBusy(true)
    try { await api.kioskSignIn(sel.id, id); toast(`Velkomin(n), ${name.split(' ')[0]}!`); setQ(''); setHits(null); refresh() }
    catch (e) { toast(errMsg(e)) } finally { setBusy(false) }
  }
  async function act(fn: () => Promise<unknown>) {
    setMenu(null)
    try { await fn(); refresh() } catch (e) { toast(errMsg(e)) }
  }

  return (
    <div className="kp-panel">
      <PanelHead {...pp} title="Coachboard" sub={
        <div className="row" style={{ gap: 2 }}>
          <button className="kp-mini" aria-label="Fyrri dagur" disabled={day <= today} onClick={() => { setDay(addDays(day, -1)); setPicked(null) }}><Icon name="back" size={18} /></button>
          <span className="kp-date">{day === today ? 'Í dag, ' + dayLabel(day) : cap1(dayLabel(day, true))}</span>
          <button className="kp-mini" aria-label="Næsti dagur" onClick={() => { setDay(addDays(day, 1)); setPicked(null) }}><Icon name="next" size={18} /></button>
        </div>
      } />
      <div className="kp-body" style={{ zoom: pp.zoom }}>
        <nav className="cb-tabs" aria-label="Tímar dagsins">
          {list.map((c) => (
            <button key={c.id} className={c.id === sel?.id ? 'on' : ''} aria-pressed={c.id === sel?.id} onClick={() => setPicked({ id: c.id, at: Date.now() })}>
              <span className="cb-dot" style={{ background: c.color }} />
              <span><b>{c.program}: {hhmm(c.starts_at)}</b><small>{shortTime(c.starts_at)}</small></span>
            </button>
          ))}
          {classes && list.length === 0 && <span className="muted" style={{ padding: 14 }}>Engir tímar þennan dag</span>}
        </nav>

        <div className="cb-main">
          <aside className="cb-side">
            <div className="cb-h">SKRÁ INN</div>
            <div className="cb-search">
              <Icon name="search" size={20} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita að nafni" aria-label="Leita að iðkanda" autoComplete="off" />
              {q && <button aria-label="Hreinsa" onClick={() => { setQ(''); setHits(null) }}><Icon name="x" size={18} /></button>}
            </div>
            {hits && (
              <div className="cb-hits">
                {hits.length === 0 && <div className="muted" style={{ padding: '10px 12px' }}>Enginn fannst.</div>}
                {hits.map((h) => {
                  const r = (roster ?? []).find((x) => x.profile_id === h.id)
                  return (
                    <button key={h.id} disabled={busy || !!r?.checked_in} onClick={() => signIn(h.id, h.full_name)}>
                      <Avatar src={h.avatar_url} name={h.full_name} size={34} />
                      <span className="grow ellipsis">{h.full_name}</span>
                      <span className="cb-pill">{r?.checked_in ? 'Mætt(ur)' : 'Skrá inn'}</span>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="cb-drop">Ekki með aðgang? <span>Talaðu við þjálfarann</span></div>

            {sel && (
              <>
                <div className="cb-sec">
                  <div className="cb-h">ÞJÁLFARI</div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <Avatar src={sel.coach_avatar} name={sel.coach_name ?? '?'} size={34} />
                    <span className="cb-link">{sel.coach_name ?? 'Enginn skráður'}</span>
                  </div>
                </div>
                <div className="cb-sec">
                  <div className="cb-h">LISTI &nbsp;<b>{booked.length} | {sel.cap}</b>{waiting.length > 0 && <b> +{waiting.length}</b>}</div>
                  <div className="cb-h" style={{ marginTop: 2 }}>MÆTT: <b>{inside.length}</b></div>
                  <ol className="cb-list">
                    {booked.map((r, i) => (
                      <li key={r.profile_id}>
                        <span className="n">{i + 1}.</span>
                        <button className={`cb-check${r.checked_in ? ' on' : ''}`} aria-pressed={r.checked_in}
                          aria-label={r.checked_in ? `Afskrá ${r.full_name}` : `Skrá inn ${r.full_name}`}
                          onClick={() => act(() => api.checkIn(sel.id, r.profile_id, !r.checked_in))}>
                          {r.checked_in && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4"><path d="M5 12l5 5L20 7" /></svg>}
                        </button>
                        <Avatar src={r.avatar_url} name={r.full_name} size={34} />
                        <span className="grow ellipsis cb-link">{r.full_name}</span>
                        {r.first_class && <span className="badge badge-warn">NÝR</span>}
                        <button className="kp-mini" aria-label={'Valmöguleikar fyrir ' + r.full_name} onClick={() => setMenu(menu === r.profile_id ? null : r.profile_id)}><Icon name="dots" size={18} /></button>
                        {menu === r.profile_id && (
                          <div className="cb-menu" role="menu">
                            <button role="menuitem" onClick={() => act(() => api.checkIn(sel.id, r.profile_id, !r.checked_in))}>{r.checked_in ? 'Afskrá mætingu' : 'Skrá inn'}</button>
                            <button role="menuitem" onClick={() => act(() => api.cancelBooking(sel.id, r.profile_id))}>Taka úr tímanum</button>
                          </div>
                        )}
                      </li>
                    ))}
                    {roster && booked.length === 0 && <li className="muted">Enginn bókaður enn</li>}
                  </ol>
                  {waiting.length > 0 && (
                    <>
                      <div className="cb-h" style={{ marginTop: 14 }}>BIÐLISTI</div>
                      <ol className="cb-list">
                        {waiting.map((r) => (
                          <li key={r.profile_id}>
                            <span className="n">{r.wait_pos}.</span>
                            <Avatar src={r.avatar_url} name={r.full_name} size={34} />
                            <span className="grow ellipsis">{r.full_name}</span>
                            <button className="cb-pill" onClick={() => signIn(r.profile_id, r.full_name)}>Skrá inn</button>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              </>
            )}
          </aside>

          <section className="cb-center" aria-label="Mætt">
            {inside.length === 0
              ? <div className="cb-none">Enginn hefur skráð sig inn enn.</div>
              : (
                <div className="cb-grid">
                  {inside.map((r) => (
                    <div key={r.profile_id} className="cb-card">
                      {r.avatar_url ? <img src={r.avatar_url} alt="" /> : <div className="ph">{initials(r.full_name)}</div>}
                      <div className="nm"><span className="ellipsis">{r.full_name}</span></div>
                    </div>
                  ))}
                </div>
              )}
          </section>
        </div>
      </div>
    </div>
  )
}
