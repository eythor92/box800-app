import { useEffect, useState } from 'react'
import type { Settings } from '../api'
import { useApp, useData } from '../ctx'
import { errMsg } from '../util'

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
function t(m: number) { const x = ((m % 1440) + 1440) % 1440; return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}` }

export default function AdminSettings() {
  const { api, toast, refresh } = useApp()
  const { data } = useData((a) => a.settings())
  const [s, setS] = useState<Settings | null>(null)
  useEffect(() => { if (data) setS(data) }, [data])
  if (!s) return <div className="spinner" />
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })
  const cls = 8 * 60 + 30
  const ot = (s.open_time ?? '12:00').slice(0, 5), [oh, om] = ot.split(':').map(Number)
  const opens = s.open_mode === 'fixed' ? oh * 60 + om - s.open_days * 1440 : cls - s.open_minutes
  const dayWord = (m: number) => (m < -1440 ? `${Math.ceil(-m / 1440)} dögum áður` : m < 0 ? 'daginn áður' : 'sama dag')
  const openDay = dayWord(opens)
  const box: React.CSSProperties = { width: 96 }

  return (
    <>
      <h1>Bókunarstillingar</h1>
      <div className="muted" style={{ fontSize: 14 }}>Gilda fyrir alla tíma.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 22, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 480px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="a-card">
            <h2 style={{ margin: '0 0 12px', fontSize: 17 }}>Bókanir</h2>
            <div style={{ fontWeight: 700 }}>Hvenær opna bókanir?</div>
            <label className="row" style={{ flexWrap: 'wrap', marginTop: 10, cursor: 'pointer' }}>
              <input type="radio" name="om" checked={s.open_mode === 'fixed'} onChange={() => setS({ ...s, open_mode: 'fixed' })} style={{ width: 18, height: 18 }} />
              <span>Opnast fyrir tímann kl.</span>
              <select className="select" style={{ width: 110 }} value={ot} onChange={(e) => setS({ ...s, open_mode: 'fixed', open_time: e.target.value })} aria-label="Klukkan">
                {TIMES.concat(TIMES.includes(ot) ? [] : [ot]).map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <select className="select" style={{ width: 180 }} value={s.open_days} onChange={(e) => setS({ ...s, open_mode: 'fixed', open_days: Number(e.target.value) })} aria-label="Hvaða dag">
                <option value={0}>sama dag</option>
                <option value={1}>daginn áður</option>
                {[2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} dögum áður</option>)}
              </select>
            </label>
            <label className="row" style={{ flexWrap: 'wrap', marginTop: 10, cursor: 'pointer' }}>
              <input type="radio" name="om" checked={s.open_mode === 'relative'} onChange={() => setS({ ...s, open_mode: 'relative' })} style={{ width: 18, height: 18 }} />
              <input className="input" style={box} type="number" min={0} value={s.open_minutes} onChange={(e) => setS({ ...s, open_mode: 'relative', open_minutes: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })} aria-label="Mínútur" />
              <span className="muted">Eða: mínútum fyrir hvern tíma</span>
            </label>
            <div style={{ color: 'var(--accent)', fontSize: 14, margin: '8px 0 4px 28px' }}>
              {s.open_mode === 'fixed'
                ? `Allir tímar opna ${s.open_days === 0 ? 'sama dag' : s.open_days === 1 ? 'daginn áður' : s.open_days + ' dögum áður'} kl. ${t(oh * 60 + om)}, sama hvenær dags þeir eru.`
                : `Fyrir tíma kl. 8:30 opna bókanir ${openDay} kl. ${t(opens)}.`}
            </div>
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 12 }} />
            <div className="row" style={{ flexWrap: 'wrap', marginTop: 14 }}><span style={{ minWidth: 170 }}>Bókanir loka</span><input className="input" style={box} type="number" min={0} value={s.close_minutes} onChange={num('close_minutes')} aria-label="Mínútur" /><span>mínútum fyrir tímann</span></div>
            <div className="row" style={{ flexWrap: 'wrap', marginTop: 14 }}><span style={{ minWidth: 170 }}>Biðlisti færist inn til</span><input className="input" style={box} type="number" min={0} value={s.cancel_minutes} onChange={num('cancel_minutes')} aria-label="Mínútur" /><span>mínútum fyrir tímann</span></div>
          </section>

          <section className="a-card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Biðlisti</h2>
              <button className="switch" role="switch" aria-checked={s.waitlist_on} aria-label="Leyfa biðlista" onClick={() => setS({ ...s, waitlist_on: !s.waitlist_on })} />
            </div>
            {s.waitlist_on && (
              <>
                <div style={{ marginTop: 12, color: '#c3cad1' }}>Þegar pláss losnar:</div>
                <label className="row" style={{ alignItems: 'flex-start', marginTop: 8, cursor: 'pointer' }}><input type="radio" name="wm" checked={s.waitlist_mode === 'auto'} onChange={() => setS({ ...s, waitlist_mode: 'auto' })} style={{ marginTop: 4, width: 18, height: 18 }} /><span>Fyrsti á biðlista fer <b>sjálfkrafa</b> inn, í réttri röð, þar til <b>{s.cancel_minutes} mín.</b> fyrir tímann. Hann fær tilkynningu.</span></label>
                <label className="row" style={{ alignItems: 'flex-start', marginTop: 8, cursor: 'pointer' }}><input type="radio" name="wm" checked={s.waitlist_mode === 'all'} onChange={() => setS({ ...s, waitlist_mode: 'all' })} style={{ marginTop: 4, width: 18, height: 18 }} /><span>Allir á biðlista fá tilkynningu og sá fyrsti sem bókar fær plássið.</span></label>
                <div className="row" style={{ flexWrap: 'wrap', marginTop: 14 }}><span>Hámark á biðlista</span><input className="input" style={box} type="number" min={0} value={s.waitlist_limit} onChange={num('waitlist_limit')} aria-label="Hámark á biðlista" /><span className="muted">0 = ekkert hámark</span></div>
              </>
            )}
          </section>

          <section className="a-card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Aflýsa sjálfkrafa ef fáir eru skráðir</h2>
              <button className="switch" role="switch" aria-checked={s.auto_cancel_on} aria-label="Aflýsa sjálfkrafa" onClick={() => setS({ ...s, auto_cancel_on: !s.auto_cancel_on })} />
            </div>
            {s.auto_cancel_on && (
              <div className="row" style={{ flexWrap: 'wrap', marginTop: 12 }}>
                <span>Fella niður tímann</span>
                <input className="input" style={{ width: 80 }} type="number" min={0} step={0.5} value={s.auto_cancel_minutes / 60} onChange={(e) => setS({ ...s, auto_cancel_minutes: Math.max(0, Math.round((Number(e.target.value.replace(',', '.')) || 0) * 60)) })} aria-label="Klukkustundir" />
                <span>klst. fyrir ef</span>
                <input className="input" style={{ width: 80 }} type="number" min={0} value={s.auto_cancel_min - 1} onChange={(e) => setS({ ...s, auto_cancel_min: Math.max(0, parseInt(e.target.value || '0', 10) || 0) + 1 })} aria-label="Fjöldi" />
                <span>eða færri eru skráðir.</span>
                <div className="row" style={{ flexWrap: 'wrap', width: '100%', marginTop: 6 }}>
                  <span>Gildir líka ef einhver afbókar, þar til</span>
                  <input className="input" style={{ width: 80 }} type="number" min={0} value={s.auto_cancel_stop} onChange={num('auto_cancel_stop')} aria-label="Mínútur" />
                  <span>mín. eru í tímann. Eftir það heldur hann sér.</span>
                </div>
                <div className="muted" style={{ fontSize: 13, width: '100%' }}>Allir sem voru skráðir eða á biðlista fá tilkynningu, og þjálfarinn líka.</div>
              </div>
            )}
          </section>
          <div><button className="btn btn-primary" onClick={async () => { try { await api.saveSettings(s); toast('Bókunarstillingar vistaðar'); refresh() } catch (e) { toast(errMsg(e)) } }}>Vista stillingar</button></div>
        </div>

        <aside className="a-card" style={{ flex: '1 1 260px', maxWidth: 340 }}>
          <div className="label">Dæmi: tími kl. 8:30</div>
          {[
            [(opens < -1440 ? Math.ceil(-opens / 1440) + ' dögum áður ' : opens < 0 ? 'Daginn áður ' : '') + t(opens), 'Bókanir opna'],
            ['Kvöldið áður 20:00', 'Æfingin birtist í appinu'],
            ...(s.auto_cancel_on ? [[t(cls - s.auto_cancel_minutes), `Tíminn fellur niður ef ${s.auto_cancel_min - 1} eða færri eru skráðir (gildir þar til ${t(cls - s.auto_cancel_stop)})`]] : []),
            [t(cls - s.cancel_minutes), s.waitlist_on && s.waitlist_mode === 'auto' ? 'Biðlisti hættir að færast sjálfkrafa inn. Eftir þetta fær sá sem bókar fyrst laust pláss.' : 'Biðlisti hættir að færast inn'],
            [t(cls - s.close_minutes), s.close_minutes ? 'Bókanir loka' : 'Bókanir loka þegar tíminn byrjar'],
          ].map(([w, x]) => <div key={w + x} className="row" style={{ alignItems: 'flex-start', marginTop: 12, fontSize: 14 }}><b style={{ minWidth: 120, color: 'var(--accent)' }}>{w}</b><span>{x}</span></div>)}
        </aside>
      </div>
    </>
  )
}
