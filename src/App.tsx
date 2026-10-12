import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import SelectExam from './pages/SelectExam'
import ExamSession from './pages/ExamSession'
import ResultSummary from './pages/ResultSummary'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function initAuth() {
      try {
        // 1. Check if OAuth tokens exist in the URL hash
        const rawHash = window.location.hash.startsWith('#')
          ? window.location.hash.substring(1)
          : window.location.hash

        if (rawHash) {
          const hashParams = new URLSearchParams(rawHash)
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (accessToken && refreshToken) {
            // Directly set session using extracted tokens
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (!error && data?.session && isMounted) {
              setSession(data.session)
              setLoading(false)
              // Clean tokens from URL address bar
              window.history.replaceState(null, '', window.location.pathname)
              return
            }
          }
        }

        // 2. If no tokens in hash or setSession completed, check existing session
        const { data: { session: existingSession } } = await supabase.auth.getSession()
        if (isMounted) {
          setSession(existingSession)
          setLoading(false)
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
        if (isMounted) {
          setSession(null)
          setLoading(false)
        }
      }
    }

    initAuth()

    // 3. Listen for future auth state changes (e.g. sign in, sign out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        setSession(newSession)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-slate-300">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold tracking-wide">กำลังเข้าสู่ระบบและเตรียมข้อมูล...</p>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={!session ? <Login /> : <Navigate to="/select" replace />} />
        <Route path="/select" element={session ? <SelectExam /> : <Navigate to="/" replace />} />
        <Route path="/exam/:examId" element={session ? <ExamSession /> : <Navigate to="/" replace />} />
        <Route path="/result/:attemptId" element={session ? <ResultSummary /> : <Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
