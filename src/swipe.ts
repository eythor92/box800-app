import { useEffect, useRef } from 'react'

/**
 * Strjúka til hliðar til að skipta um dag (eins og í Wodify):
 * fingur til vinstri → næsti dagur, fingur til hægri → fyrri dagur.
 * Hunsað þegar gluggi er opinn eða strokið er á lista sem flettist til hliðar.
 */
export function useSwipeDays(onNext: () => void, onPrev: () => void) {
  const fns = useRef({ onNext, onPrev })
  fns.current = { onNext, onPrev }
  useEffect(() => {
    let x0 = 0, y0 = 0, t0 = 0, ok = false
    const start = (e: TouchEvent) => {
      const t = e.touches[0]
      const el = e.target as HTMLElement
      ok = e.touches.length === 1 && !document.querySelector('.sheet, .modal, .drawer')
        && !el.closest('.daybar, .chips, .h-scroll, .cb-tabs, input, textarea, select, [data-noswipe]')
      x0 = t.clientX; y0 = t.clientY; t0 = Date.now()
    }
    const end = (e: TouchEvent) => {
      if (!ok) return
      const t = e.changedTouches[0]
      const dx = t.clientX - x0, dy = t.clientY - y0
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - t0 < 700) {
        if (dx < 0) fns.current.onNext(); else fns.current.onPrev()
        document.querySelector('.m-content')?.animate?.([{ opacity: 0.4, transform: `translateX(${dx < 0 ? 24 : -24}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' })
      }
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchend', end, { passive: true })
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchend', end) }
  }, [])
}
