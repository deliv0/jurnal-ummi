import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { revalidatePath } from 'next/cache'

export default async function AdminTargetPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Ambil Info Level
  const { data: level } = await supabase.from('level').select('*').eq('id', id).single()
  if (!level) return <div>Level tidak ditemukan</div>

  // 2. Server Action: Tambah Target
  async function createTarget(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const judul = formData.get('judul')
    const kategori = formData.get('kategori')
    const urutan = formData.get('urutan')

    await supabase.from('target_pembelajaran').insert({
      level_id: id,
      judul: String(judul),
      kategori_target: String(kategori),
      urutan: Number(urutan)
    })
    revalidatePath(`/admin/kurikulum/${id}`)
  }

  // 3. Server Action: Hapus Target
  async function deleteTarget(formData: FormData) {
    'use server'
    const targetId = formData.get('targetId')
    const supabase = await createClient()
    await supabase.from('target_pembelajaran').delete().eq('id', targetId)
    revalidatePath(`/admin/kurikulum/${id}`)
  }

  // 4. Ambil Daftar Target
  const { data: targets } = await supabase
    .from('target_pembelajaran')
    .select('*')
    .eq('level_id', id)
    .order('urutan', { ascending: true })

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin/kurikulum" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{level.nama}</h1>
            <p className="text-slate-500">Daftar Target Pembelajaran</p>
          </div>
        </div>

        {/* FORM TAMBAH TARGET */}
        <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Plus size={20} className="text-blue-600"/> Tambah Target Baru
          </h2>
          <form action={createTarget} className="grid gap-4 sm:grid-cols-12 items-end">
            <div className="sm:col-span-6">
              <label className="mb-1 block text-sm font-medium text-slate-700">Judul Target</label>
              <input name="judul" type="text" placeholder="Contoh: Juz 28 / Ghorib Bab 3" required className="w-full rounded-md border border-slate-300 p-2 text-sm" />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Kategori</label>
              <select name="kategori" className="w-full rounded-md border border-slate-300 p-2 text-sm">
                <option value="tilawah">Tilawah (Al-Quran)</option>
                <option value="tahfidz">Tahfidz (Hafalan)</option>
                <option value="tahsin_jilid">Jilid (Buku)</option>
                <option value="ghorib">Ghorib</option>
                <option value="tajwid">Tajwid</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Urutan</label>
              <input name="urutan" type="number" placeholder="1" required className="w-full rounded-md border border-slate-300 p-2 text-sm" />
            </div>
            <div className="sm:col-span-1">
                <button type="submit" className="w-full rounded-md bg-blue-600 p-2 text-white hover:bg-blue-500 flex justify-center">
                <Plus size={20}/>
                </button>
            </div>
          </form>
        </div>

        {/* LIST TARGET */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">No</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Kategori</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Judul Target</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {targets?.map((target) => (
                        <tr key={target.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{target.urutan}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                    ${target.kategori_target === 'tahfidz' ? 'bg-green-100 text-green-800' : 
                                      target.kategori_target === 'ghorib' ? 'bg-purple-100 text-purple-800' :
                                      target.kategori_target === 'tajwid' ? 'bg-orange-100 text-orange-800' :
                                      'bg-blue-100 text-blue-800'}`}>
                                    {target.kategori_target.replace('_', ' ')}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">{target.judul}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <form action={deleteTarget}>
                                    <input type="hidden" name="targetId" value={target.id} />
                                    <button className="text-red-600 hover:text-red-900"><Trash2 size={18}/></button>
                                </form>
                            </td>
                        </tr>
                    ))}
                     {targets?.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Belum ada target di level ini.</td>
                        </tr>
                     )}
                </tbody>
            </table>
        </div>

      </div>
    </div>
  )
}