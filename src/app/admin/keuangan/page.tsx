'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Printer, Calculator, Banknote, User, Loader2 } from 'lucide-react'

export default function KeuanganPage() {
  const supabase = createClient()

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  
  // STATE DATA
  const [laporan, setLaporan] = useState<any[]>([])
  const [instansi, setInstansi] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  // SUMMARY STATS
  const [stats, setStats] = useState({ omset: 0, bagiHasil: 0, operasional: 0 })

  useEffect(() => {
    const fetchInstansi = async () => {
        const { data } = await supabase.from('instansi').select('*').single()
        if(data) setInstansi(data)
    }
    fetchInstansi()
  }, [])

  const handleHitungGaji = async (e?: any) => {
    if(e) e.preventDefault()
    setLoading(true)

    const [year, month] = selectedMonth.split('-')
    const startDate = `${year}-${month}-01`
    const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]

    // 1. Ambil Data Kelompok (Wadah)
    const { data: listKelompok } = await supabase
        .from('kelompok')
        .select('id, nama_kelompok, guru_utama_id, users:guru_utama_id(nama_lengkap)')
    
    // 2. Ambil Data Pembayaran (SUMBER DANA)
    const { data: rawBayar } = await supabase
        .from('pembayaran')
        .select('kelompok_id, total_bayar')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)

    // 3. Ambil Data Absensi (DISTRIBUSI KERJA)
    // Ambil distinct (tanggal + kelompok) untuk menghitung total sesi
    const { data: listAbsen } = await supabase
        .from('absensi')
        .select('tanggal, kelompok_id, user_id')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)

    // 4. Ambil List Guru
    const { data: listGuru } = await supabase.from('users').select('id, nama_lengkap')

    if (!rawBayar || !listKelompok || !listAbsen || !listGuru) {
        setLoading(false)
        return
    }

    // --- LOGIC: AVERAGE SESSION VALUE ---
    
    // Init Dompet Guru
    const salaryMap: Record<string, any> = {}
    listGuru.forEach(g => {
        salaryMap[g.id] = { 
            id: g.id, 
            nama: g.nama_lengkap, 
            honor_utama: 0,    // Gaji dari kelas sendiri
            honor_badal: 0,    // Gaji dari menggantikan orang
            sesi_utama: 0,
            sesi_badal: 0,
            total_terima: 0
        }
    })

    let totalOmsetSemua = 0

    // PROSES PER KELOMPOK
    listKelompok.forEach(k => {
        // A. Hitung Total Omset Kelompok Bulan Ini
        const omsetKelompok = rawBayar
            .filter(b => b.kelompok_id === k.id)
            .reduce((sum, b) => sum + (b.total_bayar || 0), 0)
        
        totalOmsetSemua += omsetKelompok

        // B. Hitung Total Sesi (Hari Efektif) Kelompok Ini
        // Filter absen milik kelompok ini, lalu ambil unik tanggalnya
        const sesiUnik = new Set(
            listAbsen.filter(a => a.kelompok_id === k.id).map(a => `${a.tanggal}_${a.user_id}`)
        )
        // Array unik sesi: [{tanggal, pengajar_id}]
        const sesiList = Array.from(sesiUnik).map(s => {
            const [tgl, uid] = s.split('_')
            return { tanggal: tgl, pengajar_id: uid }
        })
        
        const jumlahSesi = sesiList.length

        // C. Hitung Nilai Per Sesi (Fair Share)
        // Jika tidak ada sesi tapi ada uang masuk (aneh, tapi bisa jadi titipan), simpan di guru utama.
        // Jika ada sesi, bagi rata.
        
        const hakGuruTotal = omsetKelompok * 0.40 // 40%
        const honorPerSesi = jumlahSesi > 0 ? (hakGuruTotal / jumlahSesi) : 0

        // D. Distribusi ke Pengajar (Sesuai Absensi)
        sesiList.forEach(sesi => {
            const pengajarId = sesi.pengajar_id
            const isGuruUtama = pengajarId === k.guru_utama_id
            
            if (salaryMap[pengajarId]) {
                if (isGuruUtama) {
                    salaryMap[pengajarId].honor_utama += honorPerSesi
                    salaryMap[pengajarId].sesi_utama += 1
                } else {
                    salaryMap[pengajarId].honor_badal += honorPerSesi
                    salaryMap[pengajarId].sesi_badal += 1
                }
            } else {
                // Case: Admin/User lain yg mengajar tapi tidak ada di listGuru
                // Uang tetap dihitung tapi mungkin tidak tampil di tabel guru.
                // Idealnya masukkan ke "Unknown/Admin"
            }
        })

        // Case Khusus: Jika ada omset tapi TIDAK ADA SESI sama sekali (Libur full tapi ada yg bayar SPP)
        // Berikan semua ke Guru Utama
        if (jumlahSesi === 0 && hakGuruTotal > 0 && k.guru_utama_id) {
             if (salaryMap[k.guru_utama_id]) {
                 salaryMap[k.guru_utama_id].honor_utama += hakGuruTotal
             }
        }
    })

    // Finalisasi
    const finalReport = Object.values(salaryMap)
        .map((s: any) => ({
            ...s,
            total_terima: s.honor_utama + s.honor_badal
        }))
        .filter((s: any) => s.total_terima > 0)
        .sort((a: any, b: any) => b.total_terima - a.total_terima)

    setLaporan(finalReport)
    setStats({
        omset: totalOmsetSemua,
        bagiHasil: totalOmsetSemua * 0.4,
        operasional: totalOmsetSemua * 0.6
    })
    setLoading(false)
  }

  const rp = (num: number) => 'Rp ' + Math.round(num).toLocaleString('id-ID')

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white">
      
      {/* FILTER AREA */}
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
                {/* INPUT TARIF BADAL DIHAPUS KARENA SUDAH OTOMATIS */}
                <div className="flex-1 text-xs text-slate-500 pb-2">
                    *Honor badal dihitung otomatis berdasarkan rata-rata omset per sesi pada kelas yang digantikan.
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
                            <th className="border border-slate-600 p-2 bg-blue-50">Honor Utama</th>
                            <th className="border border-slate-600 p-2 bg-green-50">Honor Badal</th>
                            <th className="border border-slate-600 p-2 bg-slate-200">Total Terima</th>
                        </tr>
                    </thead>
                    <tbody>
                        {laporan.map((row, index) => (
                            <tr key={index} className="break-inside-avoid hover:bg-slate-50">
                                <td className="border border-slate-400 p-2 text-center">{index + 1}</td>
                                <td className="border border-slate-400 p-2">
                                    <div className="font-bold">{row.nama}</div>
                                    <div className="text-[10px] text-slate-500">
                                        Mengajar: {row.sesi_utama} sesi
                                        {row.sesi_badal > 0 && `, Badal: ${row.sesi_badal} sesi`}
                                    </div>
                                </td>
                                <td className="border border-slate-400 p-2 text-right bg-blue-50 font-medium">
                                    {rp(row.honor_utama)}
                                </td>
                                <td className="border border-slate-400 p-2 text-right bg-green-50 text-green-700">
                                    {row.honor_badal > 0 ? `+${rp(row.honor_badal)}` : '-'}
                                </td>
                                <td className="border border-slate-400 p-2 text-right font-bold bg-slate-100">{rp(row.total_terima)}</td>
                            </tr>
                        ))}
                        {/* FOOTER TOTAL */}
                        <tr className="bg-slate-800 text-white font-bold">
                            <td colSpan={2} className="p-2 text-right">TOTAL</td>
                            <td className="p-2 text-right text-blue-200">{rp(laporan.reduce((a,b)=>a+b.honor_utama, 0))}</td>
                            <td className="p-2 text-right text-green-200">{rp(laporan.reduce((a,b)=>a+b.honor_badal, 0))}</td>
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