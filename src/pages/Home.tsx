import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, useData } from '../ctx'
import { Icon } from '../components/Icon'
import ClassSheet from '../components/ClassSheet'
import { addDays, dayKey, dayStart, DAYS_SHORT, errMsg, hhmm, mondayOf, today, whenText } from '../util'

export default function Home() {
  const { api, me, toast, refresh } = useApp()
  const nav = useNavigate()
  const [open, setOpen] = useState<number | null>(null)
  const t = today()
  const week = mondayOf(t)
  const { data } = useData((a) => a.classList(dayStart(week), dayStart(addDays(t, 14))), [week, t])
  const { data: att } = useData((a) => a.myAttendance())

  const upcoming = useMemo(() => (data ?? []).filter((c) => (c.my_status === 'booked' || c.my_status === 'waitlist') && new Date(c.ends_at) > new Date()), [data])
  const bookedDays = new Set((data ?? []).filter((c) => c.my_status === 'booked').map((c) => dayKey(new Date(c.starts_at))))

  // „Bóka aftur“: sami tími á morgun og síðasti bókaði tími
  const again = useMemo(() => {
    const all = data ?? []
    const last = [...all].filter((c) => c.my_status === 'booked').sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at))[0]
      ?? null
    if (!last) return null
    const tomorrow = addDays(dayKey(new Date()), 1)
    return all.find((c) => dayKey(new Date(c.starts_at)) === tomorrow && c.program_id === last.program_id
      && hhmm(c.starts_at) === hhmm(last.starts_at) && !c.my_status && !c.cancelled) ?? null
  }, [data])

  // Vikustreak: vikur í röð með mætingu
  const streak = useMemo(() => {
    const weeks = new Set((att ?? []).map((a) => mondayOf(dayKey(new Date(a.starts_at)))))
    let n = 0, w = mondayOf(t)
    if (!weeks.has(w)) w = addDays(w, -7)
    while (weeks.has(w)) { n++; w = addDays(w, -7) }
    return n
  }, [att, t])

  const sel = (data ?? []).find((c) => c.id === open)
  const first = me.full_name.split(' ')[0]

  async function bookAgain() {
    if (!again) return
    try { const r = await api.book(again.id); toast(r === 'waitlist' ? 'Þú ert á biðlista' : 'Bókað!'); refresh() } catch (e) { toast(errMsg(e)) }
  }

  return (
    <>
      <section className="band">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="display" style={{ fontSize: 30 }}>{streak > 0 ? 'Haltu áfram!' : `Hæ${first ? ' ' + first : ''}!`}</div>
          {streak > 0 && <div className="row" style={{ gap: 6, color: '#b9c1ca' }}><Icon name="flame" color="#f2b84b" />{streak} vikna röð</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {DAYS_SHORT.map((d, i) => {
            const k = addDays(week, i), on = bookedDays.has(k)
            return (
              <button key={k} onClick={() => nav('/timatafla')} aria-label={`${d}${on ? ', bókað' : ''}`}
                style={{ width: 42, height: 42, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                  background: on ? 'var(--accent)' : 'var(--line)', color: on ? 'var(--accent-ink)' : 'var(--muted)', boxShadow: k === t ? '0 3px 0 0 var(--accent)' : 'none' }}>
                {d[0]}
              </button>
            )
          })}
        </div>
      </section>

      <div className="section-title"><Icon name="cal" size={20} />BÓKANIR</div>
      <div style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data && upcoming.length === 0 && (
          <div className="empty">Engar bókanir framundan.<br /><Link to="/timatafla" style={{ fontWeight: 700, display: 'inline-block', marginTop: 8 }}>Skoða tímatöflu</Link></div>
        )}
        {upcoming.map((c) => (
          <div key={c.id} className="card" style={{ paddingBottom: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: 'var(--text-2)' }}>{whenText(c.starts_at)}</div>
                <div className="display" style={{ color: 'var(--accent)', fontSize: 24, marginTop: 2 }}>{c.program}: {hhmm(c.starts_at)}</div>
              </div>
              <span className={`badge ${c.cancelled ? 'badge-danger' : c.my_status === 'waitlist' ? 'badge-outline' : 'badge-grey'}`}>
                {c.cancelled ? 'AFLÝST' : c.my_status === 'waitlist' ? `BIÐLISTI #${c.my_position}` : 'SKRÁÐ'}
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="card-link" onClick={() => nav(`/aefing?p=${c.program_id}&d=${dayKey(new Date(c.starts_at))}`)}><Icon name="dumb" size={20} />Skoða æfingu</button>
              <button className="card-link" style={{ color: '#b9c1ca' }} onClick={() => setOpen(c.id)}><Icon name="x" size={20} />{c.my_status === 'waitlist' ? 'Fara af biðlista' : 'Afbóka'}</button>
            </div>
          </div>
        ))}
      </div>

      {again && (
        <>
          <div className="section-title"><Icon name="clock" size={20} />BÓKA AFTUR</div>
          <div style={{ padding: '8px 16px 0' }}>
            <div className="card">
              <div style={{ color: 'var(--text-2)' }}>{whenText(again.starts_at)}</div>
              <div className="display" style={{ color: 'var(--accent)', fontSize: 24, marginTop: 2 }}>{again.program}: {hhmm(again.starts_at)}</div>
              <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={bookAgain}>{again.booked >= again.cap ? 'Fara á biðlista' : 'Bóka'}</button>
            </div>
          </div>
        </>
      )}
      {sel && <ClassSheet c={sel} onClose={() => setOpen(null)} />}
    </>
  )
}
