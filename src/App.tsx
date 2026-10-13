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
  const [globalError, setGlobalError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function initAuth() {
      try {
        // 1. Check if OAuth error or tokens exist in URL hash or search params
        const rawHash = window.location.hash.startsWith('#')
          ? window.location.hash.substring(1)
          : window.location.hash

        const hashParams = new URLSearchParams(rawHash)
        const searchParams = new URLSearchParams(window.location.search)

        // Check for OAuth error returned from provider
        const errDesc = hashParams.get('error_description') || searchParams.get('error_description')
        const errCode = hashParams.get('error') || searchParams.get('error')
        if (errDesc || errCode) {
          const message = decodeURIComponent(errDesc || errCode || 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์')
          console.error('OAuth error from URL:', message)
          if (isMounted) {
            setGlobalError(message)
            setLoading(false)
          }
          return
        }

        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          // Explicitly set session from hash tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) {
            console.error('setSession failed:', error)
            if (isMounted) {
              setGlobalError(error.message)
              setLoading(false)
            }
            return
          }

          if (data?.session && isMounted) {
            setSession(data.session)
            setLoading(false)
            // Clean tokens from URL address bar
            window.history.replaceState(null, '', window.location.pathname)
            return
          }
        }

        // 2. Check existing session from localStorage
        const { data: { session: existingSession } } = await supabase.auth.getSession()
        if (isMounted) {
          if (existingSession) {
            setSession(existingSession)
          }
          setLoading(false)
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err)
        if (isMounted) {
          setGlobalError(err?.message || 'ไม่สามารถโหลดข้อมูลสิทธิ์ได้')
          setLoading(false)
        }
      }
    }

    initAuth()

    // 3. Listen for auth state events without letting INITIAL_SESSION wipe an active session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (newSession) {
          setSession(newSession)
          setLoading(false)
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setLoading(false)
      } else if (event === 'INITIAL_SESSION' && newSession) {
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
      {globalError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4">
          <div className="bg-rose-600 text-white p-3 rounded-xl shadow-xl flex items-center justify-between text-xs sm:text-sm">
            <span>{globalError}</span>
            <button
              onClick={() => setGlobalError(null)}
              className="ml-3 font-bold hover:opacity-75"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/" element={!session ? <Login initialError={globalError} /> : <Navigate to="/select" replace />} />
        <Route path="/select" element={session ? <SelectExam /> : <Navigate to="/" replace />} />
        <Route path="/exam/:examId" element={session ? <ExamSession /> : <Navigate to="/" replace />} />
        <Route path="/result/:attemptId" element={session ? <ResultSummary /> : <Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
