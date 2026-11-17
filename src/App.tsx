import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getApi, type Api, type Profile } from './api'
import { AppCtx, useToast } from './ctx'
import Login from './pages/Login'
import NewPassword from './pages/NewPassword'
import MobileShell from './pages/MobileShell'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import WorkoutView from './pages/WorkoutView'
import Attendance from './pages/Attendance'
import CoachClasses from './pages/CoachClasses'
import CoachClass from './pages/CoachClass'
import AdminShell from './admin/AdminShell'
import AdminWorkouts from './admin/AdminWorkouts'
import AdminClasses from './admin/AdminClasses'
import AdminSettings from './admin/AdminSettings'
import AdminMembers from './admin/AdminMembers'
import AdminMemberProfile from './admin/AdminMemberProfile'
import AdminPromos from './admin/AdminPromos'
import AdminInsights from './admin/AdminInsights'
import KioskPlus from './kiosk/KioskPlus'
import Results from './pages/Results'
import MyProfile from './pages/MyProfile'
import NoAccess from './pages/NoAccess'
import LiftHistory from './pages/LiftHistory'
import Leaderboard from './pages/Leaderboard'

/** Hreinsar gamla útgáfu úr geymslu vafrans og endurhleður (sjá index.html) */
function fixCache(force: boolean) {
  const f = (window as unknown as { __box800Fix?: (force: boolean) => void }).__box800Fix
  if (f) f(force); else location.reload()
}

export default function App() {
  const [api, setApi] = useState<Api | null>(null)
  const [me, setMe] = useState<Profile | null | undefined>(undefined)
  const [access, setAccess] = useState(true)
  const [tick, setTick] = useState(0)
  const [fatal, setFatal] = useState<string | null>(null)
  const { msg, toast } = useToast()
  const [recovery, setRecovery] = useState(false)

  const loadMe = useCallback(async (a: Api) => {
    const s = await a.session()
    const p = s ? await a.myProfile() : null
    try { if (s && sessionStorage.getItem('box800-recovery')) setRecovery(true) } catch { /* */ }
    if (p) setAccess(await a.hasAccess().catch(() => true))
    setMe(p)
  }, [])

  useEffect(() => {
    const fail = (e: unknown) => {
      const m = String((e as Error)?.message ?? e)
      setFatal(m)
      // Gömul útgáfa í geymslu reyndi að sækja skrá sem er ekki lengur til: hreinsa og endurhlaða
      if (/import|module|dynamically|Failed to fetch/i.test(m)) fixCache(false)
    }
    getApi().then((a) => { setApi(a); loadMe(a).catch(fail); setTimeout(() => { try { sessionStorage.removeItem('box800-fixed') } catch { /* */ } }, 5000) }, fail)
  }, [loadMe])

  useEffect(() => {
    if (!api) return
    const off = api.onAuthChange(() => { loadMe(api) })
    return off
  }, [api, loadMe])

  useEffect(() => {
    if (!api || !me) return
    return api.subscribe(() => setTick((t) => t + 1))
  }, [api, me])

  // Án áskriftar: athuga reglulega hvort áskrift sé komin inn
  useEffect(() => {
    if (!api || !me || access) return
    const t = setInterval(() => { api.hasAccess().then((x) => { if (x) loadMe(api) }, () => undefined) }, 60000)
    return () => clearInterval(t)
  }, [api, me, access, loadMe])

  if (fatal) return (
    <div className="auth"><div className="error">
      {/import|module|fetch/i.test(fatal) ? 'Ný útgáfa af appinu er komin. Augnablik…' : 'Villa: ' + fatal}
      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={() => fixCache(true)}>Hlaða appinu upp á nýtt</button>
    </div></div>
  )
  if (!api || me === undefined) return <div className="auth"><div><img src="myndir/logo-white.png" alt="BOX800" style={{ height: 60, display: 'block', margin: '0 auto' }} /><div className="spinner" /></div></div>
  if (me && recovery) return <>
    <NewPassword api={api} email={me.email} onDone={() => { try { sessionStorage.removeItem('box800-recovery') } catch { /* */ } setRecovery(false); toast('Nýja lykilorðið er komið. Velkomin(n)!') }} />
    {msg && <div className="toast" role="status">{msg}</div>}
  </>
  if (!me) return <>{<Login api={api} />}{msg && <div className="toast" role="status">{msg}</div>}</>

  const staff = me.role !== 'member'
  const owner = me.role === 'owner'

  return (
    <AppCtx.Provider value={{ api, me, tick, refresh: () => setTick((t) => t + 1), toast, reloadMe: () => { loadMe(api) }, access }}>
      <HashRouter>
        <Routes>
          {!access ? (
            <Route element={<MobileShell />}>
              <Route path="/" element={<NoAccess />} />
              <Route path="/profill" element={<MyProfile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          ) : (
          <Route element={<MobileShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/timatafla" element={<Schedule />} />
            <Route path="/aefing" element={<WorkoutView />} />
            <Route path="/maeting" element={<Attendance />} />
            <Route path="/arangur" element={<Results />} />
            <Route path="/profill" element={<MyProfile />} />
            <Route path="/arangur/:id" element={<LiftHistory />} />
            <Route path="/stigatafla/:id" element={<Leaderboard />} />
            {staff && <Route path="/thjalfari" element={<CoachClasses />} />}
            {staff && <Route path="/thjalfari/aefing" element={<WorkoutView coach />} />}
            {staff && <Route path="/thjalfari/timi/:id" element={<CoachClass />} />}
          </Route>
          )}
          {staff && <Route path="/kiosk" element={<KioskPlus />} />}
          {staff && <Route path="/kiosk/sjonvarp" element={<Navigate to="/kiosk?t=aefing" replace />} />}
          {owner && (
            <Route path="/stjorn" element={<AdminShell />}>
              <Route index element={<Navigate to="aefingar" replace />} />
              <Route path="aefingar" element={<AdminWorkouts />} />
              <Route path="timar" element={<AdminClasses />} />
              <Route path="stillingar" element={<AdminSettings />} />
              <Route path="idkendur" element={<AdminMembers />} />
              <Route path="idkendur/:id" element={<AdminMemberProfile />} />
              <Route path="innsyn" element={<AdminInsights />} />
              <Route path="samstarf" element={<AdminPromos />} />
            </Route>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      {msg && <div className="toast" role="status">{msg}</div>}
    </AppCtx.Provider>
  )
}
