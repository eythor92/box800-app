/**
 * Draga glugga (.sheet) niður til að loka honum, eins og í öðrum öppum.
 * Virkar fyrir alla glugga: þegar dregið er nógu langt er smellt á bakgrunninn (.sheet-back) sem lokar.
 */
export function installSheetDrag() {
  let sheet: HTMLElement | null = null
  let y0 = 0, x0 = 0, dy = 0, t0 = 0, active = false

  const reset = (el: HTMLElement) => { el.style.transition = 'transform .2s ease'; el.style.transform = ''; setTimeout(() => { el.style.transition = '' }, 220) }

  document.addEventListener('touchstart', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.sheet')
    if (!el || window.matchMedia('(min-width: 1000px)').matches) return
    // ekki byrja drátt inni í textareit eða myndbandi
    if ((e.target as HTMLElement).closest('input, textarea, select, video, [data-nodrag]')) return
    sheet = el; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; t0 = Date.now(); active = false
  }, { passive: true })

  document.addEventListener('touchmove', (e) => {
    if (!sheet) return
    const d = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0)
    if (!active) {
      // aðeins ef glugginn er efst og dregið er niður (ekki til hliðar)
      if (d > 8 && sheet.scrollTop <= 0 && d > dx) active = true
      else if (d < -4 || dx > 12) { sheet = null; return }
      else return
    }
    dy = Math.max(0, d)
    sheet.style.transition = 'none'
    sheet.style.transform = `translate(-50%, ${dy}px)`
    if (e.cancelable) e.preventDefault()
  }, { passive: false })

  const end = () => {
    if (!sheet) return
    const el = sheet; sheet = null
    if (!active) return
    const fast = dy > 40 && Date.now() - t0 < 250
    if (dy > Math.min(140, el.offsetHeight * 0.25) || fast) {
      el.style.transition = 'transform .18s ease'; el.style.transform = `translate(-50%, ${el.offsetHeight}px)`
      const back = el.previousElementSibling as HTMLElement | null
      setTimeout(() => { (back?.classList.contains('sheet-back') ? back : document.querySelector<HTMLElement>('.sheet-back'))?.click() }, 170)
    } else reset(el)
  }
  document.addEventListener('touchend', end)
  document.addEventListener('touchcancel', end)
}
