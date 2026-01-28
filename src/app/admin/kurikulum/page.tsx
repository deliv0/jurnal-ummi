import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ChevronRight, LayoutList, ArrowLeft } from 'lucide-react'
import { revalidatePath } from 'next/cache'

export default async function AdminLevelPage() {
  const supabase = await createClient()

  // 1. Cek Security (Hanya Admin)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: userProfile } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single()

  // Cek apakah array roles mengandung "admin"
  const isAdmin = userProfile?.roles && JSON.stringify(userProfile.roles).includes('admin')
  
  if (!isAdmin) {
    return <div className="p-10 text-center text-red-600">Akses Ditolak. Halaman ini khusus Admin.</div>
  }

  // 2. Server Action: Tambah Level Baru
  async function createLevel(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const nama = formData.get('nama')
    const urutan = formData.get('urutan')
    const kategori = formData.get('kategori')
    
    // Ambil instansi ID (Hardcode dulu ambil yang pertama utk kesederhanaan)
    const { data: instansi } = await supabase.from('instansi').select('id').limit(1).single()

    if (instansi) {
      await supabase.from('level').insert({
        instansi_id: instansi.id,
        nama: String(nama),
        urutan: Number(urutan),
        kategori: String(kategori)
      })
      revalidatePath('/admin/kurikulum') // Refresh halaman
    }
  }

  // 3. Ambil Data Level yang sudah ada
  const { data: levels } = await supabase
    .from('level')
    .select('*')
    .order('urutan', { ascending: true })

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600">
                    <ArrowLeft size={20}/>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Manajemen Kurikulum</h1>
                    <p className="text-slate-500">Atur Struktur Level & Jilid</p>
                </div>
            </div>
        </div>

        {/* FORM TAMBAH LEVEL */}
        <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Plus size={20} className="text-blue-600"/> Tambah Level Baru
          </h2>
          <form action={createLevel} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-sm font-medium text-slate-700">Nama Level</label>
              <input name="nama" type="text" placeholder="Contoh: Tilawah 3" required className="w-full rounded-md border border-slate-300 p-2 text-sm" />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-sm font-medium text-slate-700">Urutan</label>
              <input name="urutan" type="number" placeholder="1" required className="w-full rounded-md border border-slate-300 p-2 text-sm" />
            </div>
            <div className="w-32">
              <label className="mb-1 block text-sm font-medium text-slate-700">Kategori</label>
              <select name="kategori" className="w-full rounded-md border border-slate-300 p-2 text-sm">
                <option value="tahsin">Tahsin</option>
                <option value="tahfidz">Tahfidz</option>
              </select>
            </div>
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              Simpan
            </button>
          </form>
        </div>

        {/* LIST LEVEL */}
        <div className="space-y-3">
          {levels?.map((lvl) => (
            <Link 
                key={lvl.id} 
                href={`/admin/kurikulum/${lvl.id}`}
                className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-400 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold">
                  {lvl.urutan}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">{lvl.nama}</h3>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                    {lvl.kategori}
                  </span>
                </div>
              </div>
              <div className="flex items-center text-slate-400 group-hover:text-blue-600">
                <span className="text-sm mr-2">Edit Target</span>
                <ChevronRight size={20} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}