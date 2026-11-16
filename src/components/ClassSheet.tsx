import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ClassRow } from '../api'
import { useApp, useData } from '../ctx'
import { Avatar } from './Icon'
import { bookingOpensAt, dayKey, errMsg, hhmm, minutesBetween, whenText } from '../util'

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
  const { api, toast, refresh } = useApp()
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
  else if (st.booked) { btn = 'Afbóka'; kind = 'btn-ghost'; note = 'Hægt er að afbóka án refsingar allt að 30 mín. fyrir tímann.' }
  else if (st.waiting) { btn = 'Fara af biðlista'; kind = 'btn-ghost'; note = `Þú ert nr. ${c.my_position} á biðlista. Ef einhver afbókar færðu plássið sjálfkrafa og tilkynningu.` }
  else if (notOpen) { btn = 'Bókanir ekki opnar'; kind = 'btn-ghost'; note = `Bókanir opna ${whenText(opensAt!.toISOString()).replace('Í dag', 'í dag').replace('Á morgun', 'á morgun')}.` }
  else if (st.full) { btn = 'Fara á biðlista'; note = `Tíminn er fullur${c.waiting ? ` og ${c.waiting} á biðlista` : ''}. Þú færð plássið sjálfkrafa ef einhver afbókar.` }
  const disabled = c.cancelled || st.past || notOpen

  async function act() {
    setBusy(true)
    try {
      if (st.booked || st.waiting) {
        const r = await api.cancelBooking(c.id)
        toast(r === 'late_cancel' ? 'Afbókað – of seint til að afbóka án refsingar' : st.waiting ? 'Þú ert farin(n) af biðlista' : 'Bókun afturkölluð')
      } else {
        const r = await api.book(c.id)
        toast(r === 'waitlist' ? 'Þú ert á biðlista – við látum þig vita' : `Bókað! ${c.program} kl. ${hhmm(c.starts_at)}`)
      }
      refresh(); onClose()
    } catch (e) { toast(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <button className="sheet-back" aria-label="Loka" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="grip" />
        <div className="row" style={{ gap: 14 }}>
          <Avatar src={c.coach_avatar} name={c.coach_name ?? '?'} size={56} />
          <div>
            <div className="display" style={{ fontSize: 28, lineHeight: 1.1 }}>{title}</div>
            <div style={{ color: '#b9c1ca' }}>{whenText(c.starts_at)} · {minutesBetween(c.starts_at, c.ends_at)} mín</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
          <div className="stat"><div className="k">Þjálfari</div><div className="v" style={{ fontSize: 15 }}>{c.coach_name ?? '–'}</div></div>
          <div className="stat"><div className="k">Skráðir</div><div className="v" style={{ fontSize: 15 }}>{c.booked} | {c.cap}{c.waiting ? ` · ${c.waiting} bíða` : ''}</div></div>
        </div>
        {note && <div className={noteCls || 'stat'} style={{ marginTop: 14, fontSize: 14, fontWeight: 600 }}>{note}</div>}
        <button className={`btn ${kind} btn-block`} style={{ marginTop: 18, height: 52 }} disabled={disabled || busy} onClick={act}>{busy ? 'Augnablik…' : btn}</button>
        <button className="btn btn-block" style={{ marginTop: 6, color: 'var(--accent)' }} onClick={() => { onClose(); nav(`/aefing?p=${c.program_id}&d=${dayKey(new Date(c.starts_at))}`) }}>Skoða æfingu dagsins</button>
      </div>
    </>
  )
}
