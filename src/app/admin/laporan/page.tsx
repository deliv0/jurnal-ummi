'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Printer, Calendar, Filter, FileText, Loader2, Download } from 'lucide-react'

export default function LaporanPage() {
  const supabase = createClient()

  // STATE FILTER
  const [kelompokList, setKelompokList] = useState<any[]>([])
  const [selectedKelompok, setSelectedKelompok] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  
  // STATE DATA
  const [laporan, setLaporan] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [instansi, setInstansi] = useState<any>(null)

  useEffect(() => {
    // Load Master Data
    const fetchMaster = async () => {
        const { data: k } = await supabase.from('kelompok').select('*').order('nama_kelompok')
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

    // Hitung Range Tanggal (Awal Bulan s/d Akhir Bulan)
    const [year, month] = selectedMonth.split('-')
    const startDate = `${year}-${month}-01`
    const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0] // Tgl terakhir bulan itu

    // Query Complex: Join Jurnal -> Siswa_Target -> Siswa (Filter by Kelompok)
    const { data, error } = await supabase
        .from('jurnal_harian')
        .select(`
            *,
            users ( nama_lengkap ),
            siswa_target!inner (
                target_pembelajaran ( judul, kategori_target ),
                siswa!inner ( nama_siswa, nis, kelompok_id )
            )
        `)
        .eq('siswa_target.siswa.kelompok_id', selectedKelompok)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at', { ascending: true }) // Urutkan tanggal

    if(data) setLaporan(data)
    setLoading(false)
  }

  // Format Tanggal Indo
  const formatTanggal = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('id-ID', {
          day: '2-digit', month: '2-digit', year: 'numeric'
      })
  }

  const getNamaKelompok = () => {
      return kelompokList.find(k => k.id === selectedKelompok)?.nama_kelompok || 'Semua'
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white">
      
      {/* HEADER (HIDDEN ON PRINT) */}
      <div className="max-w-5xl mx-auto mb-6 print:hidden">
        <div className="flex items-center gap-4 mb-6">
            <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600">
                <ArrowLeft size={20}/>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Laporan Jurnal Mengajar</h1>
        </div>

        {/* CARD FILTER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <form onSubmit={handleFilter} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Kelompok / Kelas</label>
                    <select 
                        className="w-full p-2.5 border rounded-lg bg-slate-50 border-slate-300"
                        value={selectedKelompok}
                        onChange={(e) => setSelectedKelompok(e.target.value)}
                        required
                    >
                        <option value="">-- Pilih Kelompok --</option>
                        {kelompokList.map(k => (
                            <option key={k.id} value={k.id}>{k.nama_kelompok}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Bulan</label>
                    <input 
                        type="month" 
                        className="w-full p-2.5 border rounded-lg bg-slate-50 border-slate-300"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        required
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : <Filter size={18}/>} Tampilkan
                    </button>
                    {laporan.length > 0 && (
                        <button type="button" onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-black flex items-center gap-2">
                            <Printer size={18}/> Cetak
                        </button>
                    )}
                </div>
            </form>
        </div>
      </div>

      {/* HASIL LAPORAN (KERTAS A4) */}
      {laporan.length > 0 ? (
          <div className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none p-[10mm] min-h-[297mm]">
                
                {/* KOP SURAT */}
                <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                    <h1 className="text-xl font-bold uppercase tracking-wide">{instansi?.nama_instansi || 'NAMA INSTANSI'}</h1>
                    <h2 className="text-sm font-semibold text-slate-600">{instansi?.alamat || 'Alamat Instansi Belum Diatur'}</h2>
                    <h3 className="text-lg font-bold mt-4 underline">LAPORAN JURNAL PEMBELAJARAN</h3>
                </div>

                {/* INFO KELAS */}
                <div className="flex justify-between text-sm mb-4 font-medium">
                    <table>
                        <tbody>
                            <tr>
                                <td className="w-24">Kelompok</td>
                                <td>: {getNamaKelompok()}</td>
                            </tr>
                            <tr>
                                <td>Bulan</td>
                                <td>: {new Date(selectedMonth).toLocaleDateString('id-ID', {month:'long', year:'numeric'})}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="text-right">
                        <p>Total Kegiatan: {laporan.length} Entri</p>
                    </div>
                </div>

                {/* TABEL DATA */}
                <table className="w-full border-collapse border border-slate-900 text-sm">
                    <thead>
                        <tr className="bg-slate-100 text-slate-900 font-bold text-xs uppercase text-center">
                            <th className="border border-slate-600 p-2 w-10">No</th>
                            <th className="border border-slate-600 p-2 w-24">Tanggal</th>
                            <th className="border border-slate-600 p-2">Nama Santri</th>
                            <th className="border border-slate-600 p-2">Materi / Jilid</th>
                            <th className="border border-slate-600 p-2">Pencapaian</th>
                            <th className="border border-slate-600 p-2 w-10">Nilai</th>
                            <th className="border border-slate-600 p-2 w-24">Guru</th>
                        </tr>
                    </thead>
                    <tbody>
                        {laporan.map((row, index) => (
                            <tr key={index} className="break-inside-avoid hover:bg-slate-50">
                                <td className="border border-slate-400 p-2 text-center">{index + 1}</td>
                                <td className="border border-slate-400 p-2 text-center text-xs">
                                    {formatTanggal(row.created_at)}
                                    <div className="text-[10px] text-slate-500">
                                        {new Date(row.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                    </div>
                                </td>
                                <td className="border border-slate-400 p-2 font-medium">
                                    {row.siswa_target?.siswa?.nama_siswa}
                                </td>
                                <td className="border border-slate-400 p-2 text-xs">
                                    {row.siswa_target?.target_pembelajaran?.judul}
                                </td>
                                <td className="border border-slate-400 p-2 text-xs">
                                    {row.halaman_ayat}
                                    {row.catatan && <div className="italic text-[10px] text-slate-500 mt-1">"{row.catatan}"</div>}
                                </td>
                                <td className="border border-slate-400 p-2 text-center font-bold">
                                    {row.nilai || '-'}
                                </td>
                                <td className="border border-slate-400 p-2 text-center text-xs">
                                    {row.users?.nama_lengkap?.split(' ')[0]}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* TANDA TANGAN */}
                <div className="flex justify-between mt-12 text-sm break-inside-avoid">
                    <div className="text-center">
                        <p>Mengetahui,</p>
                        <p>Kepala Sekolah / Koordinator</p>
                        <br/><br/><br/>
                        <p className="font-bold underline">{instansi?.kepala_instansi || '( ........................... )'}</p>
                        <p>NIP/NIY. ...........................</p>
                    </div>
                    <div className="text-center">
                        <p>{new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
                        <p>Guru Pengampu</p>
                        <br/><br/><br/>
                        <p className="font-bold underline">( ........................... )</p>
                    </div>
                </div>
          </div>
      ) : (
          !loading && selectedKelompok && (
              <div className="max-w-5xl mx-auto p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                  <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3"/>
                  <h3 className="font-bold text-slate-600">Tidak ada data laporan</h3>
                  <p className="text-slate-400 text-sm">Coba pilih kelompok atau bulan yang lain.</p>
              </div>
          )
      )}
    </div>
  )
}