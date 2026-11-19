import { useEffect, useRef, useState } from 'react'
import type { PtVideo } from '../api'
import { useApp, useData } from '../ctx'
import { Icon } from './Icon'
import { dayLabel, errMsg, relDay, shortTime } from '../util'

const MAX = 100 * 1024 * 1024

/** Myndbönd í 1 on 1: iðkandi sendir inn, þjálfari gefur endurgjöf */
export default function PtVideos({ profileId, day, staff, name }: { profileId: string; day?: string; staff?: boolean; name?: string }) {
  const { api, toast, refresh } = useApp()
  const { data: all } = useData((a) => a.ptVideos(profileId), [profileId])
  const list = (all ?? []).filter((v) => !day || v.day === day)
  const file = useRef<HTMLInputElement>(null)
  const [pick, setPick] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [prog, setProg] = useState<number | null>(null)

  async function send() {
    if (!pick || !day) return
    if (pick.size > MAX) { toast('Myndbandið er of stórt (mest 100 MB). Prófaðu styttra myndband.'); return }
    setProg(0)
    try { await api.uploadPtVideo(profileId, day, pick, note, setProg); toast('Myndbandið er sent!'); setPick(null); setNote(''); refresh() }
    catch (e) { toast(errMsg(e)) } finally { setProg(null); if (file.current) file.current.value = '' }
  }

  return (
    <section className="ptv">
      <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
        <div className="label">{staff ? `Myndbönd frá ${name?.split(' ')[0] ?? 'iðkanda'}` : 'Myndband og endurgjöf'}</div>
        {!staff && day && !pick && <button className="btn btn-outline btn-sm" onClick={() => file.current?.click()}><Icon name="plus" size={16} />Senda myndband</button>}
      </div>
      {!staff && <input ref={file} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setPick(f) }} />}

      {pick && (
        <div className="ptv-new">
          <div className="row" style={{ gap: 10 }}><Icon name="dumb" size={18} /><span className="grow ellipsis">{pick.name}</span><span className="muted" style={{ fontSize: 13 }}>{(pick.size / 1048576).toFixed(0)} MB</span></div>
          {pick.size > MAX && <div style={{ color: 'var(--warn)', fontSize: 14, marginTop: 6 }}>Of stórt, mest 100 MB. Taktu styttra myndband (u.þ.b. 1 mínúta).</div>}
          <textarea className="textarea" rows={2} style={{ height: 'auto', padding: 10, marginTop: 10 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Spurning til þjálfarans (má sleppa), t.d. „Er bakið beint?“" maxLength={500} />
          {prog !== null
            ? <div className="ptv-bar" aria-label="Hleð upp"><span style={{ width: `${Math.round(prog * 100)}%` }} /><b>{Math.round(prog * 100)}%</b></div>
            : <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setPick(null); if (file.current) file.current.value = '' }}>Hætta við</button>
                <button className="btn btn-primary btn-sm" disabled={pick.size > MAX} onClick={send}>Senda</button>
              </div>}
        </div>
      )}

      {all && list.length === 0 && !pick && <div className="muted" style={{ fontSize: 14, marginTop: 8 }}>{staff ? 'Engin myndbönd enn.' : 'Taktu upp lyftu eða æfingu og sendu þjálfaranum til að fá endurgjöf.'}</div>}
      {list.map((v) => <VideoItem key={v.id} v={v} staff={staff} showDay={!day} />)}
    </section>
  )
}

function VideoItem({ v, staff, showDay }: { v: PtVideo; staff?: boolean; showDay?: boolean }) {
  const { api, toast, refresh } = useApp()
  const [src, setSrc] = useState<string | null>(null)
  const [fb, setFb] = useState<string | null>(null)
  useEffect(() => { if (!staff && v.feedback && !v.seen_at) api.ptVideoSeen(v.id).catch(() => undefined) }, [v.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() { try { setSrc(await api.ptVideoUrl(v.path)) } catch (e) { toast(errMsg(e)) } }
  return (
    <div className="ptv-item">
      <div className="muted" style={{ fontSize: 13 }}>{showDay ? dayLabel(v.day) + ' · ' : ''}Sent {relDay(v.created_at).toLowerCase()} kl. {shortTime(v.created_at)}</div>
      {src ? <video src={src} controls playsInline preload="metadata" className="ptv-video" />
        : <button className="ptv-play" onClick={load} aria-label="Spila myndband"><Icon name="next" size={28} /><span>Spila myndband</span></button>}
      {v.note && <div className="ptv-note">„{v.note}“</div>}
      {v.feedback && fb === null && (
        <div className="ptv-fb">
          <div className="label" style={{ color: 'var(--ok)' }}>Endurgjöf frá þjálfara</div>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{v.feedback}</div>
          {staff && <button className="link" style={{ fontSize: 13, marginTop: 6 }} onClick={() => setFb(v.feedback ?? '')}>Breyta</button>}
        </div>
      )}
      {staff && (fb !== null || !v.feedback) && (
        <div style={{ marginTop: 10 }}>
          <textarea className="textarea" rows={3} style={{ height: 'auto', padding: 10 }} value={fb ?? ''} onChange={(e) => setFb(e.target.value)} placeholder="Skrifaðu endurgjöf, t.d. „Flott dýpt! Haltu bringunni hærra.“" />
          <div className="row" style={{ gap: 8, justifyContent: 'space-between', marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--warn)' }} onClick={async () => { if (!window.confirm('Eyða myndbandinu?')) return; try { await api.deletePtVideo(v); toast('Eytt'); refresh() } catch (e) { toast(errMsg(e)) } }}>Eyða myndbandi</button>
            <button className="btn btn-primary btn-sm" disabled={!(fb ?? '').trim()} onClick={async () => { try { await api.ptVideoFeedback(v.id, fb ?? ''); toast('Endurgjöf send'); setFb(null); refresh() } catch (e) { toast(errMsg(e)) } }}>Senda endurgjöf</button>
          </div>
        </div>
      )}
    </div>
  )
}
