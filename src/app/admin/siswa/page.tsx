'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Upload, UserPlus, CheckCircle, AlertCircle, Loader2, Search, Pencil, User } from 'lucide-react'
import readXlsxFile from 'read-excel-file' 
import { useRouter } from 'next/navigation'

export default function AdminSiswaPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState<'manual' | 'excel'>('manual')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)
  
  // Data Master
  const [kelompokList, setKelompokList] = useState<any[]>([])
  const [levelList, setLevelList] = useState<any[]>([])
  
  // Data Siswa (List)
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    // 1. Ambil Master Data
    const { data: k } = await supabase.from('kelompok').select('id, nama_kelompok')
    const { data: l } = await supabase.from('level').select('id, nama').order('urutan')
    if (k) setKelompokList(k)
    if (l) setLevelList(l)

    // 2. Ambil Daftar Siswa (Terbaru diatas)
    const { data: s } = await supabase
        .from('siswa')
        .select('*, kelompok(nama_kelompok), level(nama)')
        .order('created_at', { ascending: false })
    if (s) setSiswaList(s)
  }

  // --- FUNGSI PINTAR: GENERATE TARGET OTOMATIS ---
  const generateTargetsForSiswa = async (siswaId: string, levelId: string) => {
    const { data: targets } = await supabase.from('target_pembelajaran').select('id').eq('level_id', levelId)
    if(!targets || targets.length === 0) return

    const newSiswaTargets = targets.map(t => ({
        siswa_id: siswaId,
        target_ref_id: t.id,
        status: 'active'
    }))

    if(newSiswaTargets.length > 0) {
        await supabase.from('siswa_target').insert(newSiswaTargets)
    }
  }

  // --- MANUAL SUBMIT ---
  const handleManualSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.target)
    
    const { data: instansi } = await supabase.from('instansi').select('id').limit(1).single()
    const levelId = String(formData.get('level'))
    
    const { data: newSiswa, error } = await supabase.from('siswa').insert({
        instansi_id: instansi?.id,
        nama_siswa: formData.get('nama'),
        kelompok_id: formData.get('kelompok'),
        current_level_id: levelId
    }).select().single()

    if (error) {
        setMessage({ type: 'error', text: error.message })
    } else if (newSiswa) {
        await generateTargetsForSiswa(newSiswa.id, levelId)
        setMessage({ type: 'success', text: 'Siswa berhasil ditambahkan & Target Pembelajaran aktif.' })
        e.target.reset()
        fetchData() // Refresh tabel bawah
    }
    setLoading(false)
  }

  // --- EXCEL UPLOAD ---
  const handleExcelUpload = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setMessage(null)

    try {
        const rows = await readXlsxFile(file)
        rows.shift() // Hapus Header
        if (rows.length === 0) throw new Error('File Excel kosong.')
        const { data: instansi } = await supabase.from('instansi').select('id').limit(1).single()
        let suksesCount = 0
        let gagalCount = 0

        for (const row of rows) {
            const namaSiswa = row[0]?.toString()
            const namaKelompok = row[1]?.toString()
            const namaLevel = row[2]?.toString()

            if (namaSiswa && namaKelompok && namaLevel) {
                 const targetKelompok = kelompokList.find(k => k.nama_kelompok.toLowerCase().trim() === namaKelompok.toLowerCase().trim())
                 const targetLevel = levelList.find(l => l.nama.toLowerCase().trim() === namaLevel.toLowerCase().trim())

                if (targetKelompok && targetLevel) {
                    const { data: newSiswa } = await supabase.from('siswa').insert({
                        instansi_id: instansi?.id,
                        nama_siswa: namaSiswa,
                        kelompok_id: targetKelompok.id,
                        current_level_id: targetLevel.id
                    }).select().single()
                    
                    if(newSiswa) {
                        await generateTargetsForSiswa(newSiswa.id, targetLevel.id)
                        suksesCount++
                    } else {
                        gagalCount++
                    }
                } else {
                    gagalCount++
                }
            } else {
                gagalCount++
            }
        }
        setMessage({ type: 'success', text: `Selesai! Sukses: ${suksesCount}, Gagal/Skip: ${gagalCount}.` })
        fetchData() // Refresh tabel
    } catch (err: any) {
        setMessage({ type: 'error', text: 'Gagal: ' + err.message })
    }
    setLoading(false)
    e.target.value = null 
  }

  // Filter Pencarian
  const filteredSiswa = siswaList.filter(s => 
      s.nama_siswa.toLowerCase().includes(search.toLowerCase()) ||
      s.kelompok?.nama_kelompok.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl"> {/* Lebar container ditambah agar tabel muat */}
        
        {/* HEADER */}
        <div className="mb-6 flex items-center gap-4">
          <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600">
            <ArrowLeft size={20}/>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Database Santri</h1>
        </div>

        {message && (
            <div className={`mb-4 p-4 rounded-md flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                {message.text}
            </div>
        )}

        {/* --- BAGIAN 1: FORM INPUT (Manual / Excel) --- */}
        <div className="mb-10">
            <div className="mb-4 flex gap-4 border-b border-slate-200">
                <button onClick={() => setActiveTab('manual')} className={`pb-2 px-4 font-medium text-sm ${activeTab === 'manual' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>Input Manual</button>
                <button onClick={() => setActiveTab('excel')} className={`pb-2 px-4 font-medium text-sm ${activeTab === 'excel' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>Import Excel</button>
            </div>

            {activeTab === 'manual' && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 animate-in fade-in slide-in-from-top-2">
                    <form onSubmit={handleManualSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Nama Santri</label>
                            <input name="nama" type="text" required className="w-full rounded border-slate-300 p-2 border" placeholder="Nama Lengkap"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Kelompok</label>
                                <select name="kelompok" required className="w-full rounded border-slate-300 p-2 border bg-white">
                                    <option value="">Pilih...</option>
                                    {kelompokList.map(k => <option key={k.id} value={k.id}>{k.nama_kelompok}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Level</label>
                                <select name="level" required className="w-full rounded border-slate-300 p-2 border bg-white">
                                    <option value="">Pilih...</option>
                                    {levelList.map(l => <option key={l.id} value={l.id}>{l.nama}</option>)}
                                </select>
                            </div>
                        </div>
                        <button disabled={loading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex justify-center items-center gap-2">
                            {loading ? <Loader2 className="animate-spin"/> : <><UserPlus size={18}/> Tambah Santri</>}
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'excel' && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 animate-in fade-in slide-in-from-top-2">
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors relative">
                        <input type="file" accept=".xlsx" onChange={handleExcelUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={loading}/>
                        {loading ? (
                            <div className="flex flex-col items-center text-blue-600"><Loader2 className="h-8 w-8 animate-spin mb-2"/><p>Memproses...</p></div>
                        ) : (
                            <div className="flex flex-col items-center text-slate-500"><Upload className="h-8 w-8 mb-2"/><p>Upload File Excel (.xlsx)</p></div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* --- BAGIAN 2: DAFTAR SISWA (TABEL) --- */}
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <User size={20}/> Daftar Santri ({filteredSiswa.length})
                </h2>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Cari nama..." 
                        className="w-full pl-9 pr-4 py-2 rounded-full border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                        <tr>
                            <th className="px-6 py-3 text-left font-semibold">Nama Santri</th>
                            <th className="px-6 py-3 text-left font-semibold">Kelompok</th>
                            <th className="px-6 py-3 text-left font-semibold">Level</th>
                            <th className="px-6 py-3 text-right font-semibold">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredSiswa.length > 0 ? (
                            filteredSiswa.map((siswa) => (
                                <tr key={siswa.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-slate-900">{siswa.nama_siswa}</td>
                                    <td className="px-6 py-3 text-slate-600">{siswa.kelompok?.nama_kelompok || '-'}</td>
                                    <td className="px-6 py-3 text-slate-600">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-100">
                                            {siswa.level?.nama || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        {/* INI LINK KE HALAMAN EDIT */}
                                        <Link 
                                            href={`/admin/siswa/${siswa.id}`} 
                                            className="inline-flex items-center gap-1 text-slate-400 hover:text-blue-600 transition-colors font-medium text-xs border border-slate-200 px-3 py-1.5 rounded hover:bg-white hover:border-blue-300 hover:shadow-sm"
                                        >
                                            <Pencil size={14} /> Edit
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    Data siswa tidak ditemukan.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

      </div>
    </div>
  )
}