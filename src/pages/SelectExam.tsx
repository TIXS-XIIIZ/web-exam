import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Scale, 
  LogOut, 
  BookOpen, 
  Clock, 
  CheckCircle, 
  ArrowRight, 
  Layers, 
  Sparkles, 
  History,
  ChevronRight,
  Loader2
} from 'lucide-react'

export default function SelectExam() {
  const [exams, setExams] = useState<any[]>([])
  const [topics, setTopics] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [recentAttempts, setRecentAttempts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startingExamId, setStartingExamId] = useState<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        setUser(currentUser)

        // 1. Fetch Exams
        const { data: examData, error: examErr } = await supabase
          .from('exams')
          .select('*, categories(name)')
        if (examErr) console.error(examErr)
        if (examData) setExams(examData)

        // 2. Fetch Topics count
        const { data: topicData } = await supabase
          .from('topics')
          .select('id, name')
        if (topicData) setTopics(topicData)

        // 3. Fetch user's recent attempts if logged in
        if (currentUser) {
          const { data: attempts } = await supabase
            .from('exam_attempts')
            .select('id, exam_id, status, total_score, started_at, finished_at, exams(title)')
            .eq('user_id', currentUser.id)
            .order('started_at', { ascending: false })
            .limit(5)
          if (attempts) setRecentAttempts(attempts)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleStartExam = async (examId: number) => {
    try {
      setStartingExamId(examId)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) return

      const { data: attempt, error } = await supabase
        .from('exam_attempts')
        .insert({
          exam_id: examId,
          user_id: currentUser.id,
          status: 'in_progress'
        })
        .select()
        .single()

      if (error) {
        console.error(error)
        alert('ไม่สามารถเริ่มทำข้อสอบได้: ' + error.message)
        return
      }

      navigate(`/exam/${examId}?attemptId=${attempt.id}`)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setStartingExamId(null)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
        <p className="text-sm font-medium">กำลังเตรียมข้อมูลคลังข้อสอบ...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-800 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white">
              <Scale size={20} />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg leading-tight block">Nitikon Exam</span>
              <span className="text-xs text-indigo-600 font-medium">ระบบสอบออนไลน์</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="max-w-[180px] truncate">{user.email}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all duration-200"
            >
              <LogOut size={15} />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 sm:p-10 shadow-xl shadow-indigo-950/10">
          <div className="absolute right-[-40px] top-[-40px] w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-indigo-200">
              <Sparkles size={14} className="text-amber-300" />
              ยินดีต้อนรับสู่ห้องทดสอบความรู้
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              เลือกชุดข้อสอบเพื่อเริ่มฝึกฝน
            </h1>
            <p className="text-sm sm:text-base text-indigo-200 leading-relaxed">
              ฝึกทำโจทย์จำลองเสมือนจริง ตอบปุ๊บเฉลยปั๊บพร้อมคำอธิบาย และสามารถบันทึกประวัติการทำเพื่อประเมินความพร้อม
            </p>
          </div>
        </div>

        {/* Content Layout (Exams Grid + Sidebar Info) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Exams Cards List (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">ชุดข้อสอบทั้งหมด</h2>
                <p className="text-xs text-slate-500">เลือกชุดข้อสอบที่ต้องการเพื่อเริ่มจับเวลาหรือฝึกทำ</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                {exams.length} ชุดที่มีให้สอบ
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {exams.map((exam) => {
                const isStarting = startingExamId === exam.id
                return (
                  <div
                    key={exam.id}
                    className="group relative bg-white rounded-2xl p-6 border border-slate-200/90 hover:border-indigo-500/50 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
                          <BookOpen size={24} />
                        </div>
                        <div>
                          <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 mb-1">
                            {exam.categories?.name || 'หมวดนิติกร'}
                          </span>
                          <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {exam.title}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                      {exam.description || 'แบบทดสอบรวมข้อสอบมาตรฐานสำหรับผู้เตรียมตัวสอบแข่งขันและคัดเลือกตำแหน่งนิติกร'}
                    </p>

                    {/* Metadata pills */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-6 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                        <Layers size={15} className="text-indigo-500" />
                        <span>จำนวน <strong>{exam.total_questions || 1050}</strong> ข้อ</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                        <Clock size={15} className="text-amber-500" />
                        <span>ไม่จำกัดเวลา (ทำได้เรื่อยๆ)</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                        <CheckCircle size={15} className="text-emerald-500" />
                        <span>เกณฑ์ผ่าน <strong>{exam.passing_score || 60}%</strong></span>
                      </div>
                    </div>

                    {/* Start Button */}
                    <button
                      onClick={() => handleStartExam(exam.id)}
                      disabled={isStarting}
                      className="w-full sm:w-auto sm:min-w-[180px] flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-sm shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isStarting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>กำลังเริ่ม...</span>
                        </>
                      ) : (
                        <>
                          <span>เริ่มทำข้อสอบ</span>
                          <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                )
              })}

              {exams.length === 0 && (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                  <BookOpen className="mx-auto text-slate-300 mb-3" size={40} />
                  <p className="text-slate-500 font-medium">ยังไม่มีชุดข้อสอบในระบบ</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Sidebar Stats & Topics & History (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Topics Covered Box */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <Layers size={18} className="text-indigo-600" />
                  <h3>สาระวิชาที่มีในข้อสอบ</h3>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-md">
                  {topics.length} หมวด
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                ข้อสอบถูกคัดเลือกและแบ่งตามหมวดหมู่กฎหมายสำคัญ:
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {topics.map((topic, i) => (
                  <div
                    key={topic.id || i}
                    className="flex items-center gap-2 text-xs text-slate-700 p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/60 border border-slate-100 transition-colors"
                  >
                    <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate">{topic.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Exam Attempts Box */}
            {recentAttempts.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900 font-bold mb-4">
                  <History size={18} className="text-indigo-600" />
                  <h3>ประวัติการสอบล่าสุดของคุณ</h3>
                </div>
                <div className="space-y-3">
                  {recentAttempts.map((att) => {
                    const isDone = att.status === 'completed'
                    return (
                      <div
                        key={att.id}
                        onClick={() => {
                          if (isDone) navigate(`/result/${att.id}`)
                          else navigate(`/exam/${att.exam_id}?attemptId=${att.id}`)
                        }}
                        className="group p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-800 line-clamp-1 group-hover:text-indigo-600">
                            {att.exams?.title || 'ข้อสอบ'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(att.started_at).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit',
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isDone ? 'ดูผลสอบ' : 'ทำต่อ'}
                          </span>
                          <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
