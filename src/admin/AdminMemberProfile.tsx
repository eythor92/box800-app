import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Profile, Role } from '../api'
import { useApp, useData } from '../ctx'
import { Icon } from '../components/Icon'
import AvatarUpload from '../components/AvatarUpload'
import { addDays, cap1, dayKey, dayLabel, dayStart, errMsg, hhmm, relDay, today } from '../util'
import { kg } from '../score'
import { PLAN_GROUPS, findPlan, planEnd } from '../plans'

type Tab = 'info' | 'membership' | 'attendance' | 'results'

/** Fæðingardagur út frá kennitölu (DDMMÁÁ-NNNC, C = öld: 9 → 1900, 0 → 2000) */
function birthFromKt(kt?: string | null): string | null {
  const d = (kt ?? '').replace(/\D/g, '')
  if (d.length !== 10) return null
  const cent = d[9] === '9' ? '19' : d[9] === '0' ? '20' : d[9] === '8' ? '18' : null
  if (!cent) return null
  const iso = `${cent}${d.slice(4, 6)}-${d.slice(2, 4)}-${d.slice(0, 2)}`
  return isNaN(Date.parse(iso)) ? null : iso
}
function yearsBetween(from: string, to = today()): number {
  const [a, b] = [from.slice(0, 10).split('-').map(Number), to.split('-').map(Number)]
  return b[0] - a[0] - (b[1] < a[1] || (b[1] === a[1] && b[2] < a[2]) ? 1 : 0)
}
function durationText(from: string): string {
  const [a, b] = [from.slice(0, 10).split('-').map(Number), today().split('-').map(Number)]
  let months = (b[0] - a[0]) * 12 + (b[1] - a[1]) - (b[2] < a[2] ? 1 : 0)
  if (months < 1) return 'Nýr'
  const y = Math.floor(months / 12); months %= 12
  return [y ? `${y} ${y === 1 ? 'ár' : 'ár'}` : '', months ? `${months} mán.` : ''].filter(Boolean).join(' og ')
}

const ROLE_LABEL: Record<Role, string> = { member: 'IÐKANDI', coach: 'ÞJÁLFARI', owner: 'STJÓRNANDI' }
const STATUS: Record<string, [string, string]> = { active: ['Virkur', 'badge-ok'], suspended: ['Í bið', 'badge-warn'], inactive: ['Óvirkur', 'badge-grey'] }

export default function AdminMemberProfile() {
  const id = useParams().id!
  const nav = useNavigate()
  const { api, me, toast, refresh } = useApp()
  const { data: p, error } = useData((a) => a.getProfile(id), [id])
  const { data: ms } = useData((a) => a.membershipsOf(id), [id])
  const { data: att } = useData((a) => a.attendanceOf(id), [id])
  const { data: lifts } = useData((a) => a.liftsOf(id), [id])
  const [tab, setTab] = useState<Tab>('info')
  const [f, setF] = useState<Partial<Profile> | null>(null)
  const [menu, setMenu] = useState(false)
  const [addCls, setAddCls] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [nm, setNm] = useState<null | { plan: string; starts_on: string; ends_on: string; other?: boolean }>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (p) setF({ ...p }) }, [p])

  const dirty = useMemo(() => !!p && !!f && (Object.keys(f) as (keyof Profile)[]).some((k) => (f[k] ?? '') !== (p[k] ?? '')), [p, f])
  if (error) return <div className="error">{error}</div>
  if (!p || !f) return <div className="spinner" />

  const birth = p.birth_date || birthFromKt(p.kennitala)
  const since = p.member_since || p.created_at?.slice(0, 10)
  const visits = att?.length ?? 0
  const last = att?.[0]?.starts_at
  const isMe = p.id === me.id
  const set = (patch: Partial<Profile>) => setF({ ...f, ...patch })

  async function save(patch: Partial<Profile>, msg = 'Vistað') {
    setBusy(true)
    try { await api.updateProfile(id, patch); toast(msg); refresh() } catch (e) { toast(errMsg(e)) } finally { setBusy(false) }
  }
  function saveInfo() {
    const kt = (f!.kennitala ?? '').replace(/\D/g, '')
    if (kt && kt.length !== 10) { toast('Kennitala er 10 tölustafir'); return }
    if (!f!.full_name?.trim()) { toast('Nafn vantar'); return }
    const keys: (keyof Profile)[] = ['full_name', 'email', 'phone', 'kennitala', 'address', 'birth_date', 'gender', 'member_since', 'emergency', 'emergency_phone', 'note']
    const patch: Record<string, unknown> = {}
    for (const k of keys) { const v = f![k]; patch[k] = typeof v === 'string' ? (v.trim() || null) : v ?? null }
    if (patch.email) patch.email = String(patch.email).toLowerCase()
    save(patch as Partial<Profile>, 'Persónuupplýsingar vistaðar')
  }
  function setRole(coach: boolean, admin: boolean) {
    const role: Role = admin ? 'owner' : coach ? 'coach' : 'member'
    if (role === p!.role) return
    if (role === 'owner' && !window.confirm(`Gera ${p!.full_name} að eiganda? Viðkomandi fær aðgang að öllu í stjórnborðinu, líka innsýn og öllum iðkendum.`)) return
    save({ role }, role === 'owner' ? `${p!.full_name} er nú eigandi` : role === 'coach' ? `${p!.full_name} er nú þjálfari` : `${p!.full_name} er nú iðkandi`)
  }

  const tabs: [Tab, string][] = [['info', 'Persónuupplýsingar'], ['membership', 'Áskrift'], ['attendance', 'Mæting'], ['results', 'Árangur']]
  const inp = (k: keyof Profile, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field"><span>{label}</span><input className="input" value={(f[k] as string) ?? ''} onChange={(e) => set({ [k]: e.target.value })} {...props} /></label>
  )

  return (
    <>
      <button className="row muted" style={{ fontWeight: 700, fontSize: 13, letterSpacing: 1, marginBottom: 6 }} onClick={() => nav('/stjorn/idkendur')}><Icon name="back" size={16} />IÐKENDUR</button>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1>{p.full_name || p.email}</h1>
        <div style={{ position: 'relative' }}>
          {p.email && <a className="btn btn-ghost" style={{ marginRight: 8 }} href={`mailto:${p.email}`} aria-label="Senda tölvupóst"><Icon name="bell" size={18} />Póstur</a>}
          <button className="btn btn-primary" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>Aðgerðir<Icon name="down" size={18} /></button>
          {menu && (
            <div className="cb-menu" role="menu" style={{ top: 54, minWidth: 230 }} onClick={() => setMenu(false)}>
              <button role="menuitem" onClick={() => setAddCls(true)}>Bæta í tíma</button>
              {p.email && <button role="menuitem" onClick={async () => { try { await api.resetPassword(p.email!); toast('Tölvupóstur til að velja nýtt lykilorð sendur á ' + p.email) } catch (e) { toast(errMsg(e)) } }}>Senda nýtt lykilorð</button>}
              {p.status !== 'suspended' && !isMe && <button role="menuitem" onClick={() => save({ status: 'suspended' }, `${p.full_name} er í bið og getur ekki bókað`)}>Setja í bið</button>}
              {p.status !== 'inactive' && !isMe && <button role="menuitem" onClick={() => save({ status: 'inactive' }, `${p.full_name} er óvirkur`)}>Gera óvirkan</button>}
              {p.status !== 'active' && <button role="menuitem" onClick={() => save({ status: 'active' }, `${p.full_name} er virkur aftur`)}>Virkja</button>}
              {!isMe && <button role="menuitem" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDel(true)}>Eyða</button>}
            </div>
          )}
        </div>
      </div>

      <section className="a-card mp-head" style={{ marginTop: 16 }}>
        <div className="mp-av">
          <AvatarUpload profileId={p.id} src={p.avatar_url} name={p.full_name || '?'} size={112} />
          {p.role !== 'member' && <span className="mp-role">{ROLE_LABEL[p.role]}</span>}
        </div>
        <div className="mp-facts">
          <div><span className="label">Staða</span><span className={`badge ${STATUS[p.status ?? 'active'][1]}`}>{STATUS[p.status ?? 'active'][0]}</span></div>
          <div><span className="label">Aldur</span>{birth ? yearsBetween(birth) + ' ára' : '–'}</div>
          <div><span className="label">Iðkandi í</span>{since ? durationText(since) : '–'}</div>
          <div><span className="label">Farsími</span>{p.phone ? <a href={`tel:${p.phone}`}>{p.phone}</a> : '–'}</div>
          <div><span className="label">Netfang</span>{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : '–'}</div>
          <div><span className="label">Tímar samtals</span>{att ? visits : '…'}</div>
          <div><span className="label">Síðast mætt</span>{last ? relDay(last) : '–'}</div>
          <div><span className="label">Innskráning</span>{p.is_dependent ? 'Barn / aðstandandi' : (p as Profile & { auth_id?: string }).auth_id ? 'Hefur aðgang' : 'Ekki stofnað aðgang enn'}</div>
        </div>
        {p.note && <div className="stat" style={{ gridColumn: '1 / -1' }}><span className="label">Athugasemd fyrir þjálfara</span><div>{p.note}</div></div>}
      </section>

      <div className="row" style={{ gap: 0, marginTop: 22, borderBottom: '1px solid var(--line-2)', overflowX: 'auto' }}>
        {tabs.map(([t, l]) => <button key={t} className={`mp-tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{l}</button>)}
      </div>

      {tab === 'info' && (
        <div className="mp-grid">
          <section className="a-card">
            <h2 className="mp-h">Persónuupplýsingar</h2>
            <div className="mp-form">
              {inp('full_name', 'Fullt nafn *')}
              {inp('kennitala', 'Kennitala', { inputMode: 'numeric', placeholder: '000000-0000' })}
              <label className="field"><span>Kyn</span>
                <select className="select" value={f.gender ?? ''} onChange={(e) => set({ gender: (e.target.value || null) as Profile['gender'] })}>
                  <option value="">–</option><option value="kona">Kona</option><option value="karl">Karl</option><option value="annað">Annað</option>
                </select>
              </label>
              <label className="field"><span>Fæðingardagur</span><input className="input" type="date" value={f.birth_date ?? ''} placeholder={birthFromKt(f.kennitala) ?? ''} onChange={(e) => set({ birth_date: e.target.value || null })} /></label>
            </div>
            <h2 className="mp-h">Samskipti</h2>
            <div className="mp-form">
              {inp('phone', 'Farsími', { type: 'tel' })}
              {inp('email', 'Netfang *', { type: 'email' })}
              <div style={{ gridColumn: '1 / -1' }}>{inp('address', 'Heimilisfang', { placeholder: 'Gata, póstnúmer og bær' })}</div>
            </div>
            <h2 className="mp-h">Neyðartengiliður</h2>
            <div className="mp-form">
              {inp('emergency', 'Nafn')}
              {inp('emergency_phone', 'Farsími', { type: 'tel' })}
            </div>
            <h2 className="mp-h">Annað</h2>
            <div className="mp-form">
              <label className="field"><span>Iðkandi síðan</span><input className="input" type="date" value={f.member_since ?? ''} onChange={(e) => set({ member_since: e.target.value || null })} /></label>
              <div />
              <label className="field" style={{ gridColumn: '1 / -1' }}><span>Athugasemd fyrir þjálfara</span><textarea className="textarea" rows={2} value={f.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="T.d. meiðsli" /></label>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
              {dirty && <button className="btn btn-ghost" onClick={() => setF({ ...p })}>Hætta við</button>}
              <button className="btn btn-primary" disabled={!dirty || busy} onClick={saveInfo}>Vista breytingar</button>
            </div>
          </section>

          <section className="a-card" style={{ alignSelf: 'start' }}>
            <h2 className="mp-h" style={{ marginTop: 0 }}>Hlutverk og heimildir</h2>
            <div className="muted" style={{ fontSize: 14 }}>Hvað má þessi aðili gera í appinu?</div>
            {([
              ['Iðkandi', 'Bókar sig í tíma, sér æfingar og skráir skor', true, true],
              ['Þjálfari', 'Sér nafnalista, skráir mætingu, breytir fjölda og aflýsir tímum', p.role !== 'member', isMe],
              ['Eigandi', 'Allt: stjórnborð, æfingar, tímatafla, stillingar, iðkendur, innsýn og samstarf. Getur gert aðra að eigendum.', p.role === 'owner', isMe],
            ] as const).map(([l, d, on, locked], i) => (
              <label key={l} className="mp-role-row" style={{ opacity: locked && i > 0 ? 0.7 : 1 }}>
                <input type="checkbox" checked={on} disabled={locked || busy}
                  onChange={(e) => i === 1 ? setRole(e.target.checked, e.target.checked && p.role === 'owner') : setRole(e.target.checked || p.role !== 'member', e.target.checked)} />
                <span><b>{l}</b><small>{d}</small></span>
              </label>
            ))}
            {isMe && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>Þú getur ekki breytt þínu eigin hlutverki.</div>}
          </section>
        </div>
      )}

      {tab === 'membership' && (
        <section className="a-card" style={{ marginTop: 16 }}>
          <h2 className="mp-h" style={{ marginTop: 0 }}>Áskrift</h2>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 10 }}>
            <div className="muted" style={{ fontSize: 14 }}>Greiðslur fara í gegnum Abler. Þangað til Abler er tengt skráir þú áskriftina hér, svo iðkandinn geti bókað.</div>
            <button className="btn btn-primary btn-sm" onClick={() => setNm({ plan: '', starts_on: today(), ends_on: '', other: false })}>+ Áskrift</button>
          </div>
          {nm && (
            <form className="stat" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end', marginBottom: 12 }}
              onSubmit={async (e) => { e.preventDefault(); if (!nm.plan.trim()) { toast('Nafn áskriftar vantar'); return } try { await api.addMembership({ profile_id: id, plan: nm.plan.trim(), starts_on: nm.starts_on, ends_on: nm.ends_on || null }); toast('Áskrift skráð'); setNm(null); refresh() } catch (er) { toast(errMsg(er)) } }}>
              <label className="field"><span>Áskrift</span>
                {nm.other
                  ? <input className="input" value={nm.plan} onChange={(e) => setNm({ ...nm, plan: e.target.value })} placeholder="Skrifaðu nafn áskriftar" autoFocus />
                  : <select className="select" value={nm.plan} autoFocus onChange={(e) => {
                      if (e.target.value === '__annad') { setNm({ ...nm, plan: '', other: true }); return }
                      setNm({ ...nm, plan: e.target.value, ends_on: planEnd(findPlan(e.target.value), nm.starts_on) })
                    }}>
                      <option value="">Veldu áskrift…</option>
                      {PLAN_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.plans.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}</optgroup>)}
                      <option value="__annad">Annað (skrifa sjálf/ur)…</option>
                    </select>}
              </label>
              <label className="field"><span>Byrjar</span><input className="input" type="date" value={nm.starts_on} onChange={(e) => setNm({ ...nm, starts_on: e.target.value, ends_on: findPlan(nm.plan) ? planEnd(findPlan(nm.plan), e.target.value) : nm.ends_on })} /></label>
              <label className="field"><span>Gildir til (autt = endurnýjast)</span><input className="input" type="date" value={nm.ends_on} onChange={(e) => setNm({ ...nm, ends_on: e.target.value })} /></label>
              <div className="row"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setNm(null)}>Hætta við</button><button className="btn btn-primary btn-sm">Vista</button></div>
            </form>
          )}
          {ms && ms.length === 0 && <div className="empty">Engin áskrift skráð.</div>}
          {ms && ms.length > 0 && (
            <div className="a-table">
              <div className="thead" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}><div>ÁSKRIFT</div><div>BYRJAÐI</div><div>GILDIR TIL</div><div>STAÐA</div></div>
              {ms.map((m) => {
                const live = m.status === 'active' && (!m.ends_on || m.ends_on >= today())
                return (
                  <div key={m.id} className="tr" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                    <div style={{ fontWeight: 700 }}>{m.plan}</div><div>{dayLabel(m.starts_on)}</div><div>{m.ends_on ? dayLabel(m.ends_on) : 'Endurnýjast'}</div>
                    <div className="row" style={{ gap: 8 }}><span className={`badge ${live ? 'badge-ok' : 'badge-grey'}`}>{live ? 'VIRK' : 'ÓVIRK'}</span>
                      {live && <button className="btn btn-ghost btn-sm" onClick={async () => { try { await api.endMembership(m.id); toast('Áskrift stöðvuð'); refresh() } catch (e) { toast(errMsg(e)) } }}>Stöðva</button>}</div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'attendance' && (
        <section className="a-card" style={{ marginTop: 16 }}>
          <h2 className="mp-h" style={{ marginTop: 0 }}>Mæting · {visits} tímar</h2>
          {att && att.length === 0 && <div className="empty">Engin mæting skráð enn.</div>}
          {(att ?? []).slice(0, 60).map((a) => (
            <div key={a.class_id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <span className="grow"><b>{a.program}</b> · {cap1(dayLabel(dayKey(new Date(a.starts_at))))} kl. {hhmm(a.starts_at)}</span>
              <span className={`badge ${a.checked_in ? 'badge-ok' : 'badge-grey'}`}>{a.checked_in ? 'MÆTT' : 'BÓKAÐ'}</span>
            </div>
          ))}
        </section>
      )}

      {tab === 'results' && (
        <section className="a-card" style={{ marginTop: 16 }}>
          <h2 className="mp-h" style={{ marginTop: 0 }}>Bestu lyftur</h2>
          {lifts && lifts.length === 0 && <div className="empty">Engin skor skráð enn.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
            {(lifts ?? []).map((l) => (
              <div key={l.movement_id} className="stat">
                <div className="k" style={{ fontWeight: 700, textTransform: 'uppercase' }}>{l.name}</div>
                <div className="v" style={{ fontSize: 26, fontFamily: 'var(--display)' }}>{kg(l.best_1rm ?? l.best)} kg</div>
                <div className="muted" style={{ fontSize: 12 }}>{l.best_1rm ? '1RM' : 'Þyngst'} · {l.n} skráningar</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {addCls && <AddToClass profileId={id} name={p.full_name} onClose={() => setAddCls(false)} />}
      {confirmDel && (
        <>
          <button className="modal-back" aria-label="Loka" onClick={() => setConfirmDel(false)} />
          <div className="modal" role="dialog" aria-label="Eyða iðkanda">
            <h2 className="display" style={{ margin: 0, fontSize: 28 }}>Eyða {p.full_name}?</h2>
            <p>Allar bókanir, mæting og skor viðkomandi eyðast líka. Þetta er ekki hægt að afturkalla. Oft er betra að <b>gera óvirkan</b>.</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDel(false)}>Hætta við</button>
              <button className="btn btn-danger" disabled={busy} onClick={async () => { try { await api.deleteProfile(id); toast('Eytt'); refresh(); nav('/stjorn/idkendur') } catch (e) { toast(errMsg(e)) } }}>Eyða endanlega</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

/** Bæta iðkanda í tíma næstu 7 daga */
function AddToClass({ profileId, name, onClose }: { profileId: string; name: string; onClose: () => void }) {
  const { api, toast, refresh } = useApp()
  const t = today()
  const [day, setDay] = useState(t)
  const { data } = useData((a) => a.classList(dayStart(day), dayStart(addDays(day, 1))), [day])
  const list = (data ?? []).filter((c) => !c.cancelled && new Date(c.ends_at) > new Date()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return (
    <>
      <button className="modal-back" aria-label="Loka" onClick={onClose} />
      <div className="modal" role="dialog" aria-label="Bæta í tíma">
        <div className="row" style={{ justifyContent: 'space-between' }}><h2 className="display" style={{ margin: 0, fontSize: 28 }}>Bæta {name.split(' ')[0]} í tíma</h2><button className="icon-btn" aria-label="Loka" onClick={onClose}><Icon name="x" /></button></div>
        <div className="chips" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          {Array.from({ length: 7 }, (_, i) => addDays(t, i)).map((d) => <button key={d} className={`chip${d === day ? ' on' : ''}`} onClick={() => setDay(d)}>{d === t ? 'Í dag' : cap1(dayLabel(d))}</button>)}
        </div>
        <div style={{ marginTop: 12 }}>
          {data && list.length === 0 && <div className="muted">Engir tímar eftir þennan dag.</div>}
          {list.map((c) => (
            <button key={c.id} className="list-row" style={{ width: '100%', padding: '12px 4px' }}
              onClick={async () => { try { const r = await api.book(c.id, profileId); toast(r === 'waitlist' ? 'Tíminn er fullur. Fór á biðlista' : `Bætt í ${c.program} kl. ${hhmm(c.starts_at)}`); refresh(); onClose() } catch (e) { toast(errMsg(e)) } }}>
              <span className="dot" style={{ background: c.color }} />
              <span className="grow"><b>{hhmm(c.starts_at)}</b> · {c.program}</span>
              <span className="muted">{c.booked} | {c.cap}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
