import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Profile } from '../api'
import { useApp, useData } from '../ctx'
import { Avatar, Icon } from '../components/Icon'
import { dayKey, dayLabel, errMsg, hhmm, initials } from '../util'

type Sheet = null | 'menu' | 'limit' | 'coaches' | 'add'

export default function CoachClass() {
  const { id } = useParams()
  const cid = Number(id)
  const { api, toast, refresh } = useApp()
  const nav = useNavigate()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [limit, setLimit] = useState('')
  const [scope, setScope] = useState<'one' | 'all'>('one')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Profile[]>([])
  const [openRow, setOpenRow] = useState<string | null>(null)

  const { data: cls } = useData(async (a) => {
    // sækjum tímann sjálfan úr class_list (sama dag)
    const all = await a.classList(new Date(Date.now() - 40 * 86400e3), new Date(Date.now() + 40 * 86400e3))
    return all.find((c) => c.id === cid) ?? null
  }, [cid])
  const { data: roster } = useData((a) => a.roster(cid), [cid])
  const { data: staff } = useData((a) => a.staff())

  useEffect(() => {
    if (sheet !== 'add' || q.trim().length < 2) { setHits([]); return }
    let live = true
    const t = setTimeout(() => api.searchProfiles(q.trim()).then((r) => live && setHits(r)), 200)
    return () => { live = false; clearTimeout(t) }
  }, [q, sheet, api])

  if (cls === undefined) return <div className="spinner" />
  if (!cls) return <div style={{ padding: 16 }}><button className="icon-btn" onClick={() => nav(-1)} aria-label="Til baka"><Icon name="back" /></button><div className="empty">Tíminn fannst ekki.</div></div>

  const booked = (roster ?? []).filter((r) => r.status === 'booked')
  const waiting = (roster ?? []).filter((r) => r.status === 'waitlist')
  const present = booked.filter((r) => r.checked_in).length
  const go = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); if (msg) toast(msg); refresh() } catch (e) { toast(errMsg(e)) }
  }

  return (
    <div style={{ paddingBottom: 30 }}>
      <div style={{ padding: 'calc(6px + env(safe-area-inset-top)) 16px 0' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="icon-btn" aria-label="Til baka" onClick={() => nav('/thjalfari')} style={{ color: 'var(--accent)', justifyContent: 'flex-start' }}><Icon name="back" size={26} /></button>
          <button className="icon-btn" aria-label="Breyta tíma" onClick={() => setSheet('menu')} style={{ color: 'var(--accent)', justifyContent: 'flex-end' }}><Icon name="edit" /></button>
        </div>
        <h1 className="display" style={{ fontSize: 34, margin: '2px 0 0' }}>{cls.program}: {hhmm(cls.starts_at)}</h1>
        {cls.cancelled && <div className="error" style={{ marginTop: 6 }}>Tímanum hefur verið aflýst</div>}
        <div className="row" style={{ marginTop: 10, color: '#c3cad1', gap: 12 }}><Icon name="clock" stroke={1.6} />{dayLabel(dayKey(new Date(cls.starts_at)))}, {hhmm(cls.starts_at)}–{hhmm(cls.ends_at)}</div>
        <div className="row" style={{ marginTop: 12, gap: 12, alignItems: 'flex-start' }}>
          <Icon name="user" stroke={1.6} color="#c3cad1" />
          <div>
            <div className="label">Aðalþjálfari</div>
            <div className="row" style={{ marginTop: 6 }}><Avatar src={cls.coach_avatar} name={cls.coach_name ?? '?'} size={40} ring="var(--accent)" /><span style={{ fontSize: 17 }}>{cls.coach_name ?? 'Enginn'}</span></div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12, color: '#c3cad1', gap: 12 }}><Icon name="pin" stroke={1.6} />BOX800 · Eyravegur 57</div>

        <button className="btn btn-outline btn-block" style={{ marginTop: 18, height: 50, fontSize: 17 }} onClick={() => nav(`/thjalfari/aefing?p=${cls.program_id}&d=${dayKey(new Date(cls.starts_at))}`)}>Skoða æfingu</button>
        <button className="btn btn-outline btn-block" style={{ marginTop: 10, height: 50, fontSize: 16 }} onClick={() => { setQ(''); setSheet('add') }}>Bæta við iðkanda</button>

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 22 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Iðkendur <span style={{ color: '#c3cad1', fontWeight: 600, marginLeft: 8 }}>{booked.length} | {cls.cap}</span></div>
            <div className="muted">{present} skráð inn</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => go(async () => { for (const r of booked) if (!r.checked_in) await api.checkIn(cid, r.profile_id, true) }, 'Allir skráðir inn')}>Skrá alla inn</button>
        </div>
      </div>

      <div style={{ marginTop: 12, borderTop: '1px solid var(--line)' }}>
        {!roster && <div className="spinner" />}
        {booked.map((r) => (
          <div key={r.profile_id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 16px' }}>
            <div className="row" style={{ gap: 12 }}>
              <Avatar src={r.avatar_url} name={r.full_name} size={42} />
              <div className="grow ellipsis" style={{ color: 'var(--accent)', fontSize: 17 }}>
                {r.full_name}
                {r.first_class && <span className="badge badge-ok" style={{ marginLeft: 8, verticalAlign: 2 }}>FYRSTI TÍMI</span>}
              </div>
              <button className="pill-btn" style={{ background: r.checked_in ? 'transparent' : 'var(--accent)', color: r.checked_in ? 'var(--accent)' : 'var(--accent-ink)' }}
                aria-label={(r.checked_in ? 'Taka innskráningu af ' : 'Skrá inn ') + r.full_name}
                onClick={() => go(() => api.checkIn(cid, r.profile_id, !r.checked_in))}>
                {r.checked_in ? 'Skráð inn ▾' : 'Skrá inn'}
              </button>
              <button className="icon-btn" style={{ width: 36 }} aria-label={'Meira um ' + r.full_name} aria-expanded={openRow === r.profile_id}
                onClick={() => setOpenRow(openRow === r.profile_id ? null : r.profile_id)}><Icon name="dots" /></button>
            </div>
            {openRow === r.profile_id && (
              <div className="row" style={{ justifyContent: 'space-between', margin: '8px 0 2px 54px' }}>
                <span className="muted" style={{ fontSize: 13 }}>{[r.plan, r.note].filter(Boolean).join(' · ') || 'Engar athugasemdir'}</span>
                <button className="btn btn-danger btn-sm" onClick={() => go(() => api.cancelBooking(cid, r.profile_id), `${r.full_name} afskráð${waiting.length ? ' – fyrsti á biðlista fer inn' : ''}`)}>Afskrá</button>
              </div>
            )}
          </div>
        ))}
        {roster && booked.length === 0 && <div className="empty" style={{ margin: 16 }}>Enginn skráður enn.</div>}
      </div>

      {waiting.length > 0 && (
        <>
          <div style={{ background: 'var(--band)', padding: '10px 16px' }} className="label">Biðlisti</div>
          {waiting.map((r) => (
            <div key={r.profile_id} className="list-row">
              <span style={{ width: 36, height: 36, borderRadius: 99, border: '1.5px solid var(--warn)', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{r.wait_pos}</span>
              <div className="grow"><div style={{ fontWeight: 600 }}>{r.full_name}</div><div className="muted" style={{ fontSize: 13 }}>{r.wait_pos === 1 ? 'Fær næsta pláss sjálfkrafa' : 'Bíður'}</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => go(() => api.cancelBooking(cid, r.profile_id), 'Tekin(n) af biðlista')}>Fjarlægja</button>
            </div>
          ))}
        </>
      )}

      {sheet && (
        <>
          <button className="sheet-back" aria-label="Loka" onClick={() => setSheet(null)} />
          <div className="sheet" role="dialog">
            {sheet === 'menu' && (
              <>
                <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>Breyta tíma</div>
                {[
                  ['user', 'Breyta þjálfara', () => setSheet('coaches')],
                  ['people', 'Breyta hámarki', () => { setLimit(String(cls.cap)); setScope('one'); setSheet('limit') }],
                  ['cal', cls.cancelled ? 'Endurvekja tíma' : 'Aflýsa tíma', () => { setSheet(null); go(() => api.cancelClass(cid, !cls.cancelled), cls.cancelled ? 'Tíminn er aftur virkur' : 'Tíma aflýst – skráðir fá tilkynningu') }],
                ].map(([ic, label, fn]) => (
                  <button key={label as string} className="row" style={{ width: '100%', minHeight: 58, gap: 16, color: 'var(--accent)', fontSize: 19 }} onClick={fn as () => void}>
                    <Icon name={ic as string} size={26} color="#c3cad1" stroke={1.6} />{label as string}
                  </button>
                ))}
              </>
            )}
            {sheet === 'limit' && (
              <form onSubmit={(e) => { e.preventDefault(); const v = parseInt(limit, 10); if (!(v > 0)) return toast('Sláðu inn tölu'); setSheet(null)
                go(async () => { const n = await api.setCap(cid, v, scope); toast(`Hámark ${v}${n ? ` – ${n} ${n === 1 ? 'fór' : 'fóru'} inn af biðlista` : ''}`) }) }}>
                <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>Hámark í tíma</div>
                <label className="field" style={{ marginTop: 18 }}><span>Hámark</span>
                  <input className="input" type="number" inputMode="numeric" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} style={{ fontSize: 22 }} autoFocus />
                </label>
                <label className="field" style={{ marginTop: 12 }}><span>Gildir fyrir</span>
                  <select className="select" value={scope} onChange={(e) => setScope(e.target.value as 'one' | 'all')}>
                    <option value="one">Bara þennan tíma</option>
                    <option value="all">Þennan tíma alltaf framvegis</option>
                  </select>
                </label>
                <div className="muted" style={{ marginTop: 10 }}>Ef plássum fjölgar fer fólk sjálfkrafa inn af biðlista.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
                  <button type="button" className="btn" style={{ color: 'var(--accent)' }} onClick={() => setSheet(null)}>Hætta við</button>
                  <button type="submit" className="btn btn-primary">Vista</button>
                </div>
              </form>
            )}
            {sheet === 'coaches' && (
              <>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                  <button className="btn" style={{ color: 'var(--accent)', padding: 0 }} onClick={() => setSheet('menu')}>Til baka</button>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>Þjálfari</div><span style={{ width: 70 }} />
                </div>
                {(staff ?? []).map((s) => (
                  <button key={s.id} className="row" style={{ width: '100%', padding: '12px 0', borderBottom: '1px solid var(--line)', gap: 14 }}
                    onClick={() => { setSheet(null); go(() => api.setCoach(cid, s.id), `${s.full_name} er nú þjálfari tímans`) }}>
                    <Avatar src={s.avatar_url} name={s.full_name} size={46} ring={s.id === cls.coach_id ? 'var(--accent)' : 'var(--line-2)'} />
                    <span className="grow" style={{ fontSize: 17 }}>{s.full_name}</span>
                    {s.id === cls.coach_id && <span className="badge" style={{ background: '#c3cad1', color: '#0b0c0e' }}>AÐALÞJÁLFARI</span>}
                  </button>
                ))}
              </>
            )}
            {sheet === 'add' && (
              <>
                <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>Bæta við iðkanda</div>
                <input className="input" style={{ marginTop: 14 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita að nafni…" aria-label="Leita að iðkanda" autoFocus />
                {q.trim().length >= 2 && hits.length === 0 && <div className="muted" style={{ padding: '12px 0' }}>Enginn fannst.</div>}
                {hits.filter((h) => !booked.some((b) => b.profile_id === h.id)).map((h) => (
                  <button key={h.id} className="row" style={{ width: '100%', padding: '10px 0', borderBottom: '1px solid var(--line)' }}
                    onClick={() => { setSheet(null); go(async () => { const r = await api.book(cid, h.id); toast(r === 'waitlist' ? `${h.full_name} fór á biðlista` : `${h.full_name} bætt við`) }) }}>
                    <span className="avatar" style={{ width: 38, height: 38 }}>{initials(h.full_name)}</span>
                    <span className="grow">{h.full_name}</span><span style={{ color: 'var(--accent)', fontWeight: 700 }}>Bæta við</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
