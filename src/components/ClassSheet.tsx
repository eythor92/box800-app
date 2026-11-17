import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ClassRow } from '../api'
import { useApp, useData } from '../ctx'
import { Avatar, Icon } from './Icon'
import { bookingOpensAt, kyn, cap1, dayKey, dayLabel, errMsg, hhmm, shortTime, whenText } from '../util'

export function classState(c: ClassRow) {
  const past = new Date(c.starts_at) <= new Date()
  const full = c.booked >= c.cap
  const booked = c.my_status === 'booked'
  const waiting = c.my_status === 'waitlist'
  let badge: { text: string; cls: string } | null = null
  if (c.cancelled) badge = { text: 'AFLÝST', cls: 'badge-danger' }
  else if (booked && past) badge = { text: 'MÆTT', cls: 'badge-grey' }
  else if (booked) badge = { text: 'SKRÁÐ', cls: 'badge-accent' }
  else if (waiting) badge = { text: 'BIÐLISTI #' + (c.my_position ?? ''), cls: 'badge-outline' }
  else if (full && !past) badge = { text: 'FULLT', cls: 'badge-warn' }
  return { past, full, booked, waiting, badge }
}

export default function ClassSheet({ c, onClose }: { c: ClassRow; onClose: () => void }) {
  const { api, me, toast, refresh } = useApp()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const st = classState(c)
  const { data: settings } = useData((a) => a.settings())
  const opensAt = settings ? bookingOpensAt(c.starts_at, settings) : null
  const notOpen = !!opensAt && opensAt > new Date() && !c.my_status
  const title = `${c.program}: ${hhmm(c.starts_at)}`

  let btn = 'Bóka', kind = 'btn-primary', note = '', noteCls = ''
  if (c.cancelled) { btn = 'Tíma aflýst'; kind = 'btn-ghost'; note = 'Þessum tíma hefur verið aflýst.'; noteCls = 'error' }
  else if (st.past) { btn = st.booked ? 'Þú mættir í þennan tíma' : 'Tíminn er liðinn'; kind = 'btn-ghost' }
  else if (st.booked) { btn = 'Afbóka'; kind = 'btn-ghost'; }
  else if (st.waiting) { btn = 'Fara af biðlista'; kind = 'btn-ghost'; note = `Þú ert nr. ${c.my_position} á biðlista. Ef einhver afbókar færðu plássið sjálfkrafa og tilkynningu.` }
  else if (notOpen) { btn = 'Bókanir ekki opnar'; kind = 'btn-ghost'; note = `Bókanir opna ${whenText(opensAt!.toISOString()).replace('Í dag', 'í dag').replace('Á morgun', 'á morgun')}.` }
  else if (st.full) { btn = 'Fara á biðlista'; note = `Tíminn er fullur${c.waiting ? ` og ${c.waiting} á biðlista` : ''}. Þú færð plássið sjálfkrafa ef einhver afbókar.` }
  const disabled = c.cancelled || st.past || notOpen

  async function act() {
    setBusy(true)
    try {
      if (st.booked || st.waiting) {
        await api.cancelBooking(c.id)
        toast(st.waiting ? `Þú ert ${kyn(me.gender, 'farin', 'farinn')} af biðlista` : 'Bókun afturkölluð')
      } else {
        const r = await api.book(c.id)
        toast(r === 'waitlist' ? 'Þú ert á biðlista – við látum þig vita' : `Bókað! ${c.program} kl. ${hhmm(c.starts_at)}`)
      }
      refresh(); onClose()
    } catch (e) { toast(errMsg(e)) } finally { setBusy(false) }
  }

  const { data: people } = useData((a) => a.attendees(c.id), [c.id])
  const meIn = people?.find((p) => p.is_me)
  const now = Date.now()
  const canSignIn = st.booked && !c.cancelled && !meIn?.checked_in && now >= +new Date(c.starts_at) - 30 * 60000 && now <= +new Date(c.ends_at) + 30 * 60000
  const d = new Date(c.starts_at)
  const when = cap1(dayLabel(dayKey(d), true)) + ', ' + shortTime(c.starts_at) + ' – ' + shortTime(c.ends_at)

  async function signIn() {
    setBusy(true)
    try { await api.selfCheckIn(c.id); toast(`Þú ert ${kyn(me.gender, 'skráð', 'skráður')} inn. Góða æfingu!`); refresh() } catch (e) { toast(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <button className="sheet-back" aria-label="Loka" onClick={onClose} />
      <div className="sheet cs" role="dialog" aria-label={title}>
        <div className="grip" />
        <div className="display" style={{ fontSize: 34, lineHeight: 1.05 }}>{title}</div>
        <div className="cs-row"><Icon name="clock" size={22} /><span>{when}</span></div>
        <div className="cs-row"><Icon name="user" size={22} /><span className="label" style={{ fontSize: 13 }}>Þjálfari</span></div>
        <div className="cs-row" style={{ paddingLeft: 36, marginTop: 4 }}>
          <Avatar src={c.coach_avatar} name={c.coach_name ?? '?'} size={44} /><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{c.coach_name ?? 'Ekki ákveðið'}</span>
        </div>
        <div className="cs-row"><Icon name="pin" size={22} /><span>BOX800 · Eyravegur 57, Selfossi</span></div>
        <button className="cs-go" onClick={() => { onClose(); nav(`/aefing?p=${c.program_id}&d=${dayKey(d)}`) }}>Skoða æfinguna<Icon name="dumb" size={22} /></button>

        <div className="cs-att">
          <span>Skráðir</span><Icon name="people" size={20} /><b>{people?.length ?? c.booked} | {c.cap}</b>{c.waiting > 0 && <span className="muted" style={{ fontWeight: 500 }}>· {c.waiting} á biðlista</span>}
        </div>
        {!people && <div className="spinner" style={{ margin: '16px auto' }} />}
        {people?.length === 0 && <div className="muted" style={{ padding: '6px 0 4px' }}>Enginn skráður enn. Vertu {kyn(me.gender, 'fyrst', 'fyrstur')}!</div>}
        <div className="cs-list">
          {people?.map((p) => (
            <div key={p.profile_id} className="row" style={{ gap: 14, padding: '7px 0' }}>
              <Avatar src={p.avatar_url} name={p.full_name} size={46} />
              <span className="grow" style={{ fontSize: 17, fontWeight: p.is_me ? 700 : 400 }}>{p.full_name}{p.is_me ? ' (þú)' : ''}</span>
              {p.checked_in && <span className="badge badge-ok">MÆTT</span>}
            </div>
          ))}
        </div>

        <div className="cs-foot">
          {note && <div className={noteCls || 'stat'} style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>{note}</div>}
          {meIn?.checked_in && !st.past && <div className="stat" style={{ marginBottom: 10, fontWeight: 700, color: 'var(--ok)' }}>Þú ert {kyn(me.gender, 'skráð', 'skráður')} inn. Góða æfingu!</div>}
          <button className={`btn ${st.booked || st.waiting ? 'btn-outline' : kind} btn-block`} style={{ height: 52 }} disabled={disabled || busy} onClick={act}>{busy ? 'Augnablik…' : btn}</button>
          {canSignIn && <button className="btn btn-primary btn-block" style={{ height: 52, marginTop: 10 }} disabled={busy} onClick={signIn}>Skrá mig inn</button>}
        </div>
      </div>
    </>
  )
}
