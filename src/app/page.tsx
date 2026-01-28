import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Users } from 'lucide-react'

export default async function Dashboard() {
  const supabase = await createClient()

  // 1. Cek User Session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirect('/login')
  }

  // 2. Ambil Data User Profile (untuk tahu nama)
  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  // 3. Ambil Data Kelompok yang diajar guru ini
  const { data: kelompokList } = await supabase
    .from('kelompok')
    .select('*')
    .eq('guru_utama_id', user.id)
    .order('nama_kelompok', { ascending: true })

  // 4. Server Action untuk Logout (Kita butuh ini untuk testing nanti)
  const signOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    return redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Sederhana */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-blue-600">Jurnal Ummi</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              Ustadz {userProfile?.nama_lengkap || 'Guru'}
            </span>
            <form action={signOut}>
              <button className="rounded-md bg-slate-100 p-2 text-slate-600 hover:text-red-600">
                <LogOut size={20} />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Daftar Kelompok</h2>
          <p className="text-slate-500">Pilih kelompok untuk mengisi jurnal.</p>
        </div>

        {/* Grid Kartu Kelompok */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {kelompokList && kelompokList.length > 0 ? (
            kelompokList.map((item) => (
              <Link
                key={item.id}
                href={`/kelompok/${item.id}`} // Nanti kita buat halaman ini
                className="group relative block rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                      <Users size={24} />
                    </div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">
                      {item.nama_kelompok}
                    </h3>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-500">
                  Jadwal: {item.jadwal_sesi || '-'}
                </p>
              </Link>
            ))
          ) : (
            // Empty State (Jika tidak ada kelompok)
            <div className="col-span-full rounded-lg border-2 border-dashed border-slate-300 p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-semibold text-slate-900">Belum ada kelompok</h3>
              <p className="mt-1 text-sm text-slate-500">Hubungi Admin untuk plotting kelas.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}