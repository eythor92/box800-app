import { useEffect, useMemo, useRef, useState } from 'react'
import type { Workout, WorkoutComponent } from '../api'
import { useApp, useData } from '../ctx'
import { Icon } from '../components/Icon'
import { WorkoutRender } from '../pages/WorkoutView'
import { addDays, cap1, dayLabel, errMsg, mondayOf, today } from '../util'
import { newKey } from '../score'

const SCORING = ['Hak (lokið)', 'Tími', 'Umferðir + endurtekningar', 'Endurtekningar', 'Þyngd (kg)', 'Kaloríur', 'Vegalengd (m)', 'Engin skráning']
const SCALING = ['Engin', 'Scaled / Rx', 'Scaled / Rx / Rx+']
const LABEL: Record<string, string> = { metcon: 'ÆFING (EINU SINNI)', header: 'KAFLAFYRIRSÖGN', lift: 'LYFTA (SKOR SKRÁÐ OG VISTAÐ Í SÖGU)', video: 'MYNDBAND', image: 'MYND' }
const MODES: [Workout['publish_mode'], string][] = [['evening_before', 'Kvöldið áður kl. 20:00'], ['now', 'Strax'], ['morning', 'Sama dag kl. 05:00']]

export default function AdminWorkouts() {
  const { api, toast, refresh } = useApp()
  const [day, setDay] = useState(today())
  const [pid, setPid] = useState<number | null>(null)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [draft, setDraft] = useState<Workout | null>(null)
  const [dirty, setDirty] = useState(false)
  const [chooser, setChooser] = useState(false)
  const [libQ, setLibQ] = useState('')
  const [saving, setSaving] = useState(false)
  const week = mondayOf(day)
  const { data: programs } = useData((a) => a.programs())
  const { data: movements, reload: reloadMov } = useData((a) => a.movements())
  const { data: workouts } = useData((a) => a.workouts(addDays(week, -7), addDays(week, 13)), [week])
  const prog = pid ?? programs?.[0]?.id ?? null
  const saved = useMemo(() => (workouts ?? []).find((w) => w.program_id === prog && w.day === day) ?? null, [workouts, prog, day])
  const taRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})

  // Hlaða æfingu í ritil þegar skipt er um dag/námskeið (ekki yfirskrifa óvistaðar breytingar)
  useEffect(() => {
    if (prog == null) return
    setDraft(saved ? structuredClone(saved) : null); setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prog, day, saved?.id, saved?.status])

  const w: Workout = draft ?? { program_id: prog ?? 0, day, components: [], status: 'draft', publish_mode: 'evening_before' }
  const set = (fn: (w: Workout) => void) => { const n = structuredClone(w); fn(n); setDraft(n); setDirty(true) }
  const setC = (i: number, patch: Partial<WorkoutComponent>) => set((n) => { n.components[i] = { ...n.components[i], ...patch } })
  const add = (c: WorkoutComponent) => { set((n) => { n.components.push({ ...c, key: newKey() }) }); setChooser(false); setLibQ('') }

  function toggleBold(i: number) {
    const el = taRefs.current[i], body = w.components[i].body ?? ''
    const a = el?.selectionStart ?? body.length, b = el?.selectionEnd ?? body.length
    const lines = body.split('\n'); let pos = 0; const idx: number[] = []
    lines.forEach((ln, n) => { const end = pos + ln.length; if (end >= a && pos <= b) idx.push(n); pos = end + 1 })
    const real = idx.filter((n) => lines[n].trim())
    if (!real.length) return
    const isB = (t: string) => { const s = t.trim(); return s.length > 1 && s.startsWith('*') && s.endsWith('*') }
    const all = real.every((n) => isB(lines[n]))
    real.forEach((n) => { const t = lines[n].trim(); lines[n] = all ? t.slice(1, -1) : isB(t) ? t : `*${t}*` })
    setC(i, { body: lines.join('\n') })
    setTimeout(() => { el?.focus(); el?.setSelectionRange(a, a) }, 0)
  }

  async function save(status: Workout['status']) {
    if (prog == null) return
    setSaving(true)
    try {
      await api.saveWorkout({ ...w, program_id: prog, day, status, components: w.components.map((c) => (c.key ? c : { ...c, key: newKey() })) })
      setDirty(false); refresh()
      const when = status === 'draft' ? 'Vistað sem drög' : w.publish_mode === 'now' ? 'Birt – iðkendur sjá æfinguna núna' : 'Birt – ' + publishText(w.publish_mode, day).replace('Birtist iðkendum', 'sést')
      toast(when)
    } catch (e) { toast(errMsg(e)) } finally { setSaving(false) }
  }

  const status = dirty ? ['ÓVISTAÐAR BREYTINGAR', '#3b321f', '#f2c97a'] : !saved ? ['VANTAR', '#3a2424', '#f0b0b0'] : saved.status === 'published' ? ['BIRT', '#1f3b2c', '#8fe0b0'] : ['DRÖG', '#2a2e33', '#c3cad1']
  const p = programs?.find((x) => x.id === prog)

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Æfingar dagsins</h1>
          <div className="muted" style={{ fontSize: 14 }}>Aðeins eigandi skrifar og breytir æfingum. Þjálfarar og iðkendur sjá þær í appinu.</div>
        </div>
      </div>

      <div className="row" style={{ gap: 26, marginTop: 22, borderBottom: '1px solid var(--line)' }}>
        {(['day', 'week'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ minHeight: 44, fontWeight: 700, letterSpacing: .8, fontSize: 14, color: view === v ? '#fff' : 'var(--muted)', borderBottom: `3px solid ${view === v ? 'var(--accent)' : 'transparent'}` }}>{v === 'day' ? 'DAGUR' : 'VIKA'}</button>
        ))}
      </div>

      <div className="row" style={{ flexWrap: 'wrap', gap: 12, marginTop: 18, justifyContent: 'space-between' }}>
        <div className="chips" style={{ flexWrap: 'wrap', flex: '1 1 420px' }}>
          {(programs ?? []).map((x) => (
            <button key={x.id} className={`chip${x.id === prog ? ' on' : ''}`} onClick={() => setPid(x.id)}><span className="dot" style={{ background: x.color }} />{x.name}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 4, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 3, padding: 4 }}>
          <button className="icon-btn" aria-label="Fyrri" onClick={() => setDay(addDays(day, view === 'week' ? -7 : -1))}><Icon name="back" /></button>
          <div style={{ minWidth: 200, textAlign: 'center', fontWeight: 700 }}>{view === 'week' ? `Vika ${dayLabel(week)} – ${dayLabel(addDays(week, 6))}` : cap1(dayLabel(day, true))}</div>
          <button className="icon-btn" aria-label="Næsti" onClick={() => setDay(addDays(day, view === 'week' ? 7 : 1))}><Icon name="next" /></button>
        </div>
      </div>

      {view === 'week' && (
        <div className="a-table" style={{ marginTop: 20 }}>
          <div style={{ minWidth: 900 }}>
            <div className="thead" style={{ gridTemplateColumns: '160px repeat(7, minmax(0,1fr))' }}>
              <div>NÁMSKEIÐ</div>{Array.from({ length: 7 }, (_, i) => <div key={i} style={{ color: addDays(week, i) === today() ? 'var(--accent)' : undefined }}>{dayLabel(addDays(week, i)).toUpperCase()}</div>)}
            </div>
            {(programs ?? []).map((x) => (
              <div key={x.id} className="tr" style={{ gridTemplateColumns: '160px repeat(7, minmax(0,1fr))' }}>
                <div className="row" style={{ fontWeight: 600, fontSize: 14 }}><span className="dot" style={{ background: x.color }} />{x.name}</div>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(week, i), ww = (workouts ?? []).find((z) => z.program_id === x.id && z.day === d)
                  return (
                    <button key={i} onClick={() => { setPid(x.id); setDay(d); setView('day') }} style={{ minHeight: 56, padding: 6, borderRadius: 3, background: ww ? 'var(--card)' : 'transparent', fontSize: 13 }}>
                      <div style={{ fontWeight: 600, color: ww ? 'var(--text)' : 'var(--accent)' }} className="ellipsis">{ww ? ww.components[0]?.title || 'Æfing' : '+ Skrifa'}</div>
                      {ww && <div style={{ fontSize: 11, fontWeight: 800, color: ww.status === 'published' ? 'var(--ok)' : 'var(--muted)' }}>{ww.status === 'published' ? 'BIRT' : 'DRÖG'}</div>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'day' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 22, alignItems: 'flex-start' }}>
          <section className="a-card" style={{ flex: '999 1 480px', minWidth: 0 }} aria-label="Ritill">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div className="row"><span className="dot" style={{ background: p?.color, width: 12, height: 12 }} /><h2 className="display" style={{ margin: 0, fontSize: 28 }}>{p?.name} – {dayLabel(day, true)}</h2></div>
              <span className="badge" style={{ background: status[1], color: status[2] }}>{status[0]}</span>
            </div>

            {w.components.length === 0 && (
              <div className="empty" style={{ marginTop: 18 }}>Engin æfing komin fyrir þennan dag.
                <div className="row" style={{ justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => setChooser(true)}>Byrja að skrifa</button>
                  {(() => {
                    const h = (workouts ?? []).find((z) => z.day === day && z.program_id === programs?.[0]?.id)
                    return h && prog !== programs?.[0]?.id ? <button className="btn btn-ghost" onClick={() => set((n) => { n.components = structuredClone(h.components) })}>Afrita {programs?.[0]?.name}-æfingu dagsins</button> : null
                  })()}
                </div>
              </div>
            )}

            {w.components.map((c, i) => (
              <div key={i} style={{ marginTop: 16, border: '1px solid #30353b', borderRadius: 3, background: 'var(--bg)', padding: '12px 16px 16px' }}>
                <div className="row" style={{ gap: 4 }}>
                  <span className="label grow"><span style={{ color: 'var(--accent)' }}>{i + 1}.</span> {LABEL[c.type]}</span>
                  <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Færa upp" onClick={() => i > 0 && set((n) => { [n.components[i - 1], n.components[i]] = [n.components[i], n.components[i - 1]] })}><Icon name="up" size={18} /></button>
                  <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Færa niður" onClick={() => i < w.components.length - 1 && set((n) => { [n.components[i + 1], n.components[i]] = [n.components[i], n.components[i + 1]] })}><Icon name="down" size={18} /></button>
                  <button className="btn btn-sm" style={{ color: 'var(--accent)' }} onClick={async () => {
                    const d = addDays(day, 1), ex = (workouts ?? []).find((z) => z.program_id === prog && z.day === d)
                    try { await api.saveWorkout({ ...(ex ?? { program_id: prog!, day: d, status: 'draft', publish_mode: w.publish_mode, components: [] }), day: d, components: [...(ex?.components ?? []), structuredClone(c)] }); refresh(); toast('Hluti afritaður á ' + dayLabel(d)) } catch (e) { toast(errMsg(e)) }
                  }}><Icon name="reuse" size={16} />Endurnýta</button>
                  <button className="icon-btn" style={{ width: 36, height: 36, color: 'var(--danger)' }} aria-label="Eyða hluta" onClick={() => set((n) => { n.components.splice(i, 1) })}><Icon name="trash" size={18} /></button>
                </div>

                {c.type === 'header' && (
                  <label className="field" style={{ marginTop: 8 }}><span>Fyrirsögn kafla</span>
                    <input className="input" value={c.title ?? ''} onChange={(e) => setC(i, { title: e.target.value })} placeholder="T.d. Upphitun" style={{ color: 'var(--accent)', fontWeight: 700 }} />
                  </label>
                )}
                {c.type === 'lift' && (
                  <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label className="field" style={{ width: 90 }}><span>Forskeyti</span><input className="input" value={c.prefix ?? ''} onChange={(e) => setC(i, { prefix: e.target.value })} placeholder="A" style={{ textAlign: 'center' }} /></label>
                    <label className="field grow" style={{ minWidth: 180 }}><span>Hreyfing</span>
                      <select className="select" value={c.movement_id ?? ''} onChange={(e) => { const m = movements?.find((x) => x.id === Number(e.target.value)); setC(i, { movement_id: m?.id, title: m?.name }) }} style={{ color: 'var(--accent)', fontWeight: 700 }}>
                        {!c.movement_id && <option value="">Veldu hreyfingu…</option>}
                        {(movements ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </label>
                    <label className="field" style={{ width: 76 }}><span>Sett</span><input className="input" type="number" min={1} value={c.sets ?? 1} onChange={(e) => setC(i, { sets: Number(e.target.value) || 1 })} style={{ textAlign: 'center' }} /></label>
                    <span style={{ paddingBottom: 12, fontWeight: 800 }}>x</span>
                    <label className="field" style={{ width: 76 }}><span>Endurt.</span><input className="input" type="number" min={1} value={c.reps ?? 5} onChange={(e) => setC(i, { reps: Number(e.target.value) || 1 })} style={{ textAlign: 'center' }} /></label>
                  </div>
                )}
                {(c.type === 'metcon' || c.type === 'lift') && (
                  <>
                    {c.type === 'metcon' && <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <label className="field" style={{ width: 90 }}><span>Forskeyti</span><input className="input" value={c.prefix ?? ''} onChange={(e) => setC(i, { prefix: e.target.value })} placeholder="A" style={{ textAlign: 'center' }} /></label>
                      <label className="field grow" style={{ minWidth: 200 }}><span>Titill (valfrjálst)</span><input className="input" value={c.title ?? ''} onChange={(e) => setC(i, { title: e.target.value })} placeholder="T.d. Mánudagur" style={{ color: 'var(--accent)', fontWeight: 700 }} /></label>
                    </div>}
                    <div className="row" style={{ justifyContent: 'space-between', marginTop: 12, marginBottom: 6 }}>
                      <label className="label" htmlFor={`ta${i}`}>Leiðbeiningar</label>
                      <button className="btn btn-ghost btn-sm" style={{ width: 40, fontWeight: 900, fontSize: 17 }} title="Feitletra línu (Ctrl+B)" aria-label="Feitletra línu (Ctrl+B)" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBold(i)}>B</button>
                    </div>
                    <textarea id={`ta${i}`} ref={(el) => { taRefs.current[i] = el }} className="textarea" rows={Math.max(4, (c.body ?? '').split('\n').length + 1)} value={c.body ?? ''}
                      onChange={(e) => setC(i, { body: e.target.value })} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleBold(i) } }}
                      placeholder="Ein lína í einu. Settu bendilinn í línu og ýttu á B til að feitletra." />
                    <label className="field" style={{ marginTop: 12 }}><span>Athugasemd til iðkenda (einu sinni)</span>
                      <textarea className="textarea" rows={2} value={c.comment ?? ''} onChange={(e) => setC(i, { comment: e.target.value })} placeholder="T.d. Veljið þyngd sem þið ráðið við í öllum umferðum" />
                    </label>
                    {c.type === 'lift' && <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>Iðkendur skrá þyngdina sína. Hún vistast í sögunni þeirra fyrir {c.title || 'hreyfinguna'}, með línuriti og PR.</div>}
                    {c.type === 'metcon' && <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <label className="field grow" style={{ minWidth: 180 }}><span>Skráning</span>
                        <select className="select" value={c.scoring ?? 'Hak (lokið)'} onChange={(e) => setC(i, { scoring: e.target.value })}>{SCORING.map((s) => <option key={s}>{s}</option>)}</select>
                      </label>
                      {c.scoring === 'Tími' && <label className="field" style={{ width: 100 }}><span>Umferðir</span><input className="input" type="number" min={1} value={c.rounds ?? 1} onChange={(e) => setC(i, { rounds: Number(e.target.value) })} /></label>}
                      <label className="field grow" style={{ minWidth: 160 }}><span>Skölun</span>
                        <select className="select" value={c.scaling ?? 'Engin'} onChange={(e) => setC(i, { scaling: e.target.value })}>{SCALING.map((s) => <option key={s}>{s}</option>)}</select>
                      </label>
                    </div>}
                  </>
                )}
                {(c.type === 'video' || c.type === 'image') && (
                  <>
                    <label className="field" style={{ marginTop: 8 }}><span>Titill</span><input className="input" value={c.title ?? ''} onChange={(e) => setC(i, { title: e.target.value })} /></label>
                    <label className="field" style={{ marginTop: 10 }}><span>{c.type === 'video' ? 'Slóð á myndband (YouTube, Instagram, Vimeo)' : 'Slóð á mynd'}</span><input className="input" value={c.url ?? ''} onChange={(e) => setC(i, { url: e.target.value })} placeholder="https://" /></label>
                  </>
                )}
              </div>
            ))}

            {w.components.length > 0 && (
              <>
                <button className="btn btn-block" style={{ marginTop: 14, border: '1.5px dashed var(--accent)', color: 'var(--accent)' }} onClick={() => setChooser(true)}>+ Bæta við hluta</button>
                <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)', gap: 14 }}>
                  <div>
                    <label className="field"><span>Hvenær sjá iðkendur æfinguna?</span>
                      <select className="select" style={{ minWidth: 260 }} value={w.publish_mode} onChange={(e) => set((n) => { n.publish_mode = e.target.value as Workout['publish_mode'] })}>
                        {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                    <div className="row" style={{ marginTop: 6, gap: 6, fontSize: 14, color: 'var(--text-2)' }}><Icon name="clock" size={16} color="var(--accent)" />{publishText(w.publish_mode, day)}</div>
                  </div>
                  <div className="row">
                    <button className="btn btn-ghost" disabled={saving} onClick={() => save('draft')}>Vista sem drög</button>
                    <button className="btn btn-primary" disabled={saving} onClick={() => save('published')}>Birta</button>
                  </div>
                </div>
              </>
            )}
          </section>

          <aside style={{ flex: '1 1 280px', maxWidth: 340 }} aria-label="Forskoðun">
            <div className="label" style={{ marginBottom: 8 }}>Svona sést þetta í appinu</div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 3, background: 'var(--bg)', padding: '18px 16px 20px', fontSize: 14 }}>
              <div className="display" style={{ fontSize: 22 }}>{p?.name} – {dayLabel(day)}</div>
              {w.components.length ? <WorkoutRender w={w} /> : <div className="muted" style={{ marginTop: 12 }}>Ekkert til að sýna enn.</div>}
            </div>
          </aside>
        </div>
      )}

      {chooser && (
        <>
          <button className="modal-back" aria-label="Loka" onClick={() => setChooser(false)} />
          <div className="modal" role="dialog" aria-label="Bæta við æfingu">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 className="display" style={{ margin: 0, fontSize: 30 }}>Bæta við æfingu</h2>
              <button className="icon-btn" aria-label="Loka" onClick={() => setChooser(false)}><Icon name="x" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {([
                ['metcon', 'Æfing (einu sinni)', 'Texti, athugasemd, skráning og skölun', true],
                ['header', 'Kaflafyrirsögn', 'T.d. Upphitun, Styrkur, Vikan framundan', false],
                ['video', 'Myndband', 'Slóð á YouTube, Instagram eða Vimeo', false],
                ['image', 'Mynd', 'T.d. uppsetning á stöðvum', false],
              ] as const).map(([t, l, d, main]) => (
                <button key={t} onClick={() => add({ type: t, title: t === 'metcon' && !w.components.length ? cap1(dayLabel(day, true).split(' ')[0]) : '', body: '', scoring: t === 'metcon' ? 'Hak (lokið)' : undefined, scaling: 'Engin' })}
                  className="row" style={{ minHeight: 58, padding: '0 16px', borderRadius: 3, border: `1.5px solid ${main ? 'var(--accent)' : '#30353b'}`, background: main ? '#162430' : 'transparent' }}>
                  <span className="grow"><span style={{ display: 'block', color: 'var(--accent)', fontWeight: 700 }}>{l}</span><span className="muted" style={{ fontSize: 13 }}>{d}</span></span>
                  {main && <span className="badge badge-accent">MEST NOTAÐ</span>}
                </button>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 18, paddingTop: 16 }}>
              <div className="label" style={{ marginBottom: 8 }}>Lyfta úr hreyfingasafni (iðkendur skrá þyngd)</div>
              <input className="input" value={libQ} onChange={(e) => setLibQ(e.target.value)} placeholder="Leita, t.d. back squat" aria-label="Leita í hreyfingasafni" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, maxHeight: 320, overflowY: 'auto' }}>
                {(movements ?? []).filter((m) => !libQ || m.name.toLowerCase().includes(libQ.toLowerCase())).map((m) => (
                  <button key={m.id} className="row" style={{ minHeight: 46, padding: '0 16px', borderRadius: 3, border: '1px solid var(--line)', justifyContent: 'space-between', fontWeight: 600 }}
                    onClick={() => add({ type: 'lift', movement_id: m.id, title: m.name, sets: 1, reps: 5, body: '', scoring: 'Þyngd (kg)', scaling: 'Engin' })}>{m.name}<span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Þyngd (kg)</span></button>
                ))}
                {libQ.trim() && !(movements ?? []).some((m) => m.name.toLowerCase() === libQ.trim().toLowerCase()) && (
                  <button className="row" style={{ minHeight: 46, padding: '0 16px', borderRadius: 3, border: '1.5px dashed var(--accent)', color: 'var(--accent)', fontWeight: 700 }}
                    onClick={async () => { try { const m = await api.addMovement(libQ); reloadMov(); add({ type: 'lift', movement_id: m.id, title: m.name, sets: 1, reps: 5, body: '', scoring: 'Þyngd (kg)', scaling: 'Engin' }) } catch (e) { toast(errMsg(e)) } }}>
                    + Bæta „{libQ.trim()}“ við hreyfingasafnið
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function publishText(mode: Workout['publish_mode'], day: string): string {
  if (mode === 'now') return 'Iðkendur sjá æfinguna um leið og þú birtir hana.'
  if (mode === 'morning') return `Birtist iðkendum ${dayLabel(day)} kl. 05:00.`
  return `Birtist iðkendum ${dayLabel(addDays(day, -1))} kl. 20:00.`
}
