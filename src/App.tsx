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
    // Check if URL contains OAuth tokens or code to be processed
    const hasAuthParams =
      window.location.hash.includes('access_token') ||
      window.location.search.includes('code=')

    // Listen for auth state changes (fires when OAuth tokens are parsed and stored)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        setSession(newSession)
        setLoading(false)
        // Clean URL hash after tokens are consumed so the address bar looks clean
        if (window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setLoading(false)
      }
    })

    // Check existing stored session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (existingSession) {
        setSession(existingSession)
        setLoading(false)
      } else if (!hasAuthParams) {
        // Only stop loading if there are NO auth tokens in the URL being processed
        setSession(null)
        setLoading(false)
      }
    })

    // Safety timeout: if token processing takes too long, stop loading
    const timer = setTimeout(() => {
      setLoading(false)
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
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
