'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { Plus, ChevronRight, ArrowLeft, Pencil, Trash2, Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AdminLevelPage() {
  const supabase = createClient()
  const router = useRouter()

  // STATE DATA
  const [levels, setLevels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  
  // STATE FORM
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nama: '',
    urutan: '',
    kategori: 'tahsin'
  })

  // FEEDBACK MESSAGE
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  // 1. LOAD DATA
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('level')
      .select('*')
      .order('urutan', { ascending: true })
    
    if (data) setLevels(data)
    setLoading(false)
  }

  // 2. HANDLE INPUT
  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // 3. MODE EDIT
  const handleEditClick = (lvl: any) => {
    setIsEditing(true)
    setEditId(lvl.id)
    setFormData({
      nama: lvl.nama,
      urutan: lvl.urutan,
      kategori: lvl.kategori
    })
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 4. BATAL EDIT
  const handleCancel = () => {
    setIsEditing(false)
    setEditId(null)
    setFormData({ nama: '', urutan: '', kategori: 'tahsin' })
    setMessage(null)
  }

  // 5. SIMPAN (CREATE / UPDATE)
  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setActionLoading(true)
    setMessage(null)

    try {
      const { data: instansi } = await supabase.from('instansi').select('id').limit(1).single()

      if (isEditing && editId) {
        // --- UPDATE ---
        const { error } = await supabase
          .from('level')
          .update({
            nama: formData.nama,
            urutan: Number(formData.urutan),
            kategori: formData.kategori
          })
          .eq('id', editId)

        if (error) throw error
        setMessage({ type: 'success', text: 'Level berhasil diperbarui.' })

      } else {
        // --- CREATE ---
        const { error } = await supabase
          .from('level')
          .insert({
            instansi_id: instansi?.id,
            nama: formData.nama,
            urutan: Number(formData.urutan),
            kategori: formData.kategori
          })

        if (error) throw error
        setMessage({ type: 'success', text: 'Level baru berhasil ditambahkan.' })
      }

      await fetchData() // Refresh Data
      handleCancel()    // Reset Form

    } catch (err: any) {
      setMessage({ type: 'error', text: 'Gagal: ' + err.message })
    } finally {
      setActionLoading(false)
    }
  }

  // 6. HAPUS DATA
  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus Level ini? PERINGATAN: Semua Target Pembelajaran di dalamnya juga akan terhapus.')) return

    setActionLoading(true)
    const { error } = await supabase.from('level').delete().eq('id', id)

    if (error) {
       alert('Gagal menghapus: ' + error.message) // Biasanya karena constraint foreign key belum di-cascade
    } else {
       await fetchData()
    }
    setActionLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        
        {/* HEADER */}
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

        {/* FEEDBACK MESSAGE */}
        {message && (
            <div className={`mb-4 p-4 rounded-md flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                {message.text}
            </div>
        )}

        {/* FORM INPUT / EDIT */}
        <div className={`mb-8 rounded-lg border p-6 shadow-sm transition-all ${isEditing ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
          <h2 className="mb-4 text-lg font-semibold text-slate-800 flex items-center gap-2">
            {isEditing ? <><Pencil size={20}/> Edit Level</> : <><Plus size={20}/> Tambah Level Baru</>}
          </h2>
          
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-sm font-medium text-slate-700">Nama Level</label>
              <input 
                name="nama" 
                value={formData.nama}
                onChange={handleChange}
                type="text" 
                placeholder="Contoh: Jilid 1 / Takhassus Juz 30" 
                required 
                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-blue-500" 
              />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-sm font-medium text-slate-700">Urutan</label>
              <input 
                name="urutan" 
                value={formData.urutan}
                onChange={handleChange}
                type="number" 
                placeholder="1" 
                required 
                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-blue-500" 
              />
            </div>
            
            {/* --- UPDATE SELECT KATEGORI DI SINI --- */}
            <div className="w-48">
              <label className="mb-1 block text-sm font-medium text-slate-700">Kategori</label>
              <select 
                name="kategori" 
                value={formData.kategori}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-blue-500"
              >
                <option value="tahsin">Tahsin (Reguler)</option>
                <option value="takhassus">Takhassus (Tahfidz)</option>
                <option value="turjuman">Turjuman</option>
                <option value="pra_tahsin">Pra Tahsin</option>
                
                {/* --- OPSI BARU --- */}
                <option value="pra_munaqasyah">Pra Munaqasyah</option>
                <option value="munaqasyah">Munaqasyah</option>
                <option value="pengembangan">Pengembangan</option>
              </select>
            </div>
            
            <div className="flex gap-2">
                <button type="submit" disabled={actionLoading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 flex items-center gap-2">
                   {actionLoading ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} 
                   Simpan
                </button>
                {isEditing && (
                    <button type="button" onClick={handleCancel} className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-300">
                        Batal
                    </button>
                )}
            </div>
          </form>
        </div>

        {/* LIST LEVEL */}
        <div className="space-y-3">
          {loading ? (
             <div className="text-center py-8 text-slate-500 flex justify-center gap-2"><Loader2 className="animate-spin"/> Memuat...</div>
          ) : (
             <>
                {levels.map((lvl) => (
                    <div 
                        key={lvl.id} 
                        className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 transition-all"
                    >
                    <div className="flex items-center gap-4 flex-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold">
                        {lvl.urutan}
                        </div>
                        <div>
                        <h3 className="font-semibold text-slate-900">{lvl.nama}</h3>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize
                            ${lvl.kategori === 'takhassus' ? 'bg-green-100 text-green-800' : 
                            lvl.kategori === 'turjuman' ? 'bg-purple-100 text-purple-800' :
                            'bg-slate-100 text-slate-800'}`}>
                            {lvl.kategori.replace('_', ' ')}
                        </span>
                        </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex items-center gap-2">
                        {/* Tombol ke Detail Target */}
                        <Link 
                            href={`/admin/kurikulum/${lvl.id}`}
                            className="mr-2 flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 font-medium px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
                        >
                             Isi Target <ChevronRight size={16} />
                        </Link>

                        {/* Tombol Edit Level */}
                        <button 
                            onClick={() => handleEditClick(lvl)}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                            title="Edit Nama/Urutan"
                        >
                            <Pencil size={18} />
                        </button>

                        {/* Tombol Hapus Level */}
                        <button 
                            onClick={() => handleDelete(lvl.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Hapus Level"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                    </div>
                ))}
             </>
          )}

          {!loading && levels.length === 0 && (
             <div className="p-8 text-center text-slate-500 border-2 border-dashed rounded-lg">Belum ada kurikulum. Silakan tambah level di atas.</div>
          )}
        </div>
      </div>
    </div>
  )
}