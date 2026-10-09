import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type TopicStat = {
  name: string
  total: number
  correct: number
}

export default function ResultSummary() {
  const { attemptId } = useParams()
  const [loading, setLoading] = useState(true)
  const [examTitle, setExamTitle] = useState('')
  const [score, setScore] = useState({ total: 0, correct: 0 })
  const [topicStats, setTopicStats] = useState<TopicStat[]>([])

  useEffect(() => {
    async function fetchResult() {
      if (!attemptId) return

      // Fetch attempt and joined answers
      const { data: attempt, error } = await supabase
        .from('exam_attempts')
        .select(`
          id, exam_id,
          exams(title),
          exam_attempt_answers(
            is_correct,
            questions(topic_id, topics(name))
          )
        `)
        .eq('id', attemptId)
        .single()

      if (error || !attempt) {
        console.error(error)
        return
      }

      setExamTitle((attempt.exams as any)?.title || 'ผลการสอบ')

      const answers = attempt.exam_attempt_answers as any[]
      let correct = 0
      const tStats: Record<string, TopicStat> = {}

      answers.forEach(ans => {
        if (ans.is_correct) correct++

        const topicName = ans.questions?.topics?.name || 'ไม่ระบุหมวดหมู่'
        if (!tStats[topicName]) {
          tStats[topicName] = { name: topicName, total: 0, correct: 0 }
        }
        tStats[topicName].total++
        if (ans.is_correct) tStats[topicName].correct++
      })

      setScore({ total: answers.length, correct })
      setTopicStats(Object.values(tStats).sort((a, b) => {
        const aPct = a.total > 0 ? a.correct / a.total : 0
        const bPct = b.total > 0 ? b.correct / b.total : 0
        return aPct - bPct // sort by lowest percentage first (weakness)
      }))

      setLoading(false)
    }

    fetchResult()
  }, [attemptId])

  if (loading) return <div className="p-8 text-center">กำลังประมวลผล...</div>

  const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-blue-600 p-8 text-center text-white">
          <h1 className="text-3xl font-bold mb-2">สรุปผลการทดสอบ</h1>
          <h2 className="text-xl opacity-90">{examTitle}</h2>
        </div>

        <div className="p-8">
          <div className="flex justify-center mb-10">
            <div className="text-center">
              <div className="text-6xl font-bold text-gray-800 mb-2">
                {score.correct} <span className="text-3xl text-gray-400">/ {score.total}</span>
              </div>
              <div className="text-xl text-gray-500">คิดเป็น {percentage}%</div>
            </div>
          </div>

          {topicStats.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">การวิเคราะห์จุดอ่อนรายหมวดหมู่</h3>
              <div className="space-y-4">
                {topicStats.map((stat, idx) => {
                  const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
                  let barColor = "bg-green-500"
                  if (pct < 50) barColor = "bg-red-500"
                  else if (pct < 75) barColor = "bg-yellow-500"

                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{stat.name}</span>
                        <span className="text-gray-500">{stat.correct}/{stat.total} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="text-center mt-8">
            <Link
              to="/select"
              className="inline-block bg-gray-800 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition"
            >
              กลับสู่หน้าเลือกข้อสอบ
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
