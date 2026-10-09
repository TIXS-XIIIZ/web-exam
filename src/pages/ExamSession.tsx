import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react'

type Question = {
  id: number
  question_text: string
  explanation: string
  choices: Choice[]
}

type Choice = {
  id: number
  choice_text: string
  is_correct: boolean
}

type AnswerState = {
  selectedChoiceId: number | null
  isCorrect: boolean | null
}

export default function ExamSession() {
  const { examId } = useParams()
  const [searchParams] = useSearchParams()
  const attemptId = searchParams.get('attemptId')
  const navigate = useNavigate()

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchQuestions() {
      if (!examId || !attemptId) return

      // Fetch questions and choices
      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select(`
          id, question_text, explanation, order_index,
          choices (id, choice_text, is_correct, order_index)
        `)
        .eq('exam_id', examId)
        .order('order_index', { ascending: true })

      if (qError) {
        console.error(qError)
        return
      }

      // Sort choices for each question
      const formattedQuestions = qData?.map((q: any) => ({
        ...q,
        choices: q.choices.sort((a: any, b: any) => a.order_index - b.order_index)
      }))

      setQuestions(formattedQuestions || [])

      // Fetch existing answers if they reloaded the page
      const { data: aData } = await supabase
        .from('exam_attempt_answers')
        .select('*')
        .eq('attempt_id', attemptId)

      if (aData) {
        const existingAnswers: Record<number, AnswerState> = {}
        aData.forEach(ans => {
          existingAnswers[ans.question_id] = {
            selectedChoiceId: ans.selected_choice_id,
            isCorrect: ans.is_correct
          }
        })
        setAnswers(existingAnswers)
      }

      setLoading(false)
    }

    fetchQuestions()
  }, [examId, attemptId])

  const handleSelectAnswer = async (choiceId: number, isCorrect: boolean) => {
    const currentQ = questions[currentIndex]
    
    // If already answered, don't allow change (as per "เฉลยทันที")
    if (answers[currentQ.id]?.selectedChoiceId) return

    const newAnswerState = { selectedChoiceId: choiceId, isCorrect }
    setAnswers(prev => ({ ...prev, [currentQ.id]: newAnswerState }))

    // Save to DB
    await supabase.from('exam_attempt_answers').insert({
      attempt_id: attemptId,
      question_id: currentQ.id,
      selected_choice_id: choiceId,
      is_correct: isCorrect
    })
  }

  const handleFinish = async () => {
    if (!confirm('คุณต้องการส่งข้อสอบและดูสรุปผลใช่หรือไม่?')) return
    
    // Update attempt status
    await supabase
      .from('exam_attempts')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
      })
      .eq('id', attemptId)

    navigate(`/result/${attemptId}`)
  }

  if (loading) return <div className="p-8 text-center">กำลังเตรียมข้อสอบ...</div>
  if (questions.length === 0) return <div className="p-8 text-center">ไม่มีข้อสอบในชุดนี้</div>

  const currentQ = questions[currentIndex]
  const currentAnswer = answers[currentQ.id]
  const hasAnswered = !!currentAnswer?.selectedChoiceId

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">
          ข้อที่ {currentIndex + 1} / {questions.length}
        </h2>
        <button
          onClick={handleFinish}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          ส่งข้อสอบ
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6 flex-grow">
        <p className="text-lg mb-6 whitespace-pre-wrap">{currentQ.question_text}</p>
        
        <div className="space-y-3">
          {currentQ.choices.map((choice) => {
            let btnClass = "w-full text-left p-4 border rounded-lg transition-colors "
            let icon = null

            if (hasAnswered) {
              if (choice.is_correct) {
                btnClass += "bg-green-100 border-green-500 text-green-800"
                icon = <CheckCircle className="text-green-600 inline ml-2" size={20} />
              } else if (currentAnswer.selectedChoiceId === choice.id) {
                btnClass += "bg-red-100 border-red-500 text-red-800"
                icon = <XCircle className="text-red-600 inline ml-2" size={20} />
              } else {
                btnClass += "bg-gray-50 border-gray-200 text-gray-400 opacity-70"
              }
            } else {
              btnClass += "hover:bg-blue-50 hover:border-blue-300 border-gray-300"
            }

            return (
              <button
                key={choice.id}
                disabled={hasAnswered}
                onClick={() => handleSelectAnswer(choice.id, choice.is_correct)}
                className={btnClass}
              >
                <div className="flex justify-between items-center">
                  <span>{choice.choice_text}</span>
                  {icon}
                </div>
              </button>
            )
          })}
        </div>

        {hasAnswered && currentQ.explanation && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-bold text-yellow-800 mb-1">คำอธิบาย/เฉลย:</h4>
            <p className="text-yellow-900 whitespace-pre-wrap">{currentQ.explanation}</p>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-auto">
        <button
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex(prev => prev - 1)}
          className={`flex items-center px-4 py-2 rounded-lg ${
            currentIndex === 0 ? 'bg-gray-200 text-gray-400' : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
        >
          <ChevronLeft size={20} className="mr-1" /> ก่อนหน้า
        </button>
        <button
          disabled={currentIndex === questions.length - 1}
          onClick={() => setCurrentIndex(prev => prev + 1)}
          className={`flex items-center px-4 py-2 rounded-lg ${
            currentIndex === questions.length - 1 ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          ถัดไป <ChevronRight size={20} className="ml-1" />
        </button>
      </div>
    </div>
  )
}
