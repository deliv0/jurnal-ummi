'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Save, Clock, History, BookOpen, CheckCircle, Loader2, AlertCircle, Mic, Book } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { QURAN_DATA, JUZ_LIST } from '@/data/quran'

export default function InputJurnalPage({ params }: { params: Promise<{ id: string, siswaId: string }> }) {
  const { id: kelompokId, siswaId } = use(params)
  
  const supabase = createClient()
  const router = useRouter()

  // STATE DATA
  const [siswa, setSiswa] = useState<any>(null)
  const [activeTargets, setActiveTargets] = useState<any[]>([])
  const [riwayat, setRiwayat] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // STATE UI
  const [activeTab, setActiveTab] = useState<'tahfidz' | 'tilawah'>('tahfidz') // Default Tab: Tahfidz

  // STATE FORM UTAMA
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [kehadiran, setKehadiran] = useState('hadir')
  const [quranState, setQuranState] = useState<Record<string, any>>({})
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true)
      
      // 1. AMBIL DATA SISWA
      const { data: dataSiswa } = await supabase
        .from('siswa')
        .select('*, kelompok(nama_kelompok), level(nama)')
        .eq('id', siswaId)
        .single()
      
      if(dataSiswa) setSiswa(dataSiswa)

      // 2. CEK TARGET PEMBELAJARAN (AUTO SYNC)
      let currentTargets = []
      
      // A. Coba ambil yang sudah ada
      const { data: existingTargets } = await supabase
        .from('siswa_target')
        .select('*, target_pembelajaran(judul, kategori_target)')
        .eq('siswa_id', siswaId)
        .eq('status', 'active')

      if (existingTargets && existingTargets.length > 0) {
          currentTargets = existingTargets
      } else {
          // B. JIKA KOSONG, COPY DARI MASTER KURIKULUM
          if (dataSiswa?.current_level_id) {
              const { data: masterTargets } = await supabase
                  .from('target_pembelajaran')
                  .select('*')
                  .eq('level_id', dataSiswa.current_level_id)
              
              if (masterTargets && masterTargets.length > 0) {
                  const newTargets = masterTargets.map(t => ({
                      siswa_id: siswaId,
                      target_ref_id: t.id, // FIX: Menggunakan target_ref_id
                      status: 'active'
                  }))

                  const { data: insertedData } = await supabase
                      .from('siswa_target')
                      .insert(newTargets)
                      .select('*, target_pembelajaran(judul, kategori_target)')

                  if (insertedData) currentTargets = insertedData
              }
          }
      }
      
      if(currentTargets.length > 0) {
        setActiveTargets(currentTargets)
        const initialForm: Record<string, any> = {}
        currentTargets.forEach((t: any) => {
            initialForm[t.id] = { halaman: '', nilai: '', catatan: '' }
        })
        setFormValues(initialForm)
      }

      // 3. AMBIL RIWAYAT
      const { data: dataRiwayat } = await supabase
        .from('jurnal_harian')
        .select(`
            created_at, 
            halaman_ayat, 
            nilai, 
            catatan,
            siswa_target_id,
            siswa_target!inner ( target_pembelajaran ( judul ) )
        `)
        .eq('siswa_target.siswa_id', siswaId)
        .order('created_at', { ascending: false })
        .limit(10)

      if(dataRiwayat) setRiwayat(dataRiwayat)
      setLoading(false)
    }

    fetchAllData()
  }, [siswaId])

  // --- LOGIC FORM INPUT ---
  const handleInputChange = (targetId: string, field: string, value: string) => {
    setFormValues(prev => ({
        ...prev,
        [targetId]: { ...prev[targetId], [field]: value }
    }))
  }

  const handleQuranChange = (targetId: string, field: 'juz'|'surah'|'halaman'|'ayat', value: any) => {
    setQuranState(prev => {
        const newState = { 
            ...prev, 
            [targetId]: { ...prev[targetId], [field]: value } 
        }
        const d = newState[targetId] || {}
        const surah = d.surah || ''
        const hal = d.halaman ? `Hal. ${d.halaman}` : ''
        const ayat = d.ayat ? `Ayat ${d.ayat}` : ''
        const finalString = [surah, hal, ayat].filter(Boolean).join(' ');
        handleInputChange(targetId, 'halaman', finalString)
        return newState
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
        const { data: { user } } = await supabase.auth.getUser()
        const dataToInsert: any[] = []

        // Hanya simpan target yang ada di TAB AKTIF saja (atau simpan semua yang ada isinya)
        // Disini kita simpan semua yang ada isinya, tidak peduli tab mana.
        activeTargets.forEach((target) => {
            const input = formValues[target.id]
            // Validasi: Minimal Halaman/Nilai/Catatan terisi
            if (input.halaman || input.nilai || input.catatan) {
                dataToInsert.push({
                    siswa_target_id: target.id,
                    guru_id: user?.id,
                    status_kehadiran: kehadiran,
                    halaman_ayat: input.halaman,
                    nilai: input.nilai,
                    catatan: input.catatan
                })
            }
        })

        // Jika tidak ada data target, tapi kehadiran diubah (misal sakit), kita harus punya cara handle.
        // TAPI untuk Jurnal Ummi, biasanya minimal ada 1 target dinilai.
        // Jika hanya absen, logikanya bisa dibuat khusus, tapi disini kita wajibkan input target.
        if(dataToInsert.length === 0 && kehadiran === 'hadir') throw new Error("Mohon isi minimal satu capaian pembelajaran.")

        // Jika Sakit/Ijin/Alpa dan tidak isi target -> kita perlu 'dummy' insert atau logika absen terpisah.
        // SEMENTARA: Kita izinkan simpan jika status != hadir meskipun target kosong (opsional, butuh logic backend).
        // Simplifikasi MVP: Harus isi target jika hadir.

        const { error } = await supabase.from('jurnal_harian').insert(dataToInsert)
        if(error) throw error

        setMessage({ type: 'success', text: 'Jurnal berhasil disimpan!' })
        
        // Reset Form untuk Tab Aktif
        const resetForm = { ...formValues }
        activeTargets.forEach((t: any) => { resetForm[t.id] = { halaman: '', nilai: '', catatan: '' } })
        setFormValues(resetForm)
        setQuranState({})
        
        router.refresh()
        window.scrollTo({ top: 0, behavior: 'smooth' })

    } catch (err: any) {
        setMessage({ type: 'error', text: err.message })
    } finally {
        setSaving(false)
    }
  }

  const getLastHistory = (targetId: string) => riwayat.find(r => r.siswa_target_id === targetId)

  // FILTER TARGET BERDASARKAN TAB
  const filteredTargets = activeTargets.filter(t => {
      const cat = t.target_pembelajaran?.kategori_target || ''
      if (activeTab === 'tahfidz') {
          return cat.includes('tahfidz') || cat === 'takhassus'
      } else {
          // Tilawah meliputi: tilawah, tajwid, ghorib, jilid
          return !cat.includes('tahfidz') && cat !== 'takhassus'
      }
  })

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600"/></div>

  return (
    <div className="min-h-screen bg-slate-50 pb-32"> {/* FIX: Padding bottom diperbesar agar tidak tertutup nav */}
      
      {/* HEADER */}
      <header className="bg-white sticky top-0 z-10 shadow-sm border-b px-4 py-3 flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
            <Link href={`/kelompok/${kelompokId}`} className="p-2 rounded-full hover:bg-slate-100 text-slate-600">
                <ArrowLeft size={20}/>
            </Link>
            <div>
                <h1 className="font-bold text-slate-800 leading-tight">{siswa?.nama_siswa}</h1>
                <p className="text-xs text-slate-500">{siswa?.level?.nama}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {/* TOMBOL BARU: ARSIP */}
            <Link 
                href={`/arsip/${siswaId}`} 
                className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
            >
                <History size={16}/> Arsip
            </Link>

            {/* TOMBOL LAMA: RAPORT */}
            <Link 
                href={`/raport/${siswaId}`} 
                className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                target="_blank" 
            >
                <BookOpen size={16}/> Raport
            </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        
        {/* KEHADIRAN */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex gap-2">
                {['hadir', 'sakit', 'ijin', 'alpa'].map((k) => (
                    <button key={k} onClick={() => setKehadiran(k)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-all ${kehadiran === k ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                        {k}
                    </button>
                ))}
            </div>
        </div>

        {/* TABS MENU */}
        <div className="flex p-1 bg-slate-200 rounded-xl">
            <button 
                onClick={() => setActiveTab('tahfidz')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'tahfidz' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Mic size={18}/> Tahfidz (Hafalan)
            </button>
            <button 
                onClick={() => setActiveTab('tilawah')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'tilawah' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Book size={18}/> Tahsin / Tilawah
            </button>
        </div>

        {message && (
            <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.type === 'success' ? <CheckCircle size={24}/> : <AlertCircle size={24}/>}
                <div className="text-sm font-medium">{message.text}</div>
            </div>
        )}

        {/* INPUT TARGET (SESUAI TAB) */}
        <div className="space-y-4">
            
            {filteredTargets.length === 0 && (
                <div className="p-8 text-center bg-white rounded-xl border border-slate-200 border-dashed">
                    <p className="text-slate-400 text-sm">Tidak ada target untuk kategori {activeTab === 'tahfidz' ? 'Hafalan' : 'Tilawah'}.</p>
                </div>
            )}

            {filteredTargets.map((target) => {
                const cat = target.target_pembelajaran?.kategori_target || '';
                const isTahfidz = cat.includes('tahfidz') || cat === 'takhassus';
                const isTilawah = cat.includes('tilawah');
                const isQuran = isTahfidz || isTilawah; // Dropdown Quran aktif untuk keduanya jika perlu
                const lastLog = getLastHistory(target.id);

                return (
                    <div key={target.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                            <span className="font-bold text-slate-800 text-sm">{target.target_pembelajaran?.judul}</span>
                            <span className="text-[10px] uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 font-bold">
                                {cat.replace('_', ' ')}
                            </span>
                        </div>
                        
                        <div className="p-4 grid grid-cols-12 gap-3">
                            {/* RIWAYAT TERAKHIR */}
                            {lastLog && (
                                <div className="col-span-12 mb-1">
                                    <div className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-100 flex justify-between items-center">
                                        <span>
                                            <span className="font-bold">Terakhir:</span> {lastLog.halaman_ayat} 
                                        </span>
                                        {lastLog.nilai && <span className="font-bold bg-white px-2 py-0.5 rounded border border-yellow-200 shadow-sm">{lastLog.nilai}</span>}
                                    </div>
                                </div>
                            )}

                            {isQuran ? (
                                <div className="col-span-12 space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 mb-1 block">Juz</label>
                                            <select 
                                                className="w-full p-2 rounded border border-slate-300 text-sm bg-white text-slate-900 font-medium" 
                                                onChange={(e) => handleQuranChange(target.id, 'juz', Number(e.target.value))}
                                            >
                                                <option value="">- Juz -</option>
                                                {JUZ_LIST.map(j => <option key={j} value={j}>Juz {j}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 mb-1 block">Surat</label>
                                            <select 
                                                className="w-full p-2 rounded border border-slate-300 text-sm bg-white text-slate-900 font-medium"
                                                disabled={!quranState[target.id]?.juz}
                                                onChange={(e) => handleQuranChange(target.id, 'surah', e.target.value)}
                                            >
                                                <option value="">- Surat -</option>
                                                {quranState[target.id]?.juz && QURAN_DATA[quranState[target.id]?.juz]?.map((s: any) => (
                                                    <option key={s.no} value={s.nama}>{s.no}. {s.nama}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        {isTilawah && (
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">Halaman</label>
                                                <input type="number" placeholder="Hal" 
                                                    className="w-full p-2 rounded border border-slate-300 text-sm text-slate-900 font-medium placeholder:font-normal"
                                                    onChange={(e) => handleQuranChange(target.id, 'halaman', e.target.value)}
                                                />
                                            </div>
                                        )}
                                        <div className={isTilawah ? "" : "col-span-2"}>
                                            <label className="text-xs font-bold text-slate-500 mb-1 block">Ayat / Rentang</label>
                                            <input type="text" placeholder="1-5" 
                                                className="w-full p-2 rounded border border-slate-300 text-sm text-slate-900 font-medium placeholder:font-normal"
                                                onChange={(e) => handleQuranChange(target.id, 'ayat', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-xs text-blue-600 text-right italic font-medium">
                                        {formValues[target.id]?.halaman || 'Belum diisi'}
                                    </div>
                                </div>
                            ) : (
                                <div className="col-span-8">
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">Capaian</label>
                                    <input type="text" placeholder="Isi capaian..." 
                                        className="w-full p-2 rounded-lg border border-slate-300 text-sm text-slate-900 font-medium placeholder:font-normal"
                                        value={formValues[target.id]?.halaman || ''}
                                        onChange={(e) => handleInputChange(target.id, 'halaman', e.target.value)}
                                    />
                                </div>
                            )}
                            
                            <div className={isQuran ? "col-span-12" : "col-span-4"}>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Nilai</label>
                                <select 
                                    className="w-full p-2 rounded-lg border border-slate-300 text-sm bg-white text-slate-900 font-bold"
                                    value={formValues[target.id]?.nilai || ''}
                                    onChange={(e) => handleInputChange(target.id, 'nilai', e.target.value)}
                                >
                                    <option value="">-</option>
                                    <option value="A">A (Sangat Baik)</option>
                                    <option value="B">B (Baik)</option>
                                    <option value="C">C (Cukup)</option>
                                    <option value="D">D (Kurang)</option>
                                </select>
                            </div>

                            <div className="col-span-12">
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Catatan</label>
                                <input type="text" placeholder="Catatan singkat..." 
                                    className="w-full p-2 rounded-lg border border-slate-300 text-sm text-slate-900 font-medium outline-none"
                                    value={formValues[target.id]?.catatan || ''}
                                    onChange={(e) => handleInputChange(target.id, 'catatan', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>

        {/* RIWAYAT (Di Bawah) */}
        <div className="pt-8 border-t border-slate-200 mt-8">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1 mb-4 flex items-center gap-2">
                <History size={16}/> Riwayat Terakhir
            </h2>
            <div className="space-y-3">
                {riwayat.map((r, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm flex justify-between items-start">
                        <div>
                            <div className="font-bold text-slate-800">{r.siswa_target?.target_pembelajaran?.judul}</div>
                            <div className="text-slate-700 mt-1 font-medium">
                                {r.halaman_ayat || '-'}
                                {r.catatan && <span className="text-slate-500 font-normal italic ml-2">"{r.catatan}"</span>}
                            </div>
                            <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                <Clock size={10}/> {new Date(r.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                            </div>
                        </div>
                        {r.nilai && (
                            <div className={`h-8 w-8 flex items-center justify-center rounded-full font-bold text-white text-xs
                                ${r.nilai === 'A' ? 'bg-green-500' : r.nilai === 'B' ? 'bg-blue-500' : 'bg-yellow-500'}`}>
                                {r.nilai}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
      </main>

      {/* FIXED BUTTON (Melayang di atas Nav Bar HP) */}
      <div className="fixed bottom-[70px] md:bottom-0 left-0 right-0 p-4 z-20 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
            <button onClick={handleSave} disabled={saving}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-xl shadow-blue-200/50 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:shadow-none border-2 border-white/20">
                {saving ? <Loader2 className="animate-spin"/> : <><Save size={20}/> SIMPAN CAPAIAN</>}
            </button>
        </div>
      </div>
    </div>
  )
}