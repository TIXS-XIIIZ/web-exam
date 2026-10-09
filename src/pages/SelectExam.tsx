import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Book, LogOut } from 'lucide-react'

export default function SelectExam() {
  const [categories, setCategories] = useState<any[]>([])
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      const { data: catData } = await supabase.from('categories').select('*')
      if (catData) setCategories(catData)

      const { data: examData } = await supabase.from('exams').select('*, categories(name)')
      if (examData) setExams(examData)

      setLoading(false)
    }
    fetchData()
  }, [])

  const handleStartExam = async (examId: number) => {
    // Create attempt
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: attempt, error } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: examId,
        user_id: user.id,
        status: 'in_progress'
      })
      .select()
      .single()

    if (error) {
      console.error(error)
      alert('ไม่สามารถเริ่มทำข้อสอบได้')
      return
    }

    navigate(`/exam/${examId}?attemptId=${attempt.id}`)
  }

  const handleLogout = () => {
    supabase.auth.signOut()
  }

  if (loading) return <div className="p-8 text-center">กำลังโหลดข้อมูล...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">เลือกข้อสอบ</h1>
        <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <LogOut size={18} /> ออกจากระบบ
        </button>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {exams.map((exam) => (
          <div key={exam.id} className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-2 text-blue-600">
              <Book size={20} />
              <span className="font-semibold text-sm">{exam.categories?.name}</span>
            </div>
            <h2 className="text-xl font-bold mb-2">{exam.title}</h2>
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">{exam.description}</p>
            <div className="flex justify-between items-center mb-4 text-sm text-gray-500">
              <span>เวลา: {exam.time_limit_minutes} นาที</span>
              <span>จำนวน: {exam.total_questions} ข้อ</span>
            </div>
            <button
              onClick={() => handleStartExam(exam.id)}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
            >
              เริ่มทำข้อสอบ
            </button>
          </div>
        ))}
      </div>
      
      {exams.length === 0 && (
        <div className="text-center text-gray-500 py-12">ไม่พบข้อสอบในระบบ กรุณาเพิ่มข้อมูลในฐานข้อมูล</div>
      )}
    </div>
  )
}
