'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Printer, ChevronLeft, Calendar } from 'lucide-react'
import Link from 'next/link'

export default function ArsipJurnalPage({ params }: { params: Promise<{ siswaId: string }> }) {
  const { siswaId } = use(params)
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
        // Ambil Data Siswa
        const { data: siswa } = await supabase.from('siswa').select('*, kelompok(nama_kelompok), level(nama), instansi(*)').eq('id', siswaId).single()
        
        // Ambil SEMUA Riwayat Jurnal
        const { data: jurnal } = await supabase
            .from('jurnal_harian')
            .select(`
                created_at,
                halaman_ayat,
                nilai,
                catatan,
                status_kehadiran,
                users ( nama_lengkap ),
                siswa_target ( target_pembelajaran ( judul, kategori_target ) )
            `)
            .eq('siswa_target.siswa_id', siswaId)
            .order('created_at', { ascending: false }) // Terbaru diatas

        setData({ siswa, jurnal })
        setLoading(false)
    }
    fetch()
  }, [siswaId])

  if(loading) return <div className="p-10 text-center">Memuat arsip...</div>

  return (
    <div className="min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white font-sans text-slate-900">
        
        {/* NAV (Screen Only) */}
        <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center print:hidden">
            <button onClick={() => window.history.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-800">
                <ChevronLeft size={20}/> Kembali
            </button>
            <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-black">
                <Printer size={18}/> Cetak Arsip
            </button>
        </div>

        {/* KERTAS A4 */}
        <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-lg print:shadow-none p-[15mm]">
            
            {/* KOP SEDERHANA */}
            <div className="border-b-2 border-slate-800 pb-4 mb-6 text-center">
                <h1 className="text-xl font-bold uppercase">{data?.siswa?.instansi?.nama_instansi}</h1>
                <h2 className="text-lg font-semibold mt-1">BUKU KONTROL / ARSIP PEMBELAJARAN</h2>
            </div>

            {/* IDENTITAS */}
            <div className="flex justify-between text-sm mb-6 font-medium">
                <div>
                    <p>Nama: {data?.siswa?.nama_siswa}</p>
                    <p>NIS: {data?.siswa?.nis || '-'}</p>
                </div>
                <div className="text-right">
                    <p>Kelompok: {data?.siswa?.kelompok?.nama_kelompok}</p>
                    <p>Level: {data?.siswa?.level?.nama}</p>
                </div>
            </div>

            {/* TABEL DATA */}
            <table className="w-full border-collapse border border-slate-400 text-sm">
                <thead>
                    <tr className="bg-slate-100 text-slate-800 text-xs uppercase">
                        <th className="border border-slate-400 p-2 w-24">Tanggal</th>
                        <th className="border border-slate-400 p-2">Materi / Hafalan</th>
                        <th className="border border-slate-400 p-2">Capaian</th>
                        <th className="border border-slate-400 p-2 w-12 text-center">Nilai</th>
                        <th className="border border-slate-400 p-2">Paraf Guru</th>
                    </tr>
                </thead>
                <tbody>
                    {data?.jurnal?.length > 0 ? (
                        data?.jurnal.map((row: any, i: number) => (
                            <tr key={i} className="break-inside-avoid">
                                <td className="border border-slate-400 p-2 text-xs">
                                    {new Date(row.created_at).toLocaleDateString('id-ID', {day: '2-digit', month:'2-digit', year:'numeric'})}
                                    <div className="text-[10px] text-slate-500">
                                        {new Date(row.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                    </div>
                                </td>
                                <td className="border border-slate-400 p-2">
                                    <div className="font-semibold text-xs">{row.siswa_target?.target_pembelajaran?.judul}</div>
                                    <div className="text-[10px] uppercase text-slate-500">{row.siswa_target?.target_pembelajaran?.kategori_target}</div>
                                </td>
                                <td className="border border-slate-400 p-2">
                                    {row.halaman_ayat}
                                    {row.catatan && <div className="text-[10px] italic mt-1 text-slate-600">"{row.catatan}"</div>}
                                </td>
                                <td className="border border-slate-400 p-2 text-center font-bold">
                                    {row.nilai || '-'}
                                </td>
                                <td className="border border-slate-400 p-2 text-center">
                                    <div className="text-[10px] text-slate-400 mb-2">{row.users?.nama_lengkap?.split(' ')[0]}</div>
                                    {/* Tempat Paraf Kosong */}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={5} className="p-4 text-center text-slate-500">Belum ada riwayat pembelajaran.</td></tr>
                    )}
                </tbody>
            </table>

            <div className="mt-8 text-xs text-slate-400 text-right">
                Dicetak pada: {new Date().toLocaleString('id-ID')}
            </div>
        </div>
    </div>
  )
}