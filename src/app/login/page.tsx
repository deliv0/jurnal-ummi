import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { message: string }
}) {
  // Perubahan: Tambah await di sini
  const supabase = await createClient()

  // Cek jika user sudah login
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    return redirect('/')
  }

  // Server Action untuk Login
  const signIn = async (formData: FormData) => {
    'use server'

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    
    // Perubahan: Tambah await di sini juga
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return redirect('/login?message=Login Gagal: Cek Email/Password')
    }

    return redirect('/')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Masuk Jurnal
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Aplikasi Monitoring Ummi
          </p>
        </div>
        
        <form className="mt-8 space-y-6" action={signIn}>
          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                className="relative block w-full rounded-t-md border-0 p-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:z-10 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Email Address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full rounded-b-md border-0 p-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:z-10 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Masuk
            </button>
          </div>
          
          {searchParams?.message && (
            <p className="mt-2 text-center text-sm font-bold text-red-600 bg-red-100 p-2 rounded">
              {searchParams.message}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}