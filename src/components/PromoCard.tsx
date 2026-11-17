import type { Promo } from '../api'
import { useApp } from '../ctx'
import { Icon } from './Icon'

/** Kynning frá samstarfsaðila: merki, texti, afsláttarkóði og hlekkur */
export default function PromoCard({ p, preview }: { p: Promo; preview?: boolean }) {
  const { api, toast } = useApp()
  const href = p.url ? (/^https?:\/\//i.test(p.url) ? p.url : 'https://' + p.url) : null

  async function copy() {
    if (!p.code) return
    try { await navigator.clipboard.writeText(p.code); toast('Kóðinn er afritaður') } catch { toast('Kóðinn: ' + p.code) }
    if (!preview) api.promoEvent(p.id, 'copy').catch(() => undefined)
  }

  return (
    <section className="promo">
      <div className="promo-top">
        {p.logo_url && <div className="promo-logo"><img src={p.logo_url} alt={p.partner} /></div>}
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="promo-kick">Í samstarfi við {p.partner}</div>
          <div className="promo-title">{p.title}</div>
        </div>
      </div>
      {p.body && <div className="promo-body">{p.body}</div>}
      {p.code && (
        <button type="button" className="promo-code" onClick={copy} aria-label={`Afrita afsláttarkóðann ${p.code}`}>
          <span>{p.code}</span><em>Afrita</em>
        </button>
      )}
      {href && (
        <a className="btn btn-ghost btn-block" style={{ marginTop: 10 }} href={href} target="_blank" rel="noreferrer"
          onClick={() => { if (!preview) api.promoEvent(p.id, 'click').catch(() => undefined) }}>
          Versla hjá {p.partner}<Icon name="next" size={16} />
        </a>
      )}
    </section>
  )
}
