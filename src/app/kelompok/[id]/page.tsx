'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Calendar, CheckCircle, Save, Loader2, Edit3, DollarSign, Wallet, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function KelompokDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()

  // STATE DATA
  const [kelompok, setKelompok] = useState<any>(null)
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [absensiMap, setAbsensiMap] = useState<Record<string, any>>({}) 
  const [todayJurnalMap, setTodayJurnalMap] = useState<Record<string, boolean>>({}) 

  // STATE UI
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'absen' | 'belajar'>('belajar') 
  const [saving, setSaving] = useState(false)
  
  // STATE TANGGAL
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA')) // YYYY-MM-DD

  // STATE FORM
  const [formAbsen, setFormAbsen] = useState<Record<string, string>>({}) 
  const [formBayar, setFormBayar] = useState<Record<string, { isPay: boolean, count: number }>>({})

  const HARGA_SESI = 5000 

  useEffect(() => {
    fetchData()
  }, [id, selectedDate])

  const fetchData = async () => {
    setLoading(true)
    
    const { data: dataKelompok } = await supabase.from('kelompok').select('*').eq('id', id).single()
    if(dataKelompok) setKelompok(dataKelompok)

    const { data: dataSiswa } = await supabase
        .from('siswa')
        .select('*, level(nama)')
        .eq('kelompok_id', id)
        .eq('status', 'aktif')
        .order('nama_siswa')
    
    if(dataSiswa) {
        setSiswaList(dataSiswa)
        
        const initAbsen: Record<string, string> = {}
        const initBayar: Record<string, any> = {}
        
        dataSiswa.forEach((s) => { 
            initAbsen[s.id] = 'hadir' 
            initBayar[s.id] = { isPay: true, count: 1 } 
        })
        setFormAbsen(initAbsen)
        setFormBayar(initBayar)
    }

    const { data: dataAbsen } = await supabase.from('absensi').select('*')
        .eq('kelompok_id', id)
        .eq('tanggal', selectedDate)
    
    if (dataAbsen && dataAbsen.length > 0) {
        setViewMode('belajar')
        const map: Record<string, any> = {}
        dataAbsen.forEach(a => map[a.siswa_id] = a.status)
        setAbsensiMap(map)
    } else {
        setViewMode('absen') 
        setAbsensiMap({})
    }

    const startDate = selectedDate + 'T00:00:00'
    const endDate = selectedDate + 'T23:59:59'
    
    const { data: jurnalToday } = await supabase.from('jurnal_harian')
        .select('siswa_target(siswa_id)')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        
    const jurnalMap: Record<string, boolean> = {}
    jurnalToday?.forEach((j: any) => { if(j.siswa_target?.siswa_id) jurnalMap[j.siswa_target.siswa_id] = true })
    setTodayJurnalMap(jurnalMap)

    setLoading(false)
  }

  const toggleStatus = (siswaId: string, current: string) => {
      const cycle = ['hadir', 'sakit', 'ijin', 'alpa']
      const next = cycle[(cycle.indexOf(current) + 1) % cycle.length]
      
      setFormAbsen(prev => ({ ...prev, [siswaId]: next }))
      
      if (next !== 'hadir') {
          setFormBayar(prev => ({ ...prev, [siswaId]: { ...prev[siswaId], isPay: false } }))
      } else {
          setFormBayar(prev => ({ ...prev, [siswaId]: { isPay: true, count: 1 } }))
      }
  }

  const togglePay = (siswaId: string) => {
      setFormBayar(prev => {
          const current = prev[siswaId] || { isPay: false, count: 1 }
          return { ...prev, [siswaId]: { ...current, isPay: !current.isPay } }
      })
  }

  const setPayCount = (siswaId: string, count: number) => {
      setFormBayar(prev => ({ ...prev, [siswaId]: { isPay: true, count: count } }))
  }

  const handleSaveAbsensi = async () => {
    setSaving(true)
    try {
        const { data: { user } } = await supabase.auth.getUser()
        const tanggalSimpan = selectedDate 

        const upsertAbsen = siswaList.map(siswa => ({
            siswa_id: siswa.id,
            kelompok_id: id,
            tanggal: tanggalSimpan,
            status: formAbsen[siswa.id] || 'hadir',
            user_id: user?.id
        }))
        const { error: errAbsen } = await supabase.from('absensi').upsert(upsertAbsen, { onConflict: 'siswa_id, tanggal' })
        if (errAbsen) throw errAbsen

        const paymentInserts: any[] = []
        
        for (const siswa of siswaList) {
            const absenStatus = formAbsen[siswa.id]
            const payData = formBayar[siswa.id]
            const isHadir = absenStatus === 'hadir'
            
            let deltaSaldo = 0
            if (isHadir) deltaSaldo -= 1 
            
            if (payData && payData.isPay && payData.count > 0) {
                const totalBayar = payData.count * HARGA_SESI
                paymentInserts.push({
                    tanggal: tanggalSimpan,
                    siswa_id: siswa.id,
                    kelompok_id: id,
                    guru_id: user?.id,
                    jumlah_sesi: payData.count,
                    nominal_per_sesi: HARGA_SESI,
                    total_bayar: totalBayar,
                    catatan: isHadir ? 'Bayar saat hadir' : 'Titip bayar'
                })
                deltaSaldo += payData.count 
            }

            if (deltaSaldo !== 0) {
                const currentSaldo = siswa.saldo_sesi || 0
                await supabase.from('siswa').update({ saldo_sesi: currentSaldo + deltaSaldo }).eq('id', siswa.id)
            }
        }

        if (paymentInserts.length > 0) {
            const { error: errPay } = await supabase.from('pembayaran').insert(paymentInserts)
            if (errPay) throw errPay
        }

        setViewMode('belajar')
        fetchData() 

    } catch (err: any) {
        alert('Gagal menyimpan: ' + err.message)
    } finally {
        setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600"/></div>

  // --- TAMPILAN MODE 1: FORM INPUT ABSENSI ---
  if (viewMode === 'absen') {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            
            {/* HEADER STICKY */}
            <div className="sticky top-0 z-30 bg-white shadow-md border-b border-slate-200">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Link href="/" className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><ArrowLeft size={20}/></Link>
                    <div>
                        <h1 className="font-bold text-slate-800 text-lg leading-none">{kelompok?.nama_kelompok}</h1>
                        <p className="text-xs text-slate-500 mt-1">Absensi & Keuangan</p>
                    </div>
                </div>
                
                <div className="px-4 pb-3">
                    <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${selectedDate !== new Date().toLocaleDateString('en-CA') ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                        <Calendar size={18} className={selectedDate !== new Date().toLocaleDateString('en-CA') ? 'text-orange-600' : 'text-slate-500'}/>
                        <input 
                            type="date" 
                            className={`bg-transparent text-sm font-bold outline-none w-full ${selectedDate !== new Date().toLocaleDateString('en-CA') ? 'text-orange-700' : 'text-slate-700'}`}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT - PB-80 (SUPER BESAR UNTUK MENGHINDARI TOMBOL TERTUTUP) */}
            <main className="p-4 max-w-3xl mx-auto space-y-4 pb-80 w-full flex-1">
                
                {selectedDate !== new Date().toLocaleDateString('en-CA') && (
                    <div className="bg-orange-100 text-orange-800 text-xs p-3 rounded-lg flex items-center gap-2 border border-orange-200 animate-in fade-in">
                        <AlertCircle size={16}/>
                        <span>Anda sedang menginput absen untuk tanggal <strong>{new Date(selectedDate).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}</strong></span>
                    </div>
                )}

                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700 flex gap-2">
                    <Wallet size={16}/>
                    <div>
                        <p className="font-bold">Info Pembayaran:</p>
                        <p>Klik tombol <strong>Rp</strong> untuk mencatat pembayaran. Saldo siswa otomatis terupdate.</p>
                    </div>
                </div>

                {siswaList.map((siswa) => {
                    const status = formAbsen[siswa.id] || 'hadir'
                    const pay = formBayar[siswa.id] || { isPay: false, count: 1 }
                    const saldo = siswa.saldo_sesi || 0
                    const isTunggakan = saldo < 0

                    return (
                        <div key={siswa.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* BARIS ATAS: NAMA & STATUS KEHADIRAN */}
                            <div className="p-4 flex justify-between items-center border-b border-slate-100">
                                <div>
                                    <div className="font-bold text-slate-800 text-lg">{siswa.nama_siswa}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {isTunggakan ? (
                                            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 flex items-center gap-1">
                                                <AlertCircle size={10}/> Tunggakan: {Math.abs(saldo)}x
                                            </span>
                                        ) : saldo > 0 ? (
                                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                                Deposit: {saldo}x
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-400">Lunas / Impas</span>
                                        )}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => toggleStatus(siswa.id, status)}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all border ${
                                        status === 'hadir' ? 'bg-green-100 text-green-700 border-green-200' :
                                        status === 'sakit' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                        status === 'ijin' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                        'bg-red-100 text-red-700 border-red-200'
                                    }`}
                                >
                                    {status}
                                </button>
                            </div>

                            {/* BARIS BAWAH: PANEL PEMBAYARAN */}
                            <div className={`p-3 flex items-center gap-3 transition-colors ${pay.isPay ? 'bg-blue-50/50' : 'bg-slate-50'}`}>
                                <button 
                                    onClick={() => togglePay(siswa.id)}
                                    disabled={status !== 'hadir'} 
                                    className={`h-10 w-10 rounded-full flex items-center justify-center border transition-all ${
                                        pay.isPay 
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                        : 'bg-white text-slate-300 border-slate-200 hover:border-slate-300'
                                    } ${status !== 'hadir' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <DollarSign size={20}/>
                                </button>

                                {pay.isPay ? (
                                    <div className="flex-1 flex items-center gap-2 animate-in slide-in-from-left-2">
                                        <div className="flex bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
                                            {[1, 2, 3, 4, 5, 20].map(num => (
                                                <button 
                                                    key={num}
                                                    onClick={() => setPayCount(siswa.id, num)}
                                                    className={`px-3 py-2 text-sm font-bold border-r border-slate-100 last:border-0 transition-colors ${
                                                        pay.count === num ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600'
                                                    }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                        <input 
                                            type="number" 
                                            value={pay.count}
                                            onChange={(e) => setPayCount(siswa.id, Number(e.target.value))}
                                            className="w-14 p-2 text-center font-bold text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <span className="text-xs font-bold text-blue-700">
                                            x Rp {HARGA_SESI/1000}k
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">
                                        {status === 'hadir' ? 'Tidak ada pembayaran' : 'Tidak hadir'}
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}

                {/* DUMMY SPACER UNTUK MEMAKSA SCROLL LEBIH DALAM */}
                <div className="h-24 w-full bg-transparent"></div>
            </main>

            {/* TOMBOL SIMPAN FIXED DI BAWAH */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div className="max-w-3xl mx-auto">
                    <button 
                        onClick={handleSaveAbsensi} 
                        disabled={saving}
                        className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 flex justify-center items-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
                    >
                        {saving ? <Loader2 className="animate-spin"/> : <><Save size={20}/> SIMPAN ({new Date(selectedDate).toLocaleDateString('id-ID', {day:'numeric', month:'short'})})</>}
                    </button>
                </div>
            </div>
        </div>
      )
  }

  // --- TAMPILAN MODE 2: DASHBOARD KELAS (VIEW ONLY) ---
  const presentStudents = siswaList.filter(s => absensiMap[s.id] === 'hadir')
  const absentStudents = siswaList.filter(s => absensiMap[s.id] && absensiMap[s.id] !== 'hadir')

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
        
        {/* HEADER DASHBOARD */}
        <div className="bg-blue-600 text-white pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden shrink-0">
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
                
                <div className="flex items-center gap-2 mt-2 bg-blue-700/50 backdrop-blur-sm rounded-lg px-3 py-1.5 w-fit border border-blue-500/50">
                    <Calendar size={14} className="text-blue-100"/>
                    <input 
                        type="date" 
                        className="bg-transparent text-sm font-medium text-white outline-none w-auto"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                </div>
                
                <div className="mt-6 flex gap-3">
                    <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 flex-1 border border-white/10">
                        <div className="text-xs text-blue-100 mb-1">Hadir</div>
                        <div className="text-xl font-bold">{presentStudents.length}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 flex-1 border border-white/10">
                        <div className="text-xs text-blue-100 mb-1">Absen</div>
                        <div className="text-xl font-bold">{absentStudents.length}</div>
                    </div>
                    <div className="bg-green-400/20 backdrop-blur-md rounded-lg p-2.5 flex-1 border border-green-400/30">
                        <div className="text-xs text-green-50 mb-1">Setor</div>
                        <div className="text-xl font-bold text-white">{Object.keys(todayJurnalMap).length}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* MAIN CONTENT DASHBOARD */}
        <main className="px-4 -mt-6 max-w-2xl mx-auto space-y-4 relative z-20 w-full flex-1 pb-20">
            
            {selectedDate !== new Date().toLocaleDateString('en-CA') && (
                <div className="bg-white p-3 rounded-xl shadow-sm border-l-4 border-l-orange-500 flex items-center gap-2 text-sm text-slate-600">
                    <AlertCircle className="text-orange-500" size={18}/>
                    <span>Menampilkan arsip tanggal <strong>{new Date(selectedDate).toLocaleDateString('id-ID', {day:'numeric', month:'long'})}</strong></span>
                </div>
            )}

            {presentStudents.length > 0 ? (
                <div className="space-y-3">
                    {presentStudents.map(siswa => {
                        const isDone = todayJurnalMap[siswa.id]
                        const saldo = siswa.saldo_sesi || 0
                        
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
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-slate-500">{siswa.level?.nama || 'Tanpa Level'}</p>
                                                {saldo < 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 rounded font-bold">Hutang {Math.abs(saldo)}x</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {isDone ? (
                                        <div className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-100 flex items-center gap-1">
                                            <CheckCircle size={12}/> Selesai
                                        </div>
                                    ) : (
                                        <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <Edit3 size={16}/>
                                        </div>
                                    )}
                                </div>
                            </Link>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-dashed border-slate-300">
                    <p className="text-slate-500">
                        {selectedDate === new Date().toLocaleDateString('en-CA') 
                            ? "Belum ada siswa yang diabsen hari ini." 
                            : "Tidak ada data kehadiran pada tanggal ini."}
                    </p>
                    <button onClick={() => setViewMode('absen')} className="mt-2 text-blue-600 font-bold text-sm underline">
                        Isi Absensi Sekarang
                    </button>
                </div>
            )}

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