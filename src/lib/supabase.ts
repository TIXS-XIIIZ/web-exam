import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vbnszkgeknxjvdmxjked.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibnN6a2dla254anZkbXhqa2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzA3MzQsImV4cCI6MjEwNzEwNjczNH0.bdJUusqlpMuDLnYfrrNzf23pTK8G2stfCdb7B_fw1tE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  }
})
