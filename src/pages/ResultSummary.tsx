import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCcw, 
  ArrowLeft, 
  TrendingDown, 
  TrendingUp, 
  Target, 
  Layers, 
  Loader2,
  Sparkles,
  Pencil,
  Check,
  X,
  BookOpen
} from 'lucide-react'

type TopicStat = {
  name: string
  total: number
  correct: number
}

export default function ResultSummary() {
  const { attemptId } = useParams()
  const [searchParams] = useSearchParams()
  const topicIdParam = searchParams.get('topicId')
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [examTitle, setExamTitle] = useState('')
  const [examId, setExamId] = useState<number | null>(null)
  const [activeTopicId, setActiveTopicId] = useState<number | null>(topicIdParam ? Number(topicIdParam) : null)
  const [singleTopicName, setSingleTopicName] = useState<string | null>(null)
  const [score, setScore] = useState({ total: 0, correct: 0, wrong: 0 })
  const [timeSpent, setTimeSpent] = useState<number>(0)
  const [topicStats, setTopicStats] = useState<TopicStat[]>([])
  const [retaking, setRetaking] = useState(false)

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)

  useEffect(() => {
    async function fetchResult() {
      if (!attemptId) return

      try {
        const { data: attempt, error } = await supabase
          .from('exam_attempts')
          .select(`
            id, exam_id, topic_id, custom_title, time_spent_seconds, started_at, finished_at,
            exams (id, title, passing_score),
            topics (id, name),
            exam_attempt_answers (
              is_correct,
              questions (topic_id, topics (name))
            )
          `)
          .eq('id', attemptId)
          .single()

        if (error || !attempt) throw error

        const examData = attempt.exams as any
        setExamId(examData?.id || null)

        // Time spent
        let seconds = attempt.time_spent_seconds || 0
        if (!seconds && attempt.started_at && attempt.finished_at) {
          seconds = Math.round(
            (new Date(attempt.finished_at).getTime() - new Date(attempt.started_at).getTime()) / 1000
          )
        }
        setTimeSpent(seconds)

        // Process answers & topic stats
        const answers = (attempt.exam_attempt_answers as any[]) || []
        let correctCount = 0
        const tStats: Record<string, TopicStat> = {}
        let detectedTopicId: number | null = null

        answers.forEach((ans) => {
          if (ans.is_correct) correctCount++

          const topicName = ans.questions?.topics?.name || 'ความรู้ทั่วไป'
          if (ans.questions?.topic_id) {
            detectedTopicId = ans.questions.topic_id
          }

          if (!tStats[topicName]) {
            tStats[topicName] = { name: topicName, total: 0, correct: 0 }
          }
          tStats[topicName].total++
          if (ans.is_correct) tStats[topicName].correct++
        })

        const resolvedTopicId = attempt.topic_id || (topicIdParam ? Number(topicIdParam) : (Object.keys(tStats).length === 1 ? detectedTopicId : null))
        setActiveTopicId(resolvedTopicId)

        const topicName = (attempt.topics as any)?.name || (resolvedTopicId && Object.keys(tStats).length === 1 ? Object.keys(tStats)[0] : null)
        setSingleTopicName(topicName)

        if (attempt.custom_title) {
          setExamTitle(attempt.custom_title)
        } else if (topicName) {
          setExamTitle(`หมวด: ${topicName}`)
        } else {
          setExamTitle(examData?.title || 'ข้อสอบรวมทั้งหมด (1,050 ข้อ)')
        }

        setScore({
          total: answers.length,
          correct: correctCount,
          wrong: answers.length - correctCount,
        })

        // Sort by lowest accuracy percentage first (Highlight weaknesses)
        const sortedTopics = Object.values(tStats).sort((a, b) => {
          const aPct = a.total > 0 ? a.correct / a.total : 0
          const bPct = b.total > 0 ? b.correct / b.total : 0
          return aPct - bPct
        })

        setTopicStats(sortedTopics)
      } catch (err) {
        console.error('Error loading result summary:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchResult()
  }, [attemptId, topicIdParam])

  const handleRetake = async () => {
    if (!examId) return
    try {
      setRetaking(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const insertData: any = {
        exam_id: examId,
        user_id: user.id,
        status: 'in_progress',
      }
      if (activeTopicId) {
        insertData.topic_id = activeTopicId
      }

      const { data: newAttempt, error } = await supabase
        .from('exam_attempts')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error
      const targetUrl = activeTopicId
        ? `/exam/${examId}?attemptId=${newAttempt.id}&topicId=${activeTopicId}`
        : `/exam/${examId}?attemptId=${newAttempt.id}`

      navigate(targetUrl)
    } catch (err: any) {
      alert('ไม่สามารถเริ่มรอบใหม่ได้: ' + err.message)
      setRetaking(false)
    }
  }

  const handleSaveResultTitle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!attemptId || savingTitle) return

    try {
      setSavingTitle(true)
      const cleanTitle = titleInput.trim()
      const { error } = await supabase
        .from('exam_attempts')
        .update({ custom_title: cleanTitle || null })
        .eq('id', attemptId)

      if (error) {
        alert('ไม่สามารถบันทึกชื่อได้: ' + error.message)
        return
      }

      setExamTitle(cleanTitle || (singleTopicName ? `หมวด: ${singleTopicName}` : 'ข้อสอบรวมทั้งหมด'))
      setIsEditingTitle(false)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSavingTitle(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
        <p className="text-sm font-medium">กำลังคำนวณผลคะแนนและวิเคราะห์จุดอ่อน...</p>
      </div>
    )
  }

  const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
  const isPassed = percentage >= 60

  const formatMinutes = (sec: number) => {
    const mins = Math.floor(sec / 60)
    const rem = sec % 60
    if (mins === 0) return `${rem} วินาที`
    return `${mins} นาที ${rem} วินาที`
  }

  return (
    <div className="min-h-screen bg-slate-100/70 py-8 px-4 sm:px-6 lg:px-8 flex justify-center items-start">
      <div className="max-w-3xl w-full space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/select"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>กลับสู่หน้าเลือกวิชา</span>
          </Link>
          <span className="text-xs text-slate-400">รหัสรอบสอบ: #{attemptId}</span>
        </div>

        {/* Hero Score Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-100/50 to-blue-50/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
              <Trophy size={32} />
            </div>

            <div className="space-y-2 max-w-xl w-full">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700">
                  <Sparkles size={13} />
                  สรุปผลการประเมิน
                </span>
                {singleTopicName ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Layers size={13} />
                    หมวด: {singleTopicName}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    <BookOpen size={13} />
                    ทำข้อสอบรวมทั้งหมด (1,050 ข้อ)
                  </span>
                )}
              </div>

              {isEditingTitle ? (
                <form onSubmit={handleSaveResultTitle} className="flex items-center justify-center gap-2 max-w-md mx-auto pt-2">
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="ระบุชื่อรอบสอบนี้..."
                    autoFocus
                    className="flex-1 text-sm px-3 py-2 rounded-xl border border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={savingTitle}
                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 cursor-pointer"
                    title="บันทึกชื่อ"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(false)}
                    className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                    title="ยกเลิก"
                  >
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {examTitle}
                  </h1>
                  <button
                    onClick={() => {
                      setTitleInput(examTitle)
                      setIsEditingTitle(true)
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                    title="เปลี่ยนชื่อรอบสอบนี้"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Score Big Display */}
            <div className="py-4">
              <div className="text-6xl sm:text-7xl font-black text-slate-900 tracking-tight">
                {score.correct}
                <span className="text-2xl sm:text-3xl font-medium text-slate-400">/{score.total}</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    isPassed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {isPassed ? '✓ ผ่านเกณฑ์การสอบ (>= 60%)' : '✕ ยังไม่ผ่านเกณฑ์ (< 60%)'}
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  ความแม่นยำ {percentage}%
                </span>
              </div>
            </div>

            {/* Stats Overview Grid */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-left">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>ตอบถูก</span>
                </div>
                <div className="text-lg font-bold text-slate-900">{score.correct} ข้อ</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <XCircle size={14} className="text-rose-500" />
                  <span>ตอบผิด</span>
                </div>
                <div className="text-lg font-bold text-slate-900">{score.wrong} ข้อ</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Target size={14} className="text-indigo-500" />
                  <span>คิดเป็น</span>
                </div>
                <div className="text-lg font-bold text-slate-900">{percentage}%</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Clock size={14} className="text-amber-500" />
                  <span>เวลาที่ใช้</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 pt-1">
                  {timeSpent > 0 ? formatMinutes(timeSpent) : 'ไม่ระบุ'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Weakness & Category Breakdown Card */}
        {topicStats.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Layers size={19} className="text-indigo-600" />
                  <span>วิเคราะห์จุดอ่อนรายหมวดวิชา</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เรียงลำดับจากหมวดที่ทำคะแนนได้น้อยที่สุดขึ้นก่อน เพื่อให้เห็นจุดที่ควรเน้นทบทวน
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                {topicStats.length} หมวด
              </span>
            </div>

            <div className="space-y-4">
              {topicStats.map((stat, idx) => {
                const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
                let barColor = 'bg-emerald-500'
                let badge = (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <TrendingUp size={12} /> จุดแข็ง
                  </span>
                )

                if (pct < 50) {
                  barColor = 'bg-rose-500'
                  badge = (
                    <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <TrendingDown size={12} /> ควรทบทวน
                    </span>
                  )
                } else if (pct < 75) {
                  barColor = 'bg-amber-500'
                  badge = (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      ปานกลาง
                    </span>
                  )
                }

                return (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="font-semibold text-xs sm:text-sm text-slate-800">
                        {stat.name}
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {badge}
                        <span className="text-xs font-bold text-slate-600">
                          {stat.correct}/{stat.total} ({pct}%)
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/select"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm text-center shadow-sm transition-all"
          >
            เลือกชุดข้อสอบอื่น
          </Link>
          <button
            onClick={handleRetake}
            disabled={retaking}
            className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all"
          >
            {retaking ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <RotateCcw size={16} />
                <span>ทำชุดนี้ใหม่อีกครั้ง</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
