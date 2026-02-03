'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Calendar, CheckCircle, XCircle, UserCheck, UserX, Loader2, Save, MoreHorizontal, Edit3 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function KelompokDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()

  // STATE DATA
  const [kelompok, setKelompok] = useState<any>(null)
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [absensiMap, setAbsensiMap] = useState<Record<string, any>>({}) // Data absen hari ini
  const [todayJurnalMap, setTodayJurnalMap] = useState<Record<string, boolean>>({}) // Siapa yang sudah setor hari ini

  // STATE UI
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'absen' | 'belajar'>('belajar') // Default view
  const [saving, setSaving] = useState(false)
  
  // STATE FORM ABSEN
  const [formAbsen, setFormAbsen] = useState<Record<string, string>>({}) // { siswaId: 'hadir' | 'sakit' }

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // 1. Ambil Data Kelompok
    const { data: dataKelompok } = await supabase.from('kelompok').select('*').eq('id', id).single()
    if(dataKelompok) setKelompok(dataKelompok)

    // 2. Ambil Siswa di Kelompok ini
    const { data: dataSiswa } = await supabase
        .from('siswa')
        .select('*, level(nama)')
        .eq('kelompok_id', id)
        .eq('status', 'aktif')
        .order('nama_siswa')
    
    if(dataSiswa) {
        setSiswaList(dataSiswa)
        
        // Inisialisasi Form Absen Default (Semua Hadir)
        const initAbsen: Record<string, string> = {}
        dataSiswa.forEach((s) => { initAbsen[s.id] = 'hadir' })
        setFormAbsen(initAbsen)
    }

    // 3. Cek Apakah Sudah Absen Hari Ini?
    const { data: dataAbsen } = await supabase
        .from('absensi')
        .select('*')
        .eq('kelompok_id', id)
        .eq('tanggal', today)
    
    if (dataAbsen && dataAbsen.length > 0) {
        // SUDAH ABSEN -> Masuk Mode Belajar
        setViewMode('belajar')
        const map: Record<string, any> = {}
        dataAbsen.forEach(a => map[a.siswa_id] = a.status)
        setAbsensiMap(map)
        
        // Sync Form Absen dengan data database (biar kalau diedit sesuai)
        const existingForm: Record<string, string> = {}
        dataSiswa?.forEach(s => {
             existingForm[s.id] = map[s.id] || 'hadir'
        })
        setFormAbsen(existingForm)

    } else {
        // BELUM ABSEN -> Masuk Mode Absen
        setViewMode('absen')
    }

    // 4. Cek Siapa yang Sudah Setor Hafalan Hari Ini (Untuk Indikator)
    // Kita cek jurnal_harian yang dibuat hari ini
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const { data: jurnalToday } = await supabase
        .from('jurnal_harian')
        .select('siswa_target(siswa_id)')
        .gte('created_at', startOfDay.toISOString())
    
    const jurnalMap: Record<string, boolean> = {}
    jurnalToday?.forEach((j: any) => {
        if(j.siswa_target?.siswa_id) jurnalMap[j.siswa_target.siswa_id] = true
    })
    setTodayJurnalMap(jurnalMap)

    setLoading(false)
  }

  // --- LOGIC SIMPAN ABSENSI ---
  const handleSaveAbsensi = async () => {
    setSaving(true)
    try {
        const { data: { user } } = await supabase.auth.getUser()
        const today = new Date().toISOString().split('T')[0]

        // Siapkan Payload Insert/Upsert
        const upsertData = siswaList.map(siswa => ({
            siswa_id: siswa.id,
            kelompok_id: id,
            tanggal: today,
            status: formAbsen[siswa.id] || 'hadir',
            user_id: user?.id
        }))

        // Upsert (Insert or Update on Conflict)
        const { error } = await supabase
            .from('absensi')
            .upsert(upsertData, { onConflict: 'siswa_id, tanggal' })

        if (error) throw error

        // Refresh Data Local
        const newMap: Record<string, any> = {}
        upsertData.forEach(d => newMap[d.siswa_id] = d.status)
        setAbsensiMap(newMap)
        
        // Pindah ke Mode Belajar
        setViewMode('belajar')

    } catch (err: any) {
        alert('Gagal menyimpan absensi: ' + err.message)
    } finally {
        setSaving(false)
    }
  }

  // Helper ganti status di form
  const toggleStatus = (siswaId: string, current: string) => {
      const cycle = ['hadir', 'sakit', 'ijin', 'alpa']
      const idx = cycle.indexOf(current)
      const next = cycle[(idx + 1) % cycle.length]
      setFormAbsen(prev => ({ ...prev, [siswaId]: next }))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600"/></div>

  // --- TAMPILAN MODE 1: ABSENSI ---
  if (viewMode === 'absen') {
      return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <header className="bg-white p-4 shadow-sm sticky top-0 z-10 border-b flex items-center gap-3">
                <Link href="/" className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><ArrowLeft size={20}/></Link>
                <div>
                    <h1 className="font-bold text-slate-800">Absensi Kelas</h1>
                    <p className="text-xs text-slate-500">{kelompok?.nama_kelompok} • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long'})}</p>
                </div>
            </header>

            <main className="p-4 max-w-2xl mx-auto space-y-3">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700 mb-4 flex gap-2">
                    <UserCheck size={16}/>
                    Silakan cek kehadiran santri sebelum memulai pembelajaran. Tap pada status untuk mengubah.
                </div>

                {siswaList.map((siswa) => {
                    const status = formAbsen[siswa.id] || 'hadir'
                    let colorClass = 'bg-white border-slate-200'
                    let textClass = 'text-slate-600'
                    
                    if(status === 'hadir') { colorClass = 'bg-green-50 border-green-200'; textClass = 'text-green-700' }
                    if(status === 'sakit') { colorClass = 'bg-yellow-50 border-yellow-200'; textClass = 'text-yellow-700' }
                    if(status === 'ijin') { colorClass = 'bg-blue-50 border-blue-200'; textClass = 'text-blue-700' }
                    if(status === 'alpa') { colorClass = 'bg-red-50 border-red-200'; textClass = 'text-red-700' }

                    return (
                        <div key={siswa.id} 
                            onClick={() => toggleStatus(siswa.id, status)}
                            className={`p-4 rounded-xl border flex justify-between items-center cursor-pointer transition-all active:scale-95 ${colorClass}`}
                        >
                            <div>
                                <div className={`font-bold ${textClass}`}>{siswa.nama_siswa}</div>
                                <div className="text-xs opacity-70 uppercase tracking-wider font-semibold">{status}</div>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-white/50 flex items-center justify-center">
                                {status === 'hadir' ? <CheckCircle size={20} className="text-green-600"/> : <MoreHorizontal size={20} className="text-slate-400"/>}
                            </div>
                        </div>
                    )
                })}
            </main>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
                <div className="max-w-2xl mx-auto">
                    <button 
                        onClick={handleSaveAbsensi} 
                        disabled={saving}
                        className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 flex justify-center items-center gap-2 hover:bg-blue-700 transition-all"
                    >
                        {saving ? <Loader2 className="animate-spin"/> : <><Save size={20}/> SIMPAN & MULAI BELAJAR</>}
                    </button>
                </div>
            </div>
        </div>
      )
  }

  // --- TAMPILAN MODE 2: BELAJAR (LIST SISWA HADIR) ---
  // Filter siswa: Hanya tampilkan yang HADIR, atau tampilkan semua tapi yang tidak hadir disable/beda warna
  const presentStudents = siswaList.filter(s => absensiMap[s.id] === 'hadir')
  const absentStudents = siswaList.filter(s => absensiMap[s.id] !== 'hadir')

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
        {/* HEADER DASHBOARD KELAS */}
        <div className="bg-blue-600 text-white pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-white/5 pattern-grid opacity-30"></div>
            <div className="relative z-10 max-w-2xl mx-auto">
                <div className="flex justify-between items-start mb-4">
                    <Link href="/" className="bg-white/20 p-2 rounded-full hover:bg-white/30 backdrop-blur-sm transition-colors">
                        <ArrowLeft size={20} className="text-white"/>
                    </Link>
                    <button 
                        onClick={() => setViewMode('absen')}
                        className="bg-white/20 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-white/30 backdrop-blur-sm flex items-center gap-1 transition-colors"
                    >
                        <Edit3 size={12}/> Edit Absen
                    </button>
                </div>
                <h1 className="text-2xl font-bold mb-1">{kelompok?.nama_kelompok}</h1>
                <div className="flex items-center gap-2 text-blue-100 text-sm opacity-90">
                    <Calendar size={14}/> {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long'})}
                </div>
                
                {/* RINGKASAN ABSEN */}
                <div className="mt-6 flex gap-3">
                    <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 flex-1 border border-white/10">
                        <div className="text-xs text-blue-100 mb-1">Hadir</div>
                        <div className="text-xl font-bold">{presentStudents.length}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 flex-1 border border-white/10">
                        <div className="text-xs text-blue-100 mb-1">Tidak Hadir</div>
                        <div className="text-xl font-bold">{absentStudents.length}</div>
                    </div>
                    <div className="bg-green-400/20 backdrop-blur-md rounded-lg p-2.5 flex-1 border border-green-400/30">
                        <div className="text-xs text-green-50 mb-1">Sudah Setor</div>
                        <div className="text-xl font-bold text-white">{Object.keys(todayJurnalMap).length}</div>
                    </div>
                </div>
            </div>
        </div>

        <main className="px-4 -mt-6 max-w-2xl mx-auto space-y-4 relative z-20">
            
            {/* LIST SISWA HADIR */}
            {presentStudents.length > 0 ? (
                <div className="space-y-3">
                    {presentStudents.map(siswa => {
                        const isDone = todayJurnalMap[siswa.id]

                        return (
                            <Link key={siswa.id} href={`/kelompok/${id}/siswa/${siswa.id}`} className="block">
                                <div className={`bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group transition-all hover:shadow-md hover:border-blue-200
                                    ${isDone ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-slate-200'}
                                `}>
                                    <div className="flex items-center gap-4">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm
                                            ${isDone ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}
                                        `}>
                                            {siswa.nama_siswa.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className={`font-bold ${isDone ? 'text-slate-800' : 'text-slate-700'}`}>{siswa.nama_siswa}</h3>
                                            <p className="text-xs text-slate-500">{siswa.level?.nama || 'Tanpa Level'}</p>
                                        </div>
                                    </div>
                                    
                                    {isDone ? (
                                        <div className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-100 flex items-center gap-1">
                                            <CheckCircle size={12}/> Selesai
                                        </div>
                                    ) : (
                                        <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <ArrowLeft size={16} className="rotate-180"/>
                                        </div>
                                    )}
                                </div>
                            </Link>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-dashed border-slate-300">
                    <p className="text-slate-500">Tidak ada siswa yang hadir.</p>
                </div>
            )}

            {/* LIST SISWA TIDAK HADIR (Collapsed/Bottom) */}
            {absentStudents.length > 0 && (
                <div className="pt-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-2">Tidak Hadir ({absentStudents.length})</h3>
                    <div className="space-y-2 opacity-60 grayscale hover:grayscale-0 transition-all">
                        {absentStudents.map(siswa => (
                            <div key={siswa.id} className="bg-slate-100 p-3 rounded-lg border border-slate-200 flex justify-between items-center text-sm">
                                <span className="font-medium text-slate-600">{siswa.nama_siswa}</span>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-slate-200 rounded text-slate-500">
                                    {absensiMap[siswa.id]}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </main>
    </div>
  )
}