import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, useData } from '../ctx'
import { Icon } from '../components/Icon'
import { errMsg, kyn, relDay, shortTime } from '../util'

export const BUY_URL = 'https://abler.io/shop/box800'

/** Forsíða fyrir þá sem eru ekki með virkt kort eða áskrift */
export default function NoAccess() {
  const { api, me, reloadMe, toast, refresh } = useApp()
  const first = me.full_name.split(' ')[0]
  const { data: sent } = useData((a) => a.supportPending())
  const [form, setForm] = useState<null | { what: string; phone: string; body: string }>(null)
  const [busy, setBusy] = useState(false)
  async function send() {
    if (!form || busy) return
    setBusy(true)
    try { await api.sendSupport(form.what, form.phone, form.body); setForm(null); toast('Takk! Skilaboðin eru send.'); refresh() }
    catch (e) { toast(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <>
      <section className="h-hero" style={{ paddingBottom: 30 }}>
        <div className="h-kicker">{kyn(me.gender, 'Velkomin', 'Velkominn')}{first ? ', ' + first : ''}</div>
        <div className="h-big">Aðgangurinn þinn er tilbúinn</div>
        <p style={{ color: '#d9dde2', fontSize: 16, lineHeight: 1.5, marginTop: 12 }}>
          Til að bóka tíma, sjá tímatöfluna og æfingu dagsins þarftu kort eða áskrift hjá BOX800.
        </p>
        <a className="btn btn-primary btn-block" style={{ marginTop: 16, height: 52 }} href={BUY_URL} target="_blank" rel="noreferrer">Kaupa kort eða áskrift</a>
      </section>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 17 }}>{kyn(me.gender, 'Búin', 'Búinn')} að kaupa áskrift en kemst ekki inn?</div>
          {sent ? (
            <div className="row" style={{ marginTop: 10, gap: 10, alignItems: 'flex-start' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="3" style={{ flexShrink: 0, marginTop: 1 }}><path d="M5 12l5 5L20 7" /></svg>
              <div className="muted" style={{ fontSize: 14 }}><b style={{ color: 'var(--text)' }}>Skilaboðin eru send</b> ({relDay(sent).toLowerCase()} kl. {shortTime(sent)}). Við kíkjum á þetta og opnum aðganginn þinn sem fyrst.</div>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Sendu okkur skilaboð og við kippum því í lag.</div>
          )}
          <button className={`btn ${sent ? 'btn-ghost' : 'btn-primary'} btn-block`} style={{ marginTop: 12 }} onClick={() => setForm({ what: '', phone: me.phone ?? '', body: '' })}>{sent ? 'Senda önnur skilaboð' : 'Senda okkur skilaboð'}</button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => reloadMe?.()}><Icon name="reuse" size={18} />Athuga aftur</button>
        </div>
        <Link to="/profill" className="card row" style={{ textDecoration: 'none', color: 'var(--text)' }}>
          <Icon name="user" /><span className="grow"><b>Prófíllinn minn</b><div className="muted" style={{ fontSize: 14 }}>Settu inn mynd af þér og neyðartengilið</div></span><Icon name="next" size={18} color="var(--muted)" />
        </Link>
        <a className="card row" style={{ textDecoration: 'none', color: 'var(--text)' }} href="https://www.box800.is/samband.html" target="_blank" rel="noreferrer">
          <Icon name="pin" /><span className="grow"><b>Hafa samband</b><div className="muted" style={{ fontSize: 14 }}>Eyravegur 57, Selfossi</div></span><Icon name="next" size={18} color="var(--muted)" />
        </a>
      </div>

      {form && (
        <>
          <button className="sheet-back" aria-label="Loka" onClick={() => setForm(null)} />
          <div className="sheet" role="dialog" aria-label="Senda okkur skilaboð">
            <div className="grip" />
            <div style={{ fontWeight: 800, fontSize: 20 }}>Senda okkur skilaboð</div>
            <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Skilaboðin fara beint til okkar hjá BOX800.</div>
            <div className="card" style={{ marginTop: 14, padding: '10px 14px', fontSize: 14 }}>
              <div><span className="muted">Nafn: </span><b>{me.full_name}</b></div>
              <div><span className="muted">Netfang: </span><b>{me.email}</b></div>
            </div>
            <label className="field" style={{ marginTop: 14 }}><span>Sími</span>
              <input className="input" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Svo við getum hringt ef þarf" />
            </label>
            <div className="field" style={{ marginTop: 14 }}><span>Hvað keyptirðu?</span>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {['Áskrift', '10 skipta kort', 'Prufukort', 'Annað'].map((w) => (
                  <button key={w} type="button" className={`chip${form.what === w ? ' on' : ''}`} onClick={() => setForm({ ...form, what: w })}>{w}</button>
                ))}
              </div>
            </div>
            <label className="field" style={{ marginTop: 14 }}><span>Skilaboð</span>
              <textarea className="textarea" rows={4} style={{ height: 'auto', padding: 12, resize: 'vertical' }} maxLength={2000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="T.d. hvenær þú keyptir og með hvaða netfangi, ef það er annað en hér að ofan" />
            </label>
            <button className="btn btn-primary btn-block" style={{ marginTop: 16, height: 52 }} disabled={busy || (!form.what && !form.body.trim())} onClick={send}>{busy ? 'Sendi…' : 'Senda'}</button>
          </div>
        </>
      )}
    </>
  )
}
