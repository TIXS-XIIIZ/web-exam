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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium">กำลังตรวจสอบการเข้าสู่ระบบ...</p>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={!session ? <Login /> : <Navigate to="/select" />} />
        <Route path="/select" element={session ? <SelectExam /> : <Navigate to="/" />} />
        <Route path="/exam/:examId" element={session ? <ExamSession /> : <Navigate to="/" />} />
        <Route path="/result/:attemptId" element={session ? <ResultSummary /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default App
