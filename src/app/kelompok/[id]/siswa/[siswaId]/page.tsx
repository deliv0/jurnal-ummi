'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Save, Clock, History, BookOpen, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
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

      // 2. CEK TARGET PEMBELAJARAN (FIX: AUTO SYNC)
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
          // B. JIKA KOSONG (Kasus Siswa Baru), COPY DARI MASTER KURIKULUM
          if (dataSiswa?.current_level_id) {
              console.log("Target kosong, melakukan auto-sync dari level...")
              
              // Ambil target master sesuai level siswa
              const { data: masterTargets } = await supabase
                  .from('target_pembelajaran')
                  .select('*')
                  .eq('level_id', dataSiswa.current_level_id)
              
              if (masterTargets && masterTargets.length > 0) {
                  // Siapkan data untuk insert massal
                  const newTargets = masterTargets.map(t => ({
                      siswa_id: siswaId,
                      target_id: t.id,
                      status: 'active'
                  }))

                  // Insert ke database
                  const { data: insertedData, error } = await supabase
                      .from('siswa_target')
                      .insert(newTargets)
                      .select('*, target_pembelajaran(judul, kategori_target)')

                  if (!error && insertedData) {
                      currentTargets = insertedData
                  }
              }
          }
      }
      
      // C. SET STATE TARGET
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

  // --- LOGIC FORM INPUT SAMA SEPERTI SEBELUMNYA ---
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

        activeTargets.forEach((target) => {
            const input = formValues[target.id]
            if (input.halaman || input.nilai || input.catatan || kehadiran !== 'hadir') {
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

        if(dataToInsert.length === 0) throw new Error("Mohon isi minimal satu data capaian.")

        const { error } = await supabase.from('jurnal_harian').insert(dataToInsert)
        if(error) throw error

        setMessage({ type: 'success', text: 'Jurnal berhasil disimpan!' })
        
        const resetForm: Record<string, any> = {}
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600"/></div>

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* HEADER */}
      <header className="bg-white sticky top-0 z-10 shadow-sm border-b px-4 py-3 flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
            <Link href={`/kelompok/${kelompokId}`} className="p-2 rounded-full hover:bg-slate-100 text-slate-600">
                <ArrowLeft size={20}/>
            </Link>
            <div>
                <h1 className="font-bold text-slate-800 leading-tight">{siswa?.nama_siswa}</h1>
                <p className="text-xs text-slate-500">{siswa?.level?.nama} • {siswa?.kelompok?.nama_kelompok}</p>
            </div>
        </div>
        <Link 
            href={`/raport/${siswaId}`} 
            className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
            target="_blank" 
        >
            <BookOpen size={16}/> Raport
        </Link>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {message && (
            <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.type === 'success' ? <CheckCircle size={24}/> : <AlertCircle size={24}/>}
                <div className="text-sm font-medium">{message.text}</div>
            </div>
        )}

        {/* KEHADIRAN */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Status Kehadiran</label>
            <div className="flex gap-2">
                {['hadir', 'sakit', 'ijin', 'alpa'].map((k) => (
                    <button key={k} onClick={() => setKehadiran(k)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${kehadiran === k ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>
                        {k}
                    </button>
                ))}
            </div>
        </div>

        {/* INPUT TARGET */}
        <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">Input Capaian</h2>
            
            {activeTargets.length === 0 && (
                <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-xl text-center text-yellow-800 text-sm">
                    <p className="font-bold">Tidak ada target pembelajaran.</p>
                    <p>Mohon pastikan Level Santri sudah memiliki Kurikulum (Target Pembelajaran) di menu Admin.</p>
                </div>
            )}

            {activeTargets.map((target) => {
                const cat = target.target_pembelajaran?.kategori_target || '';
                const isTahfidz = cat.includes('tahfidz') || cat === 'takhassus';
                const isTilawah = cat.includes('tilawah');
                const isQuran = isTahfidz || isTilawah;
                const lastLog = getLastHistory(target.id);

                return (
                    <div key={target.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex justify-between items-center">
                            <span className="font-semibold text-blue-800 text-sm">{target.target_pembelajaran?.judul}</span>
                            <span className="text-[10px] uppercase bg-white text-blue-600 px-2 py-0.5 rounded border border-blue-200 font-bold">
                                {cat.replace('_', ' ')}
                            </span>
                        </div>
                        
                        <div className="p-4 grid grid-cols-12 gap-3">
                            {/* RIWAYAT TERAKHIR */}
                            {lastLog && (
                                <div className="col-span-12 mb-1">
                                    <div className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-200 flex justify-between items-center">
                                        <span>
                                            <span className="font-bold">Terakhir:</span> {lastLog.halaman_ayat} 
                                        </span>
                                        {lastLog.nilai && <span className="font-bold bg-white px-1.5 rounded border border-yellow-300">{lastLog.nilai}</span>}
                                    </div>
                                </div>
                            )}

                            {isQuran ? (
                                <div className="col-span-12 space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">Pilih Juz</label>
                                            <select 
                                                className="w-full p-2 rounded border border-slate-300 text-sm bg-white"
                                                onChange={(e) => handleQuranChange(target.id, 'juz', Number(e.target.value))}
                                            >
                                                <option value="">- Juz -</option>
                                                {JUZ_LIST.map(j => <option key={j} value={j}>Juz {j}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">Pilih Surat</label>
                                            <select 
                                                className="w-full p-2 rounded border border-slate-300 text-sm bg-white"
                                                disabled={!quranState[target.id]?.juz}
                                                onChange={(e) => handleQuranChange(target.id, 'surah', e.target.value)}
                                            >
                                                <option value="">- Surat -</option>
                                                {quranState[target.id]?.juz && QURAN_DATA[quranState[target.id]?.juz]?.map((s: any) => (
                                                    <option key={s.no} value={s.nama}>{s.no}. {s.nama} ({s.ayat} ayt)</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        {isTilawah && (
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 mb-1 block">Halaman</label>
                                                <input type="number" placeholder="Hal" className="w-full p-2 rounded border border-slate-300 text-sm"
                                                    onChange={(e) => handleQuranChange(target.id, 'halaman', e.target.value)}
                                                />
                                            </div>
                                        )}
                                        <div className={isTilawah ? "" : "col-span-2"}>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">Ayat / Rentang</label>
                                            <input type="text" placeholder="Contoh: 1-5" className="w-full p-2 rounded border border-slate-300 text-sm"
                                                onChange={(e) => handleQuranChange(target.id, 'ayat', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-xs text-blue-600 text-right italic">
                                        Hasil: {formValues[target.id]?.halaman || '...'}
                                    </div>
                                </div>
                            ) : (
                                <div className="col-span-8">
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Capaian (Hal/Materi)</label>
                                    <input type="text" placeholder="Cth: Hal 20" className="w-full p-2 rounded-lg border border-slate-300 text-sm"
                                        value={formValues[target.id]?.halaman || ''}
                                        onChange={(e) => handleInputChange(target.id, 'halaman', e.target.value)}
                                    />
                                </div>
                            )}
                            
                            <div className={isQuran ? "col-span-12" : "col-span-4"}>
                                <label className="text-xs font-medium text-slate-500 mb-1 block">Nilai</label>
                                <select className="w-full p-2 rounded-lg border border-slate-300 text-sm bg-white"
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
                                <label className="text-xs font-medium text-slate-500 mb-1 block">Catatan Guru</label>
                                <input type="text" placeholder="Catatan evaluasi..." className="w-full p-2 rounded-lg border border-slate-300 text-sm outline-none"
                                    value={formValues[target.id]?.catatan || ''}
                                    onChange={(e) => handleInputChange(target.id, 'catatan', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>

        {/* RIWAYAT */}
        <div className="pt-6">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1 mb-3 flex items-center gap-2">
                <History size={16}/> Semua Riwayat
            </h2>
            <div className="space-y-3">
                {riwayat.map((r, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-100 text-sm flex justify-between items-start">
                        <div>
                            <div className="font-semibold text-slate-700">{r.siswa_target?.target_pembelajaran?.judul}</div>
                            <div className="text-slate-600 mt-1">
                                <span className="font-medium bg-slate-100 px-1.5 rounded">{r.halaman_ayat || '-'}</span>
                                {r.catatan && <span className="text-slate-400 italic ml-2">"{r.catatan}"</span>}
                            </div>
                            <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                <Clock size={10}/> {new Date(r.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                            </div>
                        </div>
                        {r.nilai && (
                            <div className={`h-8 w-8 flex items-center justify-center rounded-full font-bold text-white
                                ${r.nilai === 'A' ? 'bg-green-500' : r.nilai === 'B' ? 'bg-blue-500' : 'bg-yellow-500'}`}>
                                {r.nilai}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-20 print:hidden">
        <div className="max-w-2xl mx-auto">
            <button onClick={handleSave} disabled={saving || activeTargets.length === 0}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-blue-200 shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:bg-slate-300">
                {saving ? <Loader2 className="animate-spin"/> : <><Save size={20}/> SIMPAN JURNAL</>}
            </button>
        </div>
      </div>
    </div>
  )
}