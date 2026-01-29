// ... imports (Pastikan ada revalidatePath atau router refresh jika pakai client component)
// TAPI karena halaman ini Server Component, kita butuh Server Action kecil di dalam file ini atau terpisah.
// Untuk kemudahan, kita ubah sedikit logicnya.

import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { ArrowLeft, User, BookOpen, Send, CheckCircle } from 'lucide-react'
import { revalidatePath } from 'next/cache'

export default async function KelompokDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // ACTION: Guru Mengajukan Santri
  async function ajukanTes(formData: FormData) {
    'use server'
    const siswaId = formData.get('siswaId')
    const supabase = await createClient()
    
    await supabase
      .from('siswa')
      .update({ status_tes: 'siap_tes' })
      .eq('id', siswaId)
      
    revalidatePath(`/kelompok/${id}`)
  }

  // ACTION: Guru Membatalkan Pengajuan
  async function batalAjukan(formData: FormData) {
    'use server'
    const siswaId = formData.get('siswaId')
    const supabase = await createClient()
    
    await supabase
      .from('siswa')
      .update({ status_tes: 'belajar' })
      .eq('id', siswaId)
      
    revalidatePath(`/kelompok/${id}`)
  }

  // 1. Ambil Info Kelompok
  const { data: kelompok } = await supabase
    .from('kelompok')
    .select('*')
    .eq('id', id)
    .single()

  // 2. Ambil Daftar Siswa
  const { data: siswaList } = await supabase
    .from('siswa')
    .select(`*, level ( nama )`)
    .eq('kelompok_id', id)
    .order('nama_siswa', { ascending: true })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          <Link href="/" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{kelompok?.nama_kelompok}</h1>
            <p className="text-xs text-slate-500">{kelompok?.jadwal_sesi}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Daftar Santri</h2>
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
            Total: {siswaList?.length || 0}
          </span>
        </div>

        <div className="space-y-3">
          {siswaList?.map((siswa) => (
            <div key={siswa.id} className="group flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-400 transition-all gap-4">
              
              {/* Info Siswa (Klik masuk ke detail jurnal) */}
              <Link href={`/kelompok/${id}/siswa/${siswa.id}`} className="flex items-center gap-4 flex-1">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${siswa.status_tes === 'siap_tes' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                   {siswa.status_tes === 'siap_tes' ? <CheckCircle size={20}/> : <User size={20}/>}
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">{siswa.nama_siswa}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <BookOpen size={12} />
                    <span>Level: {siswa.level?.nama || '-'}</span>
                    {siswa.status_tes === 'siap_tes' && (
                        <span className="text-green-600 font-bold ml-2">• MENUNGGU UJIAN</span>
                    )}
                  </div>
                </div>
              </Link>

              {/* Tombol Aksi Guru */}
              <div className="flex items-center gap-2">
                 {siswa.status_tes === 'siap_tes' ? (
                    <form action={batalAjukan}>
                        <input type="hidden" name="siswaId" value={siswa.id} />
                        <button className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded hover:bg-red-50" title="Batalkan Pengajuan">
                            Batal
                        </button>
                    </form>
                 ) : (
                    <form action={ajukanTes}>
                        <input type="hidden" name="siswaId" value={siswa.id} />
                        <button className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700 flex items-center gap-1 shadow-sm" title="Ajukan ke Admin untuk diuji">
                            <Send size={12}/> Ajukan Tes
                        </button>
                    </form>
                 )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}