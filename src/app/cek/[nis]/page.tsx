'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, User, Calendar, BookOpen, Clock, CheckCircle, XCircle, AlertCircle, Banknote, MapPin } from 'lucide-react'

export default function DetailSantriPage({ params }: { params: Promise<{ nis: string }> }) {
  const { nis } = use(params)
  const supabase = createClient()

  const [siswa, setSiswa] = useState<any>(null)
  const [jurnal, setJurnal] = useState<any[]>([])
  const [absensi, setAbsensi] = useState<any[]>([])
  const [stats, setStats] = useState({
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpha: 0,
      total_pertemuan: 0
  })
  
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // KONSTANTA HARGA (Bisa disesuaikan)
  const NOMINAL_SESI = 5000

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true)
        setErrorMsg(null)

        try {
            // 1. Data Siswa
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
            
            if (errSiswa) throw new Error("Data santri tidak ditemukan.")
            setSiswa(dataSiswa)

            // 2. Jurnal Terakhir (5 Data)
            const { data: dataJurnal } = await supabase
                .from('jurnal_harian')
                .select(`
                    created_at, 
                    halaman_ayat, 
                    nilai, 
                    catatan,
                    users!guru_id(nama_lengkap), 
                    siswa_target!inner(
                        target_pembelajaran(judul, kategori_target)
                    )
                `)
                .eq('siswa_target.siswa_id', dataSiswa.id)
                .order('created_at', { ascending: false })
                .limit(5)
            
            if (dataJurnal) setJurnal(dataJurnal)

            // 3. Absensi Bulan Ini (Untuk Statistik)
            const startMonth = new Date().toISOString().slice(0, 7) + '-01'
            const { data: dataAbsen } = await supabase
                .from('absensi')
                .select('*')
                .eq('siswa_id', dataSiswa.id)
                .gte('tanggal', startMonth)
            
            if (dataAbsen) {
                setAbsensi(dataAbsen)
                // Hitung Statistik
                const s = {
                    hadir: dataAbsen.filter(a => a.status === 'hadir').length,
                    sakit: dataAbsen.filter(a => a.status === 'sakit').length,
                    izin: dataAbsen.filter(a => a.status === 'ijin').length,
                    alpha: dataAbsen.filter(a => a.status === 'alpa').length,
                    total_pertemuan: dataAbsen.length
                }
                setStats(s)
            }

        } catch (err: any) {
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
        <h1 className="text-xl font-bold text-slate-800 mb-2">Maaf</h1>
        <p className="text-slate-600 mb-6">{errorMsg}</p>
        <Link href="/cek" className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-black transition-all">
            Kembali Cari
        </Link>
    </div>
  )

  // --- LOGIKA KEUANGAN ---
  const saldo = siswa.saldo_sesi || 0
  // Rumus: Yang Sudah Dibayar = Jumlah Hadir + Saldo
  // Contoh: Hadir 14, Saldo -1 (Kurang 1). Berarti Sudah Bayar = 13.
  // Contoh: Hadir 14, Saldo +2 (Lebih 2). Berarti Sudah Bayar = 16.
  const sudahBayarCount = stats.hadir + saldo
  const kurangBayarCount = saldo < 0 ? Math.abs(saldo) : 0
  const nominalKurang = kurangBayarCount * NOMINAL_SESI

  return (
    <div className="min-h-screen bg-slate-50 pb-10 font-sans">
        
        {/* HEADER PROFILE (Simple & Clean) */}
        <div className="bg-blue-600 text-white p-6 pb-20 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-10 -mb-5 blur-xl"></div>
            
            <Link href="/cek" className="absolute top-6 left-6 p-2 bg-white/20 rounded-full hover:bg-white/30 backdrop-blur-sm transition-all"><ArrowLeft size={20}/></Link>
            
            <div className="flex flex-col items-center text-center mt-2 relative z-10">
                <div className="h-20 w-20 bg-white rounded-full p-1 shadow-xl mb-3">
                    <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                        <User size={36}/>
                    </div>
                </div>
                <h1 className="text-xl font-bold">{siswa.nama_siswa}</h1>
                <div className="flex items-center gap-2 mt-1 text-xs bg-blue-700/50 px-3 py-1 rounded-full border border-blue-500/30 backdrop-blur-md">
                    <span className="opacity-80">Jilid: {siswa.level?.nama}</span>
                    <span className="w-1 h-1 bg-white rounded-full"></span>
                    <span className="opacity-80">{siswa.kelompok?.nama_kelompok}</span>
                </div>
            </div>
        </div>

        <div className="max-w-md mx-auto px-4 -mt-14 space-y-5 relative z-20">
            
            {/* 1. KARTU TRANSPARANSI (ABSENSI & KEUANGAN) */}
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                        <Calendar size={16} className="text-blue-500"/> Laporan Bulan Ini
                    </h3>
                    <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                        {new Date().toLocaleDateString('id-ID', {month:'long', year:'numeric'})}
                    </span>
                </div>
                
                <div className="p-5">
                    {/* Statistik Absensi Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-6 text-center">
                        <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                            <div className="text-lg font-bold text-green-700">{stats.hadir}</div>
                            <div className="text-[10px] text-green-600 font-medium">Hadir</div>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-100">
                            <div className="text-lg font-bold text-yellow-700">{stats.sakit}</div>
                            <div className="text-[10px] text-yellow-600 font-medium">Sakit</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                            <div className="text-lg font-bold text-blue-700">{stats.izin}</div>
                            <div className="text-[10px] text-blue-600 font-medium">Izin</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                            <div className="text-lg font-bold text-red-700">{stats.alpha}</div>
                            <div className="text-[10px] text-red-600 font-medium">Alfa</div>
                        </div>
                    </div>

                    {/* Transparansi Pembayaran */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-slate-500">PEMBAYARAN INFAQ / SPP</span>
                            <span className="text-[10px] text-slate-400">Rp {NOMINAL_SESI.toLocaleString('id-ID')} / pertemuan</span>
                        </div>
                        
                        <div className="space-y-3">
                            {/* Baris 1: Wajib Bayar */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600">Total Pertemuan (Hadir)</span>
                                <span className="font-bold text-slate-800">{stats.hadir}x</span>
                            </div>
                            
                            {/* Baris 2: Sudah Bayar */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600">Sudah Dibayarkan</span>
                                <span className="font-bold text-blue-600">{sudahBayarCount}x</span>
                            </div>

                            <div className="border-t border-slate-200 my-2"></div>

                            {/* Baris 3: Status Akhir */}
                            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                <span className="text-xs font-bold text-slate-500">STATUS SAAT INI</span>
                                {kurangBayarCount > 0 ? (
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full inline-block mb-0.5">
                                            KURANG BAYAR
                                        </div>
                                        <div className="text-sm font-bold text-red-700">
                                            {kurangBayarCount}x (Rp {nominalKurang.toLocaleString('id-ID')})
                                        </div>
                                    </div>
                                ) : saldo > 0 ? (
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full inline-block mb-0.5">
                                            TABUNGAN / LEBIH
                                        </div>
                                        <div className="text-sm font-bold text-green-700">
                                            Simpanan {saldo}x Pertemuan
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full inline-block mb-0.5">
                                            LUNAS
                                        </div>
                                        <div className="text-sm font-bold text-slate-700">
                                            Tidak ada tunggakan
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. PROGRESS HARIAN (TIMELINE CARD) */}
            <div>
                <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 px-1">
                    <BookOpen size={18} className="text-purple-500"/> Progres Hafalan Terakhir
                </h3>
                
                <div className="space-y-3">
                    {jurnal.length > 0 ? (
                        jurnal.map((item, i) => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex gap-4 items-start relative overflow-hidden">
                                {/* Hiasan Level (Kategori) */}
                                <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-bold uppercase tracking-wider
                                    ${item.siswa_target?.target_pembelajaran?.kategori_target?.includes('tahfidz') ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}
                                `}>
                                    {item.siswa_target?.target_pembelajaran?.kategori_target || 'UMUM'}
                                </div>

                                {/* Tanggal Box */}
                                <div className="flex flex-col items-center justify-center min-w-[50px] bg-slate-50 rounded-lg p-2 border border-slate-100">
                                    <span className="text-lg font-bold text-slate-700">
                                        {new Date(item.created_at).getDate()}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">
                                        {new Date(item.created_at).toLocaleDateString('id-ID', {month:'short'})}
                                    </span>
                                </div>

                                {/* Konten */}
                                <div className="flex-1 pt-1">
                                    <h4 className="font-bold text-slate-800 text-sm leading-tight mb-1">
                                        {item.siswa_target?.target_pembelajaran?.judul}
                                    </h4>
                                    <p className="text-sm text-slate-600 font-medium bg-slate-50 inline-block px-2 py-0.5 rounded mb-1">
                                        {item.halaman_ayat}
                                    </p>
                                    
                                    {/* Nilai & Catatan */}
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                                        <div className="flex items-center gap-2">
                                            <div className={`text-xs font-bold px-2 py-0.5 rounded text-white
                                                ${item.nilai === 'A' ? 'bg-green-500' : item.nilai === 'B' ? 'bg-blue-500' : 'bg-yellow-500'}
                                            `}>
                                                Nilai: {item.nilai}
                                            </div>
                                            {item.catatan && (
                                                <span className="text-[10px] text-slate-400 italic max-w-[120px] truncate">
                                                    "{item.catatan}"
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-200">
                            <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-300">
                                <BookOpen size={24}/>
                            </div>
                            <p className="text-slate-400 text-sm">Belum ada data setoran.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-center text-[10px] text-slate-300 pt-4 pb-8">
                Data diperbarui secara real-time dari sistem Jurnal Ummi.
            </div>

        </div>
    </div>
  )
}