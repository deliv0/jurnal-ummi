'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Upload, UserPlus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
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

  useEffect(() => {
    const fetchData = async () => {
      const { data: k } = await supabase.from('kelompok').select('id, nama_kelompok')
      const { data: l } = await supabase.from('level').select('id, nama').order('urutan')
      if (k) setKelompokList(k)
      if (l) setLevelList(l)
    }
    fetchData()
  }, [])

  // --- FUNGSI PINTAR: GENERATE TARGET OTOMATIS ---
  // Fungsi ini dipanggil setelah siswa berhasil dibuat
  const generateTargetsForSiswa = async (siswaId: string, levelId: string) => {
    // 1. Ambil Template Target dari Level tersebut
    const { data: targets } = await supabase
        .from('target_pembelajaran')
        .select('id')
        .eq('level_id', levelId)
    
    if(!targets || targets.length === 0) return

    // 2. Siapkan Data untuk dimasukkan ke tas siswa
    const newSiswaTargets = targets.map(t => ({
        siswa_id: siswaId,
        target_ref_id: t.id,
        status: 'active' // <--- KOREKSI: Menggunakan 'active' agar sesuai database Anda
    }))

    // 3. Masukkan sekaligus
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
    
    // 1. Simpan Siswa
    const { data: newSiswa, error } = await supabase.from('siswa').insert({
        instansi_id: instansi?.id,
        nama_siswa: formData.get('nama'),
        kelompok_id: formData.get('kelompok'),
        current_level_id: levelId
    }).select().single() // Penting: select() agar kita dapat ID siswa baru

    if (error) {
        setMessage({ type: 'error', text: error.message })
    } else if (newSiswa) {
        // 2. GENERATE TARGET (PANGGIL FUNGSI PINTAR TADI)
        await generateTargetsForSiswa(newSiswa.id, levelId)

        setMessage({ type: 'success', text: 'Siswa berhasil ditambahkan & Target Pembelajaran aktif.' })
        e.target.reset()
        router.refresh()
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
                 // Cari ID Kelompok & Level
                 const targetKelompok = kelompokList.find(k => k.nama_kelompok.toLowerCase().trim() === namaKelompok.toLowerCase().trim())
                 const targetLevel = levelList.find(l => l.nama.toLowerCase().trim() === namaLevel.toLowerCase().trim())

                if (targetKelompok && targetLevel) {
                    // 1. Insert Siswa
                    const { data: newSiswa } = await supabase.from('siswa').insert({
                        instansi_id: instansi?.id,
                        nama_siswa: namaSiswa,
                        kelompok_id: targetKelompok.id,
                        current_level_id: targetLevel.id
                    }).select().single()
                    
                    // 2. GENERATE TARGET (Jika siswa sukses dibuat)
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

        setMessage({ 
            type: 'success', 
            text: `Selesai! Sukses: ${suksesCount}, Gagal/Skip: ${gagalCount}. Target pembelajaran otomatis dibuat.` 
        })

    } catch (err: any) {
        setMessage({ type: 'error', text: 'Gagal memproses file: ' + err.message })
    }
    
    setLoading(false)
    e.target.value = null 
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl">
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

        <div className="mb-6 flex gap-4 border-b border-slate-200">
            <button onClick={() => setActiveTab('manual')} className={`pb-2 px-4 font-medium text-sm ${activeTab === 'manual' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>Input Manual</button>
            <button onClick={() => setActiveTab('excel')} className={`pb-2 px-4 font-medium text-sm ${activeTab === 'excel' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>Import Excel</button>
        </div>

        {/* FORM MANUAL */}
        {activeTab === 'manual' && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Nama Santri</label>
                        <input name="nama" type="text" required className="w-full rounded border-slate-300 p-2 border" placeholder="Nama Lengkap"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Kelompok (Kelas)</label>
                            <select name="kelompok" required className="w-full rounded border-slate-300 p-2 border">
                                <option value="">Pilih Kelompok...</option>
                                {kelompokList.map(k => <option key={k.id} value={k.id}>{k.nama_kelompok}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Level (Kurikulum)</label>
                            <select name="level" required className="w-full rounded border-slate-300 p-2 border">
                                <option value="">Pilih Level...</option>
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

        {/* UPLOAD EXCEL */}
        {activeTab === 'excel' && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="mb-6 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800 border border-yellow-200">
                    <strong>Panduan Import Excel:</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                        <li>Baris 1 = Header (Judul).</li>
                        <li>Urutan Kolom: <strong>Nama</strong> | <strong>Kelompok</strong> | <strong>Level</strong>.</li>
                        <li>Pastikan nama Kelompok & Level SAMA PERSIS dengan di aplikasi.</li>
                    </ul>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-lg p-10 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                    <input type="file" accept=".xlsx" onChange={handleExcelUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={loading}/>
                    {loading ? (
                        <div className="flex flex-col items-center text-blue-600">
                            <Loader2 className="h-10 w-10 animate-spin mb-2"/>
                            <p>Sedang memproses & generate target...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-slate-500">
                            <Upload className="h-10 w-10 mb-2"/>
                            <p className="font-medium">Klik untuk Upload File Excel (.xlsx)</p>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  )
}