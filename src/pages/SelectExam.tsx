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
  Loader2,
  FolderOpen,
  Filter,
  Pencil,
  Check,
  X,
  Lightbulb,
  Shuffle,
  Trash2
} from 'lucide-react'

export default function SelectExam() {
  const [exams, setExams] = useState<any[]>([])
  const [topics, setTopics] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [recentAttempts, setRecentAttempts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'topics'>('all')
  const [editingAttemptId, setEditingAttemptId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [deletingAttemptId, setDeletingAttemptId] = useState<number | null>(null)
  const [isClearingAll, setIsClearingAll] = useState<boolean>(false)

  // Exam Mode, Time Setting, and Random state
  const [examMode, setExamMode] = useState<'real_exam' | 'practice'>('real_exam')
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(180)
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('180')
  const [isCustomTime, setIsCustomTime] = useState<boolean>(false)
  const [isRandom, setIsRandom] = useState<boolean>(true)

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

        // 2. Fetch Topics with question counts
        const { data: topicData } = await supabase
          .from('topics')
          .select('id, name, questions(count)')
        if (topicData) {
          const formattedTopics = topicData.map((t: any) => ({
            id: t.id,
            name: t.name,
            questionCount: t.questions?.[0]?.count || 0
          }))
          setTopics(formattedTopics)
        }

        // 3. Fetch user's recent attempts if logged in (with topic_id, custom_title, and topics name)
        if (currentUser) {
          const { data: attempts } = await supabase
            .from('exam_attempts')
            .select(`
              id, exam_id, topic_id, custom_title, exam_mode, time_limit_seconds, time_spent_seconds, is_random, status, total_score, started_at, finished_at,
              exams (title),
              topics (name)
            `)
            .eq('user_id', currentUser.id)
            .order('started_at', { ascending: false })
            .limit(50)
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

  const handleStartExam = async (examId: number, topicId?: number) => {
    try {
      const startKey = topicId ? `topic-${topicId}` : `exam-${examId}`
      setStartingId(startKey)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) return

      const finalMinutes = isCustomTime ? Math.max(1, parseInt(customMinutesInput) || 180) : timeLimitMinutes
      const timeLimitSecs = examMode === 'real_exam' ? finalMinutes * 60 : null

      const insertData: any = {
        exam_id: examId,
        user_id: currentUser.id,
        status: 'in_progress',
        exam_mode: examMode,
        time_limit_seconds: timeLimitSecs,
        is_random: isRandom,
      }
      if (topicId) {
        insertData.topic_id = topicId
      }

      const { data: attempt, error } = await supabase
        .from('exam_attempts')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error(error)
        alert('ไม่สามารถเริ่มทำข้อสอบได้: ' + error.message)
        return
      }

      const queryParams = new URLSearchParams()
      queryParams.set('attemptId', String(attempt.id))
      if (topicId) queryParams.set('topicId', String(topicId))
      queryParams.set('mode', examMode)
      queryParams.set('random', isRandom ? '1' : '0')

      navigate(`/exam/${examId}?${queryParams.toString()}`)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setStartingId(null)
    }
  }

  const handleStartEdit = (att: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingAttemptId(att.id)
    setEditingTitle(att.custom_title || (att.topic_id && att.topics?.name ? `หมวด: ${att.topics.name}` : (att.exams?.title || 'ทำข้อสอบรวมทั้งหมด')))
  }

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingAttemptId(null)
    setEditingTitle('')
  }

  const handleSaveTitle = async (attemptId: number, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (savingTitle) return

    try {
      setSavingTitle(true)
      const cleanTitle = editingTitle.trim()
      const { error } = await supabase
        .from('exam_attempts')
        .update({ custom_title: cleanTitle || null })
        .eq('id', attemptId)

      if (error) {
        alert('ไม่สามารถบันทึกชื่อได้: ' + error.message)
        return
      }

      setRecentAttempts((prev) =>
        prev.map((att) => (att.id === attemptId ? { ...att, custom_title: cleanTitle || null } : att))
      )
      setEditingAttemptId(null)
      setEditingTitle('')
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSavingTitle(false)
    }
  }

  const handleDeleteAttempt = async (attemptId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = window.confirm('คุณต้องการลบประวัติการสอบรอบนี้ใช่หรือไม่?\nข้อมูลคะแนนและคำตอบในรอบนี้จะถูกลบถาวร')
    if (!confirmed) return

    try {
      setDeletingAttemptId(attemptId)
      const { error } = await supabase
        .from('exam_attempts')
        .delete()
        .eq('id', attemptId)

      if (error) throw error

      setRecentAttempts((prev) => prev.filter((a) => a.id !== attemptId))
    } catch (err: any) {
      alert('ไม่สามารถลบประวัติได้: ' + err.message)
    } finally {
      setDeletingAttemptId(null)
    }
  }

  const handleClearAllHistory = async () => {
    if (!user) return
    const confirmed = window.confirm('คุณต้องการลบประวัติการสอบทั้งหมดของคุณใช่หรือไม่?\nประวัติการทำข้อสอบทุกรอบจะถูกลบถาวรและไม่สามารถกู้คืนได้')
    if (!confirmed) return

    try {
      setIsClearingAll(true)
      const { error } = await supabase
        .from('exam_attempts')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error

      setRecentAttempts([])
    } catch (err: any) {
      alert('ไม่สามารถลบประวัติทั้งหมดได้: ' + err.message)
    } finally {
      setIsClearingAll(false)
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

  const primaryExam = exams[0] || { id: 1, title: 'คลังข้อสอบนิติกร (ทั้งหมด)' }

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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all duration-200 cursor-pointer"
            >
              <LogOut size={15} />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 flex-1 w-full space-y-6 sm:space-y-8">
        {/* Welcome Banner */}
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 sm:p-8 md:p-10 shadow-xl shadow-indigo-950/10">
          <div className="absolute right-[-40px] top-[-40px] w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 max-w-2xl space-y-2.5 sm:space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-indigo-200">
              <Sparkles size={14} className="text-amber-300" />
              ยินดีต้อนรับสู่ห้องทดสอบความรู้
            </div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-snug">
              เลือกโหมดการฝึกทำข้อสอบ
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-indigo-200 leading-relaxed">
              ฝึกทำโจทย์จำลองเสมือนจริง ตอบปุ๊บเฉลยปั๊บพร้อมคำอธิบาย หรือเลือกลองสอบจริงแบบจับเวลา 3 ชั่วโมงเพื่อวัดความพร้อมก่อนลงสนาม
            </p>
          </div>
        </div>

        {/* Mode Selector Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">1. เลือกลักษณะการสอบ</h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700">
              {examMode === 'real_exam' ? `⏱️ จับเวลา ${timeLimitMinutes} นาที` : '💡 ฝึกฝน ไม่จำกัดเวลา'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {/* Real Exam Mode */}
            <div
              onClick={() => setExamMode('real_exam')}
              className={`p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                examMode === 'real_exam'
                  ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 transition-colors ${
                  examMode === 'real_exam' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    สอบจริง (จับเวลา)
                  </h3>
                  <p className="text-xs text-slate-500">
                    ซ่อนเฉลย • ส่งเมื่อหมดเวลา
                  </p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                examMode === 'real_exam' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'
              }`}>
                {examMode === 'real_exam' && <Check size={12} strokeWidth={3} />}
              </div>
            </div>

            {/* Practice Mode */}
            <div
              onClick={() => setExamMode('practice')}
              className={`p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                examMode === 'practice'
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 transition-colors ${
                  examMode === 'practice' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Lightbulb size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    ฝึกฝนปกติ
                  </h3>
                  <p className="text-xs text-slate-500">
                    เฉลยทันที • ไม่จำกัดเวลา
                  </p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                examMode === 'practice' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
              }`}>
                {examMode === 'practice' && <Check size={12} strokeWidth={3} />}
              </div>
            </div>
          </div>

          {/* Time setting bar when Real Exam Mode is active */}
          {examMode === 'real_exam' && (
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 flex flex-wrap items-center gap-2 animate-in fade-in duration-150">
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5 mr-1">
                <Clock size={14} className="text-amber-600" />
                เวลาสอบ:
              </span>
              {[
                { label: '1 ชม.', value: 60 },
                { label: '2 ชม.', value: 120 },
                { label: '3 ชม. (มาตรฐาน)', value: 180 },
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setTimeLimitMinutes(preset.value)
                    setIsCustomTime(false)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !isCustomTime && timeLimitMinutes === preset.value
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-white hover:bg-amber-100/70 text-slate-700 border border-amber-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCustomTime(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isCustomTime
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white hover:bg-amber-100/70 text-slate-700 border border-amber-200'
                }`}
              >
                กำหนดเอง
              </button>

              {isCustomTime && (
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-amber-300">
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={customMinutesInput}
                    onChange={(e) => {
                      const val = e.target.value
                      setCustomMinutesInput(val)
                      const num = parseInt(val)
                      if (num > 0) setTimeLimitMinutes(num)
                    }}
                    placeholder="นาที"
                    className="w-14 text-xs text-slate-900 font-bold focus:outline-none"
                  />
                  <span className="text-xs text-slate-500 font-medium">นาที</span>
                </div>
              )}
            </div>
          )}

          {/* Random Questions & Choices Option */}
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                isRandom ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
              }`}>
                <Shuffle size={15} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-800">
                  สุ่มลำดับโจทย์และตัวเลือก
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isRandom ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {isRandom ? 'เปิด' : 'ปิด'}
                </span>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => setIsRandom(!isRandom)}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer flex items-center ${
                isRandom ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
              title={isRandom ? 'ปิดการสุ่ม' : 'เปิดการสุ่ม'}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                  isRandom ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Scope Switch Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-2xl w-full sm:w-fit">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen size={16} />
              <span>2. ทำข้อสอบรวมทั้งหมด (1,050 ข้อ)</span>
            </button>
            <button
              onClick={() => setActiveTab('topics')}
              className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'topics'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Filter size={16} />
              <span>2. เลือกทำเฉพาะหมวด (แยกตามสาระวิชา)</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-extrabold">
                9 หมวด
              </span>
            </button>
          </div>
        </div>

        {/* Content Layout (Exams Grid + Sidebar Info) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Main Content (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {activeTab === 'all' ? (
              /* TAB 1: ALL QUESTIONS IN ONE EXAM */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">ชุดข้อสอบรวม</h2>
                    <p className="text-xs text-slate-500">รวมข้อสอบทุกสาระวิชา 1,050 ข้อ</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {exams.length} ชุด
                  </span>
                </div>

                {exams.map((exam) => {
                  const isStarting = startingId === `exam-${exam.id}`
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
                          <Clock size={15} className={examMode === 'real_exam' ? 'text-amber-500 font-bold' : 'text-slate-500'} />
                          <span>
                            {examMode === 'real_exam' ? (
                              <strong className="text-amber-700">จับเวลาถอยหลัง {timeLimitMinutes} นาที</strong>
                            ) : (
                              'ไม่จำกัดเวลา (ทำได้เรื่อยๆ)'
                            )}
                          </span>
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
                        className={`w-full sm:w-auto sm:min-w-[200px] flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer ${
                          examMode === 'real_exam'
                            ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20 hover:shadow-amber-600/30'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 hover:shadow-indigo-600/30'
                        }`}
                      >
                        {isStarting ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            <span>กำลังเริ่ม...</span>
                          </>
                        ) : (
                          <>
                            <span>
                              {examMode === 'real_exam'
                                ? `เริ่มสอบจริง (${timeLimitMinutes} นาที)`
                                : 'เริ่มทำข้อสอบรวม'}
                            </span>
                            <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* TAB 2: SELECT SPECIFIC TOPIC */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">เลือกทำเฉพาะหมวด</h2>
                    <p className="text-xs text-slate-500">เลือกหัวข้อที่ต้องการฝึกฝน ระบบจะแสดงเฉพาะข้อสอบในหมวดนั้น</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {topics.length} หมวดวิชา
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {topics.map((topic, idx) => {
                    const isStarting = startingId === `topic-${topic.id}`
                    return (
                      <div
                        key={topic.id}
                        className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-indigo-500/50 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {topic.questionCount} ข้อ
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm mb-3 line-clamp-2 leading-snug">
                            {topic.name}
                          </h3>
                        </div>

                        <button
                          onClick={() => handleStartExam(primaryExam.id, topic.id)}
                          disabled={isStarting}
                          className={`mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer disabled:opacity-70 ${
                            examMode === 'real_exam'
                              ? 'bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 hover:border-amber-600'
                              : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white'
                          }`}
                        >
                          {isStarting ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <>
                              <span>
                                {examMode === 'real_exam'
                                  ? `สอบจริงหมวดนี้ (${timeLimitMinutes} น.)`
                                  : `เริ่มทำหมวดนี้ (${topic.questionCount} ข้อ)`}
                              </span>
                              <ChevronRight size={15} />
                            </>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Sidebar Stats & Topics & History (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* 1. History Button - Placed ABOVE "สรุปจำนวนข้อรายหมวด" */}
            <button
              onClick={() => setShowHistoryModal(true)}
              className="w-full bg-white hover:bg-indigo-50/50 border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-4 sm:p-4.5 shadow-sm hover:shadow-md transition-all flex items-center justify-between group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-all shadow-inner flex-shrink-0">
                  <History size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                    <span>ประวัติการสอบของคุณ</span>
                    {recentAttempts.length > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex-shrink-0">
                        {recentAttempts.length}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {recentAttempts.length > 0
                      ? 'คลิกดูรายละเอียด / เปลี่ยนชื่อ / ทำต่อ'
                      : 'ยังไม่มีประวัติการสอบ'}
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400 group-hover:translate-x-1 group-hover:text-indigo-600 transition-all flex-shrink-0 ml-2" />
            </button>

            {/* 2. Quick Topic Overview Box */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <FolderOpen size={18} className="text-indigo-600" />
                  <h3>สรุปจำนวนข้อรายหมวด</h3>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-md">
                  {topics.length} หมวด
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                คลิกที่หมวดใดก็ได้เพื่อเริ่มทำทันที:
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {topics.map((topic, i) => (
                  <button
                    key={topic.id || i}
                    onClick={() => handleStartExam(primaryExam.id, topic.id)}
                    className="w-full text-left flex items-center justify-between gap-2 text-xs text-slate-700 p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate group-hover:text-indigo-600 font-medium">{topic.name}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 flex-shrink-0">
                      {topic.questionCount} ข้อ
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* History Modal Dialog */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">ประวัติการสอบของคุณ</h3>
                  <p className="text-xs text-slate-500">
                    แสดง {recentAttempts.length} รอบล่าสุด • คลิกเพื่อดูผลวิเคราะห์หรือทำต่อ
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false)
                  setEditingAttemptId(null)
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="ปิด"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-3.5">
              {recentAttempts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <History size={40} className="mx-auto text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">ยังไม่มีประวัติการสอบ</p>
                  <p className="text-xs text-slate-400">เลือกทำข้อสอบรวมหรือเฉพาะหมวด เพื่อเริ่มต้นบันทึกประวัติ</p>
                </div>
              ) : (
                recentAttempts.map((att) => {
                  const isDone = att.status === 'completed'
                  const isEditing = editingAttemptId === att.id
                  const isSingleTopic = !!att.topic_id
                  const topicName = att.topics?.name
                  const defaultName = isSingleTopic
                    ? (topicName ? `หมวด: ${topicName}` : 'รายหมวดวิชา')
                    : 'ทำข้อสอบรวมทั้งหมด (1,050 ข้อ)'
                  const displayName = att.custom_title || defaultName

                  return (
                    <div
                      key={att.id}
                      onClick={() => {
                        if (isEditing) return
                        setShowHistoryModal(false)
                        if (isDone) {
                          navigate(att.topic_id ? `/result/${att.id}?topicId=${att.topic_id}` : `/result/${att.id}`)
                        } else {
                          navigate(att.topic_id ? `/exam/${att.exam_id}?attemptId=${att.id}&topicId=${att.topic_id}` : `/exam/${att.exam_id}?attemptId=${att.id}`)
                        }
                      }}
                      className="group p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-200/80 hover:border-indigo-300 cursor-pointer transition-all space-y-2.5 relative"
                    >
                      {/* Top Info Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {att.exam_mode === 'real_exam' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                              <Clock size={11} />
                              <span>สอบจริง ({Math.round((att.time_limit_seconds || 10800) / 60)} น.)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                              <Lightbulb size={11} />
                              <span>ฝึกฝน</span>
                            </span>
                          )}

                          {isSingleTopic ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              <Layers size={11} className="flex-shrink-0" />
                              <span>หมวด: {topicName || 'รายหมวด'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                              <BookOpen size={11} className="flex-shrink-0" />
                              <span>รวมทั้งหมด</span>
                            </span>
                          )}

                          {att.is_random && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              <Shuffle size={10} />
                              <span>สุ่มโจทย์</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={(e) => handleStartEdit(att, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white transition-colors cursor-pointer"
                            title="เปลี่ยนชื่อประวัตินี้"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteAttempt(att.id, e)}
                            disabled={deletingAttemptId === att.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="ลบประวัตินี้"
                          >
                            {deletingAttemptId === att.id ? (
                              <Loader2 size={14} className="animate-spin text-rose-500" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-full ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isDone ? (att.total_score != null ? `${Number(att.total_score)} ข้อ` : 'ตรวจแล้ว') : 'ทำต่อ'}
                          </span>
                        </div>
                      </div>

                      {/* Title or Inline Edit Input */}
                      {isEditing ? (
                        <form
                          onSubmit={(e) => handleSaveTitle(att.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 pt-1"
                        >
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            placeholder="ระบุชื่อประวัตินี้..."
                            autoFocus
                            className="flex-1 text-sm px-3 py-2 rounded-xl border border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
                          />
                          <button
                            type="submit"
                            disabled={savingTitle}
                            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 cursor-pointer"
                            title="บันทึกชื่อ"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                            title="ยกเลิก"
                          >
                            <X size={15} />
                          </button>
                        </form>
                      ) : (
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {displayName}
                          </h4>
                          {att.custom_title && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {isSingleTopic ? `หมวดวิชา: ${topicName}` : 'ทำข้อสอบรวมทั้งหมด'}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Bottom Date and Action */}
                      <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-3">
                          <span>
                            {new Date(att.started_at).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {att.time_spent_seconds > 0 && (
                            <span className="flex items-center gap-1 text-slate-500 font-medium">
                              <Clock size={11} />
                              <span>{Math.floor(att.time_spent_seconds / 60)} น. {att.time_spent_seconds % 60} ว.</span>
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-indigo-600 font-semibold group-hover:translate-x-1 transition-transform">
                          {isDone ? 'ดูผลวิเคราะห์' : 'เข้าทำต่อ'}
                          <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
              {recentAttempts.length > 0 ? (
                <button
                  onClick={handleClearAllHistory}
                  disabled={isClearingAll}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer transition-colors"
                  title="ลบประวัติการสอบทั้งหมด"
                >
                  {isClearingAll ? <Loader2 size={13} className="animate-spin text-rose-600" /> : <Trash2 size={13} />}
                  <span>ลบประวัติทั้งหมด</span>
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => {
                  setShowHistoryModal(false)
                  setEditingAttemptId(null)
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm cursor-pointer transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
