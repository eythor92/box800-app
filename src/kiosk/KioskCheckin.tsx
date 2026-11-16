import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile, RosterRow } from '../api'
import { useApp, useData } from '../ctx'
import { Avatar, Icon } from '../components/Icon'
import { addDays, cap1, dayKey, dayLabel, dayStart, errMsg, initials, shortTime } from '../util'
import { BigWorkout, currentClass, fullscreen, isLive, useLocal, useNow, useWakeLock } from './shared'

/**
 * Innskráningarskjár á stöðinni (eins og Kiosk+ í Wodify):
 * tímar dagsins efst, leit og listi vinstra megin, myndir af þeim sem eru mættir í miðju
 * og æfingin hægra megin.
 */
export default function KioskCheckin() {
  const { api, toast, refresh } = useApp()
  const nav = useNavigate()
  const now = useNow(20000)
  useWakeLock()
  const [cfg, setCfg] = useLocal('box800-kiosk-checkin', { workout: true })
  const [day, setDay] = useState(dayKey(new Date()))
  const [picked, setPicked] = useState<{ id: number; at: number } | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Profile[]>([])
  const [busy, setBusy] = useState(false)

  const today = dayKey(now)
  useEffect(() => { if (day < today) setDay(today) }, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: classes } = useData((a) => a.classList(dayStart(day), dayStart(addDays(day, 1))), [day])
  const list = useMemo(() => (classes ?? []).filter((c) => !c.cancelled).sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [classes])
  // Fylgir sjálfkrafa tímanum sem er í gangi, nema einhver hafi valið annan síðustu 15 mín.
  const auto = day === today ? currentClass(list, now) : list[0]
  const manual = picked && +now - picked.at < 15 * 60000 ? list.find((c) => c.id === picked.id) : undefined
  const sel = manual ?? auto

  const { data: roster } = useData((a) => (sel ? a.roster(sel.id) : Promise.resolve([] as RosterRow[])), [sel?.id])
  const { data: workouts } = useData((a) => a.workouts(day, day), [day])
  const w = (workouts ?? []).find((x) => x.program_id === sel?.program_id && x.day === day)
  const live = isLive(w, now) ? w : undefined

  const booked = (roster ?? []).filter((r) => r.status === 'booked')
  const waiting = (roster ?? []).filter((r) => r.status === 'waitlist')
  const inside = booked.filter((r) => r.checked_in).sort((a, b) => a.full_name.localeCompare(b.full_name, 'is'))

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    let live = true
    const t = setTimeout(() => api.searchProfiles(q.trim()).then((r) => live && setHits(r), () => undefined), 200)
    return () => { live = false; clearTimeout(t) }
  }, [q, api])

  async function signIn(p: { id: string; name: string }) {
    if (!sel || busy) return
    setBusy(true)
    try {
      await api.kioskSignIn(sel.id, p.id)
      toast(`Velkomin(n), ${p.name.split(' ')[0]}!`)
      setQ(''); setHits([]); refresh()
    } catch (e) { toast(errMsg(e)) } finally { setBusy(false) }
  }
  async function toggle(r: RosterRow) {
    if (!sel) return
    try { await api.checkIn(sel.id, r.profile_id, !r.checked_in); refresh() } catch (e) { toast(errMsg(e)) }
  }

  return (
    <div className="kiosk">
      <header className="k-top">
        <img src="myndir/logo-white.png" alt="BOX800" className="k-logo" />
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" aria-label="Fyrri dagur" disabled={day <= today} onClick={() => { setDay(addDays(day, -1)); setPicked(null) }}><Icon name="back" /></button>
          <span className="k-day">{day === today ? 'Í dag' : cap1(dayLabel(day))}</span>
          <button className="icon-btn" aria-label="Næsti dagur" onClick={() => { setDay(addDays(day, 1)); setPicked(null) }}><Icon name="next" /></button>
        </div>
        <nav className="k-tabs" aria-label="Tímar dagsins">
          {list.map((c) => (
            <button key={c.id} className={c.id === sel?.id ? 'on' : ''} aria-pressed={c.id === sel?.id}
              onClick={() => setPicked({ id: c.id, at: Date.now() })}>
              <span className="dot" style={{ background: c.color }} />
              <span><b>{shortTime(c.starts_at)}</b><small>{c.program}</small></span>
            </button>
          ))}
          {classes && list.length === 0 && <span className="muted" style={{ padding: '0 12px' }}>Engir tímar þennan dag</span>}
        </nav>
        <div className="row" style={{ gap: 4, marginLeft: 'auto' }}>
          <button className={`chip${cfg.workout ? ' on' : ''}`} onClick={() => setCfg({ ...cfg, workout: !cfg.workout })} aria-pressed={cfg.workout}>Æfing</button>
          <button className="icon-btn" aria-label="Fullur skjár" onClick={fullscreen}><Icon name="grid" /></button>
          <button className="icon-btn" aria-label="Loka kiosk" onClick={() => nav('/thjalfari')}><Icon name="x" /></button>
        </div>
      </header>

      <div className={`k-main${cfg.workout ? ' with-w' : ''}`}>
        <aside className="k-side">
          <div className="label">Skrá inn</div>
          <div className="k-search">
            <Icon name="search" color="var(--muted)" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita að nafni…" aria-label="Leita að iðkanda" autoComplete="off" />
            {q && <button aria-label="Hreinsa" onClick={() => { setQ(''); setHits([]) }}><Icon name="x" size={18} /></button>}
          </div>
          {hits.length > 0 && (
            <div className="k-hits">
              {hits.map((h) => {
                const r = (roster ?? []).find((x) => x.profile_id === h.id)
                return (
                  <button key={h.id} disabled={busy || r?.checked_in} onClick={() => signIn({ id: h.id, name: h.full_name })}>
                    <Avatar src={h.avatar_url} name={h.full_name} size={36} />
                    <span className="grow ellipsis">{h.full_name}</span>
                    <span className="badge badge-accent">{r?.checked_in ? 'MÆTT' : 'SKRÁ INN'}</span>
                  </button>
                )
              })}
            </div>
          )}
          {q.trim().length >= 2 && hits.length === 0 && <div className="muted" style={{ fontSize: 14, padding: '8px 2px' }}>Enginn fannst. Þjálfari getur bætt viðkomandi við.</div>}

          {sel && (
            <>
              <div className="label" style={{ marginTop: 22 }}>Þjálfari</div>
              <div className="row" style={{ marginTop: 8 }}>
                <Avatar src={sel.coach_avatar} name={sel.coach_name ?? '?'} size={36} />
                <b>{sel.coach_name ?? 'Enginn skráður'}</b>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 22 }}>
                <div className="label">Skráðir {booked.length} | {sel.cap}</div>
                <div className="label">Mættir {inside.length}</div>
              </div>
              <div className="k-list">
                {booked.map((r, i) => (
                  <button key={r.profile_id} onClick={() => toggle(r)} aria-pressed={r.checked_in} aria-label={`${r.full_name}: ${r.checked_in ? 'mætt, ýta til að afskrá' : 'ýta til að skrá inn'}`}>
                    <span className="n">{i + 1}.</span>
                    <span className={`k-check${r.checked_in ? ' on' : ''}`}>{r.checked_in && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4"><path d="M5 12l5 5L20 7" /></svg>}</span>
                    <Avatar src={r.avatar_url} name={r.full_name} size={32} />
                    <span className="grow ellipsis">{r.full_name}</span>
                    {r.first_class && <span className="badge badge-warn">NÝR</span>}
                  </button>
                ))}
                {roster && booked.length === 0 && <div className="muted" style={{ padding: '10px 2px', fontSize: 14 }}>Enginn bókaður enn</div>}
              </div>
              {waiting.length > 0 && (
                <>
                  <div className="label" style={{ marginTop: 18 }}>Biðlisti {waiting.length}</div>
                  <div className="k-list">
                    {waiting.map((r) => (
                      <button key={r.profile_id} onClick={() => signIn({ id: r.profile_id, name: r.full_name })}>
                        <span className="n">{r.wait_pos}.</span>
                        <Avatar src={r.avatar_url} name={r.full_name} size={32} />
                        <span className="grow ellipsis">{r.full_name}</span>
                        <span className="badge badge-outline">SKRÁ INN</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </aside>

        <section className="k-center" aria-label="Mættir">
          {sel && <div className="k-title"><span className="dot" style={{ background: sel.color, width: 14, height: 14 }} />{sel.program} · {shortTime(sel.starts_at)}</div>}
          {inside.length === 0
            ? <div className="k-empty">Finndu nafnið þitt vinstra megin og ýttu á það til að skrá þig inn</div>
            : (
              <div className="k-grid">
                {inside.map((r) => (
                  <div key={r.profile_id} className="k-card">
                    {r.avatar_url ? <img src={r.avatar_url} alt="" /> : <div className="ph">{initials(r.full_name)}</div>}
                    <div className="nm">{r.full_name}</div>
                  </div>
                ))}
              </div>
            )}
        </section>

        {cfg.workout && (
          <section className="k-workout" aria-label="Æfing">
            {live && sel
              ? <BigWorkout w={live} title={`${sel.program} – ${dayLabel(day)}`} />
              : <div className="k-empty" style={{ fontSize: 16 }}>Engin birt æfing fyrir {sel?.program ?? 'þennan tíma'}</div>}
          </section>
        )}
      </div>
    </div>
  )
}
