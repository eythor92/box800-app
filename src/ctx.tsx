import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Api, Profile } from './api'

interface Ctx {
  api: Api
  me: Profile
  tick: number          // hækkar þegar gögn breytast (rauntími)
  refresh: () => void
  toast: (msg: string) => void
}
export const AppCtx = createContext<Ctx>(null as never)
export const useApp = () => useContext(AppCtx)

/** Sækir gögn og endurhleður þegar eitthvað breytist */
export function useData<T>(load: (api: Api) => Promise<T>, deps: unknown[] = []): { data: T | undefined; error: string | null; reload: () => void } {
  const { api, tick } = useApp()
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [n, setN] = useState(0)
  const ref = useRef(load); ref.current = load
  useEffect(() => {
    let live = true
    ref.current(api).then((d) => { if (live) { setData(d); setError(null) } }, (e) => live && setError(String(e?.message ?? e)))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, tick, n, ...deps])
  return { data, error, reload: useCallback(() => setN((x) => x + 1), []) }
}

export function useToast() {
  const [msg, setMsg] = useState('')
  const t = useRef<number>()
  const toast = useCallback((m: string) => {
    setMsg(m); clearTimeout(t.current); t.current = window.setTimeout(() => setMsg(''), 2600)
  }, [])
  return { msg, toast }
}
