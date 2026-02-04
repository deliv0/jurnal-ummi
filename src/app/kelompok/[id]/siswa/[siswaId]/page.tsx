'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Save, Clock, History, BookOpen, CheckCircle, Loader2, AlertCircle, Mic, Book, ChevronDown, ChevronUp, ChevronRight, User } from 'lucide-react'
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
  const [kelompokSiswa, setKelompokSiswa] = useState<any[]>([]) // Untuk Navigasi Next/Prev
  const [loading, setLoading] = useState(true)

  // STATE UI
  const [activeTab, setActiveTab] = useState<'tahfidz' | 'tilawah'>('tahfidz') 
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null) // Accordion State
  const [savingId, setSavingId] = useState<string | null>(null) // Loading per item
  
  // STATE FORM
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [quranState, setQuranState] = useState<Record<string, any>>({})
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  useEffect(() => {
    fetchAllData()
  }, [siswaId])

  const fetchAllData = async () => {
    setLoading(true)
    
    // 1. AMBIL DATA SISWA
    const { data: dataSiswa } = await supabase.from('siswa').select('*, kelompok(nama_kelompok), level(nama)').eq('id', siswaId).single()
    if(dataSiswa) setSiswa(dataSiswa)

    // 2. AMBIL LIST TEMAN SEKELAS (Untuk Navigasi Next/Prev)
    if(dataSiswa?.kelompok_id) {
        // Ambil ID semua siswa di kelompok ini yg AKTIF & HADIR (Logic hadir opsional, sementara ambil semua aktif)
        const { data: teman } = await supabase.from('siswa').select('id').eq('kelompok_id', dataSiswa.kelompok_id).eq('status', 'aktif').order('nama_siswa')
        if(teman) setKelompokSiswa(teman)
    }

    // 3. LOAD TARGET (AUTO SYNC)
    let currentTargets = []
    const { data: existingTargets } = await supabase.from('siswa_target').select('*, target_pembelajaran(judul, kategori_target)').eq('siswa_id', siswaId).eq('status', 'active')

    if (existingTargets && existingTargets.length > 0) {
        currentTargets = existingTargets
    } else {
        // Auto Sync jika kosong
        if (dataSiswa?.current_level_id) {
            const { data: masterTargets } = await supabase.from('target_pembelajaran').select('*').eq('level_id', dataSiswa.current_level_id)
            if (masterTargets && masterTargets.length > 0) {
                const newTargets = masterTargets.map(t => ({ siswa_id: siswaId, target_ref_id: t.id, status: 'active' }))
                const { data: insertedData } = await supabase.from('siswa_target').insert(newTargets).select('*, target_pembelajaran(judul, kategori_target)')
                if (insertedData) currentTargets = insertedData
            }
        }
    }
    
    if(currentTargets.length > 0) {
      setActiveTargets(currentTargets)
      const initialForm: Record<string, any> = {}
      currentTargets.forEach((t: any) => { initialForm[t.id] = { halaman: '', nilai: '', catatan: '' } })
      setFormValues(initialForm)
    }

    // 4. LOAD RIWAYAT
    const { data: dataRiwayat } = await supabase.from('jurnal_harian').select(`
        created_at, halaman_ayat, nilai, catatan, siswa_target_id, siswa_target!inner ( target_pembelajaran ( judul ) )
    `).eq('siswa_target.siswa_id', siswaId).order('created_at', { ascending: false }).limit(5)

    if(dataRiwayat) setRiwayat(dataRiwayat)
    setLoading(false)
  }

  // --- LOGIC FORM ---
  const handleInputChange = (targetId: string, field: string, value: string) => {
    setFormValues(prev => ({ ...prev, [targetId]: { ...prev[targetId], [field]: value } }))
  }

  const handleQuranChange = (targetId: string, field: 'juz'|'surah'|'halaman'|'ayat', value: any) => {
    setQuranState(prev => {
        const newState = { ...prev, [targetId]: { ...prev[targetId], [field]: value } }
        const d = newState[targetId] || {}
        const surah = d.surah || ''
        const hal = d.halaman ? `Hal. ${d.halaman}` : ''
        const ayat = d.ayat ? `Ayat ${d.ayat}` : ''
        const finalString = [surah, hal, ayat].filter(Boolean).join(' ');
        handleInputChange(targetId, 'halaman', finalString)
        return newState
    })
  }

  // --- SAVE PER ITEM ---
  const handleSaveItem = async (targetId: string) => {
    setSavingId(targetId)
    setMessage(null)

    try {
        const { data: { user } } = await supabase.auth.getUser()
        const input = formValues[targetId]

        if (!input.halaman && !input.nilai) throw new Error("Mohon isi capaian atau nilai.")

        const { error } = await supabase.from('jurnal_harian').insert({
            siswa_target_id: targetId,
            guru_id: user?.id,
            status_kehadiran: 'hadir', // Selalu hadir krn sdh difilter di depan
            halaman_ayat: input.halaman,
            nilai: input.nilai,
            catatan: input.catatan
        })

        if(error) throw error

        setMessage({ type: 'success', text: 'Tersimpan!' })
        
        // Refresh Riwayat Lokal
        setRiwayat(prev => [{
            created_at: new Date().toISOString(),
            halaman_ayat: input.halaman,
            nilai: input.nilai,
            catatan: input.catatan,
            siswa_target_id: targetId,
            siswa_target: { target_pembelajaran: { judul: activeTargets.find(t=>t.id===targetId)?.target_pembelajaran?.judul } }
        }, ...prev])

        // Reset Form Item Ini
        setFormValues(prev => ({ ...prev, [targetId]: { halaman: '', nilai: '', catatan: '' } }))
        setQuranState(prev => { const n = {...prev}; delete n[targetId]; return n; })
        
        // Tutup Accordion (Opsional, agar guru bisa lanjut ke target lain)
        setExpandedTarget(null)

    } catch (err: any) {
        setMessage({ type: 'error', text: err.message })
    } finally {
        setSavingId(null)
    }
  }

  // --- NAVIGASI NEXT SISWA ---
  const handleNextSiswa = () => {
      const currentIndex = kelompokSiswa.findIndex(s => s.id === siswaId)
      if(currentIndex !== -1 && currentIndex < kelompokSiswa.length - 1) {
          const nextId = kelompokSiswa[currentIndex + 1].id
          router.push(`/kelompok/${kelompokId}/siswa/${nextId}`)
      } else {
          alert("Ini siswa terakhir di daftar.")
      }
  }

  const getLastHistory = (targetId: string) => riwayat.find(r => r.siswa_target_id === targetId)

  // FILTER TARGET
  const filteredTargets = activeTargets.filter(t => {
      const cat = t.target_pembelajaran?.kategori_target || ''
      if (activeTab === 'tahfidz') return cat.includes('tahfidz') || cat === 'takhassus'
      return !cat.includes('tahfidz') && cat !== 'takhassus'
  })

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600"/></div>

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      
      {/* HEADER COMPACT */}
      <header className="bg-white sticky top-0 z-10 shadow-sm border-b px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
            <Link href={`/kelompok/${kelompokId}`} className="p-2 rounded-full hover:bg-slate-100 text-slate-600">
                <ArrowLeft size={20}/>
            </Link>
            <div>
                <h1 className="font-bold text-slate-800 leading-tight">{siswa?.nama_siswa}</h1>
                <p className="text-xs text-slate-500">{siswa?.level?.nama}</p>
            </div>
        </div>
        <div className="flex gap-2">
            <Link href={`/arsip/${siswaId}`} className="p-2 bg-slate-100 text-slate-600 rounded-lg"><History size={18}/></Link>
            <Link href={`/raport/${siswaId}`} target="_blank" className="p-2 bg-blue-50 text-blue-600 rounded-lg"><BookOpen size={18}/></Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        
        {/* TABS BESAR */}
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button onClick={() => setActiveTab('tahfidz')} className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'tahfidz' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Mic size={18}/> HAFALAN
            </button>
            <button onClick={() => setActiveTab('tilawah')} className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'tilawah' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Book size={18}/> TILAWAH
            </button>
        </div>

        {message && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 font-medium animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>} {message.text}
            </div>
        )}

        {/* LIST TARGET (ACCORDION) */}
        <div className="space-y-3">
            {filteredTargets.length === 0 && (
                <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">Target kosong.</div>
            )}

            {filteredTargets.map((target) => {
                const isOpen = expandedTarget === target.id
                const lastLog = getLastHistory(target.id)
                const cat = target.target_pembelajaran?.kategori_target || ''
                const isQuran = cat.includes('tahfidz') || cat.includes('tilawah')
                const isTilawah = cat.includes('tilawah')

                return (
                    <div key={target.id} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isOpen ? 'ring-2 ring-blue-500 border-transparent shadow-lg' : 'border-slate-200 shadow-sm'}`}>
                        
                        {/* HEADER ACCORDION */}
                        <div 
                            onClick={() => setExpandedTarget(isOpen ? null : target.id)}
                            className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 active:bg-slate-100"
                        >
                            <div className="flex-1">
                                <h3 className={`font-bold text-sm ${isOpen ? 'text-blue-700' : 'text-slate-800'}`}>{target.target_pembelajaran?.judul}</h3>
                                {lastLog ? (
                                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                        <History size={10}/> Terakhir: <span className="font-medium text-slate-700">{lastLog.halaman_ayat}</span> ({lastLog.nilai})
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-1 italic">Belum ada nilai</p>
                                )}
                            </div>
                            <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                                <ChevronDown size={20} className="text-slate-400"/>
                            </div>
                        </div>

                        {/* BODY FORM (Hanya Render Jika Open agar Ringan) */}
                        {isOpen && (
                            <div className="p-4 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2">
                                <div className="space-y-4">
                                    {isQuran ? (
                                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <select className="p-2 rounded border border-slate-300 text-sm bg-slate-50" onChange={(e) => handleQuranChange(target.id, 'juz', Number(e.target.value))}>
                                                    <option value="">- Juz -</option>
                                                    {JUZ_LIST.map(j => <option key={j} value={j}>Juz {j}</option>)}
                                                </select>
                                                <select className="p-2 rounded border border-slate-300 text-sm bg-slate-50" disabled={!quranState[target.id]?.juz} onChange={(e) => handleQuranChange(target.id, 'surah', e.target.value)}>
                                                    <option value="">- Surat -</option>
                                                    {quranState[target.id]?.juz && QURAN_DATA[quranState[target.id]?.juz]?.map((s: any) => (
                                                        <option key={s.no} value={s.nama}>{s.no}. {s.nama}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {isTilawah && <input type="number" placeholder="Hal" className="p-2 rounded border border-slate-300 text-sm" onChange={(e) => handleQuranChange(target.id, 'halaman', e.target.value)} />}
                                                <input type="text" placeholder="Ayat 1-5" className={isTilawah ? "p-2 rounded border border-slate-300 text-sm" : "col-span-2 p-2 rounded border border-slate-300 text-sm"} onChange={(e) => handleQuranChange(target.id, 'ayat', e.target.value)} />
                                            </div>
                                            <div className="text-right text-xs font-bold text-blue-600">{formValues[target.id]?.halaman || '-'}</div>
                                        </div>
                                    ) : (
                                        <input type="text" placeholder="Isi capaian..." className="w-full p-3 rounded-lg border border-slate-300 text-sm" 
                                            value={formValues[target.id]?.halaman || ''} onChange={(e) => handleInputChange(target.id, 'halaman', e.target.value)} />
                                    )}

                                    <div className="flex gap-3">
                                        <select className="w-24 p-3 rounded-lg border border-slate-300 text-sm font-bold" value={formValues[target.id]?.nilai || ''} onChange={(e) => handleInputChange(target.id, 'nilai', e.target.value)}>
                                            <option value="">Nilai</option>
                                            <option value="A">A</option>
                                            <option value="B">B</option>
                                            <option value="C">C</option>
                                            <option value="D">D</option>
                                        </select>
                                        <input type="text" placeholder="Catatan (Opsional)" className="flex-1 p-3 rounded-lg border border-slate-300 text-sm" 
                                            value={formValues[target.id]?.catatan || ''} onChange={(e) => handleInputChange(target.id, 'catatan', e.target.value)} />
                                    </div>

                                    <button 
                                        onClick={() => handleSaveItem(target.id)}
                                        disabled={savingId === target.id}
                                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md active:scale-95 transition-all flex justify-center items-center gap-2"
                                    >
                                        {savingId === target.id ? <Loader2 className="animate-spin"/> : <><Save size={18}/> SIMPAN NILAI</>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
      </main>

      {/* FOOTER NAVIGASI NEXT SISWA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-20">
          <div className="max-w-2xl mx-auto flex gap-3">
             <button onClick={() => router.back()} className="px-4 py-3 border border-slate-300 rounded-xl text-slate-600 font-bold text-sm">Kembali</button>
             <button onClick={handleNextSiswa} className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 hover:bg-black active:scale-95 transition-all">
                Siswa Selanjutnya <ChevronRight size={18}/>
             </button>
          </div>
      </div>
    </div>
  )
}