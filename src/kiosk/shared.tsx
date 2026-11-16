import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClassRow, Workout } from '../api'
import { parseLines } from '../util'
import { compTitle } from '../score'

/** Klukka sem tifar (fyrir sjálfvirkt val á tíma og degi) */
export function useNow(ms = 30000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t) }, [ms])
  return now
}

/** Heldur skjánum vakandi (sjónvarp og innskráningartölva) */
export function useWakeLock() {
  useEffect(() => {
    type WL = { release: () => Promise<void> }
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WL> } }
    if (!nav.wakeLock) return
    let lock: WL | null = null
    const get = () => { if (document.visibilityState === 'visible') nav.wakeLock!.request('screen').then((l) => { lock = l }, () => undefined) }
    get()
    document.addEventListener('visibilitychange', get)
    return () => { document.removeEventListener('visibilitychange', get); lock?.release().catch(() => undefined) }
  }, [])
}

/** Vistað á þessu tæki (hvert sjónvarp/tölva man sínar stillingar) */
export function useLocal<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? { ...init, ...JSON.parse(s) } : init } catch { return init }
  })
  return [v, (n: T) => { setV(n); try { localStorage.setItem(key, JSON.stringify(n)) } catch { /* ekkert */ } }]
}

/** Núverandi tími: sá sem er í gangi eða næstur (skiptir 10 mín. eftir lok) */
export function currentClass(classes: ClassRow[], now: Date): ClassRow | undefined {
  const open = classes.filter((c) => !c.cancelled).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return open.find((c) => +new Date(c.ends_at) + 10 * 60000 > +now) ?? open[open.length - 1]
}

/** Á kiosk sést æfingin aðeins þegar hún er birt (ekki drög), þó þjálfari sé innskráður */
export function isLive(w: Workout | undefined, now: Date): w is Workout {
  return !!w && w.status === 'published' && (!w.publish_at || +new Date(w.publish_at) <= +now)
}

/** Stærð einingar (uppfærist þegar gluggi eða skilrúm breytist) */
export function useSize(ref: React.RefObject<HTMLElement>): [number, number] {
  const [wh, setWh] = useState<[number, number]>([0, 0])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWh([el.clientWidth, el.clientHeight]))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return wh
}

export function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
  else document.documentElement.requestFullscreen?.().catch(() => undefined)
}

/** Æfing í stóru letri. Letrið minnkar sjálfkrafa svo allt passi á skjáinn. */
export function BigWorkout({ w, title, scale = 1, columns = 1 }: { w: Workout; title: string; scale?: number; columns?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(0)
  const wh = useSize(box)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const w0 = el.clientWidth, h0 = el.clientHeight
    let s = Math.min(w0 / (columns > 1 ? 16 : 13), h0 / 9) * scale
    el.style.fontSize = s + 'px'
    for (let i = 0; i < 80 && (el.scrollHeight > h0 + 1 || el.scrollWidth > w0 + 1) && s > 10; i++) { s *= 0.94; el.style.fontSize = s + 'px' }
    setSize(s)
  }, [w, title, scale, columns, wh])

  return (
    <div ref={box} className="bigw" style={{ fontSize: size || undefined }}>
      <div className="bigw-title">{title}</div>
      <div style={{ columnCount: columns, columnGap: '1.6em' }}>
        {w.components.map((c, i) => {
          if (c.type === 'header') return <div key={i} className="bigw-sec">{c.title}</div>
          if (c.type === 'image' || c.type === 'video') return null
          const head = c.title || c.prefix ? compTitle(c) : ''
          return (
            <div key={i} className="bigw-part">
              {head && <div className="bigw-h">{head}</div>}
              {parseLines(c.body).map((l, j) => l.t.trim()
                ? <div key={j} className={l.b ? 'b' : ''}>{l.t}</div>
                : <div key={j} style={{ height: '.4em' }} />)}
              {c.comment && <div className="bigw-note">{c.comment}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
