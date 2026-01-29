'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Printer, Download, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function RaportPage({ params }: { params: Promise<{ siswaId: string }> }) {
  const { siswaId } = use(params)
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  
  // State untuk Catatan (Bisa diedit sebelum print)
  const [catatan, setCatatan] = useState("Ananda menunjukkan perkembangan yang baik. Mohon bimbingan orang tua di rumah untuk mengulang hafalan (Muraja'ah) agar semakin lancar.")

  useEffect(() => {
    const fetchData = async () => {
        // 1. Ambil Data Siswa & Instansi
        const { data: siswa } = await supabase
            .from('siswa')
            .select('*, kelompok(nama_kelompok, guru_utama_id), level(nama), instansi(*)')
            .eq('id', siswaId)
            .single()

        // 2. Ambil Target Aktif & Capaian Terakhirnya
        const { data: targets } = await supabase
            .from('siswa_target')
            .select(`
                *,
                target_pembelajaran(judul, kategori_target),
                jurnal_harian (
                    halaman_ayat,
                    nilai,
                    created_at
                )
            `)
            .eq('siswa_id', siswaId)
            .eq('status', 'active')
            .order('created_at', { ascending: false, referencedTable: 'jurnal_harian' })

        // 3. Hitung Statistik Kehadiran
        const { data: absen } = await supabase
            .from('jurnal_harian')
            .select('status_kehadiran, siswa_target!inner(siswa_id)')
            .eq('siswa_target.siswa_id', siswaId)

        const stats = {
            hadir: absen?.filter((x:any) => x.status_kehadiran === 'hadir').length || 0,
            sakit: absen?.filter((x:any) => x.status_kehadiran === 'sakit').length || 0,
            ijin: absen?.filter((x:any) => x.status_kehadiran === 'ijin').length || 0,
            alpa: absen?.filter((x:any) => x.status_kehadiran === 'alpa').length || 0,
        }

        // Olah Data Target
        const processedTargets = targets?.map((t:any) => {
            const sortedJurnal = t.jurnal_harian?.sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            const lastLog = sortedJurnal?.[0] || null
            return {
                ...t,
                last_capaian: lastLog?.halaman_ayat || '-',
                last_nilai: lastLog?.nilai || '-',
                last_update: lastLog?.created_at
            }
        })

        setData({ siswa, targets: processedTargets, stats })
        setLoading(false)
    }
    fetchData()
  }, [siswaId])

  const handlePrint = () => {
    window.print()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Menyiapkan Raport...</div>

  return (
    <div className="min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white font-sans">
      
      {/* NAVBAR (HANYA DILAYAR) */}
      <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center print:hidden">
         <Link href="#" onClick={() => window.close()} className="flex items-center gap-2 text-slate-500 hover:text-slate-800">
            <ChevronLeft size={20}/> Kembali
         </Link>
         <button 
            onClick={handlePrint}
            className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700 flex items-center gap-2 transition-all"
         >
            <Printer size={18}/> Cetak PDF
         </button>
      </div>

      {/* KERTAS A4 (210mm x 297mm) */}
      <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl print:shadow-none p-[20mm] relative text-slate-900 leading-relaxed">
        
        {/* === BAGIAN 1: KOP SURAT DENGAN LOGO === */}
        <div className="border-b-4 border-double border-slate-800 pb-6 mb-8 relative">
            {/* LOGO - Muncul jika URL ada */}
            {data?.siswa?.instansi?.logo_url && (
                <div className="absolute left-0 top-0 h-full flex items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                        src={data?.siswa?.instansi?.logo_url} 
                        alt="Logo" 
                        className="h-24 w-auto object-contain"
                    />
                </div>
            )}
            
            {/* TEXT KOP - Diberi padding kiri jika ada logo agar tidak nabrak */}
            <div className={`text-center ${data?.siswa?.instansi?.logo_url ? 'pl-20' : ''}`}>
                <h1 className="text-3xl font-bold uppercase tracking-wide text-slate-900">
                    {data?.siswa?.instansi?.nama_instansi || 'NAMA TPQ BELUM DISET'}
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                    {data?.siswa?.instansi?.alamat || 'Alamat belum diatur'}
                </p>
                <p className="text-sm text-slate-600">
                    {data?.siswa?.instansi?.kota && `${data?.siswa?.instansi?.kota} • `} 
                    Telp: {data?.siswa?.instansi?.telepon || '-'} 
                    {data?.siswa?.instansi?.email && ` • Email: ${data?.siswa?.instansi?.email}`}
                </p>
            </div>
        </div>

        {/* JUDUL */}
        <div className="text-center mb-8">
            <h2 className="text-xl font-bold underline decoration-2 underline-offset-4">LAPORAN PERKEMBANGAN SANTRI</h2>
            <p className="text-sm text-slate-500 mt-1 italic">Periode: {new Date().toLocaleDateString('id-ID', {month:'long', year:'numeric'})}</p>
        </div>

        {/* IDENTITAS */}
        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
            <div className="space-y-2">
                <div className="grid grid-cols-3">
                    <span className="font-semibold text-slate-500">Nama Santri</span>
                    <span className="col-span-2 font-bold uppercase">: {data?.siswa?.nama_siswa}</span>
                </div>
                <div className="grid grid-cols-3">
                    <span className="font-semibold text-slate-500">Nomor Induk</span>
                    <span className="col-span-2">: {data?.siswa?.nis || '-'}</span>
                </div>
            </div>
            <div className="space-y-2">
                <div className="grid grid-cols-3">
                    <span className="font-semibold text-slate-500">Kelompok</span>
                    <span className="col-span-2">: {data?.siswa?.kelompok?.nama_kelompok}</span>
                </div>
                <div className="grid grid-cols-3">
                    <span className="font-semibold text-slate-500">Level Saat Ini</span>
                    <span className="col-span-2">: {data?.siswa?.level?.nama}</span>
                </div>
            </div>
        </div>

        {/* TABEL CAPAIAN */}
        <div className="mb-8">
            <h3 className="font-bold text-lg mb-3 border-l-4 border-blue-600 pl-3">A. Capaian Pembelajaran</h3>
            <table className="w-full border-collapse border border-slate-300 text-sm">
                <thead>
                    <tr className="bg-slate-100 text-slate-700">
                        <th className="border border-slate-300 p-3 text-left w-10">No</th>
                        <th className="border border-slate-300 p-3 text-left">Materi / Target</th>
                        <th className="border border-slate-300 p-3 text-left">Capaian Terakhir</th>
                        <th className="border border-slate-300 p-3 text-center w-24">Nilai</th>
                        <th className="border border-slate-300 p-3 text-center w-32">Ket</th>
                    </tr>
                </thead>
                <tbody>
                    {data?.targets?.length > 0 ? (
                        data?.targets.map((t:any, idx:number) => (
                            <tr key={idx}>
                                <td className="border border-slate-300 p-3 text-center">{idx + 1}</td>
                                <td className="border border-slate-300 p-3 font-medium">
                                    {t.target_pembelajaran?.judul}
                                    <div className="text-[10px] text-slate-500 uppercase">{t.target_pembelajaran?.kategori_target?.replace('_', ' ')}</div>
                                </td>
                                <td className="border border-slate-300 p-3">
                                    {t.last_capaian}
                                    {t.last_update && (
                                        <div className="text-[10px] text-slate-400 italic">
                                            Update: {new Date(t.last_update).toLocaleDateString('id-ID')}
                                        </div>
                                    )}
                                </td>
                                <td className="border border-slate-300 p-3 text-center font-bold text-slate-800">{t.last_nilai}</td>
                                <td className="border border-slate-300 p-3 text-center">
                                    {t.last_nilai === 'A' ? 'Sangat Baik' : t.last_nilai === 'B' ? 'Baik' : t.last_nilai === 'C' ? 'Cukup' : '-'}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={5} className="p-4 text-center text-slate-400">Belum ada data target pembelajaran.</td></tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* KEHADIRAN & CATATAN (2 KOLOM) */}
        <div className="grid grid-cols-3 gap-6 mb-12">
            
            {/* Kehadiran */}
            <div className="col-span-1">
                <h3 className="font-bold text-lg mb-3 border-l-4 border-blue-600 pl-3">B. Kehadiran</h3>
                <div className="border border-slate-300 rounded p-4 text-sm space-y-2">
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                        <span>Hadir</span>
                        <span className="font-bold">{data?.stats?.hadir}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                        <span>Sakit</span>
                        <span className="font-bold">{data?.stats?.sakit}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                        <span>Ijin</span>
                        <span className="font-bold">{data?.stats?.ijin}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                        <span>Alpa</span>
                        <span className="font-bold">{data?.stats?.alpa}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-slate-300 font-bold flex justify-between">
                        <span>Total Pertemuan</span>
                        <span>{data?.stats?.hadir + data?.stats?.sakit + data?.stats?.ijin + data?.stats?.alpa}</span>
                    </div>
                </div>
            </div>

            {/* Catatan Guru */}
            <div className="col-span-2">
                <h3 className="font-bold text-lg mb-3 border-l-4 border-blue-600 pl-3">C. Catatan Ustadz/Ustadzah</h3>
                <div className="relative">
                    {/* Textarea ini hanya terlihat di layar untuk diedit */}
                    <textarea 
                        className="w-full h-32 border border-blue-200 bg-blue-50 p-3 rounded text-sm focus:ring-2 focus:ring-blue-500 print:hidden resize-none"
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                        placeholder="Tulis catatan untuk wali murid disini..."
                    ></textarea>
                    
                    {/* Div ini hanya muncul saat print (Isinya sama dengan textarea) */}
                    <div className="hidden print:block w-full h-32 border border-slate-300 p-4 text-sm rounded leading-relaxed whitespace-pre-wrap">
                        {catatan}
                    </div>
                    
                    <p className="text-[10px] text-blue-400 mt-1 print:hidden">*Anda bisa mengubah teks catatan di atas sebelum dicetak.</p>
                </div>
            </div>
        </div>

        {/* === BAGIAN 2: TANDA TANGAN DINAMIS === */}
        <div className="grid grid-cols-3 gap-4 mt-16 text-center text-sm break-inside-avoid">
            <div>
                <p className="mb-20">Mengetahui,<br/>Orang Tua / Wali</p>
                <p className="font-bold border-t border-slate-400 mx-8 pt-1">( ........................ )</p>
            </div>
            <div>
                <p className="mb-20">Kepala TPQ</p>
                <p className="font-bold border-t border-slate-400 mx-8 pt-1">
                    {data?.siswa?.instansi?.kepala_instansi || 'Kepala Sekolah'}
                </p>
                {/* Jika mau menampilkan NIP */}
                {data?.siswa?.instansi?.nomor_induk_kepala && (
                    <p className="text-xs text-slate-500">NIY: {data?.siswa?.instansi?.nomor_induk_kepala}</p>
                )}
            </div>
            <div>
                <p className="mb-20">
                    {/* Menggunakan Kota dari Database */}
                    {data?.siswa?.instansi?.kota || 'Jakarta'}, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month:'long', year:'numeric'})}
                    <br/>Guru Pembimbing
                </p>
                <p className="font-bold border-t border-slate-400 mx-8 pt-1">Ustadz/ah Pengajar</p>
            </div>
        </div>

      </div>
    </div>
  )
}