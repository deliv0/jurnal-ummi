'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Save, History, CheckCircle, Loader2, AlertCircle, Mic, Book, ChevronDown, ChevronRight, ChevronLeft, GraduationCap, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { QURAN_DATA, JUZ_LIST } from '@/data/quran'

export default function InputJurnalPage({ params }: { params: Promise<{ id: string, siswaId: string }> }) {
  const { id: kelompokId, siswaId } = use(params)
  const supabase = createClient()
  const router = useRouter()

  const [siswa, setSiswa] = useState<any>(null)
  const [activeTargets, setActiveTargets] = useState<any[]>([])
  const [riwayat, setRiwayat] = useState<any[]>([])
  const [kelompokSiswa, setKelompokSiswa] = useState<any[]>([]) 
  const [loading, setLoading] = useState(true)

  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA')) 
  const [activeTab, setActiveTab] = useState<'tahfidz' | 'tilawah'>('tahfidz') 
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null) 
  const [savingId, setSavingId] = useState<string | null>(null)
  const [submittingExam, setSubmittingExam] = useState(false)
  
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [quranState, setQuranState] = useState<Record<string, any>>({})
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  useEffect(() => {
    fetchAllData()
  }, [siswaId])

  const fetchAllData = async () => {
    setLoading(true)
    const { data: dataSiswa } = await supabase.from('siswa').select('*, kelompok(nama_kelompok), level(nama)').eq('id', siswaId).single()
    if(dataSiswa) setSiswa(dataSiswa)

    if(dataSiswa?.kelompok_id) {
        const { data: teman } = await supabase.from('siswa').select('id').eq('kelompok_id', dataSiswa.kelompok_id).eq('status', 'aktif').order('nama_siswa')
        if(teman) setKelompokSiswa(teman)
    }

    let currentTargets = []
    const { data: existingTargets } = await supabase.from('siswa_target').select('*, target_pembelajaran(judul, kategori_target)').eq('siswa_id', siswaId).eq('status', 'active')

    if (existingTargets && existingTargets.length > 0) {
        currentTargets = existingTargets
    } else {
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

    const { data: dataRiwayat } = await supabase.from('jurnal_harian').select(`
        created_at, halaman_ayat, nilai, catatan, siswa_target_id, siswa_target!inner ( target_pembelajaran ( judul ) )
    `).eq('siswa_target.siswa_id', siswaId).order('created_at', { ascending: false }).limit(3)

    if(dataRiwayat) setRiwayat(dataRiwayat)
    setLoading(false)
  }

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

  const handleSaveItem = async (targetId: string) => {
    setSavingId(targetId)
    setMessage(null)
    try {
        const { data: { user } } = await supabase.auth.getUser()
        const input = formValues[targetId]
        if (!input.halaman && !input.nilai) throw new Error("Mohon isi capaian atau nilai.")

        const timePart = new Date().toTimeString().split(' ')[0]
        const dateTimeString = `${selectedDate}T${timePart}`

        const { error } = await supabase.from('jurnal_harian').insert({
            created_at: new Date(dateTimeString).toISOString(),
            siswa_target_id: targetId,
            guru_id: user?.id,
            status_kehadiran: 'hadir',
            halaman_ayat: input.halaman,
            nilai: input.nilai,
            catatan: input.catatan
        })
        if(error) throw error
        setMessage({ type: 'success', text: 'Tersimpan!' })
        
        setRiwayat(prev => [{
            created_at: new Date(dateTimeString).toISOString(),
            halaman_ayat: input.halaman,
            nilai: input.nilai,
            catatan: input.catatan,
            siswa_target_id: targetId,
            siswa_target: { target_pembelajaran: { judul: activeTargets.find(t=>t.id===targetId)?.target_pembelajaran?.judul } }
        }, ...prev])

        setFormValues(prev => ({ ...prev, [targetId]: { halaman: '', nilai: '', catatan: '' } }))
        setQuranState(prev => { const n = {...prev}; delete n[targetId]; return n; })
        setExpandedTarget(null)
    } catch (err: any) {
        setMessage({ type: 'error', text: err.message })
    } finally {
        setSavingId(null)
    }
  }

  const handleAjukanUjian = async () => {
      if(!confirm("Yakin ajukan ujian kenaikan jilid?")) return;
      setSubmittingExam(true)
      try {
          await supabase.from('siswa').update({ status_tes: 'siap_tes' }).eq('id', siswaId)
          setSiswa((prev: any) => ({ ...prev, status_tes: 'siap_tes' }))
          alert("Berhasil diajukan!")
      } catch (err: any) { alert(err.message) } finally { setSubmittingExam(false) }
  }

  const navigateSiswa = (direction: 'next' | 'prev') => {
      const currentIndex = kelompokSiswa.findIndex(s => s.id === siswaId)
      if (currentIndex === -1) return

      let targetId = null
      if (direction === 'next' && currentIndex < kelompokSiswa.length - 1) {
          targetId = kelompokSiswa[currentIndex + 1].id
      } else if (direction === 'prev' && currentIndex > 0) {
          targetId = kelompokSiswa[currentIndex - 1].id
      }

      if (targetId) router.push(`/kelompok/${kelompokId}/siswa/${targetId}`)
      else alert(direction === 'next' ? "Ini siswa terakhir." : "Ini siswa pertama.")
  }

  const getLastHistory = (targetId: string) => riwayat.find(r => r.siswa_target_id === targetId)
  const filteredTargets = activeTargets.filter(t => {
      const cat = t.target_pembelajaran?.kategori_target || ''
      if (activeTab === 'tahfidz') return cat.includes('tahfidz') || cat === 'takhassus'
      return !cat.includes('tahfidz') && cat !== 'takhassus'
  })

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600"/></div>

  return (
    // Tambahkan flex-col agar struktur layout lebih solid
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* HEADER BARU (STICKY) - Z-INDEX 50 */}
      <div className="sticky top-0 z-50 bg-white shadow-md border-b border-slate-200 w-full">
          
          <div className="flex items-center justify-between px-4 py-3">
             <div className="flex items-center gap-3">
                <Link href={`/kelompok/${kelompokId}`} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600">
                    <ArrowLeft size={22}/>
                </Link>
                <div>
                    <h1 className="font-bold text-slate-800 text-lg leading-none truncate max-w-[150px]">{siswa?.nama_siswa}</h1>
                    <p className="text-xs text-slate-500 mt-1">{siswa?.level?.nama}</p>
                </div>
             </div>
             
             <div className="flex items-center bg-slate-100 rounded-lg p-1 shrink-0">
                <button onClick={() => navigateSiswa('prev')} className="p-2 rounded hover:bg-white hover:shadow-sm text-slate-500 disabled:opacity-30">
                    <ChevronLeft size={20}/>
                </button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button onClick={() => navigateSiswa('next')} className="p-2 rounded hover:bg-white hover:shadow-sm text-blue-600 font-bold disabled:opacity-30">
                    <ChevronRight size={20}/>
                </button>
             </div>
          </div>

          <div className="px-4 pb-3 flex items-center justify-between gap-3">
               <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-1">
                   <Calendar size={16} className="text-blue-500 shrink-0"/>
                   <input 
                        type="date" 
                        className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                   />
               </div>

               <div className="flex gap-2 shrink-0">
                    {siswa?.status_tes === 'siap_tes' ? (
                        <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-1.5 rounded border border-orange-200 flex items-center">
                           Ujian
                        </span>
                    ) : (
                        <button onClick={handleAjukanUjian} disabled={submittingExam} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                            <GraduationCap size={18}/>
                        </button>
                    )}
                    <Link href={`/arsip/${siswaId}`} className="p-2 bg-slate-50 text-slate-600 rounded-lg border border-slate-200">
                        <History size={18}/>
                    </Link>
               </div>
          </div>
      </div>

      {/* BODY CONTENT */}
      <main className="flex-1 max-w-2xl mx-auto p-4 space-y-4 pb-32 w-full">
        
        {selectedDate !== new Date().toLocaleDateString('en-CA') && (
            <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-lg text-xs font-bold border border-orange-200 flex items-center gap-2 mb-2 animate-in fade-in">
                <AlertCircle size={14}/>
                Mode Edit: {new Date(selectedDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
            </div>
        )}

        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button onClick={() => setActiveTab('tahfidz')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'tahfidz' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Mic size={16}/> HAFALAN
            </button>
            <button onClick={() => setActiveTab('tilawah')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'tilawah' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Book size={16}/> TILAWAH
            </button>
        </div>

        {message && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 font-medium animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>} {message.text}
            </div>
        )}

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
                        
                        <div 
                            onClick={() => setExpandedTarget(isOpen ? null : target.id)}
                            className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 active:bg-slate-100"
                        >
                            <div className="flex-1">
                                <h3 className={`font-bold text-sm ${isOpen ? 'text-blue-700' : 'text-slate-800'}`}>{target.target_pembelajaran?.judul}</h3>
                                {lastLog ? (
                                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                        <History size={10}/> <span className="font-medium text-slate-700">{lastLog.halaman_ayat}</span> ({lastLog.nilai})
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-1 italic">Belum ada nilai</p>
                                )}
                            </div>
                            <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                                <ChevronDown size={20} className="text-slate-400"/>
                            </div>
                        </div>

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
                                        <input type="text" placeholder="Catatan" className="flex-1 p-3 rounded-lg border border-slate-300 text-sm" 
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
    </div>
  )
}