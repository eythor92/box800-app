import { useEffect, useRef, useState } from 'react'
import type { PromoAdmin, PromoInput } from '../api'
import { useApp, useData } from '../ctx'
import PromoCard from '../components/PromoCard'
import { dayLabel, errMsg, today } from '../util'

/** Minnkar merki í mest 600 px breidd og vistar sem PNG (heldur gegnsæi) */
async function shrinkLogo(file: File, max = 600): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('Gat ekki lesið myndina')); i.src = url })
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('Gat ekki unnið myndina'))), 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}

const EMPTY = (): PromoInput => ({ partner: '', title: '', body: '', code: '', url: '', logo_url: null, audience_plan: 'Mömmuhreysti', starts_on: today(), ends_on: null, active: true })

function stateOf(p: PromoAdmin): [string, string] {
  const t = today()
  if (!p.active) return ['ÓVIRK', 'badge-grey']
  if (p.starts_on > t) return ['HEFST ' + dayLabel(p.starts_on).toUpperCase(), 'badge-outline']
  if (p.ends_on && p.ends_on < t) return ['LOKIÐ', 'badge-grey']
  return ['Í GANGI', 'badge-ok']
}

/** Samstarf: kynningar frá samstarfsaðilum á forsíðu appsins */
export default function AdminPromos() {
  const { api, toast, refresh } = useApp()
  const { data: list } = useData((a) => a.promos())
  const [ed, setEd] = useState<PromoInput | null>(null)
  const [aud, setAud] = useState<'all' | 'plan'>('plan')
  const [reach, setReach] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ed) return
    let live = true
    const plan = aud === 'all' ? null : ed.audience_plan
    const t = setTimeout(() => api.promoReach(plan).then((n) => live && setReach(n), () => undefined), 250)
    return () => { live = false; clearTimeout(t) }
  }, [ed?.audience_plan, aud, !!ed]) // eslint-disable-line react-hooks/exhaustive-deps

  function open(p?: PromoAdmin) {
    const v = p ? { ...p } : EMPTY()
    setAud(p && !p.audience_plan ? 'all' : 'plan'); setReach(null); setEd(v)
  }
  async function logo(f?: File) {
    if (!f || !ed) return
    if (!f.type.startsWith('image/')) { toast('Veldu mynd'); return }
    setBusy(true)
    try { const url = await api.uploadPromoLogo(await shrinkLogo(f)); setEd((e) => e && { ...e, logo_url: url }) }
    catch (e) { toast(errMsg(e)) } finally { setBusy(false); if (file.current) file.current.value = '' }
  }
  async function save() {
    if (!ed) return
    if (!ed.partner.trim() || !ed.title.trim()) { toast('Samstarfsaðili og fyrirsögn þurfa að vera útfyllt'); return }
    if (aud === 'plan' && !ed.audience_plan?.trim()) { toast('Skrifaðu nafn áskriftarinnar'); return }
    const clean = (s: string | null) => (s && s.trim() ? s.trim() : null)
    try {
      await api.savePromo({ ...ed, partner: ed.partner.trim(), title: ed.title.trim(), body: clean(ed.body), code: clean(ed.code)?.toUpperCase() ?? null, url: clean(ed.url),
        audience_plan: aud === 'all' ? null : clean(ed.audience_plan), ends_on: ed.ends_on || null })
      toast('Vistað'); setEd(null); refresh()
    } catch (e) { toast(errMsg(e)) }
  }
  async function remove(p: PromoAdmin) {
    if (!window.confirm(`Eyða kynningunni frá ${p.partner}?`)) return
    try { await api.deletePromo(p.id); toast('Eytt'); refresh() } catch (e) { toast(errMsg(e)) }
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div><h1>Samstarf og afslættir</h1><div className="muted" style={{ fontSize: 14 }}>Lítil kynning frá samstarfsaðila efst á forsíðu appsins, með merki, afsláttarkóða og hlekk.</div></div>
        <button className="btn btn-primary" onClick={() => open()}>+ Ný kynning</button>
      </div>

      {list && list.length === 0 && <div className="empty" style={{ marginTop: 20 }}>Engin kynning enn. Smelltu á „+ Ný kynning“.</div>}
      {!list && <div className="spinner" />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
        {(list ?? []).map((p) => {
          const [st, cls] = stateOf(p)
          return (
            <section key={p.id} className="a-card promo-admin">
              <PromoCard p={p} preview />
              <div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><span className={`badge ${cls}`}>{st}</span><b>{p.partner}</b></div>
                <div className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
                  <div>Hverjir sjá: <b style={{ color: 'var(--text)' }}>{p.audience_plan ? `Áskrift sem heitir „${p.audience_plan}“` : 'Allir iðkendur með aðgang'}</b></div>
                  <div>Tímabil: <b style={{ color: 'var(--text)' }}>{dayLabel(p.starts_on)} – {p.ends_on ? dayLabel(p.ends_on) : 'þar til slökkt er á henni'}</b></div>
                  <div>Afrituðu kóðann: <b style={{ color: 'var(--text)' }}>{p.copies}</b> · Smelltu á hlekkinn: <b style={{ color: 'var(--text)' }}>{p.clicks}</b></div>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 14 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => open(p)}>Breyta</button>
                  <button className="btn btn-ghost btn-sm" onClick={async () => { try { await api.savePromo({ ...p, active: !p.active }); refresh() } catch (e) { toast(errMsg(e)) } }}>{p.active ? 'Slökkva' : 'Kveikja'}</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--warn)' }} onClick={() => remove(p)}>Eyða</button>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      {ed && (
        <>
          <button className="modal-back" aria-label="Loka" onClick={() => setEd(null)} />
          <form className="modal" role="dialog" aria-label="Kynning" style={{ maxWidth: 860, width: 'calc(100% - 32px)' }} onSubmit={(e) => { e.preventDefault(); save() }}>
            <h2 style={{ marginTop: 0 }}>{ed.id ? 'Breyta kynningu' : 'Ný kynning'}</h2>
            <div className="promo-admin">
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', marginBottom: 8 }}>SVONA LÍTUR HÚN ÚT</div>
                <PromoCard preview p={{ id: 0, partner: ed.partner || 'Samstarfsaðili', title: ed.title || 'Fyrirsögn', body: ed.body, code: ed.code ? ed.code.toUpperCase() : null, url: ed.url, logo_url: ed.logo_url }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="field"><span>Samstarfsaðili</span><input className="input" value={ed.partner} onChange={(e) => setEd({ ...ed, partner: e.target.value })} placeholder="T.d. Yrja" autoFocus /></label>
                <div className="field"><span>Merki</span>
                  <div className="row" style={{ gap: 10 }}>
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Hleð upp…' : ed.logo_url ? 'Skipta um merki' : 'Velja mynd'}</button>
                    {ed.logo_url && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEd({ ...ed, logo_url: null })}>Fjarlægja</button>}
                    <input ref={file} type="file" accept="image/*" hidden onChange={(e) => logo(e.target.files?.[0])} />
                  </div>
                </div>
                <label className="field"><span>Fyrirsögn</span><input className="input" value={ed.title} onChange={(e) => setEd({ ...ed, title: e.target.value })} placeholder="T.d. 20% afsláttur í vefverslun" /></label>
                <label className="field"><span>Texti (má sleppa)</span><textarea className="textarea" rows={3} style={{ height: 'auto', padding: 12 }} value={ed.body ?? ''} onChange={(e) => setEd({ ...ed, body: e.target.value })} placeholder="Stutt lýsing á tilboðinu" /></label>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <label className="field grow"><span>Afsláttarkóði</span><input className="input" value={ed.code ?? ''} onChange={(e) => setEd({ ...ed, code: e.target.value })} placeholder="T.d. BOX800" /></label>
                  <label className="field grow"><span>Hlekkur á vefverslun</span><input className="input" value={ed.url ?? ''} onChange={(e) => setEd({ ...ed, url: e.target.value })} placeholder="T.d. yrja.is" /></label>
                </div>
                <div className="field"><span>Hverjir sjá kynninguna?</span>
                  <label className="row" style={{ gap: 8, cursor: 'pointer' }}><input type="radio" name="aud" checked={aud === 'plan'} onChange={() => setAud('plan')} />Aðeins þau sem eru með áskrift sem heitir</label>
                  {aud === 'plan' && <input className="input" style={{ marginTop: 6 }} value={ed.audience_plan ?? ''} onChange={(e) => setEd({ ...ed, audience_plan: e.target.value })} placeholder="T.d. Mömmuhreysti" />}
                  <label className="row" style={{ gap: 8, cursor: 'pointer', marginTop: 8 }}><input type="radio" name="aud" checked={aud === 'all'} onChange={() => setAud('all')} />Allir iðkendur með aðgang</label>
                  <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{reach === null ? '…' : `Sést núna hjá ${reach} ${reach % 10 === 1 && reach % 100 !== 11 ? 'iðkanda' : 'iðkendum'}.`}</div>
                </div>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <label className="field grow"><span>Frá</span><input className="input" type="date" value={ed.starts_on} onChange={(e) => setEd({ ...ed, starts_on: e.target.value || today() })} /></label>
                  <label className="field grow"><span>Til (má sleppa)</span><input className="input" type="date" value={ed.ends_on ?? ''} min={ed.starts_on} onChange={(e) => setEd({ ...ed, ends_on: e.target.value || null })} /></label>
                </div>
                <label className="row" style={{ gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={ed.active} onChange={(e) => setEd({ ...ed, active: e.target.checked })} />Virk</label>
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEd(null)}>Hætta við</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Vista</button>
            </div>
          </form>
        </>
      )}
    </>
  )
}
