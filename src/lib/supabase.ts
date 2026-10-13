import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vbnszkgeknxjvdmxjked.supabase.co'
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibnN6a2dla254anZkbXhqa2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzA3MzQsImV4cCI6MjEwNzEwNjczNH0.bdJUusqlpMuDLnYfrrNzf23pTK8G2stfCdb7B_fw1tE'

// Sanitize inputs (strip any quotes, spaces, or trailing slashes)
const supabaseUrl = rawUrl.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '')
const supabaseAnonKey = rawKey.trim().replace(/^["']|["']$/g, '')

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  }
})
