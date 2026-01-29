'use client'

import { useState, useEffect, use } from 'react' // Perhatikan import 'use'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Pencil, Save, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AdminTargetPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrapping params di Next.js 15 (Client Component)
  const { id } = use(params)
  
  const supabase = createClient()
  const router = useRouter()

  // STATE DATA
  const [level, setLevel] = useState<any>(null)
  const [targets, setTargets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // STATE FORM (Untuk Create & Edit)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    judul: '',
    kategori: 'tilawah',
    urutan: ''
  })

  // 1. LOAD DATA
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    // Ambil Info Level
    const { data: levelData } = await supabase.from('level').select('*').eq('id', id).single()
    if (levelData) setLevel(levelData)

    // Ambil Daftar Target
    const { data: targetData } = await supabase
      .from('target_pembelajaran')
      .select('*')
      .eq('level_id', id)
      .order('urutan', { ascending: true })
    
    if (targetData) setTargets(targetData)
    setLoading(false)
  }

  // 2. HANDLE INPUT
  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // 3. MODE EDIT (Isi form dengan data lama)
  const handleEditClick = (item: any) => {
    setIsEditing(true)
    setEditId(item.id)
    setFormData({
      judul: item.judul,
      kategori: item.kategori_target,
      urutan: item.urutan
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setMessage(null)
  }

  // 4. BATAL EDIT
  const handleCancel = () => {
    setIsEditing(false)
    setEditId(null)
    setFormData({ judul: '', kategori: 'tilawah', urutan: '' })
    setMessage(null)
  }

  // 5. SIMPAN (CREATE / UPDATE)
  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setActionLoading(true)
    setMessage(null)

    try {
      if (isEditing && editId) {
        // --- UPDATE ---
        const { error } = await supabase
          .from('target_pembelajaran')
          .update({
            judul: formData.judul,
            kategori_target: formData.kategori,
            urutan: Number(formData.urutan)
          })
          .eq('id', editId)
        
        if (error) throw error
        setMessage({ type: 'success', text: 'Target berhasil diperbarui.' })

      } else {
        // --- CREATE ---
        const { error } = await supabase
          .from('target_pembelajaran')
          .insert({
            level_id: id,
            judul: formData.judul,
            kategori_target: formData.kategori,
            urutan: Number(formData.urutan)
          })

        if (error) throw error
        setMessage({ type: 'success', text: 'Target baru berhasil ditambahkan.' })
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
  const handleDelete = async (targetId: string) => {
    if(!confirm("Yakin hapus target ini? Data nilai santri terkait target ini mungkin akan error.")) return;

    setActionLoading(true)
    const { error } = await supabase.from('target_pembelajaran').delete().eq('id', targetId)
    
    if(error) {
        alert("Gagal menghapus: " + error.message)
    } else {
        await fetchData()
    }
    setActionLoading(false)
  }

  if (!level && !loading) return <div className="p-10">Level tidak ditemukan.</div>

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        
        {/* HEADER */}
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin/kurikulum" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{level?.nama || 'Loading...'}</h1>
            <p className="text-slate-500">Manajemen Target Pembelajaran</p>
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
            {isEditing ? <><Pencil size={20}/> Edit Target</> : <><Plus size={20}/> Tambah Target Baru</>}
          </h2>
          
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-12 items-end">
            <div className="sm:col-span-6">
              <label className="mb-1 block text-sm font-medium text-slate-700">Judul Target</label>
              <input 
                name="judul" 
                value={formData.judul}
                onChange={handleChange}
                type="text" 
                placeholder="Contoh: Juz 28 / Ghorib Bab 3" 
                required 
                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-blue-500" 
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Kategori</label>
              <select 
                name="kategori" 
                value={formData.kategori}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-blue-500"
              >
                <option value="tilawah">Tilawah (Al-Quran)</option>
                <option value="tahfidz">Tahfidz (Hafalan)</option>
                <option value="tahsin_jilid">Jilid (Buku)</option>
                <option value="ghorib">Ghorib</option>
                <option value="tajwid">Tajwid</option>
              </select>
            </div>
            <div className="sm:col-span-2">
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
            
            {/* BUTTONS */}
            <div className="sm:col-span-1 flex gap-1">
                <button type="submit" disabled={actionLoading} className="flex-1 rounded-md bg-blue-600 p-2 text-white hover:bg-blue-500 flex justify-center items-center">
                    {actionLoading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                </button>
                {isEditing && (
                    <button type="button" onClick={handleCancel} className="rounded-md bg-slate-200 p-2 text-slate-600 hover:bg-slate-300 flex justify-center items-center">
                        <X size={18}/>
                    </button>
                )}
            </div>
          </form>
        </div>

        {/* TABLE DATA */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            {loading ? (
                <div className="p-8 text-center text-slate-500 flex justify-center gap-2"><Loader2 className="animate-spin"/> Memuat data...</div>
            ) : (
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">No</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kategori</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Judul Target</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {targets.map((target) => (
                            <tr key={target.id} className="hover:bg-slate-50">
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
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                                    <button onClick={() => handleEditClick(target)} className="text-yellow-600 hover:text-yellow-900" title="Edit">
                                        <Pencil size={18}/>
                                    </button>
                                    <button onClick={() => handleDelete(target.id)} className="text-red-600 hover:text-red-900" title="Hapus">
                                        <Trash2 size={18}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                         {targets.length === 0 && (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Belum ada target di level ini.</td></tr>
                         )}
                    </tbody>
                </table>
            )}
        </div>

      </div>
    </div>
  )
}