import type { Api } from './types'
import { supabaseApi } from './supabase'

export * from './types'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Sýniútgáfa ef Supabase er ekki stillt, eða ef slóðin endar á ?demo
export const isDemo = !URL || !KEY || new URLSearchParams(location.search).has('demo')

let api: Api | null = null
export async function getApi(): Promise<Api> {
  if (api) return api
  if (isDemo) {
    const { demoApi } = await import('./demo')
    api = await demoApi()
  } else {
    api = supabaseApi(URL!, KEY!)
  }
  return api
}
