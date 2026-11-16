import { useEffect, useState } from 'react'
import type { Profile } from '../api'
import { useApp, useData } from '../ctx'
import AvatarUpload from '../components/AvatarUpload'
import { dayLabel, errMsg, today } from '../util'

/** Prófíllinn minn: mynd, sími og neyðartengiliður. Iðkandi breytir sjálfur. */
export default function MyProfile() {
  const { api, me, toast, refresh, reloadMe } = useApp()
  const { data: p } = useData((a) => a.getProfile(me.id), [me.id])
  const { data: ms } = useData((a) => a.membershipsOf(me.id), [me.id])
  const [f, setF] = useState<Partial<Profile>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (p) setF({ full_name: p.full_name, phone: p.phone, emergency: p.emergency, emergency_phone: p.emergency_phone }) }, [p])
  const live = (ms ?? []).find((m) => m.status === 'active' && (!m.ends_on || m.ends_on >= today()))

  async function save() {
    if (!f.full_name?.trim()) { toast('Nafn vantar'); return }
    setBusy(true)
    try {
      await api.updateProfile(me.id, { full_name: f.full_name.trim(), phone: f.phone?.trim() || null, emergency: f.emergency?.trim() || null, emergency_phone: f.emergency_phone?.trim() || null })
      toast('Vistað'); refresh(); reloadMe?.()
    } catch (e) { toast(errMsg(e)) } finally { setBusy(false) }
  }
  const inp = (k: keyof Profile, label: string, type = 'text') => (
    <label className="field" style={{ marginTop: 12 }}><span>{label}</span><input className="input" type={type} value={(f[k] as string) ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  )

  return (
    <div style={{ padding: '20px 16px 30px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <AvatarUpload profileId={me.id} src={me.avatar_url} name={me.full_name || me.email || '?'} size={120} />
        <div className="muted" style={{ fontSize: 13 }}>Ýttu á myndina til að setja inn mynd af þér</div>
        <div className="display" style={{ fontSize: 28, textAlign: 'center' }}>{me.full_name || 'Nafnlaus'}</div>
        <div className="muted">{me.email}</div>
      </div>

      <div className="stat" style={{ marginTop: 18 }}>
        <div className="k">Áskrift</div>
        <div className="v" style={{ fontSize: 16 }}>{ms ? (live ? `${live.plan} · ${live.ends_on ? 'gildir til ' + dayLabel(live.ends_on) : 'endurnýjast'}` : 'Engin virk áskrift') : '…'}</div>
        {ms && !live && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Til að bóka tíma þarf áskrift. Hafðu samband við BOX800 eða keyptu kort á box800.is.</div>}
      </div>

      {inp('full_name', 'Fullt nafn')}
      {inp('phone', 'Farsími', 'tel')}
      <div className="label" style={{ marginTop: 20 }}>Neyðartengiliður</div>
      {inp('emergency', 'Nafn')}
      {inp('emergency_phone', 'Farsími', 'tel')}
      <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} disabled={busy} onClick={save}>Vista</button>
    </div>
  )
}
