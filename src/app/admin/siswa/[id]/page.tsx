'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2, Loader2, User, AlertTriangle } from 'lucide-react'

export default function EditSiswaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // Data Select Options
  const [levels, setLevels] = useState<any[]>([])
  const [kelompoks, setKelompoks] = useState<any[]>([])

  // State untuk deteksi perubahan level
  const [originalLevelId, setOriginalLevelId] = useState<string | null>(null)

  // Form Data
  const [formData, setFormData] = useState({
    nama_siswa: '',
    nis: '',
    gender: 'L',
    level_id: '',
    kelompok_id: '',
    status: 'aktif'
  })

  useEffect(() => {
    const initData = async () => {
      // 1. Load Master Data (Level & Kelompok)
      const { data: listLevel } = await supabase.from('level').select('*').order('urutan')
      const { data: listKelompok } = await supabase.from('kelompok').select('*').order('nama_kelompok')
      
      if(listLevel) setLevels(listLevel)
      if(listKelompok) setKelompoks(listKelompok)

      // 2. Load Data Siswa
      const { data: siswa } = await supabase.from('siswa').select('*').eq('id', id).single()
      if (siswa) {
        setFormData({
            nama_siswa: siswa.nama_siswa,
            nis: siswa.nis || '',
            gender: siswa.gender || 'L',
            level_id: siswa.current_level_id || '',
            kelompok_id: siswa.kelompok_id || '',
            status: siswa.status || 'aktif'
        })
        // Simpan level asli untuk perbandingan nanti
        setOriginalLevelId(siswa.current_level_id)
      }
      setLoading(false)
    }
    initData()
  }, [id])

  // --- LOGIC SYNC TARGET BARU ---
  const syncTargets = async (levelId: string) => {
      // 1. Hapus Target Lama (Reset)
      await supabase.from('siswa_target').delete().eq('siswa_id', id)

      // 2. Ambil Template Target Baru
      const { data: masterTargets } = await supabase
        .from('target_pembelajaran')
        .select('id')
        .eq('level_id', levelId)
      
      if (masterTargets && masterTargets.length > 0) {
          // 3. Masukkan Target Baru
          const newTargets = masterTargets.map(t => ({
              siswa_id: id,
              target_ref_id: t.id,
              status: 'active'
          }))
          await supabase.from('siswa_target').insert(newTargets)
      }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    try {
        // 1. Update Data Siswa
        const { error } = await supabase
            .from('siswa')
            .update({
                nama_siswa: formData.nama_siswa,
                nis: formData.nis,
                gender: formData.gender,
                current_level_id: formData.level_id || null,
                kelompok_id: formData.kelompok_id || null,
                status: formData.status
            })
            .eq('id', id)

        if (error) throw error

        // 2. CEK PERUBAHAN LEVEL (The Logic Fix)
        // Jika level berubah DAN level baru tidak kosong
        if (formData.level_id !== originalLevelId && formData.level_id) {
            const confirmSync = confirm(
                "PERHATIAN: Anda mengubah Level/Jilid siswa.\n\n" +
                "Apakah Anda ingin mereset target pembelajaran siswa menyesuaikan level baru?\n" +
                "(Klik OK untuk Sync Otomatis, Cancel untuk biarkan target lama)"
            )

            if (confirmSync) {
                await syncTargets(formData.level_id)
            }
        }

        alert('Data siswa berhasil diperbarui')
        router.refresh()
        router.push('/admin/siswa')

    } catch (err: any) {
        alert('Gagal: ' + err.message)
    } finally {
        setSaving(false)
    }
  }

  const handleDelete = async () => {
    if(!confirm("PERINGATAN KERAS:\nMenghapus siswa akan menghapus SEMUA riwayat jurnal, nilai, dan raport mereka secara permanen.\n\nApakah Anda yakin 100%?")) return;

    setDeleting(true)
    const { error } = await supabase.from('siswa').delete().eq('id', id)
    
    if (!error) {
        router.replace('/admin/siswa')
    } else {
        alert("Gagal menghapus: " + error.message)
        setDeleting(false)
    }
  }

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto"/></div>

  return (
    <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto">
            <div className="mb-6 flex items-center gap-4">
                <Link href="/admin/siswa" className="p-2 bg-white rounded-full shadow hover:text-blue-600"><ArrowLeft size={20}/></Link>
                <h1 className="text-2xl font-bold text-slate-800">Edit Data Santri</h1>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-xl shadow border border-slate-200 p-6 space-y-6">
                
                {/* IDENTITAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                        <input type="text" required 
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                            value={formData.nama_siswa}
                            onChange={e => setFormData({...formData, nama_siswa: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">NIS / Nomor Induk</label>
                        <input type="text" 
                            className="w-full p-2 border border-slate-300 rounded"
                            value={formData.nis}
                            onChange={e => setFormData({...formData, nis: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                        <select 
                            className="w-full p-2 border border-slate-300 rounded bg-white"
                            value={formData.gender}
                            onChange={e => setFormData({...formData, gender: e.target.value})}
                        >
                            <option value="L">Laki-laki</option>
                            <option value="P">Perempuan</option>
                        </select>
                    </div>
                </div>

                <div className="border-t border-slate-100 my-4"></div>

                {/* AKADEMIK */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Kelompok Belajar</label>
                        <select 
                            className="w-full p-2 border border-slate-300 rounded bg-white"
                            value={formData.kelompok_id}
                            onChange={e => setFormData({...formData, kelompok_id: e.target.value})}
                        >
                            <option value="">- Pilih Kelompok -</option>
                            {kelompoks.map(k => (
                                <option key={k.id} value={k.id}>{k.nama_kelompok}</option>
                            ))}
                        </select>
                    </div>
                    <div className={`p-3 rounded-lg border ${formData.level_id !== originalLevelId ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-300'}`}>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Level / Jilid</label>
                        <select 
                            className="w-full p-2 border border-slate-300 rounded bg-white"
                            value={formData.level_id}
                            onChange={e => setFormData({...formData, level_id: e.target.value})}
                        >
                            <option value="">- Pilih Level -</option>
                            {levels.map(l => (
                                <option key={l.id} value={l.id}>{l.nama}</option>
                            ))}
                        </select>
                        {formData.level_id !== originalLevelId && (
                            <p className="text-xs text-yellow-700 mt-2 font-medium flex items-center gap-1">
                                <AlertTriangle size={12}/> Level berubah. Target akan disesuaikan saat disimpan.
                            </p>
                        )}
                    </div>
                    
                    <div className="col-span-2">
                         <label className="block text-sm font-medium text-slate-700 mb-1">Status Siswa</label>
                         <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="status" value="aktif" checked={formData.status === 'aktif'} onChange={() => setFormData({...formData, status: 'aktif'})} />
                                <span className="text-sm">Aktif</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="status" value="nonaktif" checked={formData.status === 'nonaktif'} onChange={() => setFormData({...formData, status: 'nonaktif'})} />
                                <span className="text-sm text-slate-500">Non-Aktif / Keluar</span>
                            </label>
                         </div>
                    </div>
                </div>

                {/* TOMBOL AKSI */}
                <div className="pt-6 flex gap-3 border-t border-slate-100 mt-4">
                    <button type="submit" disabled={saving || deleting} 
                        className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2">
                        {saving ? <Loader2 className="animate-spin"/> : <><Save size={20}/> SIMPAN PERUBAHAN</>}
                    </button>
                    
                    <button type="button" onClick={handleDelete} disabled={saving || deleting}
                        className="px-4 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center justify-center"
                        title="Hapus Siswa Permanen">
                        {deleting ? <Loader2 className="animate-spin"/> : <Trash2 size={20}/>}
                    </button>
                </div>
            </form>
        </div>
    </div>
  )
}