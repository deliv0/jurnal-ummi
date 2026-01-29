'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Search, ClipboardCheck, Save, AlertCircle, CheckCircle, Loader2, Flag } from 'lucide-react' // Update Icon
import { useRouter } from 'next/navigation'

export default function AdminUjianPage() {
  const supabase = createClient()
  const router = useRouter()

  // STATE PENCARIAN
  const [keyword, setKeyword] = useState('')
  const [siswaResult, setSiswaResult] = useState<any[]>([])
  const [selectedSiswa, setSelectedSiswa] = useState<any>(null)
  
  // STATE DATA MASTER
  const [levelList, setLevelList] = useState<any[]>([])

  // STATE FORM UJIAN
  const [nilai, setNilai] = useState('')
  const [predikat, setPredikat] = useState('')
  const [levelTujuan, setLevelTujuan] = useState('')
  const [catatan, setCatatan] = useState('')
  const [statusLulus, setStatusLulus] = useState('lulus')
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  // 1. Load Data Level
  useEffect(() => {
    const fetchLevels = async () => {
      const { data } = await supabase.from('level').select('*').order('urutan', { ascending: true })
      if (data) setLevelList(data)
    }
    fetchLevels()
  }, [])

  // 2. Cari Siswa
  const handleSearch = async (e: any) => {
    e.preventDefault()
    if(!keyword) return
    setLoading(true)
    
    const { data } = await supabase
        .from('siswa')
        .select('*, level:current_level_id(id, nama), kelompok(nama_kelompok)')
        .ilike('nama_siswa', `%${keyword}%`)
        .limit(5)
    
    setSiswaResult(data || [])
    setSelectedSiswa(null)
    setLoading(false)
  }

  // 3. Pilih Siswa
  const handleSelectSiswa = (siswa: any) => {
    setSelectedSiswa(siswa)
    setSiswaResult([]) 
    setKeyword('')     
    setMessage(null)
    
    // Auto-Select Level Berikutnya
    if(levelList.length > 0 && siswa.current_level_id) {
        const currentIdx = levelList.findIndex(l => l.id === siswa.current_level_id)
        if(currentIdx !== -1 && currentIdx < levelList.length - 1) {
            setLevelTujuan(levelList[currentIdx + 1].id)
        } else {
            setLevelTujuan('')
        }
    }
    setNilai('')
    setPredikat('')
    setCatatan('')
  }

  // 4. Auto Predikat
  const handleNilaiChange = (val: string) => {
    setNilai(val)
    const n = Number(val)
    if(n >= 95) setPredikat('Mumtaz (Istimewa)')
    else if(n >= 85) setPredikat('Jayyid Jiddan (Baik Sekali)')
    else if(n >= 76) setPredikat('Jayyid (Baik)')
    else if(n > 0) setPredikat('Maqbul (Cukup) / Rasib (Kurang)')
    else setPredikat('')

    if(n < 76 && n > 0) setStatusLulus('gagal')
    else setStatusLulus('lulus')
  }

  // 5. SIMPAN HASIL UJIAN
  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if(!selectedSiswa) return
    setLoading(true)

    try {
        const { data: { user } } = await supabase.auth.getUser()

        // A. Simpan Arsip
        const { error: errArsip } = await supabase.from('riwayat_kenaikan_level').insert({
            siswa_id: selectedSiswa.id,
            penguji_id: user?.id,
            level_asal_id: selectedSiswa.current_level_id,
            level_tujuan_id: statusLulus === 'lulus' ? levelTujuan : null,
            nilai_angka: Number(nilai),
            predikat: predikat,
            catatan: catatan,
            status_kelulusan: statusLulus,
            tanggal_ujian: new Date().toISOString()
        })
        if(errArsip) throw errArsip

        // B. Update Siswa (PENTING: Reset status_tes jadi 'belajar')
        if(statusLulus === 'lulus') {
            const { error: errUpdate } = await supabase
                .from('siswa')
                .update({ 
                    current_level_id: levelTujuan,
                    status_tes: 'belajar' // <--- RESET STATUS PENGJUAN DI SINI
                })
                .eq('id', selectedSiswa.id)
            
            if(errUpdate) throw errUpdate
            
            // Opsional: Bersihkan target lama
            await supabase.from('siswa_target').delete().eq('siswa_id', selectedSiswa.id)
        } else {
            // Jika Gagal, mungkin status tes tetap 'siap_tes' (biar diuji ulang) atau dikembalikan ke 'belajar'
            // Kita pilih kembalikan ke 'belajar' agar guru tahu harus membina lagi
             await supabase.from('siswa').update({ status_tes: 'belajar' }).eq('id', selectedSiswa.id)
        }

        setMessage({ type: 'success', text: `Data tersimpan. Status pengajuan ujian telah di-reset.` })
        setSelectedSiswa(null)

    } catch (err: any) {
        setMessage({ type: 'error', text: 'Gagal menyimpan: ' + err.message })
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600">
            <ArrowLeft size={20}/>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Ujian Kenaikan Level</h1>
        </div>

        {message && (
            <div className={`mb-4 p-4 rounded-md flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                {message.text}
            </div>
        )}

        {/* PENCARIAN */}
        {!selectedSiswa && (
            <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-center">
                <ClipboardCheck className="mx-auto h-12 w-12 text-blue-500 mb-4"/>
                <h2 className="text-lg font-semibold mb-2">Siapa yang akan diuji?</h2>
                <form onSubmit={handleSearch} className="max-w-md mx-auto relative">
                    <input 
                        type="text" 
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="Ketik nama santri..." 
                        className="w-full pl-10 p-3 rounded-full border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={20}/>
                    <button type="submit" className="hidden">Cari</button>
                </form>

                {loading && <div className="mt-4 text-slate-500 flex justify-center gap-2"><Loader2 className="animate-spin"/> Mencari...</div>}

                <div className="mt-6 space-y-2 text-left max-w-md mx-auto">
                    {siswaResult.map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => handleSelectSiswa(s)}
                            className={`p-3 border rounded-lg cursor-pointer flex justify-between items-center group transition-all
                                ${s.status_tes === 'siap_tes' ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'hover:bg-blue-50 hover:border-blue-300'}`}
                        >
                            <div>
                                <div className="font-semibold text-slate-800 flex items-center gap-2">
                                    {s.nama_siswa}
                                    {/* --- BADGE KHUSUS JIKA DIAJUKAN GURU --- */}
                                    {s.status_tes === 'siap_tes' && (
                                        <span className="inline-flex items-center gap-1 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                            <CheckCircle size={10} /> Siap Ujian
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {s.kelompok?.nama_kelompok} • Level: <span className="text-blue-600 font-medium">{s.level?.nama}</span>
                                </div>
                            </div>
                            <div className="text-blue-600 opacity-0 group-hover:opacity-100 text-sm font-medium">Uji &rarr;</div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* FORM PENILAIAN */}
        {selectedSiswa && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                {/* Header Form */}
                <div className={`p-4 border-b flex justify-between items-center ${selectedSiswa.status_tes === 'siap_tes' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Lembar Penilaian</div>
                            {selectedSiswa.status_tes === 'siap_tes' && (
                                <span className="bg-green-200 text-green-800 text-[10px] px-2 rounded-full font-bold">Rekomendasi Guru</span>
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">{selectedSiswa.nama_siswa}</h2>
                        <p className="text-sm text-slate-600">Level Saat Ini: {selectedSiswa.level?.nama}</p>
                    </div>
                    <button onClick={() => setSelectedSiswa(null)} className="text-slate-400 hover:text-red-500 text-sm">Batal</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* ... (Bagian Form Sama seperti sebelumnya) ... */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nilai Akhir (0-100)</label>
                            <input 
                                type="number" 
                                required
                                max="100"
                                value={nilai}
                                onChange={(e) => handleNilaiChange(e.target.value)}
                                className="w-full text-2xl font-bold p-2 border rounded-md border-slate-300 focus:ring-blue-500"
                                placeholder="0"
                            />
                            <p className="text-xs text-slate-500 mt-1">KKM: 76</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Predikat</label>
                            <input type="text" readOnly value={predikat} className="w-full bg-slate-50 p-3 border rounded-md border-slate-200 text-slate-600 font-medium"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Keputusan Penguji</label>
                        <div className="flex gap-4">
                            <label className={`flex-1 border rounded-lg p-3 flex items-center gap-3 cursor-pointer ${statusLulus === 'lulus' ? 'bg-green-50 border-green-500 text-green-700' : 'opacity-50'}`}>
                                <input type="radio" name="status" value="lulus" checked={statusLulus === 'lulus'} onChange={() => setStatusLulus('lulus')} />
                                <span className="font-bold">LULUS / NAIK LEVEL</span>
                            </label>
                            <label className={`flex-1 border rounded-lg p-3 flex items-center gap-3 cursor-pointer ${statusLulus === 'gagal' ? 'bg-red-50 border-red-500 text-red-700' : 'opacity-50'}`}>
                                <input type="radio" name="status" value="gagal" checked={statusLulus === 'gagal'} onChange={() => setStatusLulus('gagal')} />
                                <span className="font-bold">BELUM LULUS</span>
                            </label>
                        </div>
                    </div>

                    {statusLulus === 'lulus' && (
                        <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                            <label className="block text-sm font-medium text-yellow-800 mb-1">Naik ke Level:</label>
                            <select required value={levelTujuan} onChange={(e) => setLevelTujuan(e.target.value)} className="w-full p-2 border rounded border-yellow-400 bg-white">
                                <option value="">-- Pilih Level Tujuan --</option>
                                {levelList.map(l => (
                                    <option key={l.id} value={l.id}>{l.nama} ({l.kategori})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Catatan / Evaluasi</label>
                        <textarea rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} className="w-full p-2 border rounded-md border-slate-300"></textarea>
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : <><Save size={20}/> SIMPAN HASIL UJIAN</>}
                    </button>
                </form>
            </div>
        )}
      </div>
    </div>
  )
}