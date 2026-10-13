import { useEffect, useState, useMemo } from 'react'
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
  AlertCircle
} from 'lucide-react'

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

  useEffect(() => {
    async function fetchQuestions() {
      if (!examId || !attemptId) return

      try {
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

        // 2. Fetch questions with choices and topic name (filtered by topic_id if provided)
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

        const formattedQuestions = qData?.map((q: any) => ({
          ...q,
          choices: (q.choices || []).sort((a: any, b: any) => a.order_index - b.order_index),
        })) || []

        setQuestions(formattedQuestions)

        // 3. Fetch existing answers
        const { data: aData } = await supabase
          .from('exam_attempt_answers')
          .select('*')
          .eq('attempt_id', attemptId)

        if (aData) {
          const existingAnswers: Record<number, AnswerState> = {}
          aData.forEach((ans) => {
            existingAnswers[ans.question_id] = {
              selectedChoiceId: ans.selected_choice_id,
              isCorrect: ans.is_correct,
            }
          })
          setAnswers(existingAnswers)
        }
      } catch (err) {
        console.error('Error fetching exam session data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchQuestions()
  }, [examId, attemptId, topicId])

  const handleSelectAnswer = async (choiceId: number, isCorrect: boolean) => {
    const currentQ = questions[currentIndex]
    if (!currentQ) return

    // If already answered, do not allow changes (instant review mode)
    if (answers[currentQ.id]?.selectedChoiceId) return

    const newAnswerState = { selectedChoiceId: choiceId, isCorrect }
    setAnswers((prev) => ({ ...prev, [currentQ.id]: newAnswerState }))

    try {
      await supabase.from('exam_attempt_answers').insert({
        attempt_id: Number(attemptId),
        question_id: currentQ.id,
        selected_choice_id: choiceId,
        is_correct: isCorrect,
      })
    } catch (err) {
      console.error('Failed to save answer:', err)
    }
  }

  const handleConfirmFinish = async () => {
    try {
      setSubmitting(true)
      // Calculate total score
      const correctCount = Object.values(answers).filter((a) => a.isCorrect).length

      await supabase
        .from('exam_attempts')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          total_score: correctCount,
        })
        .eq('id', attemptId)

      const targetUrl = topicId 
        ? `/result/${attemptId}?topicId=${topicId}`
        : `/result/${attemptId}`

      navigate(targetUrl)
    } catch (err) {
      console.error('Failed to finish exam:', err)
      alert('เกิดข้อผิดพลาดในการส่งข้อสอบ โปรดลองใหม่อีกครั้ง')
      setSubmitting(false)
    }
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/select"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="กลับสู่หน้าเลือกวิชา"
            >
              <ChevronLeft size={20} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {examTitle || 'ห้องสอบ'}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>ข้อที่ <strong className="text-indigo-600 font-bold">{currentIndex + 1}</strong> จาก {questions.length}</span>
                <span>•</span>
                <span>ตอบแล้ว {answeredCount}/{questions.length} ({progressPercent}%)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Quick jump drawer button */}
            <button
              onClick={() => setShowDrawer(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Grid3X3 size={15} />
              <span className="hidden sm:inline">ข้อทั้งหมด</span>
            </button>

            {/* Finish exam button */}
            <button
              onClick={() => setShowFinishModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <Send size={14} />
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
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 flex-1 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Question Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
            {/* Category / Topic chip */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700">
                <Layers size={13} />
                <span>{currentQ.topics?.name || 'หมวดความรู้ทั่วไปเกี่ยวกับนิติกร'}</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                ข้อที่ {currentIndex + 1}
              </span>
            </div>

            {/* Question Text */}
            <h2 className="text-base sm:text-lg md:text-xl font-medium text-slate-900 leading-relaxed whitespace-pre-line mb-8">
              {currentQ.question_text}
            </h2>

            {/* Choices list */}
            <div className="space-y-3.5">
              {currentQ.choices.map((choice, idx) => {
                const choiceLabel = choice.choice_text.trim().slice(0, 1) // e.g. ก, ข, ค, ง
                const isSelected = currentAnswer?.selectedChoiceId === choice.id

                let stateStyle = 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-slate-50/80 text-slate-800'
                let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300'
                let icon = null

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

                return (
                  <button
                    key={choice.id}
                    disabled={hasAnswered}
                    onClick={() => handleSelectAnswer(choice.id, choice.is_correct)}
                    className={`w-full text-left p-4 sm:p-4.5 rounded-2xl border transition-all duration-200 flex items-start justify-between gap-3 ${stateStyle} disabled:cursor-default`}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold border flex-shrink-0 mt-0.5 ${badgeStyle}`}>
                        {['ก', 'ข', 'ค', 'ง'][idx] || choiceLabel || (idx + 1)}
                      </span>
                      <span className="text-sm sm:text-base leading-relaxed break-words pt-0.5">
                        {choice.choice_text.replace(/^[ก-ง]\.\s*/, '')}
                      </span>
                    </div>
                    {icon}
                  </button>
                )
              })}
            </div>

            {/* Instant Feedback Explanation Box */}
            {hasAnswered && currentQ.explanation && (
              <div className="mt-8 p-5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 space-y-2 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                  <Lightbulb size={18} className="text-amber-600 flex-shrink-0" />
                  <span>คำอธิบายและเฉลยข้อสอบ:</span>
                </div>
                <p className="text-xs sm:text-sm text-amber-950 leading-relaxed whitespace-pre-line pl-6">
                  {currentQ.explanation}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Floating/Sticky Action Bar */}
        <div className="mt-8 flex items-center justify-between gap-4 pt-4 border-t border-slate-200/80">
          <button
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={18} />
            <span>ก่อนหน้า</span>
          </button>

          {/* Center question jump pill on mobile */}
          <button
            onClick={() => setShowDrawer(true)}
            className="sm:hidden px-3 py-1.5 rounded-lg bg-slate-200/80 text-slate-700 text-xs font-semibold flex items-center gap-1"
          >
            <span>{currentIndex + 1}/{questions.length}</span>
          </button>

          <button
            disabled={currentIndex === questions.length - 1}
            onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            className="flex items-center gap-1.5 px-4 sm:px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <span>ถัดไป</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </main>

      {/* Quick Jump Drawer Modal */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">สารบัญข้อสอบทั้งหมด</h3>
                <p className="text-xs text-slate-500">เลือกข้อที่ต้องการเพื่อข้ามไปทำทันที</p>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Legend */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-4 text-[11px] text-slate-600">
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
            </div>

            {/* Questions Grid */}
            <div className="p-5 flex-1 overflow-y-auto grid grid-cols-5 sm:grid-cols-6 gap-2">
              {questions.map((q, idx) => {
                const ans = answers[q.id]
                const isCurrent = idx === currentIndex

                let colorClass = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                if (ans) {
                  if (ans.isCorrect) {
                    colorClass = 'bg-emerald-500 text-white font-bold border-emerald-600'
                  } else {
                    colorClass = 'bg-rose-500 text-white font-bold border-rose-600'
                  }
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentIndex(idx)
                      setShowDrawer(false)
                    }}
                    className={`h-11 rounded-xl text-xs font-semibold border flex items-center justify-center transition-all ${colorClass} ${
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Send size={26} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-xl font-bold text-slate-900">ยืนยันการส่งข้อสอบ?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                ระบบจะคำนวณคะแนนรวมและวิเคราะห์จุดอ่อนของคุณทันที
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
                className="w-1/2 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 transition-colors"
              >
                กลับไปทำต่อ
              </button>
              <button
                onClick={handleConfirmFinish}
                disabled={submitting}
                className="w-1/2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5"
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
    </div>
  )
}
