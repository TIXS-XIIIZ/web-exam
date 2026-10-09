import { supabase } from '../lib/supabase'
import { LogIn } from 'lucide-react'

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
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          ระบบสอบออนไลน์
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          โปรดเข้าสู่ระบบเพื่อดำเนินการต่อ
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <button
            onClick={handleLogin}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 gap-2 items-center"
          >
            <LogIn size={20} />
            เข้าสู่ระบบด้วย Gmail
          </button>
        </div>
      </div>
    </div>
  )
}
