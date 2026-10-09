import { supabase } from '../lib/supabase'
import { GraduationCap, BookOpen, Award } from 'lucide-react'

export default function Login() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/select`,
      }
    })
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Decorative/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-white p-2 rounded-lg text-blue-600">
              <GraduationCap size={32} />
            </div>
            <span className="text-2xl font-bold tracking-tight">Nitikon Exam</span>
          </div>
          
          <h1 className="text-5xl font-extrabold leading-tight mb-6">
            คลังข้อสอบนิติกร <br/>
            <span className="text-blue-200">เพื่อความสำเร็จของคุณ</span>
          </h1>
          <p className="text-lg text-blue-100 max-w-md">
            ฝึกทำข้อสอบออนไลน์ ทบทวนความรู้กฎหมาย และวิเคราะห์จุดอ่อนของคุณแบบเรียลไทม์
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-6 mt-12">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/50 p-3 rounded-lg"><BookOpen size={24} /></div>
            <div>
              <div className="font-semibold text-lg">1,000+</div>
              <div className="text-blue-200 text-sm">ข้อสอบทั้งหมด</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/50 p-3 rounded-lg"><Award size={24} /></div>
            <div>
              <div className="font-semibold text-lg">วิเคราะห์ผล</div>
              <div className="text-blue-200 text-sm">ตรงจุดแม่นยำ</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 bg-white relative">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="flex items-center gap-2 lg:hidden mb-8 justify-center">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <GraduationCap size={28} />
            </div>
            <span className="text-2xl font-bold text-gray-900">Nitikon Exam</span>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">ยินดีต้อนรับ</h2>
            <p className="text-gray-500">กรุณาเข้าสู่ระบบเพื่อเริ่มทำแบบทดสอบ</p>
          </div>

          <div className="mt-8">
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-xl shadow-sm bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md transition-all duration-200 font-medium text-lg"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
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
              เข้าสู่ระบบด้วย Google
            </button>
          </div>

          <div className="mt-8 flex items-center justify-center">
            <div className="text-sm text-gray-400 text-center">
              โดยการเข้าสู่ระบบ คุณยอมรับข้อตกลงและเงื่อนไขการใช้งาน
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
