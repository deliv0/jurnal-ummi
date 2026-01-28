import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import JurnalForm from '@/components/JurnalForm' // Import komponen kita

export default async function JurnalPage({
  params,
}: {
  params: Promise<{ id: string; siswaId: string }>
}) {
  const { id, siswaId } = await params
  const supabase = await createClient()

  // 1. Cek User Login
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  // 2. Ambil Data Siswa
  const { data: siswa } = await supabase
    .from('siswa')
    .select('*, level(nama)')
    .eq('id', siswaId)
    .single()

  if (!siswa) return <div>Siswa tidak ditemukan</div>

  // 3. Ambil Target Aktif milik Siswa ini
  // Kita perlu join ke tabel master 'target_pembelajaran' untuk dapat Judulnya
  const { data: targets } = await supabase
    .from('siswa_target')
    .select(`
      id,
      status,
      target_ref_id,
      target_pembelajaran (
        id,
        judul,
        kategori_target,
        urutan
      )
    `)
    .eq('siswa_id', siswaId)
    .eq('status', 'active') // Hanya ambil yang statusnya Active
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-4">
          <Link
            href={`/kelompok/${id}`}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {siswa.nama_siswa}
            </h1>
            <p className="text-xs text-slate-500">
              Level: {siswa.level?.nama}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Target Pembelajaran Aktif
          </h2>
        </div>

        {/* Panggil Komponen JurnalForm disini */}
        <JurnalForm 
          siswa={siswa} 
          targets={targets || []} 
          user={user} 
        />
        
      </main>
    </div>
  )
}