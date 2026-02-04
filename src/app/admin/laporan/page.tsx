'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Printer, Filter, Loader2 } from 'lucide-react'

export default function LaporanPage() {
  const supabase = createClient()

  // STATE FILTER
  const [kelompokList, setKelompokList] = useState<any[]>([])
  const [selectedKelompok, setSelectedKelompok] = useState('')
  
  // Default: Senin - Jumat minggu ini
  const curr = new Date()
  const first = curr.getDate() - curr.getDay() + 1
  const last = first + 4
  const [startDate, setStartDate] = useState(new Date(curr.setDate(first)).toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date(curr.setDate(last)).toISOString().slice(0, 10))
  
  // STATE DATA
  const [reportData, setReportData] = useState<any[]>([]) // Data siswa & jurnalnya
  const [dateColumns, setDateColumns] = useState<string[]>([]) // List tanggal untuk header tabel
  const [loading, setLoading] = useState(false)
  
  // STATE INFO
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

  // FUNGSI UTAMA: BUILD MATRIX
  const handleFilter = async (e?: any) => {
    if(e) e.preventDefault()
    if(!selectedKelompok) return
    
    setLoading(true)
    
    // 1. Setup Header & Tanggal
    const detail = kelompokList.find(k => k.id === selectedKelompok)
    setDetailKelompok(detail)

    // Generate Array Tanggal (Senin s/d Jumat)
    // --- PERBAIKAN DI SINI: Menambahkan tipe data string[] ---
    const dates: string[] = [] 
    
    let currentDate = new Date(startDate)
    const stopDate = new Date(endDate)
    while (currentDate <= stopDate) {
        dates.push(new Date(currentDate).toISOString().slice(0, 10))
        currentDate.setDate(currentDate.getDate() + 1)
    }
    setDateColumns(dates)

    // 2. Ambil Semua Siswa di Kelompok (Termasuk yg tidak masuk agar absen tetap ada)
    const { data: listSiswa } = await supabase
        .from('siswa')
        .select('id, nama_siswa, nis')
        .eq('kelompok_id', selectedKelompok)
        .eq('status', 'aktif')
        .order('nama_siswa')

    if (!listSiswa) { setLoading(false); return; }

    // 3. Ambil Jurnal di Rentang Tanggal
    const { data: rawJurnal } = await supabase
        .from('jurnal_harian')
        .select(`
            created_at, halaman_ayat, nilai, catatan,
            siswa_target!inner (
                siswa_id,
                target_pembelajaran ( judul, kategori_target )
            )
        `)
        .eq('siswa_target.siswa.kelompok_id', selectedKelompok)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at')

    // 4. MAPPING DATA (PIVOT)
    const processedData = listSiswa.map(siswa => {
        const row: any = {
            id: siswa.id,
            nama_siswa: siswa.nama_siswa,
            nis: siswa.nis,
            entries: {} // Key: Tanggal, Value: Array of Jurnal
        }

        // Inisialisasi setiap tanggal dengan array kosong
        dates.forEach(d => row.entries[d] = [])

        // Isi dengan data jurnal jika ada
        if (rawJurnal) {
            rawJurnal.forEach((j: any) => {
                const jDate = j.created_at.split('T')[0]
                const jSiswaId = j.siswa_target.siswa_id
                
                if (jSiswaId === siswa.id && row.entries[jDate]) {
                    row.entries[jDate].push({
                        kategori: j.siswa_target.target_pembelajaran.kategori_target || 'umum',
                        judul_target: j.siswa_target.target_pembelajaran.judul,
                        capaian: j.halaman_ayat,
                        nilai: j.nilai
                    })
                }
            })
        }
        return row
    })

    setReportData(processedData)
    setLoading(false)
  }

  // HELPER: SINGKATAN KATEGORI
  const getKode = (kategori: string, judul: string) => {
      const k = kategori ? kategori.toLowerCase() : ''
      if (k.includes('tahfidz')) return 'TF'
      if (k.includes('murajaah')) return 'MJ'
      if (k.includes('ziyadah')) return 'ZD'
      if (k.includes('tilawah')) return 'TL'
      if (k.includes('jilid')) return 'JLD'
      if (k.includes('ghorib')) return 'GR'
      if (k.includes('tajwid')) return 'TJ'
      return judul ? judul.substring(0, 3).toUpperCase() : '??'
  }

  // HELPER: FORMAT TANGGAL HEADER
  const formatDateHeader = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white">
      
      {/* FILTER AREA */}
      <div className="max-w-6xl mx-auto mb-6 print:hidden">
        <div className="flex items-center gap-4 mb-6">
            <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600"><ArrowLeft size={20}/></Link>
            <h1 className="text-2xl font-bold text-slate-900">Laporan Jurnal Pekanan</h1>
        </div>

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
                    <label className="block text-sm font-bold text-slate-700 mb-2">Mulai</label>
                    <input type="date" className="w-full p-2.5 border rounded-lg" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                </div>
                <div className="w-full md:w-40">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Sampai</label>
                    <input type="date" className="w-full p-2.5 border rounded-lg" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                </div>
                <div className="flex gap-2">
                    <button type="submit" disabled={loading} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : <Filter size={18}/>} Lihat
                    </button>
                    {reportData.length > 0 && (
                        <button type="button" onClick={() => window.print()} className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-black flex items-center gap-2">
                            <Printer size={18}/> Cetak
                        </button>
                    )}
                </div>
            </form>
        </div>
      </div>

      {/* PRINT PREVIEW AREA */}
      {reportData.length > 0 && (
          <div className="max-w-[297mm] mx-auto bg-white shadow-lg print:shadow-none p-[5mm] print:p-0 min-h-[210mm] print:landscape">
                
                {/* 1. KOP SURAT (COMPACT) */}
                <div className="text-center border-b-2 border-black pb-2 mb-2">
                    <h1 className="text-xl font-bold uppercase">{instansi?.nama_instansi || 'NAMA INSTANSI'}</h1>
                    <p className="text-xs">{instansi?.alamat}</p>
                </div>

                {/* 2. INFO HEADER */}
                <div className="mb-2 flex justify-between items-end">
                    <div className="text-sm font-bold">
                        KELOMPOK: {detailKelompok?.nama_kelompok} <span className="font-normal mx-2">|</span> 
                        GURU: {detailKelompok?.users?.nama_lengkap || '-'}
                    </div>
                    <div className="text-xs">
                        Periode: {new Date(startDate).toLocaleDateString('id-ID')} s/d {new Date(endDate).toLocaleDateString('id-ID')}
                    </div>
                </div>

                {/* 3. TABEL MATRIX (COMPACT) */}
                <table className="w-full border-collapse border border-black text-[10px] leading-tight font-sans">
                    <thead>
                        <tr className="bg-slate-100 text-black font-bold text-center uppercase">
                            <th className="border border-black p-1 w-6">No</th>
                            <th className="border border-black p-1 w-48 text-left">Nama Santri</th>
                            {dateColumns.map(date => (
                                <th key={date} className="border border-black p-1 w-24">
                                    {formatDateHeader(date)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map((row, idx) => (
                            <tr key={idx} className="break-inside-avoid hover:bg-slate-50">
                                <td className="border border-black p-1 text-center align-top">{idx + 1}</td>
                                <td className="border border-black p-1 align-top font-bold">
                                    {row.nama_siswa}
                                </td>
                                {dateColumns.map(date => {
                                    const entries = row.entries[date] || []
                                    return (
                                        <td key={date} className="border border-black p-1 align-top h-12">
                                            {entries.length > 0 ? (
                                                <div className="space-y-1">
                                                    {entries.map((ent: any, i: number) => (
                                                        <div key={i} className="flex gap-1 border-b border-dotted border-slate-300 last:border-0 pb-0.5 mb-0.5">
                                                            <span className="font-bold min-w-[20px] text-blue-800">{getKode(ent.kategori, ent.judul_target)}:</span>
                                                            <span className="flex-1 truncate">{ent.capaian}</span>
                                                            {ent.nilai && <span className="font-bold bg-slate-100 px-1 rounded border border-slate-300">{ent.nilai}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center text-slate-200 text-xs">-</div>
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* 4. FOOTER TANDA TANGAN */}
                <div className="flex justify-between mt-6 text-xs break-inside-avoid px-8">
                    <div className="text-center">
                        <p>Mengetahui,</p>
                        <p>Koordinator</p>
                        <br/><br/><br/>
                        <p className="font-bold underline">{instansi?.kepala_instansi || '.....................'}</p>
                    </div>
                    <div className="text-center">
                        <p>{instansi?.kota || 'Tempat'}, {new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
                        <p>Guru Pengampu</p>
                        <br/><br/><br/>
                        <p className="font-bold underline">{detailKelompok?.users?.nama_lengkap || '.....................'}</p>
                    </div>
                </div>

                {/* LEGEND / KETERANGAN KODE (Bawah Kiri) */}
                <div className="mt-4 text-[9px] text-slate-500 border-t pt-1">
                    <span className="font-bold">Ket:</span> TF=Tahfidz, MJ=Murajaah, ZD=Ziyadah, JLD=Jilid, TL=Tilawah, GR=Ghorib, TJ=Tajwid.
                </div>
          </div>
      )}
    </div>
  )
}