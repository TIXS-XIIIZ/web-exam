import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Scale, CheckCircle2, BookOpen, BarChart3, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react'

export default function Login() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/select`,
        }
      })
      if (error) throw error
    } catch (err: any) {
      console.error(err)
      alert('เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'))
      setLoading(false)
    }
  }

  const features = [
    {
      icon: BookOpen,
      title: 'คลังข้อสอบ 1,050 ข้อ',
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
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none"></div>

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
            พร้อมใช้งาน • ครอบคลุม 9 หมวดหลัก
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
            <div className="text-center space-y-2 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
                <Scale size={28} />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">เข้าสู่ระบบเพื่อเริ่มสอบ</h2>
              <p className="text-sm text-slate-400">
                เข้าใช้งานผ่าน Gmail สะดวก ปลอดภัย ไม่ต้องจำรหัสผ่าน
              </p>
            </div>

            {/* Google Sign-in button */}
            <div className="space-y-4">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full relative group flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl bg-white text-slate-900 font-semibold text-base hover:bg-slate-100 active:scale-[0.99] transition-all duration-200 shadow-md shadow-white/10 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="animate-spin text-slate-700" size={22} />
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
                <span>{loading ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google (Gmail)'}</span>
                <ArrowRight size={18} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="pt-2 text-center text-xs text-slate-500 leading-relaxed">
                การคลิกเข้าสู่ระบบถือว่ายอมรับการจัดเก็บผลคะแนนและประวัติการสอบของคุณในระบบอย่างปลอดภัย
              </div>
            </div>

            {/* Micro stats banner inside card */}
            <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-around text-center">
              <div>
                <div className="text-lg font-bold text-white">1,050</div>
                <div className="text-xs text-slate-400">ข้อสอบบรรจุ</div>
              </div>
              <div className="h-8 w-[1px] bg-slate-800"></div>
              <div>
                <div className="text-lg font-bold text-emerald-400">เฉลยทันที</div>
                <div className="text-xs text-slate-400">พร้อมเหตุผล</div>
              </div>
              <div className="h-8 w-[1px] bg-slate-800"></div>
              <div>
                <div className="text-lg font-bold text-indigo-400">9 หมวด</div>
                <div className="text-xs text-slate-400">สาระวิชา</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 text-center text-xs text-slate-500 border-t border-slate-900">
        © 2026 Nitikon Exam System. ข้อมูลข้อสอบตามหลักสูตรความรู้สำหรับตำแหน่งนิติกรปฏิบัติการ
      </footer>
    </div>
  )
}
