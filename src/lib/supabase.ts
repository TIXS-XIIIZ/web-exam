import { createClient } from '@supabase/supabase-js'

export function cleanJwt(token?: string | null): string {
  if (!token) return ''
  return token.replace(/[^A-Za-z0-9._-]/g, '')
}

export function cleanUrl(url?: string | null): string {
  if (!url) return ''
  return url.replace(/[\r\n\t\s"']/g, '').replace(/\/+$/, '')
}

const defaultUrl = 'https://vbnszkgeknxjvdmxjked.supabase.co'
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibnN6a2dla254anZkbXhqa2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzA3MzQsImV4cCI6MjEwNzEwNjczNH0.bdJUusqlpMuDLnYfrrNzf23pTK8G2stfCdb7B_fw1tE'

const cleanedEnvUrl = cleanUrl(import.meta.env.VITE_SUPABASE_URL)
const cleanedEnvKey = cleanJwt(import.meta.env.VITE_SUPABASE_ANON_KEY)

const supabaseUrl = cleanedEnvUrl || defaultUrl
const supabaseAnonKey = (cleanedEnvKey && cleanedEnvKey.length > 50) ? cleanedEnvKey : defaultKey

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  }
})
