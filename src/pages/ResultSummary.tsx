import { useEffect, useState, useMemo } from 'react'
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
  BookOpen,
  Zap,
  Gauge,
  Timer,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  CheckCircle,
  Shuffle,
  Trash2
} from 'lucide-react'
import { cleanThaiText } from '../lib/formatThaiText'
import { useAlert } from '../components/AlertProvider'

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const result = [...array]
  let currentSeed = seed
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(currentSeed++) * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

type TopicStat = {
  name: string
  total: number
  correct: number
  totalTimeSpent: number
}

type QuestionReviewItem = {
  id: number
  questionId: number
  orderIndex: number
  questionText: string
  explanation: string
  topicName: string
  selectedChoiceId: number | null
  isCorrect: boolean
  timeSpentSeconds: number
  choices: {
    id: number
    choice_text: string
    is_correct: boolean
    order_index: number
  }[]
}

export default function ResultSummary() {
  const { toast, confirm } = useAlert()
  const { attemptId } = useParams()
  const [searchParams] = useSearchParams()
  const topicIdParam = searchParams.get('topicId')
  const isTimeUp = searchParams.get('timeup') === '1'
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [examTitle, setExamTitle] = useState('')
  const [examQuestionCount, setExamQuestionCount] = useState(1110)
  const [examId, setExamId] = useState<number | null>(null)
  const [examMode, setExamMode] = useState<'real_exam' | 'practice'>('practice')
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(10800)
  const [isRandom, setIsRandom] = useState<boolean>(false)
  const [activeTopicId, setActiveTopicId] = useState<number | null>(topicIdParam ? Number(topicIdParam) : null)
  const [singleTopicName, setSingleTopicName] = useState<string | null>(null)
  const [score, setScore] = useState({ total: 0, correct: 0, wrong: 0 })
  const [timeSpent, setTimeSpent] = useState<number>(0)
  const [topicStats, setTopicStats] = useState<TopicStat[]>([])
  const [questionReviews, setQuestionReviews] = useState<QuestionReviewItem[]>([])
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong' | 'correct'>('all')
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null)
  const [retaking, setRetaking] = useState(false)
  const [deletingAttempt, setDeletingAttempt] = useState(false)

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
            id, exam_id, topic_id, custom_title, exam_mode, time_limit_seconds, time_spent_seconds, is_random, started_at, finished_at,
            exams (id, title, passing_score, total_questions),
            topics (id, name)
          `)
          .eq('id', attemptId)
          .single()

        if (error || !attempt) throw error

        // Chunked pagination for all answers to exceed PostgREST limit (pageSize=500)
        let allAnswers: any[] = []
        let aFrom = 0
        const pageSize = 500
        let aHasMore = true

        while (aHasMore) {
          const { data: aChunk, error: aError } = await supabase
            .from('exam_attempt_answers')
            .select(`
              id,
              question_id,
              selected_choice_id,
              is_correct,
              time_spent_seconds,
              questions (
                id,
                question_text,
                explanation,
                order_index,
                topic_id,
                topics (name),
                choices (id, choice_text, is_correct, order_index)
              )
            `)
            .eq('attempt_id', attemptId)
            .order('id', { ascending: true })
            .range(aFrom, aFrom + pageSize - 1)

          if (aError) throw aError

          if (aChunk && aChunk.length > 0) {
            allAnswers = allAnswers.concat(aChunk)
            if (aChunk.length < pageSize) {
              aHasMore = false
            } else {
              aFrom += pageSize
            }
          } else {
            aHasMore = false
          }
        }

        const examData = attempt.exams as any
        if (examData?.total_questions) setExamQuestionCount(examData.total_questions)
        setExamId(examData?.id || null)

        const mode = (attempt.exam_mode as 'real_exam' | 'practice') || 'practice'
        setExamMode(mode)
        setTimeLimitSeconds(attempt.time_limit_seconds || 10800)

        const randomFlag = attempt.is_random ?? (searchParams.get('random') === '1')
        setIsRandom(randomFlag)

        // Time spent
        let seconds = attempt.time_spent_seconds || 0
        if (!seconds && attempt.started_at && attempt.finished_at) {
          seconds = Math.round(
            (new Date(attempt.finished_at).getTime() - new Date(attempt.started_at).getTime()) / 1000
          )
        }
        setTimeSpent(seconds)

        // Process answers & topic stats
        const answers = allAnswers
        let correctCount = 0
        const tStats: Record<string, TopicStat> = {}
        let detectedTopicId: number | null = null
        let reviews: QuestionReviewItem[] = []

        answers.forEach((ans) => {
          if (ans.is_correct) correctCount++

          const q = ans.questions || {}
          const topicName = q.topics?.name || 'ความรู้ทั่วไป'
          if (q.topic_id) {
            detectedTopicId = q.topic_id
          }

          const qTime = ans.time_spent_seconds || 0
          if (!tStats[topicName]) {
            tStats[topicName] = { name: topicName, total: 0, correct: 0, totalTimeSpent: 0 }
          }
          tStats[topicName].total++
          tStats[topicName].totalTimeSpent += qTime
          if (ans.is_correct) tStats[topicName].correct++

          const formattedChoices = (q.choices || [])
            .map((c: any) => ({
              ...c,
              choice_text: cleanThaiText(c.choice_text),
            }))
            .sort((a: any, b: any) => a.order_index - b.order_index)

          reviews.push({
            id: ans.id,
            questionId: ans.question_id,
            orderIndex: q.order_index || 0,
            questionText: cleanThaiText(q.question_text),
            explanation: cleanThaiText(q.explanation),
            topicName,
            selectedChoiceId: ans.selected_choice_id,
            isCorrect: !!ans.is_correct,
            timeSpentSeconds: qTime,
            choices: formattedChoices,
          })
        })

        // If randomized in exam, recreate the exact shuffled order using attemptId seed
        if (randomFlag && attemptId) {
          const baseSeed = Number(attemptId) || 12345
          reviews = shuffleWithSeed(reviews, baseSeed)
          reviews = reviews.map((r, rIdx) => {
            const choiceSeed = baseSeed + r.questionId * 31 + rIdx * 17
            return {
              ...r,
              choices: shuffleWithSeed(r.choices, choiceSeed),
            }
          })
        } else {
          // Natural order
          reviews.sort((a, b) => a.orderIndex - b.orderIndex)
        }
        setQuestionReviews(reviews)

        const resolvedTopicId = attempt.topic_id || (topicIdParam ? Number(topicIdParam) : (Object.keys(tStats).length === 1 ? detectedTopicId : null))
        setActiveTopicId(resolvedTopicId)

        const topicName = (attempt.topics as any)?.name || (resolvedTopicId && Object.keys(tStats).length === 1 ? Object.keys(tStats)[0] : null)
        setSingleTopicName(topicName)

        if (attempt.custom_title) {
          setExamTitle(attempt.custom_title)
        } else if (topicName) {
          setExamTitle(`หมวด: ${topicName}`)
        } else {
          setExamTitle(examData?.title || 'ข้อสอบรวมทั้งหมด')
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
        exam_mode: examMode,
        time_limit_seconds: examMode === 'real_exam' ? timeLimitSeconds : null,
        is_random: isRandom,
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

      const queryParams = new URLSearchParams()
      queryParams.set('attemptId', String(newAttempt.id))
      if (activeTopicId) queryParams.set('topicId', String(activeTopicId))
      queryParams.set('mode', examMode)
      if (isRandom) queryParams.set('random', '1')

      navigate(`/exam/${examId}?${queryParams.toString()}`)
    } catch (err: any) {
      toast.error(err.message, 'ไม่สามารถเริ่มรอบใหม่ได้')
      setRetaking(false)
    }
  }

  const handleDeleteAttempt = async () => {
    if (!attemptId) return
    const ok = await confirm({
      title: 'ยืนยันการลบผลการสอบ',
      message: 'คุณต้องการลบประวัติการสอบรอบนี้ใช่หรือไม่?\nข้อมูลผลคะแนน คำตอบ และสถิติทั้งหมดในรอบนี้จะถูกลบถาวร',
      confirmText: 'ลบประวัตินี้',
      cancelText: 'ยกเลิก',
      type: 'danger',
    })
    if (!ok) return

    try {
      setDeletingAttempt(true)
      const { error } = await supabase
        .from('exam_attempts')
        .delete()
        .eq('id', attemptId)

      if (error) throw error

      toast.success('ลบประวัติการสอบรอบนี้เรียบร้อยแล้ว')
      navigate('/select')
    } catch (err: any) {
      toast.error(err.message, 'ไม่สามารถลบประวัติได้')
      setDeletingAttempt(false)
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
        toast.error(error.message, 'ไม่สามารถบันทึกชื่อได้')
        return
      }

      setExamTitle(cleanTitle || (singleTopicName ? `หมวด: ${singleTopicName}` : 'ข้อสอบรวมทั้งหมด'))
      setIsEditingTitle(false)
      toast.success('บันทึกชื่อรอบสอบนี้เรียบร้อยแล้ว')
    } catch (err: any) {
      toast.error(err.message, 'เกิดข้อผิดพลาด')
    } finally {
      setSavingTitle(false)
    }
  }

  // Duration formatting helpers
  const formatSeconds = (sec: number) => {
    if (sec <= 0) return 'ไม่ระบุ'
    const m = Math.floor(sec / 60)
    const s = sec % 60
    if (m === 0) return `${s} วินาที`
    return `${m} นาที ${s} วินาที`
  }

  const formatTotalTime = (sec: number) => {
    if (sec <= 0) return 'ไม่ระบุ'
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) {
      return `${h} ชม. ${m} นาที ${s} ว.`
    }
    return `${m} นาที ${s} วินาที`
  }

  // Speed and Pacing calculations
  const avgSecondsPerQuestion = useMemo(() => {
    return score.total > 0 && timeSpent > 0 ? Math.round(timeSpent / score.total) : 0
  }, [score.total, timeSpent])

  const paceStatus = useMemo(() => {
    if (avgSecondsPerQuestion <= 0) {
      return { text: 'ไม่ระบุ', badge: 'bg-slate-100 text-slate-700', icon: '⏱️' }
    }
    if (avgSecondsPerQuestion < 45) {
      return { text: 'ความเร็วสูงมาก (< 45 ว./ข้อ)', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '⚡' }
    }
    if (avgSecondsPerQuestion <= 90) {
      return { text: 'จังหวะมาตรฐาน (45-90 ว./ข้อ)', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: '🎯' }
    }
    return { text: 'ควรเร่งความเร็ว (> 90 ว./ข้อ)', badge: 'bg-amber-100 text-amber-800 border-amber-200', icon: '🐢' }
  }, [avgSecondsPerQuestion])

  // Top Slowest Questions (sorted by time_spent_seconds descending)
  const slowestQuestions = useMemo(() => {
    return [...questionReviews]
      .filter((q) => q.timeSpentSeconds > 0)
      .sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)
      .slice(0, 5)
  }, [questionReviews])

  // Top Fastest Questions (sorted by time_spent_seconds ascending)
  const fastestQuestions = useMemo(() => {
    return [...questionReviews]
      .filter((q) => q.timeSpentSeconds > 0)
      .sort((a, b) => a.timeSpentSeconds - b.timeSpentSeconds)
      .slice(0, 5)
  }, [questionReviews])

  // Filtered reviews list
  const filteredReviews = useMemo(() => {
    if (reviewFilter === 'wrong') return questionReviews.filter((q) => !q.isCorrect)
    if (reviewFilter === 'correct') return questionReviews.filter((q) => q.isCorrect)
    return questionReviews
  }, [questionReviews, reviewFilter])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
        <p className="text-sm font-medium">กำลังคำนวณผลคะแนนและวิเคราะห์จุดอ่อนความเร็ว...</p>
      </div>
    )
  }

  const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
  const isPassed = percentage >= 60

  return (
    <div className="min-h-screen bg-slate-100/70 py-4 sm:py-8 px-3 sm:px-6 lg:px-8 flex justify-center items-start">
      <div className="max-w-4xl w-full space-y-4 sm:space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/select"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>กลับสู่หน้าเลือกวิชา</span>
          </Link>
          <span className="text-[11px] sm:text-xs text-slate-400">รหัสรอบสอบ: #{attemptId}</span>
        </div>

        {/* Timeout Banner Notification */}
        {isTimeUp && (
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 flex items-start gap-3.5 shadow-sm animate-in fade-in duration-300">
            <div className="p-2 rounded-xl bg-amber-500 text-white flex-shrink-0 mt-0.5">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-amber-950">
                หมดเวลาสอบจริงครบ {Math.round(timeLimitSeconds / 60)} นาทีแล้ว!
              </h3>
              <p className="text-xs sm:text-sm text-amber-900 mt-0.5 leading-relaxed">
                ระบบได้ทำการบันทึกและส่งข้อสอบของคุณโดยอัตโนมัติ พร้อมประมวลผลคะแนนและวิเคราะห์ความเร็วใน Dashboard ด้านล่างนี้
              </p>
            </div>
          </div>
        )}

        {/* Hero Score Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 border border-slate-200/90 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-100/50 to-blue-50/20 rounded-full blur-3xl pointer-events-none animate-blob"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-emerald-100/40 to-teal-50/20 rounded-full blur-3xl pointer-events-none animate-blob-delayed"></div>

          <div className="relative z-10 flex flex-col items-center text-center space-y-3 sm:space-y-4">
            <div className={`w-14 sm:w-16 h-14 sm:h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner ${isPassed ? 'animate-trophy' : ''}`}>
              <Trophy size={32} />
            </div>

            <div className="space-y-2 max-w-xl w-full">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {/* Mode Pill */}
                {examMode === 'real_exam' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                    <Clock size={13} />
                    <span>สอบจริง ({Math.round(timeLimitSeconds / 60)} นาที)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    <Sparkles size={13} />
                    <span>ฝึกฝนปกติ</span>
                  </span>
                )}

                {isRandom && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                    <Shuffle size={13} />
                    <span>สุ่มโจทย์และตัวเลือก</span>
                  </span>
                )}

                {singleTopicName ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Layers size={13} />
                    หมวด: {singleTopicName}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    <BookOpen size={13} />
                    ข้อสอบรวมทั้งหมด ({examQuestionCount.toLocaleString('th-TH')} ข้อ)
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
                  <span>เวลาที่ใช้ทั้งหมด</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 pt-1">
                  {formatTotalTime(timeSpent)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 1. SPEED & PACING ANALYSIS DASHBOARD */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Gauge size={20} className="text-indigo-600" />
                <span>Dashboard วิเคราะห์ความเร็วและจังหวะการทำข้อสอบ</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ประเมินความเร็วเฉลี่ย อัตราความเร็ว และประสิทธิภาพการบริหารเวลาในแต่ละข้อ
              </p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-xl border flex items-center gap-1.5 w-fit ${paceStatus.badge}`}>
              <span>{paceStatus.icon}</span>
              <span>{paceStatus.text}</span>
            </span>
          </div>

          {/* Speed Metrics 4 Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <Zap size={14} className="text-amber-500" />
                <span>เวลาเฉลี่ยต่อข้อ</span>
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                {avgSecondsPerQuestion > 0 ? `${avgSecondsPerQuestion} ว.` : '0 ว.'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">วินาทีต่อหนึ่งคำถาม</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <Clock size={14} className="text-indigo-500" />
                <span>เวลาที่ใช้จริง</span>
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 truncate">
                {formatTotalTime(timeSpent)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {examMode === 'real_exam' ? `กำหนดไว้ ${Math.round(timeLimitSeconds / 60)} นาที` : 'ไม่มีหมดเวลา'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <Target size={14} className="text-emerald-500" />
                <span>จำนวนข้อที่ตอบ</span>
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                {score.total} <span className="text-sm font-semibold text-slate-400">ข้อ</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                ถูก {score.correct} / ผิด {score.wrong}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <Timer size={14} className="text-purple-500" />
                <span>สปีดการทำ</span>
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                {timeSpent > 0 ? (score.total / (timeSpent / 60)).toFixed(1) : '0'} <span className="text-xs font-semibold text-slate-400">ข้อ/นาที</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">อัตราการตอบต่อนาที</p>
            </div>
          </div>

          {/* 2. DETAIL: SLOWEST VS FASTEST QUESTIONS */}
          {(slowestQuestions.length > 0 || fastestQuestions.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2">
              {/* Slowest Questions Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm sm:text-base text-rose-950 flex items-center gap-2">
                    <span className="text-base">🐢</span>
                    <span>ข้อที่ใช้เวลานานที่สุด (Top 5)</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                    ควรฝึกอ่านให้ไวขึ้น
                  </span>
                </div>

                <div className="space-y-2">
                  {slowestQuestions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      onClick={() => setExpandedQuestionId(expandedQuestionId === q.questionId ? null : q.questionId)}
                      className="p-3 rounded-xl bg-white border border-rose-200/70 hover:border-rose-400 cursor-pointer transition-all space-y-1.5 group shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {q.orderIndex + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-rose-700">
                            {q.questionText}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {q.isCorrect ? (
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">ถูก</span>
                          ) : (
                            <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">ผิด</span>
                          )}
                          <span className="text-xs font-bold text-rose-700 font-mono">
                            {formatSeconds(q.timeSpentSeconds)}
                          </span>
                        </div>
                      </div>

                      {expandedQuestionId === q.questionId && (
                        <div className="pt-2 text-xs text-slate-600 border-t border-slate-100 space-y-2 animate-in fade-in">
                          <p className="leading-relaxed whitespace-pre-line text-slate-800">{q.questionText}</p>
                          {q.explanation && (
                            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-950 font-medium border border-emerald-200">
                              <span className="font-bold text-emerald-900 block mb-0.5">เฉลย:</span>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Fastest Questions Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm sm:text-base text-emerald-950 flex items-center gap-2">
                    <span className="text-base">⚡</span>
                    <span>ข้อที่ทำได้ไวที่สุด (Top 5)</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    ตอบคล่องแคล่ว
                  </span>
                </div>

                <div className="space-y-2">
                  {fastestQuestions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      onClick={() => setExpandedQuestionId(expandedQuestionId === q.questionId ? null : q.questionId)}
                      className="p-3 rounded-xl bg-white border border-emerald-200/70 hover:border-emerald-400 cursor-pointer transition-all space-y-1.5 group shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {q.orderIndex + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-emerald-700">
                            {q.questionText}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {q.isCorrect ? (
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">ถูก</span>
                          ) : (
                            <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">ผิด</span>
                          )}
                          <span className="text-xs font-bold text-emerald-700 font-mono">
                            {formatSeconds(q.timeSpentSeconds)}
                          </span>
                        </div>
                      </div>

                      {expandedQuestionId === q.questionId && (
                        <div className="pt-2 text-xs text-slate-600 border-t border-slate-100 space-y-2 animate-in fade-in">
                          <p className="leading-relaxed whitespace-pre-line text-slate-800">{q.questionText}</p>
                          {q.explanation && (
                            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-950 font-medium border border-emerald-200">
                              <span className="font-bold text-emerald-900 block mb-0.5">เฉลย:</span>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. WEAKNESS & TOPIC BREAKDOWN CARD */}
        {topicStats.length > 0 && (
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Layers size={19} className="text-indigo-600" />
                  <span>วิเคราะห์จุดอ่อนและความเร็วรายหมวดวิชา</span>
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
                const topicAvgSec = stat.total > 0 && stat.totalTimeSpent > 0 ? Math.round(stat.totalTimeSpent / stat.total) : 0
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
                  <div key={idx} className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="font-semibold text-xs sm:text-sm text-slate-800">
                        {stat.name}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                        {topicAvgSec > 0 && (
                          <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                            <Clock size={11} className="text-slate-400" />
                            <span>เฉลี่ย {topicAvgSec} ว./ข้อ</span>
                          </span>
                        )}
                        {badge}
                        <span className="text-xs font-bold text-slate-700">
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

        {/* 4. FULL QUESTION-BY-QUESTION REVIEW */}
        {questionReviews.length > 0 && (
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle size={20} className="text-indigo-600" />
                  <span>ทบทวนข้อสอบและเฉลยละเอียดทุกข้อ</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  คลิกที่ข้อเพื่อดูตัวเลือก คำตอบที่คุณเลือก คำตอบที่ถูกต้อง พร้อมคำอธิบายสีเขียว
                </p>
              </div>

              {/* Review Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setReviewFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reviewFilter === 'all'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทั้งหมด ({questionReviews.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('wrong')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reviewFilter === 'wrong'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ตอบผิด ({score.wrong})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('correct')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reviewFilter === 'correct'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ตอบถูก ({score.correct})
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {filteredReviews.map((item, idx) => {
                const isExpanded = expandedQuestionId === item.questionId
                return (
                  <div
                    key={item.id}
                    className="border border-slate-200/90 rounded-2xl overflow-hidden transition-all duration-200 bg-white hover:border-indigo-300"
                  >
                    {/* Header Row */}
                    <button
                      type="button"
                      onClick={() => setExpandedQuestionId(isExpanded ? null : item.questionId)}
                      className="w-full text-left p-4 sm:p-4.5 flex items-center justify-between gap-3 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            item.isCorrect
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {idx + 1}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {item.topicName}
                            </span>
                            {item.timeSpentSeconds > 0 && (
                              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                                <Clock size={10} className="text-slate-400" />
                                <span>{formatSeconds(item.timeSpentSeconds)}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                            {item.questionText}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.isCorrect ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 hidden sm:inline-block">
                            ✓ ถูกต้อง
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 hidden sm:inline-block">
                            ✕ ตอบผิด
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp size={18} className="text-slate-400" />
                        ) : (
                          <ChevronDown size={18} className="text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Body */}
                    {isExpanded && (
                      <div className="p-4 sm:p-6 border-t border-slate-200/80 space-y-4 bg-white animate-in fade-in duration-200">
                        {/* Full Question Text */}
                        <div className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed whitespace-pre-line">
                          {item.questionText}
                        </div>

                        {/* Choices */}
                        <div className="space-y-2">
                          {item.choices.map((choice, cIdx) => {
                            const isUserChoice = item.selectedChoiceId === choice.id
                            let choiceStyle = 'bg-slate-50/70 border-slate-200 text-slate-700'
                            let badgeStyle = 'bg-slate-100 text-slate-600 border-slate-200'

                            if (choice.is_correct) {
                              choiceStyle = 'bg-emerald-50/90 border-emerald-500 text-emerald-950 font-medium'
                              badgeStyle = 'bg-emerald-500 text-white border-emerald-600'
                            } else if (isUserChoice && !choice.is_correct) {
                              choiceStyle = 'bg-rose-50/90 border-rose-500 text-rose-950'
                              badgeStyle = 'bg-rose-500 text-white border-rose-600'
                            }

                            return (
                              <div
                                key={choice.id}
                                className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs sm:text-sm ${choiceStyle}`}
                              >
                                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold border flex-shrink-0 mt-0.5 ${badgeStyle}`}>
                                    {['ก', 'ข', 'ค', 'ง'][cIdx] || (cIdx + 1)}
                                  </span>
                                  <span className="leading-relaxed pt-0.5 break-words flex-1">
                                    {choice.choice_text.replace(/^[ก-ง]\.\s*/, '')}
                                  </span>
                                </div>
                                {isUserChoice && (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 flex-shrink-0">
                                    คุณเลือกข้อนี้
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Explanation Box */}
                        {item.explanation && (
                          <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-emerald-950 space-y-1.5 shadow-sm shadow-emerald-500/5">
                            <div className="flex items-center gap-2 font-bold text-emerald-900 text-xs sm:text-sm">
                              <Lightbulb size={16} className="text-emerald-600 flex-shrink-0" />
                              <span>คำอธิบายและเฉลยข้อสอบ:</span>
                            </div>
                            <p className="text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed sm:leading-loose whitespace-pre-line pl-5 break-words">
                              {item.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
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
            disabled={retaking || deletingAttempt}
            className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
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
          <button
            onClick={handleDeleteAttempt}
            disabled={deletingAttempt || retaking}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            title="ลบผลการสอบรอบนี้ออกจากประวัติ"
          >
            {deletingAttempt ? (
              <Loader2 size={16} className="animate-spin text-rose-600" />
            ) : (
              <>
                <Trash2 size={16} />
                <span>ลบประวัติรอบนี้</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
