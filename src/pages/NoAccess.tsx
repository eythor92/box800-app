import { Link } from 'react-router-dom'
import { useApp } from '../ctx'
import { Icon } from '../components/Icon'
import hero from '../assets/forsida.webp'

export const BUY_URL = 'https://www.box800.is/verdskra.html'

/** Forsíða fyrir þá sem eru ekki með virkt kort eða áskrift */
export default function NoAccess() {
  const { me, reloadMe } = useApp()
  const first = me.full_name.split(' ')[0]
  return (
    <>
      <section className="h-hero" style={{ backgroundImage: `linear-gradient(180deg, rgba(5,6,8,.55) 0%, rgba(5,6,8,.85) 60%, var(--bg) 100%), url(${hero})`, paddingBottom: 30 }}>
        <div className="h-kicker">Velkomin(n){first ? ', ' + first : ''}</div>
        <div className="h-big">Aðgangurinn þinn er tilbúinn</div>
        <p style={{ color: '#d9dde2', fontSize: 16, lineHeight: 1.5, marginTop: 12 }}>
          Til að bóka tíma, sjá tímatöfluna og æfingu dagsins þarftu kort eða áskrift hjá BOX800.
        </p>
        <a className="btn btn-primary btn-block" style={{ marginTop: 16, height: 52 }} href={BUY_URL} target="_blank" rel="noreferrer">Kaupa kort eða áskrift</a>
      </section>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 800 }}>Búin(n) að kaupa?</div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Við virkjum aðganginn þinn og þá opnast appið sjálfkrafa. Notaðu sama netfang og þú keyptir kortið með: <b>{me.email}</b></div>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={() => reloadMe?.()}><Icon name="reuse" size={18} />Athuga aftur</button>
        </div>
        <Link to="/profill" className="card row" style={{ textDecoration: 'none', color: 'var(--text)' }}>
          <Icon name="user" /><span className="grow"><b>Prófíllinn minn</b><div className="muted" style={{ fontSize: 14 }}>Settu inn mynd af þér og neyðartengilið</div></span><Icon name="next" size={18} color="var(--muted)" />
        </Link>
        <a className="card row" style={{ textDecoration: 'none', color: 'var(--text)' }} href="https://www.box800.is/samband.html" target="_blank" rel="noreferrer">
          <Icon name="pin" /><span className="grow"><b>Hafa samband</b><div className="muted" style={{ fontSize: 14 }}>Eyravegur 57, Selfossi</div></span><Icon name="next" size={18} color="var(--muted)" />
        </a>
      </div>
    </>
  )
}
