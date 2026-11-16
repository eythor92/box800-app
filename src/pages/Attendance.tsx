import { useMemo } from 'react'
import { useData } from '../ctx'
import { MONTHS, hhmm, whenText } from '../util'

export default function Attendance() {
  const { data, error } = useData((a) => a.myAttendance())
  const year = new Date().getUTCFullYear()
  const groups = useMemo(() => {
    const m = new Map<string, typeof data>()
    for (const a of data ?? []) {
      const d = new Date(a.starts_at), k = `${MONTHS[d.getUTCMonth()].replace('.', '').toUpperCase()} ${d.getUTCFullYear()}`
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(a)
    }
    return [...m]
  }, [data])
  if (error) return <div className="error" style={{ margin: 16 }}>{error}</div>
  if (!data) return <div className="spinner" />
  const head = (t: string, extra?: string) => (
    <div style={{ background: 'var(--band)', padding: '10px 16px', display: 'flex', gap: 18, alignItems: 'baseline', borderBottom: '1px solid var(--line)' }}>
      <span className="label" style={{ fontSize: 14 }}>{t}</span>{extra && <span style={{ fontSize: 16 }}>{extra}</span>}
    </div>
  )
  const big = (n: number) => (
    <div style={{ padding: '16px 16px 18px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{n}</div>
      <div className="label" style={{ marginTop: 6 }}>Tímar samtals</div>
    </div>
  )
  return (
    <>
      {head('Frá upphafi')}{big(data.length)}
      {head(String(year))}{big(data.filter((a) => new Date(a.starts_at).getUTCFullYear() === year).length)}
      {data.length === 0 && <div className="empty" style={{ margin: 16 }}>Engin mæting skráð enn. Sjáumst á gólfinu!</div>}
      {groups.map(([k, list]) => (
        <div key={k}>
          {head(k, `${list!.length} ${list!.length === 1 ? 'tími' : 'tímar'}`)}
          {list!.map((a) => (
            <div key={a.class_id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ color: 'var(--text-2)' }}>{whenText(a.starts_at)}</div>
              <div className="display" style={{ color: 'var(--accent)', fontSize: 22 }}>{a.program}: {hhmm(a.starts_at)}</div>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
