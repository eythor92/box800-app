import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MemberRow } from '../api'
import { useApp, useData } from '../ctx'
import { Avatar, Icon } from '../components/Icon'
import { dayKey, dayLabel, errMsg, relDay, today, addDays } from '../util'

type Tab = 'active' | 'new' | 'expiring' | 'inactive' | 'suspended' | 'staff' | 'all'

function statusOf(m: MemberRow): Tab {
  if (m.status === 'suspended') return 'suspended'
  if (m.status === 'inactive') return 'inactive'
  const t = today()
  const ends = m.ends_on?.slice(0, 10) ?? null
  const active = m.membership_status === 'active' && (!ends || ends >= t)
  if (!active) return 'inactive'
  if (ends && ends <= addDays(t, 14)) return 'expiring'
  if (m.created_at && dayKey(new Date(m.created_at)) >= addDays(t, -30)) return 'new'
  return 'active'
}

export default function AdminMembers() {
  const { api, toast, refresh } = useApp()
  const { data, error } = useData((a) => a.members())
  const { data: inbox } = useData((a) => a.supportInbox())
  // Leit og flipi haldast þegar farið er inn á prófíl og til baka
  const [tab, setTabRaw] = useState<Tab>(() => { try { return (sessionStorage.getItem('box800-members-tab') as Tab) || 'active' } catch { return 'active' } })
  const [q, setQRaw] = useState(() => { try { return sessionStorage.getItem('box800-members-q') ?? '' } catch { return '' } })
  const setTab = (t: Tab) => { setTabRaw(t); try { sessionStorage.setItem('box800-members-tab', t) } catch { /* */ } }
  const setQ = (v: string) => { setQRaw(v); try { sessionStorage.setItem('box800-members-q', v) } catch { /* */ } }
  const nav = useNavigate()
  const [nw, setNw] = useState<null | { first: string; last: string; email: string; phone: string; kt: string; note: string; emergency: string; child: boolean }>(null)

  const rows = useMemo(() => (data ?? []).map((m) => ({ ...m, st: statusOf(m) })), [data])
  const inTab = (st: Tab, t: Tab, role?: string) => t === 'all' || (t === 'staff' ? role !== 'member' : t === 'active' ? st !== 'inactive' && st !== 'suspended' : st === t)
  const shown = rows.filter((m) => inTab(m.st, tab, m.role) && (!q || `${m.full_name} ${m.email} ${m.phone}`.toLowerCase().includes(q.toLowerCase())))
  const tabs: [Tab, string][] = [['active', 'Virkir'], ['new', 'Nýir'], ['expiring', 'Áskrift að renna út'], ['staff', 'Starfsfólk'], ['suspended', 'Í bið'], ['inactive', 'Óvirkir'], ['all', 'Allir']]
  const flag: Record<string, [string, string, string]> = { new: ['NÝR', '#1f3b2c', '#8fe0b0'], expiring: ['RENNUR ÚT', '#3b321f', '#f2c97a'], inactive: ['ÓVIRKUR', '#2a2e33', '#9aa3ad'], suspended: ['Í BIÐ', '#3b321f', '#f2c97a'] }
  const cols = 'minmax(0,2fr) minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) 100px 44px'

  const kt = (nw?.kt ?? '').replace(/\D/g, '')
  const valid = nw && nw.first.trim() && nw.last.trim() && /.+@.+\..+/.test(nw.email) && (kt.length === 10 || kt.length === 0)
  async function create() {
    if (!nw || !valid) return
    try {
      await api.createMember({ full_name: `${nw.first.trim()} ${nw.last.trim()}`, email: nw.email.trim(), phone: nw.phone || undefined, kennitala: kt || undefined, note: nw.note || undefined, emergency: nw.emergency || undefined, is_dependent: nw.child })
      toast(`${nw.first} stofnuð – getur nú stofnað aðgang í appinu með sama netfangi`); setNw(null); setTab('all'); refresh()
    } catch (e) { toast(errMsg(e)) }
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div><h1>Iðkendur</h1><div className="muted" style={{ fontSize: 14 }}>Áskriftir koma frá Abler. Hér sérðu stöðu, mætingu og samskiptaupplýsingar.</div></div>
        <button className="btn btn-primary" onClick={() => setNw({ first: '', last: '', email: '', phone: '', kt: '', note: '', emergency: '', child: false })}>+ Nýr iðkandi</button>
      </div>
      {inbox && inbox.length > 0 && (
        <section className="a-card" style={{ marginTop: 20, borderColor: '#f2b84b' }}>
          <h2 className="mp-h" style={{ marginTop: 0 }}>Kemst ekki inn <span className="badge badge-warn" style={{ marginLeft: 6 }}>{inbox.length}</span></h2>
          <div className="muted" style={{ fontSize: 14, marginBottom: 6 }}>Iðkendur sem segjast hafa keypt en komast ekki inn. Opnaðu prófílinn og bættu við áskrift, merktu svo afgreitt.</div>
          {inbox.map((m) => (
            <div key={m.id} className="row" style={{ gap: 12, padding: '12px 0', borderTop: '1px solid var(--line)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Avatar src={m.avatar_url} name={m.full_name} size={40} />
              <div className="grow" style={{ minWidth: 220 }}>
                <div><b>{m.full_name}</b>{m.what && <span className="badge badge-outline" style={{ marginLeft: 8 }}>{m.what}</span>}{m.has_access && <span className="badge badge-grey" style={{ marginLeft: 8 }}>HEFUR NÚ AÐGANG</span>}</div>
                <div className="muted" style={{ fontSize: 14 }}>{m.email}{m.phone ? ' · ' + m.phone : ''} · {relDay(m.created_at)}</div>
                {m.body && <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{m.body}</div>}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => nav('/stjorn/idkendur/' + m.profile_id)}>Opna prófíl</button>
                <button className="btn btn-primary btn-sm" onClick={async () => { try { await api.supportHandled(m.id); toast('Merkt afgreitt'); refresh() } catch (e) { toast(errMsg(e)) } }}>Afgreitt</button>
              </div>
            </div>
          ))}
        </section>
      )}
      <div className="row" style={{ flexWrap: 'wrap', marginTop: 20 }}>
        {tabs.map(([t, l]) => <button key={t} className={`chip${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{l} <span style={{ opacity: .75 }}>{rows.filter((m) => inTab(m.st, t, m.role)).length}</span></button>)}
      </div>
      <div className="row" style={{ marginTop: 14, maxWidth: 520 }}>
        <Icon name="search" color="var(--muted)" />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita að nafni, netfangi eða síma…" aria-label="Leita að iðkanda" />
        {q && <button className="icon-btn" aria-label="Hreinsa leit" onClick={() => setQ('')}><Icon name="x" size={18} /></button>}
      </div>
      {error && <div className="error" style={{ marginTop: 16 }}>{error}</div>}
      <div className="a-table" style={{ marginTop: 16 }}>
        <div style={{ minWidth: 860 }}>
          <div className="thead" style={{ gridTemplateColumns: cols }}><div>NAFN</div><div>ÁSKRIFT</div><div>GILDIR TIL</div><div>SÍÐAST MÆTT</div><div>30 DAGAR</div><div /></div>
          {!data && !error && <div className="spinner" />}
          {shown.map((m) => {
            const f = flag[m.st]
            return (
              <button key={m.id} className="tr mrow" style={{ gridTemplateColumns: cols, width: '100%', textAlign: 'left' }} onClick={() => nav('/stjorn/idkendur/' + m.id)}>
                <div className="row" style={{ minWidth: 0 }}>
                  <Avatar src={m.avatar_url} name={m.full_name || '?'} size={40} ring={f ? f[2] : undefined} />
                  <div style={{ minWidth: 0 }}>
                    <div className="ellipsis" style={{ color: 'var(--accent)', fontWeight: 600 }}>{m.full_name || m.email}</div>
                    <div className="row" style={{ gap: 4 }}>
                      {m.role !== 'member' && <span className="badge badge-accent">{m.role === 'owner' ? 'STJÓRNANDI' : 'ÞJÁLFARI'}</span>}
                      {f && <span className="badge" style={{ background: f[1], color: f[2] }}>{f[0]}</span>}
                    </div>
                  </div>
                </div>
                <div>{m.plan ?? '—'}</div>
                <div style={{ color: m.st === 'expiring' ? 'var(--warn)' : undefined }}>{m.ends_on ? dayLabel(m.ends_on) : m.plan ? 'Endurnýjast' : '—'}</div>
                <div style={{ color: '#c3cad1' }}>{m.last_class ? relDay(m.last_class) : '—'}</div>
                <div style={{ fontWeight: 700 }}>{m.visits_30}</div>
                <Icon name="next" size={18} color="var(--muted)" />
              </button>
            )
          })}
          {data && shown.length === 0 && <div className="tr muted">Enginn iðkandi passar við leitina.</div>}
        </div>
      </div>

      {nw && (
        <>
          <button className="modal-back" aria-label="Loka" onClick={() => setNw(null)} />
          <form className="modal" role="dialog" aria-label="Nýr iðkandi" onSubmit={(e) => { e.preventDefault(); create() }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><h2 className="display" style={{ margin: 0, fontSize: 30 }}>Nýr iðkandi</h2><button type="button" className="icon-btn" aria-label="Loka" onClick={() => setNw(null)}><Icon name="x" /></button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
              <label className="field"><span>Fornafn *</span><input className="input" value={nw.first} onChange={(e) => setNw({ ...nw, first: e.target.value })} required /></label>
              <label className="field"><span>Eftirnafn *</span><input className="input" value={nw.last} onChange={(e) => setNw({ ...nw, last: e.target.value })} required /></label>
            </div>
            <label className="field" style={{ marginTop: 14 }}><span>Netfang *</span><input className="input" type="email" value={nw.email} onChange={(e) => setNw({ ...nw, email: e.target.value })} required /></label>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Sama netfang og í Abler, svo áskriftin tengist sjálfkrafa.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <label className="field"><span>Farsími</span><input className="input" type="tel" value={nw.phone} onChange={(e) => setNw({ ...nw, phone: e.target.value })} /></label>
              <label className="field"><span>Kennitala</span><input className="input" inputMode="numeric" placeholder="000000-0000" value={nw.kt} onChange={(e) => setNw({ ...nw, kt: e.target.value })} style={{ borderColor: kt.length && kt.length !== 10 ? 'var(--warn)' : undefined }} /></label>
            </div>
            {kt.length > 0 && kt.length !== 10 && <div style={{ color: 'var(--warn)', fontSize: 13, marginTop: 4 }}>Kennitala er 10 tölustafir</div>}
            <label className="field" style={{ marginTop: 14 }}><span>Neyðartengiliður</span><input className="input" placeholder="Nafn og sími" value={nw.emergency} onChange={(e) => setNw({ ...nw, emergency: e.target.value })} /></label>
            <label className="field" style={{ marginTop: 14 }}><span>Athugasemd fyrir þjálfara</span><textarea className="textarea" rows={2} placeholder="T.d. meiðsli" value={nw.note} onChange={(e) => setNw({ ...nw, note: e.target.value })} /></label>
            <label className="row" style={{ marginTop: 14, alignItems: 'flex-start', cursor: 'pointer' }}><input type="checkbox" checked={nw.child} onChange={(e) => setNw({ ...nw, child: e.target.checked })} style={{ width: 20, height: 20, marginTop: 2 }} /><span><b>Barn eða aðstandandi</b> (engin eigin innskráning)</span></label>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 22 }}>
              <button type="button" className="btn" onClick={() => setNw(null)}>Hætta við</button>
              <button type="submit" className="btn btn-primary" disabled={!valid}>Stofna iðkanda</button>
            </div>
          </form>
        </>
      )}
    </>
  )
}
