'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Printer, Filter, Loader2, FileSpreadsheet, Download, HardDrive, Calendar, Table2 } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function LaporanPage() {
  const supabase = createClient()

  // --- STATE NAVIGASI (TAB) ---
  const [activeTab, setActiveTab] = useState<'pekanan' | 'backup'>('pekanan')

  // BAGIAN 1: LAPORAN PEKANAN
  const [kelompokList, setKelompokList] = useState<any[]>([])
  const [selectedKelompok, setSelectedKelompok] = useState('')
  
  const curr = new Date()
  const first = curr.getDate() - curr.getDay() + 1
  const last = first + 4
  const [startDate, setStartDate] = useState(new Date(curr.setDate(first)).toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date(curr.setDate(last)).toISOString().slice(0, 10))
  
  const [reportData, setReportData] = useState<any[]>([]) 
  const [dateColumns, setDateColumns] = useState<string[]>([]) 
  const [loading, setLoading] = useState(false)
  
  const [instansi, setInstansi] = useState<any>(null)
  const [detailKelompok, setDetailKelompok] = useState<any>(null)

  // BAGIAN 2: BACKUP
  const today = new Date()
  const [bulanBackup, setBulanBackup] = useState(today.toISOString().slice(0, 7)) 
  const [loadingBackup, setLoadingBackup] = useState(false)

  useEffect(() => {
    const fetchMaster = async () => {
        const { data: k } = await supabase.from('kelompok').select('*, users(nama_lengkap)').order('nama_kelompok')
        const { data: i } = await supabase.from('instansi').select('*').single()
        if(k) setKelompokList(k)
        if(i) setInstansi(i)
    }
    fetchMaster()
  }, [])

  // FILTER LAPORAN PEKANAN
  const handleFilter = async (e?: any) => {
    if(e) e.preventDefault()
    if(!selectedKelompok) return
    
    setLoading(true)
    
    const detail = kelompokList.find(k => k.id === selectedKelompok)
    setDetailKelompok(detail)

    const dates: string[] = []
    let currentDate = new Date(startDate)
    const stopDate = new Date(endDate)
    while (currentDate <= stopDate) {
        dates.push(new Date(currentDate).toISOString().slice(0, 10))
        currentDate.setDate(currentDate.getDate() + 1)
    }
    setDateColumns(dates)

    const { data: listSiswa } = await supabase
        .from('siswa')
        .select('id, nama_siswa, nis')
        .eq('kelompok_id', selectedKelompok)
        .eq('status', 'aktif')
        .order('nama_siswa')

    if (!listSiswa || listSiswa.length === 0) { 
        setReportData([])
        setLoading(false); 
        return; 
    }

    const siswaIds = listSiswa.map(s => s.id)

    const { data: rawJurnal } = await supabase
        .from('jurnal_harian')
        .select(`
            created_at, halaman_ayat, nilai, catatan,
            siswa_target!inner (
                siswa_id,
                target_pembelajaran ( judul, kategori_target )
            )
        `)
        .in('siswa_target.siswa_id', siswaIds)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at')

    const processedData = listSiswa.map(siswa => {
        const row: any = {
            id: siswa.id,
            nama_siswa: siswa.nama_siswa,
            nis: siswa.nis,
            entries: {} 
        }

        dates.forEach(d => row.entries[d] = [])

        if (rawJurnal) {
            rawJurnal.forEach((j: any) => {
                const localDateStr = j.created_at.slice(0, 10) 
                const jSiswaId = j.siswa_target.siswa_id
                
                if (jSiswaId === siswa.id && row.entries[localDateStr]) {
                    row.entries[localDateStr].push({
                        kategori: j.siswa_target.target_pembelajaran?.kategori_target || 'umum',
                        judul_target: j.siswa_target.target_pembelajaran?.judul || 'Target',
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

  const formatDateHeader = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'numeric' })
  }

  // DOWNLOAD BACKUP
  const handleDownloadBackup = async () => {
    setLoadingBackup(true)
    try {
        const [year, month] = bulanBackup.split('-')
        const startD = `${bulanBackup}-01`
        const lastDay = new Date(Number(year), Number(month), 0).getDate()
        const endD = `${bulanBackup}-${lastDay}`

        const { data: dataJurnal, error: errJurnal } = await supabase
            .from('jurnal_harian')
            .select(`
                created_at, halaman_ayat, nilai, catatan, status_kehadiran,
                users (nama_lengkap),
                siswa_target (
                    siswa (nama_siswa, nis),
                    target_pembelajaran (judul, kategori_target)
                )
            `)
            .gte('created_at', startD)
            .lte('created_at', endD + 'T23:59:59')
            .order('created_at', { ascending: true })

        if (errJurnal) throw errJurnal

        const { data: dataAbsen, error: errAbsen } = await supabase
            .from('absensi')
            .select(`
                tanggal, status,
                siswa (nama_siswa, nis),
                kelompok (nama_kelompok)
            `)
            .gte('tanggal', startD)
            .lte('tanggal', endD)
            .order('tanggal', { ascending: true })
        
        if (errAbsen) throw errAbsen

        const { data: dataBayar, error: errBayar } = await supabase
            .from('pembayaran')
            .select(`
                created_at, tanggal, total_bayar, jumlah_sesi, catatan,
                siswa (nama_siswa, nis),
                users (nama_lengkap)
            `)
            .gte('tanggal', startD)
            .lte('tanggal', endD)
            .order('tanggal', { ascending: true })

        if (errBayar) throw errBayar

        const wb = XLSX.utils.book_new()

        const jurnalRows = dataJurnal?.map((j: any) => ({
            TANGGAL: new Date(j.created_at).toLocaleDateString('id-ID'),
            JAM: new Date(j.created_at).toLocaleTimeString('id-ID'),
            NIS: j.siswa_target?.siswa?.nis,
            NAMA_SISWA: j.siswa_target?.siswa?.nama_siswa,
            TARGET: j.siswa_target?.target_pembelajaran?.judul,
            CAPAIAN: j.halaman_ayat,
            NILAI: j.nilai,
            CATATAN: j.catatan,
            GURU: j.users?.nama_lengkap
        })) || []
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jurnalRows), "Jurnal")

        const absenRows = dataAbsen?.map((a: any) => ({
            TANGGAL: new Date(a.tanggal).toLocaleDateString('id-ID'),
            NIS: a.siswa?.nis,
            NAMA_SISWA: a.siswa?.nama_siswa,
            KELOMPOK: a.kelompok?.nama_kelompok,
            STATUS: a.status.toUpperCase()
        })) || []
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(absenRows), "Absensi")

        const bayarRows = dataBayar?.map((b: any) => ({
            TANGGAL: new Date(b.tanggal).toLocaleDateString('id-ID'),
            NIS: b.siswa?.nis,
            NAMA_SISWA: b.siswa?.nama_siswa,
            SESI: b.jumlah_sesi,
            NOMINAL: b.total_bayar,
            PENERIMA: b.users?.nama_lengkap,
            KET: b.catatan
        })) || []
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bayarRows), "Keuangan")

        XLSX.writeFile(wb, `Backup_Data_${bulanBackup}.xlsx`)
        
    } catch (err: any) {
        alert("Gagal: " + err.message)
    } finally {
        setLoadingBackup(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white">
      
      <div className="max-w-6xl mx-auto mb-6 print:hidden">
        
        <div className="flex items-center gap-4 mb-6">
            <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600"><ArrowLeft size={20}/></Link>
            <h1 className="text-2xl font-bold text-slate-900">Pusat Data & Laporan</h1>
        </div>

        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-6 w-fit">
            <button onClick={() => setActiveTab('pekanan')} className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'pekanan' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Table2 size={16}/> Laporan Pekanan
            </button>
            <button onClick={() => setActiveTab('backup')} className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'backup' ? 'bg-green-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                <FileSpreadsheet size={16}/> Backup Excel
            </button>
        </div>

        {activeTab === 'pekanan' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-left-4">
                <form onSubmit={handleFilter} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Kelompok</label>
                        <select className="w-full p-2.5 border rounded-lg bg-slate-50" value={selectedKelompok} onChange={(e) => setSelectedKelompok(e.target.value)} required>
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
        )}

        {activeTab === 'backup' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-green-100 p-3 rounded-xl text-green-600"><FileSpreadsheet size={24}/></div>
                        <div>
                            <h3 className="font-bold text-slate-800">Download Rekap Bulanan</h3>
                            <p className="text-xs text-slate-500">Jurnal, Absensi & Keuangan dalam 1 File.</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Bulan</label>
                            <input type="month" className="w-full p-3 border rounded-lg font-bold text-slate-600" value={bulanBackup} onChange={(e) => setBulanBackup(e.target.value)} />
                        </div>
                        <button onClick={handleDownloadBackup} disabled={loadingBackup} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-200 flex justify-center items-center gap-2">
                            {loadingBackup ? <Loader2 className="animate-spin"/> : <Download size={20}/>} DOWNLOAD EXCEL
                        </button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-blue-100 p-3 rounded-xl text-blue-600"><HardDrive size={24}/></div>
                            <div>
                                <h3 className="font-bold text-slate-800">Simpan ke Cloud</h3>
                                <p className="text-xs text-slate-500">Google Drive</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">
                            Sangat disarankan untuk mengupload file Excel hasil download ke Google Drive sekolah sebagai cadangan data (Backup) jika terjadi kerusakan pada perangkat lokal.
                        </p>
                    </div>
                    <a href="https://drive.google.com/drive/u/0/my-drive" target="_blank" rel="noopener noreferrer" className="w-full bg-white border-2 border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition-all flex justify-center items-center gap-2">
                        BUKA GOOGLE DRIVE
                    </a>
                </div>
            </div>
        )}
      </div>

      {activeTab === 'pekanan' && reportData.length > 0 && (
          <div className="max-w-[297mm] mx-auto bg-white shadow-lg print:shadow-none p-[5mm] print:p-0 min-h-[210mm] print:landscape">
                <div className="text-center border-b-2 border-black pb-2 mb-2">
                    <h1 className="text-xl font-bold uppercase">{instansi?.nama_instansi || 'NAMA INSTANSI'}</h1>
                    <p className="text-xs">{instansi?.alamat}</p>
                </div>

                <div className="mb-2 flex justify-between items-end">
                    <div className="text-sm font-bold">
                        KELOMPOK: {detailKelompok?.nama_kelompok} <span className="font-normal mx-2">|</span> 
                        GURU: {detailKelompok?.users?.nama_lengkap || '-'}
                    </div>
                    <div className="text-xs">
                        Periode: {new Date(startDate).toLocaleDateString('id-ID')} s/d {new Date(endDate).toLocaleDateString('id-ID')}
                    </div>
                </div>

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

                <div className="mt-4 text-[9px] text-slate-500 border-t pt-1">
                    <span className="font-bold">Ket:</span> TF=Tahfidz, MJ=Murajaah, ZD=Ziyadah, JLD=Jilid, TL=Tilawah, GR=Ghorib, TJ=Tajwid.
                </div>
          </div>
      )}
    </div>
  )
}