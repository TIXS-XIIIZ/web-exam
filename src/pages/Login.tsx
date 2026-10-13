import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAlert } from '../components/AlertProvider'
import { 
  Scale, 
  CheckCircle2, 
  BookOpen, 
  BarChart3, 
  ShieldCheck, 
  ArrowRight, 
  Loader2, 
  Mail, 
  Lock, 
  UserPlus, 
  LogIn, 
  Sparkles 
} from 'lucide-react'

interface LoginProps {
  initialError?: string | null
}

export default function Login({ initialError }: LoginProps) {
  const { toast } = useAlert()
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(initialError || null)
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [questionCount, setQuestionCount] = useState(1110)
  const [topicCount, setTopicCount] = useState(13)

  useEffect(() => {
    async function loadCounts() {
      const [exams, topics] = await Promise.all([
        supabase.from('exams').select('total_questions'),
        supabase.from('topics').select('id', { count: 'exact', head: true }),
      ])
      if (exams.data) setQuestionCount(exams.data.reduce((sum, exam) => sum + (exam.total_questions || 0), 0))
      if (topics.count !== null) setTopicCount(topics.count)
    }
    loadCounts()
  }, [])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setAuthError(null)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/select`,
        }
      })
      if (error) throw error
    } catch (err: any) {
      console.error(err)
      const msg = err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google'
      setAuthError(msg)
      toast.error(msg, 'เข้าสู่ระบบไม่สำเร็จ')
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    try {
      setDemoLoading(true)
      setAuthError(null)
      const { error } = await supabase.auth.signInWithPassword({
        email: 'admin@nitikon.com',
        password: 'ExamPassword2026!',
      })
      if (error) throw error
      toast.success('ยินดีต้อนรับเข้าสู่ระบบบัญชีทดสอบ!')
      window.location.href = '/select'
    } catch (err: any) {
      console.error(err)
      const msg = err.message || 'ไม่สามารถเข้าสู่ระบบด้วยบัญชีทดสอบได้'
      setAuthError(msg)
      toast.error(msg, 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setDemoLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      const msg = 'กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน'
      setAuthError(msg)
      toast.warning(msg)
      return
    }

    try {
      setLoading(true)
      setAuthError(null)
      setAuthMessage(null)

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        if (data.session) {
          toast.success('สร้างบัญชีและเข้าสู่ระบบสำเร็จ!')
          window.location.href = '/select'
        } else {
          const msg = 'สร้างบัญชีสำเร็จ! เข้าสู่ระบบได้ทันที'
          setAuthMessage(msg)
          toast.success(msg)
          setIsSignUp(false)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        toast.success('เข้าสู่ระบบสำเร็จ!')
        window.location.href = '/select'
      }
    } catch (err: any) {
      console.error(err)
      const msg = err.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
      setAuthError(msg)
      toast.error(msg, 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    {
      icon: BookOpen,
      title: `คลังข้อสอบ ${questionCount.toLocaleString('th-TH')} ข้อ`,
      desc: 'ครอบคลุมครบทุกหมวดวิชากฎหมายที่ใช้สอบนิติกร',
    },
    {
      icon: CheckCircle2,
      title: 'ระบบเฉลยทันที (Instant Feedback)',
      desc: 'รู้ผลถูก-ผิดทันทีที่ตอบ พร้อมคำอธิบายข้อกฎหมายอย่างละเอียด',
    },
    {
      icon: BarChart3,
      title: 'วิเคราะห์จุดอ่อนรายหมวด',
      desc: 'สรุปผลคะแนน บันทึกประวัติ และชี้จุดที่ต้องอ่านทบทวนเพิ่ม',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between text-slate-100 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[128px] pointer-events-none animate-blob"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none animate-blob-delayed"></div>

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Scale className="text-white" size={24} />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white block">Nitikon Exam</span>
            <span className="text-xs text-indigo-300 font-medium tracking-wide uppercase">คลังข้อสอบนิติกร</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-indigo-300 backdrop-blur-md">
          <ShieldCheck size={14} className="text-emerald-400" />
          ระบบฐานข้อมูลมาตรฐาน Supabase
        </div>
      </header>

      {/* Main Hero & Login Box */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Hero Details */}
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            พร้อมใช้งาน • ครอบคลุม {topicCount} หมวดหลัก
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            เตรียมพร้อมสอบนิติกร <br />
            <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-sky-300 bg-clip-text text-transparent">
              ด้วยแบบทดสอบจำลองเสมือนจริง
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
            ระบบฝึกทำข้อสอบออนไลน์ที่ช่วยให้คุณรู้ผลและเข้าใจเหตุผลของคำตอบได้ทันทีในทุกข้อ ข้ามไปมาได้สะดวก พร้อมระบบสรุปคะแนนวิเคราะห์จุดอ่อนที่ตรงจุด
          </p>

          {/* Key Feature highlights */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {features.map((feat, idx) => {
              const Icon = feat.icon
              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm hover:border-indigo-500/40 transition-all duration-200"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3">
                    <Icon size={20} />
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-1">{feat.title}</h3>
                  <p className="text-xs text-slate-400 leading-normal">{feat.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Login Card */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl bg-slate-900/80 border border-slate-800/90 shadow-2xl shadow-indigo-950/50 backdrop-blur-xl">
            <div className="text-center space-y-2 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <Scale size={28} />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">เข้าสู่ระบบเพื่อเริ่มสอบ</h2>
              <p className="text-xs text-slate-400">
                เลือกวิธีเข้าใช้งานเพื่อบันทึกประวัติการทำข้อสอบของคุณ
              </p>
            </div>

            {/* Error & Message Alerts */}
            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs leading-relaxed">
                {authError}
              </div>
            )}
            {authMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed">
                {authMessage}
              </div>
            )}

            {/* Login Options Container */}
            <div className="space-y-3.5">
              {/* Option 1: Google OAuth Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading || demoLoading}
                className="w-full relative group flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 active:scale-[0.99] transition-all duration-200 shadow-md shadow-white/10 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading && !showEmailLogin ? (
                  <Loader2 className="animate-spin text-slate-700" size={20} />
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                <span>เข้าสู่ระบบด้วย Google (Gmail)</span>
                <ArrowRight size={17} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Option 2: Instant Demo / Test Account Login Button */}
              <button
                onClick={handleDemoLogin}
                disabled={loading || demoLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-medium text-sm hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-70"
              >
                {demoLoading ? (
                  <Loader2 className="animate-spin text-indigo-400" size={18} />
                ) : (
                  <Sparkles size={18} className="text-amber-400" />
                )}
                <span>{demoLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วยบัญชีทดสอบ (คลิกเดียวเริ่มได้ทันที)'}</span>
              </button>

              {/* Option 3: Collapsible Email Login Divider */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <button
                  type="button"
                  onClick={() => setShowEmailLogin(!showEmailLogin)}
                  className="flex-shrink mx-3 text-xs text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  {showEmailLogin ? '▲ ซ่อนช่องกรอก Email' : '▼ หรือเข้าสู่ระบบด้วย Email / รหัสผ่าน'}
                </button>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Collapsible Email Login Form */}
              {showEmailLogin && (
                <form onSubmit={handleEmailAuth} className="space-y-3 pt-1 animate-in fade-in duration-200">
                  <div>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
                      <input
                        type="email"
                        placeholder="อีเมลของคุณ (เช่น test@example.com)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
                      <input
                        type="password"
                        placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || demoLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-medium text-sm transition-all shadow-md shadow-indigo-600/20 disabled:opacity-70 cursor-pointer"
                  >
                    {loading && showEmailLogin ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : isSignUp ? (
                      <>
                        <UserPlus size={16} />
                        <span>สมัครสมาชิกใหม่ (ใช้งานได้ทันที)</span>
                      </>
                    ) : (
                      <>
                        <LogIn size={16} />
                        <span>เข้าสู่ระบบด้วย Email</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp)
                        setAuthError(null)
                        setAuthMessage(null)
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      {isSignUp
                        ? 'มีบัญชีอยู่แล้ว? คลิกที่นี่เพื่อเข้าสู่ระบบ'
                        : 'ยังไม่มีบัญชี? คลิกที่นี่เพื่อสมัครสมาชิก'}
                    </button>
                  </div>
                </form>
              )}

              <div className="pt-2 text-center text-[11px] text-slate-500 leading-relaxed">
                ระบบจะบันทึกประวัติการสอบและวิเคราะห์ผลสอบแบบส่วนบุคคลอย่างปลอดภัย
              </div>
            </div>

            {/* Micro stats banner inside card */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-around text-center">
              <div>
                <div className="text-base font-bold text-white">{questionCount.toLocaleString('th-TH')}</div>
                <div className="text-[11px] text-slate-400">ข้อสอบบรรจุ</div>
              </div>
              <div className="h-7 w-[1px] bg-slate-800"></div>
              <div>
                <div className="text-base font-bold text-emerald-400">เฉลยทันที</div>
                <div className="text-[11px] text-slate-400">พร้อมเหตุผล</div>
              </div>
              <div className="h-7 w-[1px] bg-slate-800"></div>
              <div>
                <div className="text-base font-bold text-indigo-400">{topicCount} หมวด</div>
                <div className="text-[11px] text-slate-400">สาระวิชา</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 text-center text-xs text-slate-500 border-t border-slate-900">
        © 2026 Nitikon Exam System. ข้อมูลข้อสอบตามหลักสูตรความรู้สำหรับตำแหน่งนิติกรปฏิบัติการ
      </footer>
    </div>
  )
}
