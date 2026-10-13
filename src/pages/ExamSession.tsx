import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Lightbulb, 
  Send, 
  Grid3X3, 
  X, 
  Layers, 
  Loader2,
  AlertCircle,
  Clock,
  Shuffle
} from 'lucide-react'
import { cleanThaiText } from '../lib/formatThaiText'

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

type Choice = {
  id: number
  choice_text: string
  is_correct: boolean
  order_index: number
}

type Question = {
  id: number
  question_text: string
  explanation: string
  order_index: number
  topic_id?: number
  topics?: {
    name: string
  }
  choices: Choice[]
}

type AnswerState = {
  selectedChoiceId: number | null
  isCorrect: boolean | null
}

export default function ExamSession() {
  const { examId } = useParams()
  const [searchParams] = useSearchParams()
  const attemptId = searchParams.get('attemptId')
  const topicId = searchParams.get('topicId')
  const navigate = useNavigate()

  const [examTitle, setExamTitle] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({})
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Exam Mode and Timer States
  const [examMode, setExamMode] = useState<'real_exam' | 'practice'>('practice')
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(10800) // Default 3 hours (10,800s)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(10800)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [isTimeUpModal, setIsTimeUpModal] = useState<boolean>(false)
  const [isRandom, setIsRandom] = useState<boolean>(false)

  // Tracking per-question time refs
  const questionStartTimeRef = useRef<number>(Date.now())
  const questionTimesRef = useRef<Record<number, number>>({})
  const answerRecordIdsRef = useRef<Record<number, number>>({})

  useEffect(() => {
    async function fetchQuestions() {
      if (!examId || !attemptId) return

      try {
        // 0. Fetch Attempt details
        const { data: attemptData } = await supabase
          .from('exam_attempts')
          .select('id, exam_mode, time_limit_seconds, is_random, started_at, status')
          .eq('id', attemptId)
          .single()

        if (attemptData) {
          if (attemptData.status === 'completed') {
            const redirectUrl = topicId ? `/result/${attemptId}?topicId=${topicId}` : `/result/${attemptId}`
            navigate(redirectUrl)
            return
          }

          const mode = (attemptData.exam_mode as 'real_exam' | 'practice') || 'practice'
          setExamMode(mode)
          const limit = attemptData.time_limit_seconds || 10800
          setTimeLimitSeconds(limit)

          const randomFlag = attemptData.is_random ?? (searchParams.get('random') === '1')
          setIsRandom(randomFlag)

          const startedMs = attemptData.started_at ? new Date(attemptData.started_at).getTime() : Date.now()
          const currentElapsed = Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
          setElapsedSeconds(currentElapsed)
          setRemainingSeconds(Math.max(0, limit - currentElapsed))
        }

        // 1. Fetch Exam info and optional Topic info
        const { data: examData } = await supabase
          .from('exams')
          .select('title')
          .eq('id', examId)
          .single()

        let currentTopicName = ''
        if (topicId) {
          const { data: topicData } = await supabase
            .from('topics')
            .select('name')
            .eq('id', topicId)
            .single()
          if (topicData) {
            currentTopicName = topicData.name
          }
        }

        if (currentTopicName) {
          setExamTitle(currentTopicName)
        } else if (examData) {
          setExamTitle(examData.title)
        }

        // 2. Fetch questions with choices and topic name
        let query = supabase
          .from('questions')
          .select(`
            id, question_text, explanation, order_index, topic_id,
            topics (name),
            choices (id, choice_text, is_correct, order_index)
          `)
          .eq('exam_id', examId)

        if (topicId) {
          query = query.eq('topic_id', topicId)
        }

        const { data: qData, error: qError } = await query.order('order_index', { ascending: true })

        if (qError) throw qError

        let formattedQuestions = qData?.map((q: any) => ({
          ...q,
          question_text: cleanThaiText(q.question_text),
          explanation: cleanThaiText(q.explanation),
          choices: (q.choices || [])
            .map((c: any) => ({
              ...c,
              choice_text: cleanThaiText(c.choice_text),
            }))
            .sort((a: any, b: any) => a.order_index - b.order_index),
        })) || []

        const shouldRandomize = attemptData?.is_random ?? (searchParams.get('random') === '1')
        if (shouldRandomize && attemptId) {
          const baseSeed = Number(attemptId) || 12345
          // 1. Shuffle questions
          formattedQuestions = shuffleWithSeed(formattedQuestions, baseSeed)

          // 2. Shuffle choices within each question
          formattedQuestions = formattedQuestions.map((q: any, qIdx: number) => {
            const choiceSeed = baseSeed + q.id * 31 + qIdx * 17
            return {
              ...q,
              choices: shuffleWithSeed(q.choices, choiceSeed),
            }
          })
        }

        setQuestions(formattedQuestions)

        // 3. Fetch existing answers and question time tracking
        const { data: aData } = await supabase
          .from('exam_attempt_answers')
          .select('*')
          .eq('attempt_id', attemptId)

        if (aData) {
          const existingAnswers: Record<number, AnswerState> = {}
          const existingTimes: Record<number, number> = {}
          const recordIds: Record<number, number> = {}

          aData.forEach((ans) => {
            existingAnswers[ans.question_id] = {
              selectedChoiceId: ans.selected_choice_id,
              isCorrect: ans.is_correct,
            }
            recordIds[ans.question_id] = ans.id
            if (ans.time_spent_seconds) {
              existingTimes[ans.question_id] = ans.time_spent_seconds
            }
          })
          setAnswers(existingAnswers)
          answerRecordIdsRef.current = recordIds
          questionTimesRef.current = existingTimes
        }

        questionStartTimeRef.current = Date.now()
      } catch (err) {
        console.error('Error fetching exam session data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchQuestions()
  }, [examId, attemptId, topicId, navigate])

  // Timer Tick Interval
  useEffect(() => {
    if (loading || submitting || isTimeUpModal) return

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)

      if (examMode === 'real_exam') {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            handleAutoSubmit()
            return 0
          }
          return prev - 1
        })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [loading, submitting, isTimeUpModal, examMode])

  // Helper to accumulate time on current question
  const flushCurrentQuestionTime = () => {
    const currentQ = questions[currentIndex]
    if (!currentQ) return
    const now = Date.now()
    const deltaSec = Math.max(1, Math.round((now - questionStartTimeRef.current) / 1000))
    questionStartTimeRef.current = now
    const totalQTime = (questionTimesRef.current[currentQ.id] || 0) + deltaSec
    questionTimesRef.current[currentQ.id] = totalQTime

    // Sync to database if row exists
    const recordId = answerRecordIdsRef.current[currentQ.id]
    if (recordId) {
      supabase
        .from('exam_attempt_answers')
        .update({ time_spent_seconds: totalQTime })
        .eq('id', recordId)
        .then()
    }
  }

  const handleNavigateQuestion = (newIndex: number) => {
    flushCurrentQuestionTime()
    setCurrentIndex(newIndex)
  }

  const handleSelectAnswer = async (choiceId: number, isCorrect: boolean) => {
    const currentQ = questions[currentIndex]
    if (!currentQ) return

    // In practice mode, lock answer once selected (instant review)
    if (examMode === 'practice' && answers[currentQ.id]?.selectedChoiceId) return

    // Accumulate question time
    const now = Date.now()
    const deltaSec = Math.max(1, Math.round((now - questionStartTimeRef.current) / 1000))
    questionStartTimeRef.current = now
    const totalQTime = (questionTimesRef.current[currentQ.id] || 0) + deltaSec
    questionTimesRef.current[currentQ.id] = totalQTime

    const newAnswerState = { selectedChoiceId: choiceId, isCorrect }
    setAnswers((prev) => ({ ...prev, [currentQ.id]: newAnswerState }))

    try {
      const existingRecordId = answerRecordIdsRef.current[currentQ.id]
      if (existingRecordId) {
        // Update existing answer
        await supabase
          .from('exam_attempt_answers')
          .update({
            selected_choice_id: choiceId,
            is_correct: isCorrect,
            time_spent_seconds: totalQTime,
          })
          .eq('id', existingRecordId)
      } else {
        // Insert new answer
        const { data: inserted } = await supabase
          .from('exam_attempt_answers')
          .insert({
            attempt_id: Number(attemptId),
            question_id: currentQ.id,
            selected_choice_id: choiceId,
            is_correct: isCorrect,
            time_spent_seconds: totalQTime,
          })
          .select('id')
          .single()

        if (inserted?.id) {
          answerRecordIdsRef.current[currentQ.id] = inserted.id
        }
      }
    } catch (err) {
      console.error('Failed to save answer:', err)
    }
  }

  const submitExam = async (isTimeout: boolean) => {
    try {
      setSubmitting(true)
      flushCurrentQuestionTime()

      // Calculate total score
      const correctCount = Object.values(answers).filter((a) => a.isCorrect).length

      // Calculate total seconds spent
      const totalSecondsSpent = examMode === 'real_exam'
        ? (isTimeout ? timeLimitSeconds : Math.min(timeLimitSeconds, elapsedSeconds))
        : elapsedSeconds

      await supabase
        .from('exam_attempts')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          total_score: correctCount,
          time_spent_seconds: totalSecondsSpent,
        })
        .eq('id', attemptId)

      const queryParams = new URLSearchParams()
      if (topicId) queryParams.set('topicId', String(topicId))
      if (isTimeout) queryParams.set('timeup', '1')
      if (isRandom) queryParams.set('random', '1')

      const queryString = queryParams.toString()
      const targetUrl = queryString ? `/result/${attemptId}?${queryString}` : `/result/${attemptId}`

      navigate(targetUrl)
    } catch (err) {
      console.error('Failed to finish exam:', err)
      alert('เกิดข้อผิดพลาดในการส่งข้อสอบ โปรดลองใหม่อีกครั้ง')
      setSubmitting(false)
      setIsTimeUpModal(false)
    }
  }

  const handleConfirmFinish = async () => {
    await submitExam(false)
  }

  const handleAutoSubmit = async () => {
    setIsTimeUpModal(true)
    await submitExam(true)
  }

  const formatTimer = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Answer statistics
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])
  const progressPercent = useMemo(() => {
    if (questions.length === 0) return 0
    return Math.round((answeredCount / questions.length) * 100)
  }, [answeredCount, questions.length])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
        <p className="text-sm font-medium">กำลังเตรียมข้อสอบและตัวเลือก...</p>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={48} className="text-amber-500 mb-3" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่พบข้อสอบในชุดนี้</h2>
        <p className="text-slate-500 text-sm mb-6">อาจยังไม่มีข้อมูลข้อสอบในระบบ</p>
        <Link to="/select" className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
          กลับหน้าหลัก
        </Link>
      </div>
    )
  }

  const currentQ = questions[currentIndex]
  const currentAnswer = answers[currentQ.id]
  const hasAnswered = !!currentAnswer?.selectedChoiceId

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              to="/select"
              className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex-shrink-0"
              title="กลับสู่หน้าเลือกวิชา"
            >
              <ChevronLeft size={20} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-base font-bold text-slate-900 truncate">
                {examTitle || 'ห้องสอบ'}
              </h1>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500">
                <span className="whitespace-nowrap">ข้อ <strong className="text-indigo-600 font-bold">{currentIndex + 1}</strong>/{questions.length}</span>
                <span>•</span>
                <span className="truncate">ตอบแล้ว {answeredCount} ({progressPercent}%)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Timer Badge */}
            {examMode === 'real_exam' ? (
              <div
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl font-mono text-xs font-bold border transition-colors ${
                  remainingSeconds <= 600
                    ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
                title={`เวลาสอบจริง คงเหลือ: ${formatTimer(remainingSeconds)}`}
              >
                <Clock size={14} className={remainingSeconds <= 600 ? 'text-rose-600' : 'text-amber-600'} />
                <span>{formatTimer(remainingSeconds)}</span>
                <span className="hidden md:inline font-sans text-[10px] text-amber-700 font-medium">
                  {remainingSeconds <= 600 ? '(ใกล้หมดเวลา)' : '(สอบจริง)'}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl font-mono text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                title={`เวลาที่ใช้: ${formatTimer(elapsedSeconds)}`}
              >
                <Clock size={14} className="text-indigo-600" />
                <span>{formatTimer(elapsedSeconds)}</span>
                <span className="hidden md:inline font-sans text-[10px] text-slate-500">(ฝึกฝน)</span>
              </div>
            )}

            {/* Quick jump drawer button */}
            <button
              onClick={() => setShowDrawer(true)}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              <Grid3X3 size={15} />
              <span className="hidden sm:inline">ข้อทั้งหมด</span>
            </button>

            {/* Finish exam button */}
            <button
              onClick={() => setShowFinishModal(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Send size={13} />
              <span>ส่งข้อสอบ</span>
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-slate-200 h-1">
          <div
            className="bg-indigo-600 h-1 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </header>

      {/* Main Question Arena */}
      <main className="max-w-4xl mx-auto w-full px-3.5 sm:px-6 py-4 sm:py-8 flex-1 flex flex-col justify-between pb-24 sm:pb-28">
        <div className="space-y-4 sm:space-y-6">
          {/* Question Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
            {/* Category / Topic chip */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] sm:text-xs font-semibold text-indigo-700 max-w-[80%] truncate">
                <Layers size={13} className="flex-shrink-0" />
                <span className="truncate">{currentQ.topics?.name || 'หมวดความรู้ทั่วไปเกี่ยวกับนิติกร'}</span>
              </div>
              <div className="flex items-center gap-2">
                {isRandom && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 flex items-center gap-1">
                    <Shuffle size={11} />
                    <span>สุ่มโจทย์</span>
                  </span>
                )}
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 flex-shrink-0">
                  ข้อที่ {currentIndex + 1}
                </span>
                {examMode === 'real_exam' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                    สอบจริง (เปลี่ยนคำตอบได้)
                  </span>
                )}
              </div>
            </div>

            {/* Question Text */}
            <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-medium text-slate-900 leading-relaxed sm:leading-loose whitespace-pre-line mb-6 sm:mb-8 break-words">
              {currentQ.question_text}
            </h2>

            {/* Choices list */}
            <div className="space-y-2.5 sm:space-y-3.5">
              {currentQ.choices.map((choice, idx) => {
                const choiceLabel = choice.choice_text.trim().slice(0, 1) // e.g. ก, ข, ค, ง
                const isSelected = currentAnswer?.selectedChoiceId === choice.id

                let stateStyle = 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-slate-50/80 text-slate-800'
                let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300'
                let icon = null

                if (examMode === 'real_exam') {
                  // Real Exam: neutral selection styling (no right/wrong reveals)
                  if (isSelected) {
                    stateStyle = 'bg-indigo-50/90 border-indigo-600 text-indigo-950 font-medium ring-2 ring-indigo-500/20 shadow-sm'
                    badgeStyle = 'bg-indigo-600 text-white border-indigo-600'
                    icon = <CheckCircle2 className="text-indigo-600 flex-shrink-0" size={20} />
                  } else {
                    stateStyle = 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/70 text-slate-800'
                    badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300'
                  }
                } else {
                  // Practice Mode: Instant feedback
                  if (hasAnswered) {
                    if (choice.is_correct) {
                      stateStyle = 'bg-emerald-50/80 border-emerald-500 text-emerald-950 font-medium ring-2 ring-emerald-400/20'
                      badgeStyle = 'bg-emerald-500 text-white border-emerald-600'
                      icon = <CheckCircle2 className="text-emerald-600 flex-shrink-0" size={20} />
                    } else if (isSelected && !choice.is_correct) {
                      stateStyle = 'bg-rose-50/80 border-rose-500 text-rose-950 ring-2 ring-rose-400/20'
                      badgeStyle = 'bg-rose-500 text-white border-rose-600'
                      icon = <XCircle className="text-rose-600 flex-shrink-0" size={20} />
                    } else {
                      stateStyle = 'bg-slate-50/50 border-slate-200 text-slate-400 opacity-60'
                      badgeStyle = 'bg-slate-100 text-slate-400 border-slate-200'
                    }
                  }
                }

                return (
                  <button
                    key={choice.id}
                    disabled={examMode === 'practice' && hasAnswered}
                    onClick={() => handleSelectAnswer(choice.id, choice.is_correct)}
                    className={`w-full text-left p-3.5 sm:p-4.5 rounded-xl sm:rounded-2xl border transition-all duration-200 flex items-start justify-between gap-2.5 sm:gap-3 ${stateStyle} disabled:cursor-default cursor-pointer active:scale-[0.99]`}
                  >
                    <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold border flex-shrink-0 mt-0.5 ${badgeStyle}`}>
                        {['ก', 'ข', 'ค', 'ง'][idx] || choiceLabel || (idx + 1)}
                      </span>
                      <span className="text-xs sm:text-sm md:text-base leading-relaxed break-words pt-0.5 flex-1">
                        {choice.choice_text.replace(/^[ก-ง]\.\s*/, '')}
                      </span>
                    </div>
                    {icon}
                  </button>
                )
              })}
            </div>

            {/* Instant Feedback Explanation Box (Visible only in Practice Mode) */}
            {examMode === 'practice' && hasAnswered && currentQ.explanation && (
              <div className="mt-6 sm:mt-8 p-4 sm:p-5 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-emerald-950 space-y-2 animate-in fade-in duration-300 shadow-sm shadow-emerald-500/5">
                <div className="flex items-center gap-2 font-bold text-emerald-900 text-xs sm:text-sm">
                  <Lightbulb size={18} className="text-emerald-600 flex-shrink-0" />
                  <span>คำอธิบายและเฉลยข้อสอบ:</span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed sm:leading-loose whitespace-pre-line pl-5 sm:pl-6 break-words">
                  {currentQ.explanation}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Sticky Bottom Action Bar for Mobile & iPad */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] py-2.5 sm:py-3 px-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <button
            disabled={currentIndex === 0}
            onClick={() => handleNavigateQuestion(Math.max(0, currentIndex - 1))}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-3.5 sm:px-6 py-2.5 sm:py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
          >
            <ChevronLeft size={18} />
            <span>ก่อนหน้า</span>
          </button>

          {/* Center question jump pill */}
          <button
            onClick={() => {
              flushCurrentQuestionTime()
              setShowDrawer(true)
            }}
            className="px-3 sm:px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all flex-shrink-0"
            title="ดูสารบัญข้อสอบทั้งหมด"
          >
            <Grid3X3 size={14} className="text-indigo-600" />
            <span>{currentIndex + 1} / {questions.length}</span>
          </button>

          <button
            disabled={currentIndex === questions.length - 1}
            onClick={() => handleNavigateQuestion(Math.min(questions.length - 1, currentIndex + 1))}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-4 sm:px-7 py-2.5 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <span>ถัดไป</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>

      {/* Quick Jump Drawer Modal */}
      {showDrawer && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end"
          onClick={() => setShowDrawer(false)}
        >
          <div 
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">สารบัญข้อสอบทั้งหมด</h3>
                <p className="text-xs text-slate-500">เลือกข้อที่ต้องการเพื่อข้ามไปทำทันที</p>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Legend */}
            <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3 sm:gap-4 text-[11px] text-slate-600">
              {examMode === 'real_exam' ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-indigo-600"></span>
                    <span>ตอบแล้ว</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-slate-200 border border-slate-300"></span>
                    <span>ยังไม่ตอบ</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-emerald-500"></span>
                    <span>ตอบถูก</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-rose-500"></span>
                    <span>ตอบผิด</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-slate-200 border border-slate-300"></span>
                    <span>ยังไม่ตอบ</span>
                  </div>
                </>
              )}
            </div>

            {/* Questions Grid */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 gap-2">
              {questions.map((q, idx) => {
                const ans = answers[q.id]
                const isCurrent = idx === currentIndex

                let colorClass = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                if (examMode === 'real_exam') {
                  if (ans?.selectedChoiceId) {
                    colorClass = 'bg-indigo-600 text-white font-bold border-indigo-700 shadow-sm'
                  }
                } else {
                  if (ans) {
                    if (ans.isCorrect) {
                      colorClass = 'bg-emerald-500 text-white font-bold border-emerald-600'
                    } else {
                      colorClass = 'bg-rose-500 text-white font-bold border-rose-600'
                    }
                  }
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      handleNavigateQuestion(idx)
                      setShowDrawer(false)
                    }}
                    className={`h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-semibold border flex items-center justify-center transition-all cursor-pointer ${colorClass} ${
                      isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2' : ''
                    }`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Finish Exam Confirmation Modal */}
      {showFinishModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowFinishModal(false)}
        >
          <div 
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Send size={26} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">ยืนยันการส่งข้อสอบ?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                ระบบจะคำนวณคะแนนรวม บันทึกความเร็วรายข้อ และสร้าง Dashboard วิเคราะห์ผลสอบให้คุณทันที
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 grid grid-cols-2 gap-4 text-center">
              <div>
                <span className="text-xs text-slate-500">ตอบไปแล้ว</span>
                <div className="text-lg font-bold text-slate-800">{answeredCount} ข้อ</div>
              </div>
              <div>
                <span className="text-xs text-slate-500">ยังไม่ตอบ</span>
                <div className="text-lg font-bold text-amber-600">{questions.length - answeredCount} ข้อ</div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowFinishModal(false)}
                className="w-1/2 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 transition-colors cursor-pointer"
              >
                กลับไปทำต่อ
              </button>
              <button
                onClick={handleConfirmFinish}
                disabled={submitting}
                className="w-1/2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <span>ยืนยันส่งข้อสอบ</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Up Fullscreen Modal */}
      {isTimeUpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto animate-bounce">
              <Clock size={36} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900">หมดเวลาทำข้อสอบแล้ว!</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                เวลาสอบครบ {Math.round(timeLimitSeconds / 60)} นาทีแล้ว ระบบกำลังทำการบันทึกและส่งคำตอบของคุณโดยอัตโนมัติ...
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-indigo-600 text-xs font-semibold py-2">
              <Loader2 size={18} className="animate-spin" />
              <span>กำลังประมวลผลคะแนนและสร้าง Dashboard วิเคราะห์ผล...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
