import { useState } from 'react'
import type { Api } from '../api'
import { errMsg } from '../util'

/** Opnast eftir að smellt er á „Velja nýtt lykilorð“ í tölvupósti */
export default function NewPassword({ api, email, onDone }: { api: Api; email?: string | null; onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (pw.length < 8) { setErr('Lykilorðið þarf að vera a.m.k. 8 stafir'); return }
    if (pw !== pw2) { setErr('Lykilorðin eru ekki eins'); return }
    setBusy(true)
    try { await api.updatePassword(pw); onDone() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={submit}>
        <img src="myndir/logo-white.png" alt="BOX800" style={{ height: 64, alignSelf: 'center', marginBottom: 10 }} />
        <h1 className="display" style={{ margin: 0, fontSize: 34, textAlign: 'center' }}>Nýtt lykilorð</h1>
        {email && <div className="muted" style={{ textAlign: 'center', fontSize: 14 }}>{email}</div>}
        {err && <div className="error" role="alert">{err}</div>}
        <label className="field"><span>Nýtt lykilorð</span>
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} required autoFocus />
        </label>
        <label className="field"><span>Endurtaka lykilorð</span>
          <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        <div className="muted" style={{ fontSize: 13 }}>A.m.k. 8 stafir.</div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Vista…' : 'Vista nýtt lykilorð'}</button>
      </form>
    </main>
  )
}
