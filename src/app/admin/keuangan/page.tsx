'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Printer, Calculator, Banknote, Calendar, Loader2, Search, User } from 'lucide-react'

export default function KeuanganPage() {
  const supabase = createClient()

  // SETTINGS (Bisa diubah lewat UI nanti)
  // Berapa honor guru badal sekali masuk? (Diambil dari jatah 40% guru utama)
  const [tarifBadal, setTarifBadal] = useState(20000) 
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  
  // STATE DATA
  const [laporan, setLaporan] = useState<any[]>([])
  const [instansi, setInstansi] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  // SUMMARY STATS
  const [stats, setStats] = useState({ omset: 0, bagiHasil: 0, operasional: 0 })

  useEffect(() => {
    // Load Instansi Info untuk Kop Surat
    const fetchInstansi = async () => {
        const { data } = await supabase.from('instansi').select('*').single()
        if(data) setInstansi(data)
    }
    fetchInstansi()
  }, [])

  const handleHitungGaji = async (e?: any) => {
    if(e) e.preventDefault()
    setLoading(true)

    // 1. Tentukan Range Tanggal
    const [year, month] = selectedMonth.split('-')
    const startDate = `${year}-${month}-01`
    const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]

    // 2. Ambil Data Pembayaran (Omset)
    const { data: rawBayar } = await supabase
        .from('pembayaran')
        .select('kelompok_id, total_bayar')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)

    // 3. Ambil Data Kelompok & Guru Utama
    const { data: listKelompok } = await supabase
        .from('kelompok')
        .select('id, nama_kelompok, guru_utama_id, users:guru_utama_id(nama_lengkap)')
    
    // 4. Ambil Data Absensi (Untuk Cek Siapa yang Mengajar)
    // Kita perlu tahu siapa user_id yg melakukan absen pada tanggal tersebut
    const { data: listAbsen } = await supabase
        .from('absensi')
        .select('tanggal, kelompok_id, user_id')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)

    // 5. Ambil List Semua Guru (Untuk menampung gaji badal bagi guru yg tidak punya kelas)
    const { data: listGuru } = await supabase
        .from('users')
        .select('id, nama_lengkap')
        .eq('role', 'guru') // Asumsi ada kolom role, atau ambil semua user

    if (!rawBayar || !listKelompok || !listAbsen || !listGuru) {
        setLoading(false)
        return
    }

    // --- ALGORITMA HITUNG GAJI ---
    
    // A. Init Dompet Guru
    // Structure: { guruId: { nama, gross: 0, badal_income: 0, badal_deduct: 0, badal_count: 0, total: 0 } }
    const salaryMap: Record<string, any> = {}
    
    listGuru.forEach(g => {
        salaryMap[g.id] = { 
            id: g.id,
            nama: g.nama_lengkap, 
            omset_kelas: 0,
            gross_share: 0,    // Hak 40%
            badal_income: 0,   // Dapat duit krn menggantikan orang
            badal_deduct: 0,   // Potongan krn digantikan orang
            badal_in_count: 0, // Berapa kali jadi badal
            badal_out_count: 0 // Berapa kali digantikan
        }
    })

    // B. Hitung Omset & Share 40% per Kelompok
    let totalOmsetSemua = 0

    listKelompok.forEach(k => {
        // Hitung total uang masuk di kelompok ini
        const omset = rawBayar
            .filter(b => b.kelompok_id === k.id)
            .reduce((sum, b) => sum + (b.total_bayar || 0), 0)
        
        totalOmsetSemua += omset
        
        // Hak Guru Utama 40%
        const share40 = omset * 0.4
        
        // Masukkan ke dompet Guru Utama
        if (k.guru_utama_id && salaryMap[k.guru_utama_id]) {
            salaryMap[k.guru_utama_id].omset_kelas += omset
            salaryMap[k.guru_utama_id].gross_share += share40
        }
    })

    // C. Hitung Badal (Transfer Honor)
    // Kita cek absensi unik per hari per kelompok
    // (Karena absensi disimpan per siswa, kita ambil distinct by tanggal & kelompok)
    
    const sesiUnik: Set<string> = new Set()
    
    listAbsen.forEach(absen => {
        const key = `${absen.tanggal}_${absen.kelompok_id}`
        
        // Jika sesi ini belum dihitung
        if (!sesiUnik.has(key)) {
            sesiUnik.add(key)
            
            // Cari Kelompoknya
            const targetKelompok = listKelompok.find(k => k.id === absen.kelompok_id)
            if (targetKelompok) {
                const guruUtamaId = targetKelompok.guru_utama_id
                const guruPengajarId = absen.user_id // Siapa yg input absen
                
                // JIKA PENGAJAR != GURU UTAMA => BADAL TERDETEKSI
                if (guruUtamaId && guruPengajarId && guruUtamaId !== guruPengajarId) {
                    
                    // 1. Potong Guru Utama
                    if (salaryMap[guruUtamaId]) {
                        salaryMap[guruUtamaId].badal_deduct += tarifBadal
                        salaryMap[guruUtamaId].badal_out_count += 1
                    }

                    // 2. Beri ke Guru Badal
                    // (Pastikan guru badal ada di map, kalau admin yg input mungkin skip)
                    if (salaryMap[guruPengajarId]) {
                        salaryMap[guruPengajarId].badal_income += tarifBadal
                        salaryMap[guruPengajarId].badal_in_count += 1
                    }
                }
            }
        }
    })

    // D. Finalisasi Array
    const finalReport = Object.values(salaryMap)
        .map((s: any) => ({
            ...s,
            total_terima: (s.gross_share - s.badal_deduct) + s.badal_income
        }))
        .filter((s: any) => s.total_terima > 0 || s.omset_kelas > 0) // Hanya tampilkan yg ada duitnya
        .sort((a: any, b: any) => b.total_terima - a.total_terima)

    setLaporan(finalReport)
    setStats({
        omset: totalOmsetSemua,
        bagiHasil: totalOmsetSemua * 0.4,
        operasional: totalOmsetSemua * 0.6
    })
    setLoading(false)
  }

  // Helper Rupiah
  const rp = (num: number) => 'Rp ' + num.toLocaleString('id-ID')

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white">
      
      {/* FILTER AREA (HIDDEN ON PRINT) */}
      <div className="max-w-5xl mx-auto mb-6 print:hidden">
        <div className="flex items-center gap-4 mb-6">
            <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600"><ArrowLeft size={20}/></Link>
            <h1 className="text-2xl font-bold text-slate-900">Payroll & Keuangan</h1>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Banknote size={24}/></div>
                <div>
                    <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Total Omset</div>
                    <div className="text-xl font-bold text-slate-900">{rp(stats.omset)}</div>
                </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><User size={24}/></div>
                <div>
                    <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Hak Guru (40%)</div>
                    <div className="text-xl font-bold text-purple-700">{rp(stats.bagiHasil)}</div>
                </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-green-50 text-green-600 rounded-lg"><Banknote size={24}/></div>
                <div>
                    <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Lembaga (60%)</div>
                    <div className="text-xl font-bold text-green-700">{rp(stats.operasional)}</div>
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <form onSubmit={handleHitungGaji} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Bulan Periode</label>
                    <input 
                        type="month" 
                        className="w-full p-2.5 border rounded-lg bg-slate-50 border-slate-300"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        required
                    />
                </div>
                <div className="w-full md:w-48">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Tarif Badal / Sesi</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-sm font-bold">Rp</span>
                        <input 
                            type="number" 
                            className="w-full pl-10 p-2.5 border rounded-lg bg-slate-50 border-slate-300"
                            value={tarifBadal}
                            onChange={(e) => setTarifBadal(Number(e.target.value))}
                        />
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : <Calculator size={18}/>} Hitung Gaji
                    </button>
                    {laporan.length > 0 && (
                        <button type="button" onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-black flex items-center gap-2">
                            <Printer size={18}/> Cetak Slip
                        </button>
                    )}
                </div>
            </form>
        </div>
      </div>

      {/* HASIL LAPORAN (SLIP GAJI VIEW) */}
      {laporan.length > 0 && (
          <div className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none p-[10mm] min-h-[297mm]">
                
                {/* KOP SURAT */}
                <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                    <h1 className="text-xl font-bold uppercase tracking-wide">{instansi?.nama_instansi || 'NAMA INSTANSI'}</h1>
                    <h2 className="text-sm font-semibold text-slate-600">{instansi?.alamat}</h2>
                    <h3 className="text-lg font-bold mt-4 underline">REKAPITULASI HONORARIUM GURU</h3>
                    <p className="text-sm">Periode: {new Date(selectedMonth).toLocaleDateString('id-ID', {month:'long', year:'numeric'})}</p>
                </div>

                {/* TABEL GAJI */}
                <table className="w-full border-collapse border border-slate-900 text-sm mb-8">
                    <thead>
                        <tr className="bg-slate-100 text-slate-900 font-bold text-center uppercase">
                            <th className="border border-slate-600 p-2 w-10">No</th>
                            <th className="border border-slate-600 p-2 text-left">Nama Guru</th>
                            <th className="border border-slate-600 p-2">Omset Kelas</th>
                            <th className="border border-slate-600 p-2 bg-blue-50">Bagi Hasil (40%)</th>
                            <th className="border border-slate-600 p-2 bg-red-50 text-red-700">Pot. Badal</th>
                            <th className="border border-slate-600 p-2 bg-green-50 text-green-700">Honor Badal</th>
                            <th className="border border-slate-600 p-2 bg-slate-200">Total Terima</th>
                        </tr>
                    </thead>
                    <tbody>
                        {laporan.map((row, index) => (
                            <tr key={index} className="break-inside-avoid hover:bg-slate-50">
                                <td className="border border-slate-400 p-2 text-center">{index + 1}</td>
                                <td className="border border-slate-400 p-2 font-bold">{row.nama}</td>
                                <td className="border border-slate-400 p-2 text-right">{rp(row.omset_kelas)}</td>
                                <td className="border border-slate-400 p-2 text-right font-medium bg-blue-50">{rp(row.gross_share)}</td>
                                <td className="border border-slate-400 p-2 text-right text-red-600 bg-red-50">
                                    {row.badal_deduct > 0 ? `(${row.badal_out_count}x) -${rp(row.badal_deduct)}` : '-'}
                                </td>
                                <td className="border border-slate-400 p-2 text-right text-green-600 bg-green-50">
                                    {row.badal_income > 0 ? `(${row.badal_in_count}x) +${rp(row.badal_income)}` : '-'}
                                </td>
                                <td className="border border-slate-400 p-2 text-right font-bold bg-slate-100">{rp(row.total_terima)}</td>
                            </tr>
                        ))}
                        {/* FOOTER TOTAL */}
                        <tr className="bg-slate-800 text-white font-bold">
                            <td colSpan={2} className="p-2 text-right">TOTAL PENGELUARAN GAJI</td>
                            <td className="p-2 text-right">-</td>
                            <td className="p-2 text-right">{rp(laporan.reduce((a,b)=>a+b.gross_share, 0))}</td>
                            <td className="p-2 text-right text-red-200">-{rp(laporan.reduce((a,b)=>a+b.badal_deduct, 0))}</td>
                            <td className="p-2 text-right text-green-200">+{rp(laporan.reduce((a,b)=>a+b.badal_income, 0))}</td>
                            <td className="p-2 text-right text-yellow-400">{rp(laporan.reduce((a,b)=>a+b.total_terima, 0))}</td>
                        </tr>
                    </tbody>
                </table>

                {/* TANDA TANGAN */}
                <div className="flex justify-between mt-12 text-sm break-inside-avoid px-8">
                    <div className="text-center">
                        <p>Mengetahui,</p>
                        <p>Kepala / Owner</p>
                        <br/><br/><br/>
                        <p className="font-bold underline">{instansi?.kepala_instansi || '( ........................... )'}</p>
                    </div>
                    <div className="text-center">
                        <p>{instansi?.kota || 'Tempat'}, {new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
                        <p>Bendahara</p>
                        <br/><br/><br/>
                        <p className="font-bold underline">( ........................... )</p>
                    </div>
                </div>
          </div>
      )}
    </div>
  )
}