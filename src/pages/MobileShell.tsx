import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp, useData } from '../ctx'
import { Icon, Avatar } from '../components/Icon'
import { relDay, shortTime } from '../util'
import { BUY_URL } from './NoAccess'

const TITLES: Record<string, string> = { '/timatafla': 'Tímatafla', '/aefing': 'Æfing', '/maeting': 'Mæting', '/einkathjalfun': '1 on 1', '/thjalfari': 'Tímar', '/thjalfari/aefing': 'Æfing' }

export default function MobileShell() {
  const { api, me, refresh, access } = useApp()
  const loc = useLocation()
  const nav = useNavigate()
  const [bell, setBell] = useState(false)
  const [menu, setMenu] = useState(false)
  const { data: notes } = useData((a) => a.notifications())
  const unread = (notes ?? []).filter((n) => !n.read_at).length
  // Áminning um fjarvist birtist sem gluggi þegar appið er opnað
  const missed = (notes ?? []).find((n) => !n.read_at && n.kind === 'no_show')
  async function dismissMissed(go?: boolean) {
    if (!missed) return
    await api.markNotificationRead(missed.id).catch(() => undefined); refresh()
    if (go) nav('/timatafla')
  }
  const staff = me.role !== 'member'
  const coachMode = loc.pathname.startsWith('/thjalfari')
  const isClassPage = loc.pathname.startsWith('/thjalfari/timi')
  const title = (loc.pathname === '/profill' ? 'Prófíll' : TITLES[loc.pathname]) ?? (loc.pathname.startsWith('/arangur') ? 'Árangur' : loc.pathname.startsWith('/stigatafla') ? 'Stigatafla' : undefined)

  const { data: hasPt } = useData((a) => (access === false ? Promise.resolve(false) : a.hasPt()), [access])

  async function openBell() {
    setBell(true)
    if (unread) { await api.markNotificationsRead(); refresh() }
  }

  const tabs = coachMode
    ? [['/thjalfari', 'Tímar', 'check'], ['/thjalfari/aefing', 'Æfing', 'dumb']]
    : access === false ? [['/', 'Heim', 'home'], ['/profill', 'Prófíll', 'user']]
    : [['/', 'Heim', 'home'], ['/timatafla', 'Tímatafla', 'cal'], ['/aefing', 'Æfing', 'dumb'], ['/maeting', 'Mæting', 'check'], ...(hasPt ? [['/einkathjalfun', '1 on 1', 'user']] : [])]

  return (
    <div className="m-shell">
      {!isClassPage && (
        <header className="m-top">
          {staff && (
            <div className="m-seg" role="group" aria-label="Sýn">
              <button className={!coachMode ? 'on' : ''} onClick={() => nav('/')} aria-pressed={!coachMode}>Iðkandi</button>
              <button className={coachMode ? 'on' : ''} onClick={() => nav('/thjalfari')} aria-pressed={coachMode}>Þjálfari</button>
            </div>
          )}
          <div className="m-head">
            <button className="icon-btn m-menu-btn" aria-label="Valmynd" onClick={() => setMenu(true)} style={{ justifyContent: 'flex-start' }}><Icon name="menu" size={26} /></button>
            {title ? <div className="title">{title}</div> : <img className="logo" src="myndir/logo-white.png" alt="BOX800" />}
            <button className="icon-btn" aria-label={`Tilkynningar${unread ? `, ${unread} nýjar` : ''}`} onClick={openBell} style={{ justifyContent: 'flex-end', position: 'relative' }}>
              <Icon name="bell" size={26} />
              {unread > 0 && <span className="bell-badge">{unread}</span>}
            </button>
          </div>
        </header>
      )}

      <main className="m-content"><Outlet /></main>

      {!isClassPage && (
        <nav className="m-nav" aria-label="Aðalvalmynd">
          {tabs.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end>
              <Icon name={icon} size={24} stroke={1.7} />{label}
            </NavLink>
          ))}
          {/* Í tölvu: restin af valmyndinni er hér í stað hamborgarans */}
          <div className="m-side-extra">
            {access !== false && <NavLink to="/arangur">Árangur</NavLink>}
            <NavLink to="/profill">Prófíllinn minn</NavLink>
            <a href={BUY_URL} target="_blank" rel="noreferrer">Kaupa kort eða áskrift</a>
            {me.role !== 'member' && <Link to="/kiosk">Stöðvarskjár</Link>}
            {me.role === 'owner' && <Link to="/stjorn">Stjórnborð</Link>}
            <div className="m-side-me">
              <Link to="/profill" className="row" style={{ gap: 10, minWidth: 0, flex: 1, textDecoration: 'none' }}>
                <Avatar src={me.avatar_url} name={me.full_name || me.email || '?'} size={36} />
                <span className="ellipsis" style={{ fontWeight: 700, color: 'var(--text)' }}>{me.full_name || 'Án nafns'}</span>
              </Link>
              <button className="icon-btn" aria-label="Skrá út" title="Skrá út" onClick={() => api.signOut()}><Icon name="logout" size={20} /></button>
            </div>
          </div>
        </nav>
      )}

      {bell && (
        <>
          <button className="sheet-back" aria-label="Loka tilkynningum" onClick={() => setBell(false)} />
          <div className="sheet" role="dialog" aria-label="Tilkynningar">
            <div className="grip" />
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Tilkynningar</div>
            {(notes ?? []).length === 0 && <div className="muted" style={{ padding: '12px 0' }}>Engar tilkynningar enn.</div>}
            {(notes ?? []).map((n) => (
              <div key={n.id} role={n.link ? 'button' : undefined} tabIndex={n.link ? 0 : undefined}
                style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid var(--line)', cursor: n.link ? 'pointer' : undefined }}
                onClick={n.link ? () => { setBell(false); nav(n.link!) } : undefined}
                onKeyDown={n.link ? (e) => { if (e.key === 'Enter') { setBell(false); nav(n.link!) } } : undefined}>
                <span style={{ width: 8, height: 8, borderRadius: 9, marginTop: 7, background: n.read_at ? 'var(--line-2)' : 'var(--accent)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{n.title}</div>
                  {n.body && <div className="muted" style={{ fontSize: 14 }}>{n.body}</div>}
                  <div className="muted" style={{ fontSize: 12 }}>{relDay(n.created_at)} kl. {shortTime(n.created_at)}</div>
                </div>
                {n.link && <Icon name="next" size={18} color="var(--muted)" style={{ marginLeft: 'auto', alignSelf: 'center', flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </>
      )}

      {menu && (
        <>
          <button className="sheet-back" aria-label="Loka valmynd" onClick={() => setMenu(false)} />
          <nav className="drawer" aria-label="Valmynd" onClick={() => setMenu(false)}>
            <img src="myndir/logo-white.png" alt="BOX800" style={{ height: 44, alignSelf: 'flex-start', marginBottom: 20 }} />
            <Link to="/profill" className="row" style={{ marginBottom: 18, border: 0, textDecoration: 'none' }}>
              <Avatar src={me.avatar_url} name={me.full_name || me.email || '?'} />
              <div><div style={{ fontWeight: 700 }}>{me.full_name || 'Án nafns'}</div><div className="muted" style={{ fontSize: 13 }}>{me.email}</div></div>
            </Link>
            <Link to="/">Heim</Link>
            {access !== false && <Link to="/timatafla">Tímatafla</Link>}
            {access !== false && <Link to="/arangur">Árangur</Link>}
            <Link to="/profill">Prófíllinn minn</Link>
            <a href={BUY_URL} target="_blank" rel="noreferrer">Kaupa kort eða áskrift</a>
            {me.role !== 'member' && <Link to="/kiosk">Stöðvarskjár</Link>}
            {me.role === 'owner' && <Link to="/stjorn">Stjórnborð</Link>}
            <button className="link" onClick={() => api.signOut()}>Skrá út</button>
            <div className="muted" style={{ marginTop: 'auto', fontSize: 13 }}>BOX800 · Eyravegur 57 · Selfossi{api.demo ? ' · prófunarútgáfa' : ''}</div>
          </nav>
        </>
      )}
      {missed && !bell && (
        <>
          <button className="sheet-back" aria-label="Loka" onClick={() => dismissMissed()} />
          <div className="sheet" role="dialog" aria-label="Áminning">
            <div className="grip" />
            <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden>👋</div>
            <div className="display" style={{ fontSize: 28, marginTop: 10 }}>{missed.title}</div>
            <p style={{ color: 'var(--text-2)', fontSize: 16, lineHeight: 1.5 }}>{missed.body}</p>
            <button className="btn btn-primary btn-block" style={{ height: 52 }} onClick={() => dismissMissed(true)}>Bóka næsta tíma</button>
            <button className="btn btn-block" style={{ marginTop: 8 }} onClick={() => dismissMissed()}>Ok, skil</button>
          </div>
        </>
      )}
    </div>
  )
}
