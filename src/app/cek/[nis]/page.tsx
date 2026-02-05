'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, User, Calendar, TrendingUp, Clock, CheckCircle, AlertCircle, Wallet } from 'lucide-react'

export default function DetailSantriPage({ params }: { params: Promise<{ nis: string }> }) {
  const { nis } = use(params)
  const supabase = createClient()

  const [siswa, setSiswa] = useState<any>(null)
  const [jurnal, setJurnal] = useState<any[]>([])
  const [absensi, setAbsensi] = useState<any[]>([])
  
  // State Error Handling
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true)
        setErrorMsg(null)

        try {
            // 1. Data Siswa
            // PERBAIKAN QUERY: Menggunakan !guru_utama_id agar supabase tahu relasinya
            const { data: dataSiswa, error: errSiswa } = await supabase
                .from('siswa')
                .select(`
                    *, 
                    level(nama), 
                    kelompok(
                        nama_kelompok, 
                        users!guru_utama_id(nama_lengkap)
                    )
                `)
                .eq('nis', nis)
                .single()
            
            if (errSiswa) throw new Error(`Gagal ambil siswa: ${errSiswa.message} (${errSiswa.code})`)
            if (!dataSiswa) throw new Error("NIS tidak ditemukan")
            
            setSiswa(dataSiswa)

            // 2. Jurnal Terakhir (5 Data)
            // PERBAIKAN QUERY: Menggunakan !guru_id
            const { data: dataJurnal, error: errJurnal } = await supabase
                .from('jurnal_harian')
                .select(`
                    created_at, 
                    halaman_ayat, 
                    nilai, 
                    users!guru_id(nama_lengkap), 
                    siswa_target!inner(
                        target_pembelajaran(judul)
                    )
                `)
                .eq('siswa_target.siswa_id', dataSiswa.id)
                .order('created_at', { ascending: false })
                .limit(5)
            
            if (errJurnal) console.error("Error Jurnal:", errJurnal) // Log aja, jangan throw biar halaman tetap tampil
            if (dataJurnal) setJurnal(dataJurnal)

            // 3. Absensi Bulan Ini
            const startMonth = new Date().toISOString().slice(0, 7) + '-01'
            const { data: dataAbsen, error: errAbsen } = await supabase
                .from('absensi')
                .select('*')
                .eq('siswa_id', dataSiswa.id)
                .gte('tanggal', startMonth)
                .order('tanggal', { ascending: false })
            
            if (errAbsen) console.error("Error Absen:", errAbsen)
            if (dataAbsen) setAbsensi(dataAbsen)

        } catch (err: any) {
            console.error("FULL ERROR:", err)
            setErrorMsg(err.message)
        } finally {
            setLoading(false)
        }
    }
    fetchData()
  }, [nis])

  if (loading) return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-blue-600 font-bold text-sm">Sedang memuat data...</p>
      </div>
  )

  if (errorMsg) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-100 p-4 rounded-full mb-4 text-red-600"><AlertCircle size={32}/></div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Terjadi Kesalahan</h1>
        <p className="text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 text-sm font-mono max-w-md mx-auto mb-6">
            {errorMsg}
        </p>
        <Link href="/cek" className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-black transition-all">
            Coba Cari Lagi
        </Link>
    </div>
  )

  const saldo = siswa.saldo_sesi || 0
  // Handle jika relasi kelompok/guru kosong (Safety Check)
  const namaGuru = siswa.kelompok?.users?.nama_lengkap || '-' 

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
        
        {/* HEADER PROFILE */}
        <div className="bg-blue-600 text-white p-6 pb-16 rounded-b-[2.5rem] shadow-lg relative">
            <Link href="/cek" className="absolute top-6 left-6 p-2 bg-white/20 rounded-full hover:bg-white/30 backdrop-blur-sm"><ArrowLeft size={20}/></Link>
            <div className="flex flex-col items-center text-center mt-4">
                <div className="h-24 w-24 bg-white rounded-full p-1 shadow-xl mb-4">
                    <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <User size={40}/>
                    </div>
                </div>
                <h1 className="text-2xl font-bold">{siswa.nama_siswa}</h1>
                <p className="text-blue-100 text-sm mt-1">{siswa.kelompok?.nama_kelompok} • {siswa.level?.nama}</p>
                <div className="mt-2 text-xs bg-blue-700/50 px-3 py-1 rounded-full border border-blue-500/30">
                    Guru: {namaGuru}
                </div>
            </div>
        </div>

        <div className="max-w-xl mx-auto px-4 -mt-10 space-y-6">
            
            {/* KARTU KEUANGAN */}
            <div className="bg-white p-5 rounded-xl shadow-md border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Wallet className="text-blue-600"/> Status Administrasi
                </h3>
                <div className={`p-4 rounded-lg border-l-4 flex justify-between items-center ${saldo < 0 ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'}`}>
                    <div>
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Saldo Sesi</div>
                        <div className={`text-2xl font-bold ${saldo < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {saldo < 0 ? `Tunggakan ${Math.abs(saldo)}x` : `Deposit ${saldo}x`}
                        </div>
                    </div>
                    {saldo < 0 ? <AlertCircle size={32} className="text-red-300"/> : <CheckCircle size={32} className="text-green-300"/>}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-center">
                    *Data diperbarui setiap kali guru melakukan absensi di kelas.
                </p>
            </div>

            {/* GRAFIK KEHADIRAN */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Calendar className="text-orange-500"/> Kehadiran Bulan Ini
                </h3>
                {absensi.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {absensi.map((a, i) => (
                            <div key={i} className="flex-shrink-0 flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white mb-2
                                    ${a.status === 'hadir' ? 'bg-green-500' : a.status === 'sakit' ? 'bg-yellow-500' : 'bg-red-500'}
                                `}>
                                    {a.status === 'hadir' ? 'H' : a.status.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium">
                                    {new Date(a.tanggal).getDate()}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 text-slate-400 text-sm italic">Belum ada data absensi bulan ini.</div>
                )}
            </div>

            {/* RIWAYAT HAFALAN */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <TrendingUp className="text-purple-500"/> Capaian Terakhir
                </h3>
                <div className="space-y-4">
                    {jurnal.length > 0 ? (
                        jurnal.map((item, i) => (
                            <div key={i} className="relative pl-6 border-l-2 border-slate-100 pb-1 last:pb-0">
                                <div className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-blue-400 ring-4 ring-white"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">{item.siswa_target?.target_pembelajaran?.judul}</div>
                                        <div className="text-slate-600 text-sm">{item.halaman_ayat}</div>
                                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                            <Clock size={10}/> {new Date(item.created_at).toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'short'})}
                                            <span>•</span>
                                            {item.users?.nama_lengkap}
                                        </div>
                                    </div>
                                    {item.nilai && (
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                                            item.nilai === 'A' ? 'bg-green-100 text-green-700' : 
                                            item.nilai === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {item.nilai}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 text-slate-400 text-sm italic">Belum ada data setoran hafalan.</div>
                    )}
                </div>
            </div>

        </div>
    </div>
  )
}