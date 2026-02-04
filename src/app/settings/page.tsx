'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, User, Lock, Save, Loader2, CheckCircle, AlertCircle, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  // FORM STATE
  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  useEffect(() => {
    const getData = async () => {
      // 1. Ambil Auth User
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      
      setUser(user)
      setEmail(user.email || '')

      // 2. Ambil Data Profil (Nama) dari tabel public.users
      const { data: profile } = await supabase.from('users').select('nama_lengkap').eq('id', user.id).single()
      if(profile) setNama(profile.nama_lengkap)
      
      setLoading(false)
    }
    getData()
  }, [])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
        // 1. Update Password (Jika diisi)
        if (password) {
            if(password.length < 6) throw new Error("Password minimal 6 karakter.")
            
            const { error: passError } = await supabase.auth.updateUser({ password: password })
            if (passError) throw passError
        }

        // 2. Update Nama di tabel public.users
        const { error: profileError } = await supabase
            .from('users')
            .update({ nama_lengkap: nama })
            .eq('id', user.id)
        
        if (profileError) throw profileError

        setMessage({ type: 'success', text: 'Profil berhasil diperbarui!' })
        setPassword('') // Reset field password agar aman

    } catch (err: any) {
        setMessage({ type: 'error', text: err.message })
    } finally {
        setSaving(false)
    }
  }

  if(loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600"/></div>

  return (
    <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-xl mx-auto">
            {/* HEADER */}
            <div className="mb-8 flex items-center gap-4">
                <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600">
                    <ArrowLeft size={20}/>
                </Link>
                <h1 className="text-2xl font-bold text-slate-900">Pengaturan Akun</h1>
            </div>

            {message && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {message.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                    {message.text}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-blue-50 p-6 border-b border-blue-100 flex items-center gap-4">
                    <div className="h-16 w-16 bg-blue-200 rounded-full flex items-center justify-center text-blue-600">
                        <User size={32}/>
                    </div>
                    <div>
                        <h2 className="font-bold text-lg text-slate-800">{nama || 'Pengguna'}</h2>
                        <p className="text-slate-500 text-sm">{email}</p>
                    </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
                    
                    {/* EDIT NAMA */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <User size={16}/> Nama Lengkap
                        </label>
                        <input 
                            type="text" 
                            required
                            value={nama}
                            onChange={(e) => setNama(e.target.value)}
                            className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Nama Lengkap Anda"
                        />
                    </div>

                    {/* EMAIL (READ ONLY) */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <Shield size={16}/> Email (Login)
                        </label>
                        <input 
                            type="email" 
                            disabled
                            value={email}
                            className="w-full p-3 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-slate-400 mt-1">*Email tidak dapat diubah.</p>
                    </div>

                    <hr className="border-slate-100 my-4"/>

                    {/* GANTI PASSWORD */}
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                        <label className="block text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                            <Lock size={16}/> Ganti Password Baru
                        </label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 rounded-lg border border-yellow-300 focus:ring-2 focus:ring-yellow-500 outline-none transition-all bg-white"
                            placeholder="Biarkan kosong jika tidak ingin mengubah"
                            minLength={6}
                        />
                        <p className="text-xs text-yellow-600 mt-2">
                            Minimal 6 karakter. Harap gunakan password yang sulit ditebak.
                        </p>
                    </div>

                    {/* TOMBOL SAVE */}
                    <div className="pt-4">
                        <button 
                            type="submit" 
                            disabled={saving}
                            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:bg-slate-300 disabled:shadow-none"
                        >
                            {saving ? <Loader2 className="animate-spin"/> : <><Save size={20}/> SIMPAN PERUBAHAN</>}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    </div>
  )
}