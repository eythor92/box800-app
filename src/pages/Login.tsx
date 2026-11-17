import { useState } from 'react'
import type { Api } from '../api'
import { errMsg } from '../util'

type Mode = 'login' | 'signup' | 'reset'

export default function Login({ api }: { api: Api }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(() => {
    try { const n = sessionStorage.getItem('box800-auth-notice'); sessionStorage.removeItem('box800-auth-notice'); return n ?? '' } catch { return '' }
  })
  const [info, setInfo] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'login') await api.signIn(email.trim(), pw)
      else if (mode === 'signup') {
        if (pw.length < 8) throw new Error('Lykilorð þarf að vera a.m.k. 8 stafir')
        const r = await api.signUp(email.trim(), pw, name.trim())
        if (r === 'confirm') { setInfo('Við sendum þér staðfestingarpóst. Smelltu á hlekkinn í honum og skráðu þig svo inn.'); setMode('login') }
      } else {
        await api.resetPassword(email.trim())
        setInfo('Ef netfangið er skráð færðu póst með hlekk til að velja nýtt lykilorð.')
        setMode('login')
      }
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  const demoUsers = api.demoUsers?.() ?? []

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={submit}>
        <img src="myndir/logo-white.png" alt="BOX800" style={{ height: 64, alignSelf: 'center', marginBottom: 10 }} />
        <h1 className="display" style={{ margin: 0, fontSize: 34, textAlign: 'center' }}>
          {mode === 'login' ? 'Skrá inn' : mode === 'signup' ? 'Nýskráning' : 'Gleymt lykilorð'}
        </h1>

        {api.demo && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="label">Prófunarútgáfa – veldu notanda</div>
            {demoUsers.map((u) => (
              <button key={u.email} type="button" className="btn btn-ghost btn-block" onClick={async () => { setBusy(true); try { await api.signIn(u.email, '') } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) } }}>
                {u.label}
              </button>
            ))}
            <div className="muted" style={{ fontSize: 13 }}>Gögnin eru prufugögn og hverfa þegar síðan er endurhlaðin.</div>
          </div>
        )}

        {info && <div className="card" style={{ color: 'var(--ok)' }} role="status">{info}</div>}
        {err && <div className="error" role="alert">{err}</div>}

        {mode === 'signup' && (
          <label className="field"><span>Fullt nafn</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
        )}
        <label className="field"><span>Netfang</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required={!api.demo} />
        </label>
        {mode !== 'reset' && (
          <label className="field"><span>Lykilorð</span>
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required={!api.demo} minLength={mode === 'signup' ? 8 : undefined} />
          </label>
        )}
        {mode === 'signup' && <div className="muted" style={{ fontSize: 13 }}>Notaðu sama netfang og þegar þú keyptir kortið, þá tengist áskriftin sjálfkrafa.</div>}

        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? 'Augnablik…' : mode === 'login' ? 'Skrá inn' : mode === 'signup' ? 'Stofna aðgang' : 'Senda hlekk'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          {mode !== 'login' && <button type="button" className="muted" onClick={() => setMode('login')}>Til baka í innskráningu</button>}
          {mode === 'login' && <button type="button" style={{ color: 'var(--accent)' }} onClick={() => setMode('signup')}>Nýr? Stofna aðgang</button>}
          {mode === 'login' && <button type="button" className="muted" onClick={() => setMode('reset')}>Gleymt lykilorð?</button>}
        </div>
      </form>
    </main>
  )
}
