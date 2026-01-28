import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, BookOpen } from 'lucide-react'

export default async function KelompokDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // 1. Tangkap ID dari URL (Next.js 15 Style)
  const { id } = await params
  const supabase = await createClient()

  // 2. Ambil Info Kelompok
  const { data: kelompok } = await supabase
    .from('kelompok')
    .select('*')
    .eq('id', id)
    .single()

  if (!kelompok) {
    return <div className="p-8">Kelompok tidak ditemukan.</div>
  }

  // 3. Ambil Daftar Siswa di kelompok ini
  const { data: siswaList } = await supabase
    .from('siswa')
    .select(`
      *,
      level ( nama )
    `)
    .eq('kelompok_id', id)
    .order('nama_siswa', { ascending: true })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          <Link
            href="/"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {kelompok.nama_kelompok}
            </h1>
            <p className="text-xs text-slate-500">{kelompok.jadwal_sesi}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Daftar Santri</h2>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            Total: {siswaList?.length || 0}
          </span>
        </div>

        <div className="space-y-3">
          {siswaList?.map((siswa) => (
            <Link
              key={siswa.id}
              href={`/kelompok/${id}/siswa/${siswa.id}`} // Next Step: Halaman Jurnal
              className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-400 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">
                    {siswa.nama_siswa}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <BookOpen size={12} />
                    <span>Level: {siswa.level?.nama || '-'}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100">
                Buka Jurnal &rarr;
              </div>
            </Link>
          ))}

          {siswaList?.length === 0 && (
            <div className="py-8 text-center text-slate-500">
              Belum ada santri di kelompok ini.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}