import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../ctx'
import { Avatar, Icon } from '../components/Icon'

const GROUPS: { id: string; label: string; icon: string; kids: [string, string][] }[] = [
  { id: 'aefingar', label: 'ÆFINGAR', icon: 'dumb', kids: [['/stjorn/aefingar', 'Æfingar dagsins']] },
  { id: 'timar', label: 'TÍMAR', icon: 'cal', kids: [['/stjorn/timar', 'Dagatal og fjöldi'], ['/stjorn/stillingar', 'Bókunarstillingar']] },
  { id: 'idkendur', label: 'IÐKENDUR', icon: 'people', kids: [['/stjorn/idkendur', 'Allir iðkendur']] },
  { id: 'kiosk', label: 'VIÐBÆTUR', icon: 'grid', kids: [['/kiosk', 'Stöðvarskjár']] },
]

export default function AdminShell() {
  const { me, api } = useApp()
  const [open, setOpen] = useState<Record<string, boolean>>({ aefingar: true, timar: true, idkendur: true, kiosk: true })
  return (
    <div className="a-shell">
      <aside className="a-side">
        <Link to="/" style={{ margin: '0 10px 20px', display: 'block' }}><img src="myndir/logo-white.png" alt="BOX800 – aftur í appið" style={{ height: 44 }} /></Link>
        <nav aria-label="Stjórnborð" style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
          {GROUPS.map((g) => (
            <div key={g.id}>
              <button className="grp" aria-expanded={!!open[g.id]} onClick={() => setOpen({ ...open, [g.id]: !open[g.id] })}>
                <Icon name={g.icon} size={20} /><span className="grow">{g.label}</span>
                <Icon name="next" size={16} style={{ transform: open[g.id] ? 'rotate(90deg)' : 'none' }} />
              </button>
              {open[g.id] && g.kids.map(([to, label]) => <NavLink key={to} to={to} className="sub">{label}</NavLink>)}
            </div>
          ))}
          <Link to="/" className="grp" style={{ marginTop: 10 }}><Icon name="back" size={20} />AFTUR Í APPIÐ</Link>
        </nav>
        <div className="row" style={{ marginTop: 'auto', padding: '16px 8px 0', borderTop: '1px solid #23272b', width: '100%' }}>
          <Avatar src={me.avatar_url} name={me.full_name} size={40} />
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 14 }}>{me.full_name}</div>
            <span className="badge" style={{ background: 'var(--warn)', color: '#0b0c0e' }}>EIGANDI</span>
          </div>
          <button className="icon-btn" aria-label="Skrá út" onClick={() => api.signOut()}><Icon name="logout" size={20} /></button>
        </div>
      </aside>
      <main className="a-main"><Outlet /></main>
    </div>
  )
}
