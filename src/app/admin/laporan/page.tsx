'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Printer, Filter, Loader2, Calendar } from 'lucide-react'

export default function LaporanPage() {
  const supabase = createClient()

  // STATE FILTER
  const [kelompokList, setKelompokList] = useState<any[]>([])
  const [selectedKelompok, setSelectedKelompok] = useState('')
  
  // Default: Minggu ini (Senin - Jumat)
  const curr = new Date()
  const first = curr.getDate() - curr.getDay() + 1
  const last = first + 4
  
  const [startDate, setStartDate] = useState(new Date(curr.setDate(first)).toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date(curr.setDate(last)).toISOString().slice(0, 10))
  
  // STATE DATA
  const [laporan, setLaporan] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [instansi, setInstansi] = useState<any>(null)
  const [detailKelompok, setDetailKelompok] = useState<any>(null)

  useEffect(() => {
    const fetchMaster = async () => {
        const { data: k } = await supabase.from('kelompok').select('*, users(nama_lengkap)').order('nama_kelompok')
        const { data: i } = await supabase.from('instansi').select('*').single()
        if(k) setKelompokList(k)
        if(i) setInstansi(i)
    }
    fetchMaster()
  }, [])

  // FUNGSI CARI DATA
  const handleFilter = async (e?: any) => {
    if(e) e.preventDefault()
    if(!selectedKelompok) return
    
    setLoading(true)
    
    // 1. Ambil Detail Kelompok (Untuk Header Laporan)
    const detail = kelompokList.find(k => k.id === selectedKelompok)
    setDetailKelompok(detail)

    // 2. Ambil Data Mentah
    const { data: rawData } = await supabase
        .from('jurnal_harian')
        .select(`
            id, created_at, halaman_ayat, nilai, catatan,
            siswa_target!inner (
                siswa!inner ( id, nama_siswa, kelompok_id, level:current_level_id(nama) ),
                target_pembelajaran ( judul, kategori_target )
            )
        `)
        .eq('siswa_target.siswa.kelompok_id', selectedKelompok)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at', { ascending: true })

    if (rawData) {
        // 3. TRANSFORMASI DATA (MERGING ROW)
        // Kita harus menggabungkan Tahfidz & Tahsin di hari yang sama untuk siswa yang sama
        const mergedData: Record<string, any> = {}

        rawData.forEach((row: any) => {
            const date = row.created_at.split('T')[0]
            const siswaId = row.siswa_target.siswa.id
            const key = `${date}_${siswaId}`

            if (!mergedData[key]) {
                mergedData[key] = {
                    key,
                    date: row.created_at,
                    nama_siswa: row.siswa_target.siswa.nama_siswa,
                    level_siswa: row.siswa_target.siswa.level?.nama,
                    tahfidz_materi: '-',
                    tahfidz_nilai: '-',
                    tahsin_materi: '-',
                    tahsin_nilai: '-',
                }
            }

            const kategori = row.siswa_target.target_pembelajaran.kategori_target || ''
            
            // Logic Pemisahan Kolom
            if (kategori.includes('tahfidz') || kategori.includes('takhassus') || kategori.includes('ziyadah') || kategori.includes('murajaah')) {
                mergedData[key].tahfidz_materi = `${row.siswa_target.target_pembelajaran.judul} : ${row.halaman_ayat}`
                mergedData[key].tahfidz_nilai = row.nilai || '-'
            } else {
                // Asumsi sisanya adalah Tahsin / Tilawah / Jilid / Ghorib
                mergedData[key].tahsin_materi = `${row.siswa_target.target_pembelajaran.judul} : ${row.halaman_ayat}`
                mergedData[key].tahsin_nilai = row.nilai || '-'
            }
        })

        // Convert Object back to Array & Sort by Date then Name
        const finalArray = Object.values(mergedData).sort((a: any, b: any) => {
            return new Date(a.date).getTime() - new Date(b.date).getTime() || a.nama_siswa.localeCompare(b.nama_siswa)
        })

        setLaporan(finalArray)
    }
    setLoading(false)
  }

  // Helper Format Tanggal
  const formatTanggalIndo = (dateStr: string) => {
      const date = new Date(dateStr)
      return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white">
      
      {/* HEADER NAVIGASI (TIDAK DICETAK) */}
      <div className="max-w-6xl mx-auto mb-6 print:hidden">
        <div className="flex items-center gap-4 mb-6">
            <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600"><ArrowLeft size={20}/></Link>
            <h1 className="text-2xl font-bold text-slate-900">Laporan Mingguan</h1>
        </div>

        {/* FORM FILTER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <form onSubmit={handleFilter} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Kelompok</label>
                    <select 
                        className="w-full p-2.5 border rounded-lg bg-slate-50"
                        value={selectedKelompok}
                        onChange={(e) => setSelectedKelompok(e.target.value)}
                        required
                    >
                        <option value="">-- Pilih --</option>
                        {kelompokList.map(k => <option key={k.id} value={k.id}>{k.nama_kelompok}</option>)}
                    </select>
                </div>
                <div className="w-full md:w-40">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Dari Tanggal</label>
                    <input type="date" className="w-full p-2.5 border rounded-lg" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                </div>
                <div className="w-full md:w-40">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Sampai Tanggal</label>
                    <input type="date" className="w-full p-2.5 border rounded-lg" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                </div>
                <div className="flex gap-2">
                    <button type="submit" disabled={loading} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : <Filter size={18}/>} Lihat
                    </button>
                    {laporan.length > 0 && (
                        <button type="button" onClick={() => window.print()} className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-black flex items-center gap-2">
                            <Printer size={18}/> Cetak
                        </button>
                    )}
                </div>
            </form>
        </div>
      </div>

      {/* AREA KERTAS CETAK (LANDSCAPE ORIENTATION RECOMMENDED) */}
      {laporan.length > 0 && (
          <div className="max-w-[297mm] mx-auto bg-white shadow-lg print:shadow-none p-[10mm] min-h-[210mm] print:landscape">
                
                {/* 1. KOP SURAT */}
                <div className="text-center border-b-2 border-black pb-4 mb-4">
                    <h1 className="text-2xl font-bold uppercase">{instansi?.nama_instansi || 'NAMA INSTANSI'}</h1>
                    <p className="text-sm">{instansi?.alamat}</p>
                </div>

                {/* 2. INFO HEADER LAPORAN */}
                <div className="mb-4">
                    <h2 className="text-center font-bold text-lg underline mb-4 uppercase">JURNAL PEMBELAJARAN AL-QURAN</h2>
                    <table className="w-full text-sm font-medium">
                        <tbody>
                            <tr>
                                <td className="w-32">Nama Kelompok</td>
                                <td className="w-2">:</td>
                                <td>{detailKelompok?.nama_kelompok}</td>
                                <td className="w-32 text-right">Guru Pengampu</td>
                                <td className="w-2">:</td>
                                <td className="w-48">{detailKelompok?.users?.nama_lengkap || '-'}</td>
                            </tr>
                            <tr>
                                <td>Rentang Tanggal</td>
                                <td>:</td>
                                <td>{new Date(startDate).toLocaleDateString('id-ID')} s/d {new Date(endDate).toLocaleDateString('id-ID')}</td>
                                <td className="text-right">Tahun Ajaran</td>
                                <td>:</td>
                                <td>{new Date().getFullYear()}/{new Date().getFullYear()+1}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 3. TABEL UTAMA (COMPLEX HEADER) */}
                <table className="w-full border-collapse border border-black text-sm">
                    <thead>
                        <tr className="bg-slate-100 text-black font-bold text-center uppercase">
                            <th rowSpan={2} className="border border-black p-2 w-10">No</th>
                            <th rowSpan={2} className="border border-black p-2 w-28">Hari / Tgl</th>
                            <th rowSpan={2} className="border border-black p-2">Nama Santri</th>
                            {/* KOLOM TAHFIDZ */}
                            <th colSpan={2} className="border border-black p-2 bg-blue-50">Tahfidz (Hafalan)</th>
                            {/* KOLOM TAHSIN */}
                            <th colSpan={2} className="border border-black p-2 bg-green-50">Tahsin / Materi</th>
                        </tr>
                        <tr className="bg-slate-50 text-black font-bold text-center text-xs uppercase">
                            <th className="border border-black p-1 bg-blue-50">Surat & Ayat</th>
                            <th className="border border-black p-1 w-12 bg-blue-50">Nilai</th>
                            <th className="border border-black p-1 bg-green-50">Materi & Halaman</th>
                            <th className="border border-black p-1 w-12 bg-green-50">Nilai</th>
                        </tr>
                    </thead>
                    <tbody>
                        {laporan.map((row, idx) => (
                            <tr key={idx} className="break-inside-avoid">
                                <td className="border border-black p-2 text-center">{idx + 1}</td>
                                <td className="border border-black p-2 text-center text-xs whitespace-nowrap">
                                    {formatTanggalIndo(row.date)}
                                </td>
                                <td className="border border-black p-2 font-medium">
                                    {row.nama_siswa}
                                </td>
                                {/* ISI TAHFIDZ */}
                                <td className="border border-black p-2 text-xs">
                                    {row.tahfidz_materi}
                                </td>
                                <td className="border border-black p-2 text-center font-bold">
                                    {row.tahfidz_nilai}
                                </td>
                                {/* ISI TAHSIN */}
                                <td className="border border-black p-2 text-xs">
                                    {row.tahsin_materi}
                                </td>
                                <td className="border border-black p-2 text-center font-bold">
                                    {row.tahsin_nilai}
                                </td>
                            </tr>
                        ))}
                        {laporan.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center border border-black italic text-slate-500">
                                    Tidak ada data pembelajaran pada rentang tanggal ini.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* 4. FOOTER TANDA TANGAN */}
                <div className="flex justify-between mt-8 text-sm break-inside-avoid">
                    <div className="text-center w-64">
                        <p>Mengetahui,</p>
                        <p>Kepala / Koordinator</p>
                        <br/><br/><br/>
                        <p className="font-bold border-b border-black inline-block min-w-[150px]">{instansi?.kepala_instansi || '.....................'}</p>
                    </div>
                    <div className="text-center w-64">
                        <p>{instansi?.kota || 'Tempat'}, {new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
                        <p>Guru Pengampu</p>
                        <br/><br/><br/>
                        <p className="font-bold border-b border-black inline-block min-w-[150px]">{detailKelompok?.users?.nama_lengkap || '.....................'}</p>
                    </div>
                </div>
          </div>
      )}
    </div>
  )
}