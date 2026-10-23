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
  Trash2,
  Plus,
  SlidersHorizontal,
  PieChart,
  Minus
} from 'lucide-react'
import { useAlert } from '../components/AlertProvider'

export const TOPIC_PALETTE = [
  { bg: 'bg-indigo-500', bar: 'bg-indigo-500', text: 'text-indigo-700', light: 'bg-indigo-50', border: 'border-indigo-200', hex: '#6366f1' },
  { bg: 'bg-purple-500', bar: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-50', border: 'border-purple-200', hex: '#a855f7' },
  { bg: 'bg-sky-500', bar: 'bg-sky-500', text: 'text-sky-700', light: 'bg-sky-50', border: 'border-sky-200', hex: '#0ea5e9' },
  { bg: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50', border: 'border-emerald-200', hex: '#10b981' },
  { bg: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50', border: 'border-amber-200', hex: '#f59e0b' },
  { bg: 'bg-rose-500', bar: 'bg-rose-500', text: 'text-rose-700', light: 'bg-rose-50', border: 'border-rose-200', hex: '#f43f5e' },
  { bg: 'bg-fuchsia-500', bar: 'bg-fuchsia-500', text: 'text-fuchsia-700', light: 'bg-fuchsia-50', border: 'border-fuchsia-200', hex: '#d946ef' },
  { bg: 'bg-teal-500', bar: 'bg-teal-500', text: 'text-teal-700', light: 'bg-teal-50', border: 'border-teal-200', hex: '#14b8a6' },
  { bg: 'bg-cyan-500', bar: 'bg-cyan-500', text: 'text-cyan-700', light: 'bg-cyan-50', border: 'border-cyan-200', hex: '#06b6d4' },
  { bg: 'bg-orange-500', bar: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50', border: 'border-orange-200', hex: '#f97316' },
  { bg: 'bg-violet-500', bar: 'bg-violet-500', text: 'text-violet-700', light: 'bg-violet-50', border: 'border-violet-200', hex: '#8b5cf6' },
  { bg: 'bg-pink-500', bar: 'bg-pink-500', text: 'text-pink-700', light: 'bg-pink-50', border: 'border-pink-200', hex: '#ec4899' },
]

export function calculateProportionalAllocation(
  selectedIds: number[],
  topicsList: any[],
  targetTotal: number
): Record<number, number> {
  const selected = topicsList.filter((t) => selectedIds.includes(t.id))
  const totalAvail = selected.reduce((sum, t) => sum + (t.questionCount || 0), 0)
  if (totalAvail <= 0 || selected.length === 0) return {}
  if (targetTotal >= totalAvail) {
    const res: Record<number, number> = {}
    selected.forEach((t) => { res[t.id] = t.questionCount || 0 })
    return res
  }

  const k = selected.length
  const target = Math.max(1, Math.min(targetTotal, totalAvail))

  const items = selected.map((t) => {
    const avail = t.questionCount || 0
    const exact = (avail / totalAvail) * target
    return {
      id: t.id,
      avail,
      count: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    }
  })

  // If target >= k, ensure at least 1 question per topic if avail >= 1
  if (target >= k) {
    items.forEach((item) => {
      if (item.count === 0 && item.avail >= 1) {
        item.count = 1
      }
    })
  }

  let currentSum = items.reduce((s, it) => s + it.count, 0)
  let diff = target - currentSum

  if (diff > 0) {
    items.sort((a, b) => b.remainder - a.remainder)
    for (let i = 0; i < items.length && diff > 0; i++) {
      if (items[i].count < items[i].avail) {
        items[i].count += 1
        diff--
      }
    }
  } else if (diff < 0) {
    items.sort((a, b) => a.remainder - b.remainder)
    for (let i = 0; i < items.length && diff < 0; i++) {
      const minCount = target >= k ? 1 : 0
      if (items[i].count > minCount) {
        items[i].count -= 1
        diff++
      }
    }
  }

  const res: Record<number, number> = {}
  items.forEach((it) => {
    res[it.id] = it.count
  })
  return res
}

export default function SelectExam() {
  const { toast, confirm } = useAlert()
  const [exams, setExams] = useState<any[]>([])
  const [topics, setTopics] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [recentAttempts, setRecentAttempts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'topics' | 'custom'>('all')
  const [editingAttemptId, setEditingAttemptId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [deletingAttemptId, setDeletingAttemptId] = useState<number | null>(null)
  const [isClearingAll, setIsClearingAll] = useState<boolean>(false)

  // Custom Exam Sets (User picked topics)
  const [customExamSets, setCustomExamSets] = useState<any[]>([])
  const [showCreateCustomModal, setShowCreateCustomModal] = useState<boolean>(false)
  const [customSetTitle, setCustomSetTitle] = useState<string>('')
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([])
  const [isSavingCustomSet, setIsSavingCustomSet] = useState<boolean>(false)
  const [deletingSetId, setDeletingSetId] = useState<number | null>(null)

  // Target question count and distribution for Custom Set Creation
  const [targetQuestionMode, setTargetQuestionMode] = useState<'all' | 'preset' | 'custom'>('all')
  const [customTargetCountInput, setCustomTargetCountInput] = useState<string>('50')
  const [topicAllocations, setTopicAllocations] = useState<Record<number, number>>({})

  // Exam Mode, Time Setting, and Random state
  const [examMode, setExamMode] = useState<'real_exam' | 'practice'>('real_exam')
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(180)
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('180')
  const [isCustomTime, setIsCustomTime] = useState<boolean>(false)
  const [isRandom, setIsRandom] = useState<boolean>(false)

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
          .order('id', { ascending: true })
        if (topicData) {
          const formattedTopics = topicData.map((t: any) => ({
            id: t.id,
            name: t.name,
            questionCount: t.questions?.[0]?.count || 0
          }))
          setTopics(formattedTopics)
        }

        // 3. Fetch user's custom exam sets
        if (currentUser) {
          const { data: sets } = await supabase
            .from('custom_exam_sets')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
          if (sets) setCustomExamSets(sets)
        }

        // 4. Fetch user's recent attempts if logged in (with topic_id, custom_title, and topics name)
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

  const handleStartExam = async (examId: number, topicId?: number, customSet?: any) => {
    try {
      const startKey = customSet ? `custom-${customSet.id}` : topicId ? `topic-${topicId}` : `exam-${examId}`
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

      if (customSet) {
        insertData.custom_set_id = customSet.id
        insertData.topic_ids = customSet.topic_ids
        insertData.custom_title = customSet.title
        if (customSet.topic_distribution) {
          insertData.topic_distribution = customSet.topic_distribution
        }
      } else if (topicId) {
        insertData.topic_id = topicId
      }

      const { data: attempt, error } = await supabase
        .from('exam_attempts')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error(error)
        toast.error(error.message, 'ไม่สามารถเริ่มทำข้อสอบได้')
        return
      }

      const queryParams = new URLSearchParams()
      queryParams.set('attemptId', String(attempt.id))
      if (topicId) queryParams.set('topicId', String(topicId))
      queryParams.set('mode', examMode)
      queryParams.set('random', isRandom ? '1' : '0')

      navigate(`/exam/${examId}?${queryParams.toString()}`)
    } catch (err: any) {
      toast.error(err.message, 'เกิดข้อผิดพลาด')
    } finally {
      setStartingId(null)
    }
  }

  // Open Create Custom Modal with initial state
  const openCreateCustomModal = () => {
    setCustomSetTitle('')
    setSelectedTopicIds([])
    setTargetQuestionMode('all')
    setCustomTargetCountInput('50')
    setTopicAllocations({})
    setShowCreateCustomModal(true)
  }

  // Calculate available questions across selected topics
  const totalAvailableQuestions = topics
    .filter((t) => selectedTopicIds.includes(t.id))
    .reduce((sum, t) => sum + (t.questionCount || 0), 0)

  // Toggle selection of a topic
  const handleToggleTopic = (topicId: number) => {
    const isChecked = selectedTopicIds.includes(topicId)
    const nextSelected = isChecked
      ? selectedTopicIds.filter((id) => id !== topicId)
      : [...selectedTopicIds, topicId]

    setSelectedTopicIds(nextSelected)

    const nextAvail = topics
      .filter((t) => nextSelected.includes(t.id))
      .reduce((sum, t) => sum + (t.questionCount || 0), 0)

    if (targetQuestionMode === 'all') {
      const newAlloc: Record<number, number> = {}
      topics
        .filter((t) => nextSelected.includes(t.id))
        .forEach((t) => {
          newAlloc[t.id] = t.questionCount || 0
        })
      setTopicAllocations(newAlloc)
    } else {
      const currentTarget = Math.max(1, parseInt(customTargetCountInput) || 50)
      const clamped = Math.min(currentTarget, nextAvail || 50)
      const newAlloc = calculateProportionalAllocation(nextSelected, topics, clamped)
      setTopicAllocations(newAlloc)
    }
  }

  // Select all topics
  const handleSelectAllTopics = () => {
    const allIds = topics.map((t) => t.id)
    setSelectedTopicIds(allIds)
    const allAvail = topics.reduce((sum, t) => sum + (t.questionCount || 0), 0)

    if (targetQuestionMode === 'all') {
      const newAlloc: Record<number, number> = {}
      topics.forEach((t) => {
        newAlloc[t.id] = t.questionCount || 0
      })
      setTopicAllocations(newAlloc)
    } else {
      const currentTarget = Math.max(1, parseInt(customTargetCountInput) || 50)
      const clamped = Math.min(currentTarget, allAvail)
      const newAlloc = calculateProportionalAllocation(allIds, topics, clamped)
      setTopicAllocations(newAlloc)
    }
  }

  // Clear all topics
  const handleClearAllTopics = () => {
    setSelectedTopicIds([])
    setTopicAllocations({})
  }

  // Select question preset (All, 20, 30, 50, 100)
  const handleSelectQuestionPreset = (preset: 'all' | number) => {
    if (preset === 'all') {
      setTargetQuestionMode('all')
      const newAlloc: Record<number, number> = {}
      topics
        .filter((t) => selectedTopicIds.includes(t.id))
        .forEach((t) => {
          newAlloc[t.id] = t.questionCount || 0
        })
      setTopicAllocations(newAlloc)
    } else {
      setTargetQuestionMode('preset')
      setCustomTargetCountInput(String(preset))
      const clamped = Math.min(preset, totalAvailableQuestions)
      const newAlloc = calculateProportionalAllocation(selectedTopicIds, topics, clamped)
      setTopicAllocations(newAlloc)
    }
  }

  // Custom target count input change
  const handleCustomTargetChange = (valStr: string) => {
    setCustomTargetCountInput(valStr)
    setTargetQuestionMode('custom')
    const val = parseInt(valStr)
    if (!isNaN(val) && val > 0 && totalAvailableQuestions > 0) {
      const clamped = Math.min(val, totalAvailableQuestions)
      const newAlloc = calculateProportionalAllocation(selectedTopicIds, topics, clamped)
      setTopicAllocations(newAlloc)
    }
  }

  // Adjust individual topic question count (+ / -)
  const handleAdjustTopicCount = (topicId: number, delta: number) => {
    const topic = topics.find((t) => t.id === topicId)
    const maxAvail = topic?.questionCount || 0
    const current = topicAllocations[topicId] || 0
    const nextVal = Math.max(1, Math.min(current + delta, maxAvail))
    if (nextVal === current) return

    const updated = { ...topicAllocations, [topicId]: nextVal }
    setTopicAllocations(updated)
    const newTotal = selectedTopicIds.reduce((sum, tid) => sum + (updated[tid] || 0), 0)
    setTargetQuestionMode('custom')
    setCustomTargetCountInput(String(newTotal))
  }

  // Active total questions to test
  const activeCustomTotalQuestions = selectedTopicIds.reduce(
    (sum, tid) => sum + (topicAllocations[tid] || 0),
    0
  )

  // Full breakdown with percentage and color
  const topicDistributionBreakdown = selectedTopicIds.map((tid, idx) => {
    const topic = topics.find((t) => t.id === tid)
    const count = topicAllocations[tid] || 0
    const available = topic?.questionCount || 0
    const percent = activeCustomTotalQuestions > 0
      ? Math.round((count / activeCustomTotalQuestions) * 1000) / 10
      : 0
    const color = TOPIC_PALETTE[idx % TOPIC_PALETTE.length]
    return {
      topic_id: tid,
      name: topic?.name || '',
      question_count: count,
      available_count: available,
      percentage: percent,
      color,
    }
  })

  // Handle Create Custom Exam Set
  const handleSaveCustomSet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast.error('กรุณาเข้าสู่ระบบก่อนสร้างชุดข้อสอบ')
      return
    }

    const trimmedTitle = customSetTitle.trim()
    if (!trimmedTitle) {
      toast.warning('กรุณาระบุชื่อชุดข้อสอบที่ต้องการสร้าง')
      return
    }

    if (selectedTopicIds.length === 0) {
      toast.warning('กรุณาเลือกอย่างน้อย 1 หมวดวิชา')
      return
    }

    if (activeCustomTotalQuestions <= 0) {
      toast.warning('กรุณาระบุจำนวนข้อสอบอย่างน้อย 1 ข้อ')
      return
    }

    try {
      setIsSavingCustomSet(true)
      const primaryExam = exams[0] || { id: 1 }

      const distributionToSave = topicDistributionBreakdown.map((item) => ({
        topic_id: item.topic_id,
        name: item.name,
        question_count: item.question_count,
        available_count: item.available_count,
        percentage: item.percentage,
      }))

      const { data: newSet, error } = await supabase
        .from('custom_exam_sets')
        .insert({
          user_id: user.id,
          exam_id: primaryExam.id,
          title: trimmedTitle,
          topic_ids: selectedTopicIds,
          total_questions: activeCustomTotalQuestions,
          topic_distribution: distributionToSave,
        })
        .select()
        .single()

      if (error) throw error

      setCustomExamSets((prev) => [newSet, ...prev])
      setShowCreateCustomModal(false)
      setCustomSetTitle('')
      setSelectedTopicIds([])
      toast.success(`สร้างชุดข้อสอบ "${trimmedTitle}" (${activeCustomTotalQuestions} ข้อ) เรียบร้อยแล้ว`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'ไม่สามารถสร้างชุดข้อสอบได้')
    } finally {
      setIsSavingCustomSet(false)
    }
  }

  // Handle Delete Custom Exam Set
  const handleDeleteCustomSet = async (setId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await confirm({
      title: 'ยืนยันการลบชุดข้อสอบที่สร้างเอง?',
      message: 'คุณต้องการลบชุดข้อสอบนี้ใช่หรือไม่? ข้อมูลประวัติการสอบที่เคยทำในชุดนี้จะยังคงอยู่',
      confirmText: 'ลบชุดข้อสอบนี้',
      cancelText: 'ยกเลิก',
      type: 'danger',
    })
    if (!ok) return

    try {
      setDeletingSetId(setId)
      const { error } = await supabase
        .from('custom_exam_sets')
        .delete()
        .eq('id', setId)

      if (error) throw error

      setCustomExamSets((prev) => prev.filter((s) => s.id !== setId))
      toast.success('ลบชุดข้อสอบเรียบร้อยแล้ว')
    } catch (err: any) {
      toast.error(err.message || 'ไม่สามารถลบชุดข้อสอบได้')
    } finally {
      setDeletingSetId(null)
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
        toast.error(error.message, 'ไม่สามารถบันทึกชื่อได้')
        return
      }

      setRecentAttempts((prev) =>
        prev.map((att) => (att.id === attemptId ? { ...att, custom_title: cleanTitle || null } : att))
      )
      setEditingAttemptId(null)
      setEditingTitle('')
      toast.success('บันทึกชื่อประวัตินี้เรียบร้อยแล้ว')
    } catch (err: any) {
      toast.error(err.message, 'เกิดข้อผิดพลาด')
    } finally {
      setSavingTitle(false)
    }
  }

  const handleDeleteAttempt = async (attemptId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await confirm({
      title: 'ยืนยันการลบประวัติการสอบ',
      message: 'คุณต้องการลบประวัติการสอบรอบนี้ใช่หรือไม่?\nข้อมูลคะแนนและคำตอบในรอบนี้จะถูกลบถาวร',
      confirmText: 'ลบประวัตินี้',
      cancelText: 'ยกเลิก',
      type: 'danger',
    })
    if (!ok) return

    try {
      setDeletingAttemptId(attemptId)
      const { error } = await supabase
        .from('exam_attempts')
        .delete()
        .eq('id', attemptId)

      if (error) throw error

      setRecentAttempts((prev) => prev.filter((a) => a.id !== attemptId))
      toast.success('ลบประวัติการสอบรอบนี้เรียบร้อยแล้ว')
    } catch (err: any) {
      toast.error(err.message, 'ไม่สามารถลบประวัติได้')
    } finally {
      setDeletingAttemptId(null)
    }
  }

  const handleClearAllHistory = async () => {
    if (!user) return
    const ok = await confirm({
      title: 'ลบประวัติการสอบทั้งหมด?',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการสอบทุกรอบของคุณ?\nข้อมูลทั้งหมดจะถูกลบถาวรและไม่สามารถกู้คืนได้',
      confirmText: 'ลบประวัติทั้งหมด',
      cancelText: 'ยกเลิก',
      type: 'danger',
    })
    if (!ok) return

    try {
      setIsClearingAll(true)
      const { error } = await supabase
        .from('exam_attempts')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error

      setRecentAttempts([])
      toast.success('ลบประวัติการสอบทั้งหมดเรียบร้อยแล้ว')
    } catch (err: any) {
      toast.error(err.message, 'ไม่สามารถลบประวัติทั้งหมดได้')
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
  const totalQuestionCount = exams.reduce((sum, exam) => sum + (exam.total_questions || 0), 0)
  const totalQuestionLabel = totalQuestionCount.toLocaleString('th-TH')

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
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 sm:p-8 md:p-10 shadow-xl shadow-indigo-950/10">
          <div className="absolute right-[-40px] top-[-40px] w-72 h-72 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none animate-blob"></div>
          <div className="absolute left-[-30px] bottom-[-30px] w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none animate-blob-delayed"></div>
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
              className={`p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 active:scale-[0.98] flex items-center justify-between gap-3 ${
                examMode === 'real_exam'
                  ? 'border-amber-500 bg-amber-50/60 shadow-md shadow-amber-500/10'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 transition-transform duration-200 ${
                  examMode === 'real_exam' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 scale-105' : 'bg-slate-100 text-slate-500'
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
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${
                examMode === 'real_exam' ? 'border-amber-500 bg-amber-500 text-white scale-110' : 'border-slate-300'
              }`}>
                {examMode === 'real_exam' && <Check size={12} strokeWidth={3} />}
              </div>
            </div>

            {/* Practice Mode */}
            <div
              onClick={() => setExamMode('practice')}
              className={`p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 active:scale-[0.98] flex items-center justify-between gap-3 ${
                examMode === 'practice'
                  ? 'border-indigo-600 bg-indigo-50/60 shadow-md shadow-indigo-600/10'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 transition-transform duration-200 ${
                  examMode === 'practice' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-105' : 'bg-slate-100 text-slate-500'
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
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${
                examMode === 'practice' ? 'border-indigo-600 bg-indigo-600 text-white scale-110' : 'border-slate-300'
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-2xl w-full sm:w-fit flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen size={16} />
              <span>2. ทำข้อสอบรวมทั้งหมด ({totalQuestionLabel} ข้อ)</span>
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
              <span>2. เลือกทำเฉพาะหมวด</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-extrabold">
                {topics.length} หมวด
              </span>
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal size={16} />
              <span>2. จัดชุดข้อสอบเอง</span>
              {customExamSets.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-extrabold">
                  {customExamSets.length} ชุด
                </span>
              )}
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
                    <p className="text-xs text-slate-500">รวมข้อสอบทุกสาระวิชา {totalQuestionLabel} ข้อ</p>
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
                      className="group relative bg-white rounded-2xl p-6 border border-slate-200/90 hover:border-indigo-500/50 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:shadow-indigo-500/10 transition-all duration-300"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
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
                          <span>จำนวน <strong>{exam.total_questions?.toLocaleString('th-TH') || 0}</strong> ข้อ</span>
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
                        className={`w-full sm:w-auto sm:min-w-[200px] flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm shadow-md active:scale-95 hover:shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer ${
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
            ) : activeTab === 'topics' ? (
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
                        className="group bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-indigo-500/50 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {topic.questionCount} ข้อ
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm mb-3 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
                            {topic.name}
                          </h3>
                        </div>

                        <button
                          onClick={() => handleStartExam(primaryExam.id, topic.id)}
                          disabled={isStarting}
                          className={`mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl font-semibold text-xs active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-70 ${
                            examMode === 'real_exam'
                              ? 'bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 hover:border-amber-600 shadow-sm hover:shadow-amber-600/20'
                              : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white shadow-sm hover:shadow-indigo-600/20'
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
            ) : (
              /* TAB 3: CUSTOM EXAM SETS (USER SELECTED TOPICS) */
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <span>ชุดข้อสอบที่จัดเอง</span>
                      <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                        เลือกหลายหมวดผสมกัน
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      สร้างชุดข้อสอบเฉพาะกิจโดยหยิบเลือกหมวดวิชาที่ต้องการมาผสมกัน บันทึกลงระบบไว้ฝึกซ้อมได้ตลอด
                    </p>
                  </div>
                  <button
                    onClick={openCreateCustomModal}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all cursor-pointer flex-shrink-0"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    <span>+ สร้างชุดข้อสอบใหม่</span>
                  </button>
                </div>

                {customExamSets.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border-2 border-dashed border-slate-200 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto shadow-inner">
                      <SlidersHorizontal size={32} />
                    </div>
                    <div className="max-w-md mx-auto space-y-1.5">
                      <h3 className="font-bold text-slate-800 text-base">ยังไม่มีชุดข้อสอบที่สร้างเอง</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        คุณสามารถหยิบเลือกหมวดวิชา 2 หมวดขึ้นไปมารวมกันเป็นชุดฝึกเฉพาะตัว เช่น เน้นเฉพาะ พ.ร.บ. หรือเน้นวิชาความจำ พร้อมกำหนดจำนวนข้อและสัดส่วน % ได้
                      </p>
                    </div>
                    <button
                      onClick={openCreateCustomModal}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 cursor-pointer active:scale-95 transition-all"
                    >
                      <Plus size={15} />
                      <span>คลิกเพื่อเริ่มสร้างชุดข้อสอบ</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customExamSets.map((cSet) => {
                      const isStarting = startingId === `custom-${cSet.id}`
                      const setTopicIds: number[] = Array.isArray(cSet.topic_ids) ? cSet.topic_ids : []
                      const selectedTopicsList = topics.filter((t) => setTopicIds.includes(t.id))
                      const totalAvailable = selectedTopicsList.reduce((sum, t) => sum + (t.questionCount || 0), 0)
                      const totalQuestions = cSet.total_questions || totalAvailable

                      // Topic distribution with colors and percentages
                      const distribution: any[] = Array.isArray(cSet.topic_distribution) && cSet.topic_distribution.length > 0
                        ? cSet.topic_distribution
                        : selectedTopicsList.map((t) => ({
                            topic_id: t.id,
                            name: t.name,
                            question_count: t.questionCount,
                            percentage: totalAvailable > 0 ? Math.round((t.questionCount / totalAvailable) * 1000) / 10 : 0,
                          }))

                      return (
                        <div
                          key={cSet.id}
                          className="group bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-purple-400 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between relative"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 flex items-center gap-1">
                                <Layers size={11} />
                                <span>{selectedTopicsList.length} หมวดวิชา</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                                  {totalQuestions} ข้อ
                                  {totalQuestions < totalAvailable && (
                                    <span className="text-slate-400 font-normal ml-1">
                                      / {totalAvailable}
                                    </span>
                                  )}
                                </span>
                                <button
                                  onClick={(e) => handleDeleteCustomSet(cSet.id, e)}
                                  disabled={deletingSetId === cSet.id}
                                  className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="ลบชุดข้อสอบนี้"
                                >
                                  {deletingSetId === cSet.id ? (
                                    <Loader2 size={14} className="animate-spin text-rose-500" />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                </button>
                              </div>
                            </div>

                            <h3 className="font-bold text-slate-900 text-base mb-2 group-hover:text-purple-600 transition-colors leading-snug">
                              {cSet.title}
                            </h3>

                            {/* Percentage Breakdown Progress Bar */}
                            <div className="w-full h-2 rounded-full bg-slate-100 flex overflow-hidden mb-3 border border-slate-200/60 shadow-inner">
                              {distribution.map((d: any, dIdx: number) => {
                                const color = TOPIC_PALETTE[dIdx % TOPIC_PALETTE.length]
                                const pct = d.percentage ?? (totalQuestions > 0 ? Math.round((d.question_count / totalQuestions) * 100) : 0)
                                return (
                                  <div
                                    key={d.topic_id || dIdx}
                                    className={`${color.bar} h-full transition-all`}
                                    style={{ width: `${pct}%` }}
                                    title={`${d.name}: ${d.question_count} ข้อ (${pct}%)`}
                                  />
                                )
                              })}
                            </div>

                            {/* Tags of topics with percentage breakdown */}
                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {distribution.map((d: any, dIdx: number) => {
                                const color = TOPIC_PALETTE[dIdx % TOPIC_PALETTE.length]
                                const pct = d.percentage ?? (totalQuestions > 0 ? Math.round((d.question_count / totalQuestions) * 100) : 0)
                                return (
                                  <span
                                    key={d.topic_id || dIdx}
                                    className={`text-[11px] px-2.5 py-1 rounded-lg ${color.light} ${color.text} border ${color.border} font-medium flex items-center gap-1.5`}
                                    title={`${d.name}: ${d.question_count} ข้อ (${pct}%)`}
                                  >
                                    <span className={`w-2 h-2 rounded-full ${color.bg} flex-shrink-0`} />
                                    <span className="truncate max-w-[130px]">{d.name}</span>
                                    <span className="font-bold flex-shrink-0">
                                      {d.question_count} ข้อ ({pct}%)
                                    </span>
                                  </span>
                                )
                              })}
                            </div>
                          </div>

                          <button
                            onClick={() => handleStartExam(primaryExam.id, undefined, cSet)}
                            disabled={isStarting}
                            className={`mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl font-bold text-xs active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-70 ${
                              examMode === 'real_exam'
                                ? 'bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 hover:border-amber-600 shadow-sm hover:shadow-amber-600/20'
                                : 'bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white border border-purple-200 hover:border-purple-600 shadow-sm hover:shadow-purple-600/20'
                            }`}
                          >
                            {isStarting ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <>
                                <span>
                                  {examMode === 'real_exam'
                                    ? `สอบจริงชุดนี้ (${timeLimitMinutes} น.)`
                                    : `เริ่มทำชุดนี้ (${totalQuestions} ข้อ)`}
                                </span>
                                <ChevronRight size={15} />
                              </>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
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
                คลิกที่หมวดใดก็ได้เพื่อเริ่มทำทันที • เครื่องหมายถูกหมายถึงตรวจสอบโดยมนุษย์แล้ว
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {topics.map((topic, i) => (
                  <button
                    key={topic.id || i}
                    onClick={() => handleStartExam(primaryExam.id, topic.id)}
                    className="w-full text-left flex items-center justify-between gap-2 text-xs text-slate-700 p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate group-hover:text-indigo-600 font-medium">{topic.name}</span>
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle size={12} aria-hidden="true" />
                          ตรวจสอบโดยมนุษย์แล้ว
                        </span>
                      </div>
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
                    : `ทำข้อสอบรวมทั้งหมด (${totalQuestionLabel} ข้อ)`
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
                                : att.status === 'paused'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isDone
                              ? (att.total_score != null ? `${Number(att.total_score)} ข้อ` : 'ตรวจแล้ว')
                              : att.status === 'paused'
                              ? '⏸️ พักการสอบ'
                              : 'ทำต่อ'}
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

      {/* Modal: Create Custom Exam Set Dialog */}
      {showCreateCustomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-modal overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-purple-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-inner">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                    จัดชุดข้อสอบด้วยตัวเอง
                  </h3>
                  <p className="text-xs text-slate-500">
                    เลือกหมวดวิชา กำหนดจำนวนข้อที่ต้องการสอบ พร้อมคำนวณสัดส่วน % แต่ละส่วน
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateCustomModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="ปิด"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveCustomSet} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
                {/* 1. Title Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>ตั้งชื่อชุดข้อสอบ: *</span>
                    <span className="text-[11px] text-slate-400 font-normal">เช่น ชุดติวเข้ม พ.ร.บ.</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customSetTitle}
                    onChange={(e) => setCustomSetTitle(e.target.value)}
                    placeholder="เช่น ชุดเน้นกฎหมายวิธีปฏิบัติราชการทางปกครอง และระเบียบกลาง"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm text-slate-900 bg-white"
                  />
                </div>

                {/* 2. Select Topics List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      1. เลือกหมวดวิชาที่ต้องการรวม ({selectedTopicIds.length}/{topics.length} หมวด):
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllTopics}
                        className="text-[11px] font-bold text-purple-600 hover:underline cursor-pointer"
                      >
                        เลือกทั้งหมด
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={handleClearAllTopics}
                        className="text-[11px] font-bold text-slate-400 hover:underline cursor-pointer"
                      >
                        ล้างที่เลือก
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                    {topics.map((topic, i) => {
                      const isChecked = selectedTopicIds.includes(topic.id)
                      return (
                        <div
                          key={topic.id}
                          onClick={() => handleToggleTopic(topic.id)}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-purple-50/80 border-purple-400 text-purple-950 shadow-sm'
                              : 'bg-white hover:bg-slate-100/80 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all flex-shrink-0 ${
                              isChecked ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isChecked && <Check size={12} strokeWidth={3} />}
                            </div>
                            <span className="text-xs font-medium truncate">
                              {i + 1}. {topic.name}
                            </span>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                            isChecked ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {topic.questionCount} ข้อ
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 3. Target Question Setting (Set number of questions to test) */}
                {selectedTopicIds.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <SlidersHorizontal size={14} className="text-purple-600" />
                        <span>2. กำหนดจำนวนข้อที่ต้องการสอบ:</span>
                      </label>
                      <span className="text-[11px] text-slate-500">
                        มีข้อสอบทั้งหมดในหมวดที่เลือก: <strong className="text-purple-700">{totalAvailableQuestions} ข้อ</strong>
                      </span>
                    </div>

                    {/* Presets and Custom Input */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectQuestionPreset('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          targetQuestionMode === 'all'
                            ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        ทั้งหมด ({totalAvailableQuestions} ข้อ)
                      </button>

                      {totalAvailableQuestions >= 20 && (
                        <button
                          type="button"
                          onClick={() => handleSelectQuestionPreset(20)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            targetQuestionMode === 'preset' && customTargetCountInput === '20'
                              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          20 ข้อ
                        </button>
                      )}

                      {totalAvailableQuestions >= 30 && (
                        <button
                          type="button"
                          onClick={() => handleSelectQuestionPreset(30)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            targetQuestionMode === 'preset' && customTargetCountInput === '30'
                              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          30 ข้อ
                        </button>
                      )}

                      {totalAvailableQuestions >= 50 && (
                        <button
                          type="button"
                          onClick={() => handleSelectQuestionPreset(50)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            targetQuestionMode === 'preset' && customTargetCountInput === '50'
                              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          50 ข้อ
                        </button>
                      )}

                      {totalAvailableQuestions >= 100 && (
                        <button
                          type="button"
                          onClick={() => handleSelectQuestionPreset(100)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            targetQuestionMode === 'preset' && customTargetCountInput === '100'
                              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          100 ข้อ
                        </button>
                      )}

                      {/* Custom input */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-xs text-slate-500 font-medium">กำหนดเอง:</span>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min={1}
                            max={totalAvailableQuestions}
                            value={customTargetCountInput}
                            onChange={(e) => handleCustomTargetChange(e.target.value)}
                            className="w-20 px-2.5 py-1 text-xs text-center font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                          />
                          <span className="text-xs text-slate-500 ml-1.5">ข้อ</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Percentage Breakdown Display */}
                {selectedTopicIds.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <PieChart size={14} className="text-purple-600" />
                        <span>3. สัดส่วนและจำนวนข้อรายหมวด (% Breakdown):</span>
                      </label>
                      <span className="text-[11px] font-bold text-purple-700">
                        รวม {activeCustomTotalQuestions} ข้อ (100%)
                      </span>
                    </div>

                    {/* Visual Segmented Progress Bar */}
                    <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden border border-slate-200/80 shadow-inner">
                      {topicDistributionBreakdown.map((item) => (
                        <div
                          key={item.topic_id}
                          className={`${item.color.bar} h-full transition-all`}
                          style={{ width: `${item.percentage}%` }}
                          title={`${item.name}: ${item.question_count} ข้อ (${item.percentage}%)`}
                        />
                      ))}
                    </div>

                    {/* Breakdown list with per-topic question steppers */}
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {topicDistributionBreakdown.map((item) => (
                        <div
                          key={item.topic_id}
                          className={`p-3 rounded-xl border ${item.color.border} ${item.color.light} flex items-center justify-between gap-3`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-3 h-3 rounded-full ${item.color.bg} flex-shrink-0 shadow-sm`} />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 block truncate">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                มี {item.available_count} ข้อในระบบ
                              </span>
                            </div>
                          </div>

                          {/* Stepper + % badge */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-sm">
                              <button
                                type="button"
                                onClick={() => handleAdjustTopicCount(item.topic_id, -1)}
                                disabled={item.question_count <= 1}
                                className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 cursor-pointer transition-colors"
                                title="ลด 1 ข้อ"
                              >
                                <Minus size={11} strokeWidth={2.5} />
                              </button>
                              <span className="px-2 py-1 text-xs font-extrabold text-slate-800 min-w-[32px] text-center">
                                {item.question_count}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAdjustTopicCount(item.topic_id, 1)}
                                disabled={item.question_count >= item.available_count}
                                className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 cursor-pointer transition-colors"
                                title="เพิ่ม 1 ข้อ"
                              >
                                <Plus size={11} strokeWidth={2.5} />
                              </button>
                            </div>

                            {/* Percentage Badge */}
                            <span className={`text-xs font-black px-2 py-1 rounded-lg bg-white ${item.color.text} border ${item.color.border} shadow-sm min-w-[54px] text-center`}>
                              {item.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Summary Pill */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-purple-950 shadow-sm">
                  <div className="space-y-0.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>สรุปชุดข้อสอบ:</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 font-extrabold text-[11px]">
                        {selectedTopicIds.length} หมวดวิชา
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      มีข้อสอบทั้งหมดในหมวดที่เลือก {totalAvailableQuestions} ข้อ • จัดสอบ {activeCustomTotalQuestions} ข้อ
                    </p>
                  </div>
                  <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                    <span className="text-[10px] text-purple-600 font-medium">จำนวนข้อที่จะใช้สอบจริง</span>
                    <span className="font-black text-lg text-purple-700">
                      {activeCustomTotalQuestions} ข้อ
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateCustomModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomSet || selectedTopicIds.length === 0 || activeCustomTotalQuestions === 0}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSavingCustomSet ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>บันทึกชุดข้อสอบ ({activeCustomTotalQuestions} ข้อ)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
