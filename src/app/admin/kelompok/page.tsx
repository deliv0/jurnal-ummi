'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { Plus, Trash2, ArrowLeft, Pencil, Save, X, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AdminKelompokPage() {
  const supabase = createClient()
  const router = useRouter()

  // State Data
  const [kelompokList, setKelompokList] = useState<any[]>([])
  const [guruList, setGuruList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  
  // State Form (Untuk Edit/Create)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nama: '',
    jadwal: '',
    guruId: ''
  })
  
  // Feedback Message
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  // 1. Load Data Awal
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    // Ambil Data Kelompok + Nama Guru
    const { data: dataKelompok, error: errK } = await supabase
      .from('kelompok')
      .select('*, users(nama_lengkap)')
      .order('nama_kelompok', { ascending: true })

    // Ambil Daftar Guru untuk Dropdown
    const { data: dataGuru, error: errG } = await supabase
      .from('users')
      .select('id, nama_lengkap')
      .order('nama_lengkap', { ascending: true })

    if (dataKelompok) setKelompokList(dataKelompok)
    if (dataGuru) setGuruList(dataGuru)
    setLoading(false)
  }

  // 2. Handle Input Change
  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // 3. Mode Edit: Isi Form dengan Data Lama
  const handleEditClick = (item: any) => {
    setIsEditing(true)
    setEditId(item.id)
    setFormData({
      nama: item.nama_kelompok,
      jadwal: item.jadwal_sesi || '',
      guruId: item.guru_utama_id || ''
    })
    setMessage(null)
    // Scroll ke atas agar form terlihat
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 4. Batal Edit
  const handleCancel = () => {
    setIsEditing(false)
    setEditId(null)
    setFormData({ nama: '', jadwal: '', guruId: '' })
    setMessage(null)
  }

  // 5. SIMPAN DATA (Create / Update)
  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setActionLoading(true)
    setMessage(null)

    try {
      const { data: instansi } = await supabase.from('instansi').select('id').limit(1).single()
      
      if (isEditing && editId) {
        // --- LOGIKA UPDATE ---
        const { error } = await supabase
          .from('kelompok')
          .update({
            nama_kelompok: formData.nama,
            jadwal_sesi: formData.jadwal,
            guru_utama_id: formData.guruId
          })
          .eq('id', editId)

        if (error) throw error
        setMessage({ type: 'success', text: 'Data Kelompok berhasil diperbarui.' })

      } else {
        // --- LOGIKA CREATE ---
        const { error } = await supabase
          .from('kelompok')
          .insert({
            instansi_id: instansi?.id,
            nama_kelompok: formData.nama,
            jadwal_sesi: formData.jadwal,
            guru_utama_id: formData.guruId
          })

        if (error) throw error
        setMessage({ type: 'success', text: 'Kelompok baru berhasil dibuat.' })
      }

      // Refresh Data & Reset Form
      await fetchData()
      handleCancel()

    } catch (err: any) {
      setMessage({ type: 'error', text: 'Gagal menyimpan: ' + err.message })
    } finally {
      setActionLoading(false)
    }
  }

  // 6. HAPUS DATA
  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus kelompok ini? Data siswa di dalamnya mungkin akan kehilangan induk kelas.')) return

    setActionLoading(true)
    const { error } = await supabase.from('kelompok').delete().eq('id', id)
    
    if (error) {
        alert('Gagal menghapus: ' + error.message)
    } else {
        await fetchData() // Refresh list
    }
    setActionLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600">
            <ArrowLeft size={20}/>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Kelompok</h1>
        </div>

        {/* FEEDBACK MESSAGE */}
        {message && (
            <div className={`mb-4 p-4 rounded-md flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                {message.text}
            </div>
        )}

        {/* FORM CARD */}
        <div className={`mb-8 rounded-lg border p-6 shadow-sm transition-all ${isEditing ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2 text-slate-800">
            {isEditing ? <><Pencil size={20} className="text-blue-600"/> Edit Kelompok</> : <><Plus size={20} className="text-blue-600"/> Tambah Kelompok Baru</>}
          </h2>
          
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-12 items-end">
            <div className="sm:col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Kelompok</label>
              <input 
                name="nama" 
                value={formData.nama} 
                onChange={handleChange}
                type="text" 
                placeholder="Contoh: Jilid 1 Pagi" 
                required 
                className="w-full rounded border-slate-300 p-2 text-sm border focus:ring-blue-500 focus:border-blue-500" 
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Jadwal</label>
              <input 
                name="jadwal" 
                value={formData.jadwal}
                onChange={handleChange}
                type="text" 
                placeholder="Senin-Kamis, 16.00" 
                className="w-full rounded border-slate-300 p-2 text-sm border focus:ring-blue-500 focus:border-blue-500" 
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Guru PJ</label>
              <select 
                name="guruId" 
                value={formData.guruId}
                onChange={handleChange}
                className="w-full rounded border-slate-300 p-2 text-sm border focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Pilih Guru --</option>
                {guruList.map(g => (
                    <option key={g.id} value={g.id}>{g.nama_lengkap}</option>
                ))}
              </select>
            </div>
            
            {/* ACTION BUTTONS */}
            <div className="sm:col-span-2 flex gap-2">
                <button 
                    type="submit" 
                    disabled={actionLoading}
                    className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 font-medium flex justify-center items-center"
                >
                    {actionLoading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                </button>
                
                {isEditing && (
                    <button 
                        type="button"
                        onClick={handleCancel}
                        className="bg-slate-200 text-slate-600 p-2 rounded hover:bg-slate-300 flex justify-center items-center"
                        title="Batal Edit"
                    >
                        <X size={18}/>
                    </button>
                )}
            </div>
          </form>
        </div>

        {/* TABEL DATA */}
        <div className="bg-white rounded-lg shadow border overflow-hidden">
            {loading ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin mb-2 text-blue-500"/>
                    Memuat data...
                </div>
            ) : (
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase border-b">
                        <tr>
                            <th className="px-6 py-3">Nama Kelompok</th>
                            <th className="px-6 py-3">Jadwal</th>
                            <th className="px-6 py-3">Guru</th>
                            <th className="px-6 py-3 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {kelompokList.map(k => (
                            <tr key={k.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">{k.nama_kelompok}</td>
                                <td className="px-6 py-4 text-slate-600">{k.jadwal_sesi || '-'}</td>
                                <td className="px-6 py-4 text-slate-600">
                                    {k.users?.nama_lengkap ? (
                                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                            {k.users.nama_lengkap}
                                        </span>
                                    ) : '-'}
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    <button 
                                        onClick={() => handleEditClick(k)}
                                        className="text-yellow-600 hover:text-yellow-700 p-1 hover:bg-yellow-50 rounded"
                                        title="Edit"
                                    >
                                        <Pencil size={18}/>
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(k.id)}
                                        className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                        title="Hapus"
                                    >
                                        <Trash2 size={18}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {kelompokList.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-400">
                                    Belum ada data kelompok. Silakan tambah baru.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  )
}