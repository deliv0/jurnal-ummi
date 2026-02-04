'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Search, BookOpen, Loader2 } from 'lucide-react'

export default function CekSantriPage() {
  const [nis, setNis] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleCek = async (e: React.FormEvent) => {
    e.preventDefault()
    if(!nis) return
    setLoading(true)

    // Cek apakah NIS ada
    const { data } = await supabase.from('siswa').select('id').eq('nis', nis).single()
    
    if (data) {
        router.push(`/cek/${nis}`)
    } else {
        alert("NIS tidak ditemukan. Mohon periksa kembali.")
        setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex flex-col justify-center items-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                <BookOpen size={32}/>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Portal Wali Santri</h1>
            <p className="text-slate-500 mb-8 text-sm">Pantau perkembangan hafalan, kehadiran, dan administrasi putra-putri Anda.</p>

            <form onSubmit={handleCek} className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                    <input 
                        type="text" 
                        placeholder="Masukkan NIS Santri" 
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-center text-lg tracking-widest uppercase"
                        value={nis}
                        onChange={(e) => setNis(e.target.value)}
                    />
                </div>
                <button 
                    disabled={loading}
                    className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin"/> : 'CEK DATA SANTRI'}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-400">
                &copy; {new Date().getFullYear()} Sistem Informasi Jurnal Ummi
            </div>
        </div>
    </div>
  )
}