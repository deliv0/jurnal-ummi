'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Save, Building, MapPin, User, Phone, Loader2 } from 'lucide-react'

export default function PengaturanPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [form, setForm] = useState({
      id: '',
      nama_instansi: '',
      alamat: '',
      kota: '',
      kepala_instansi: '',
      no_telp: '',
      email: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    // Ambil data baris pertama saja (karena ini single row table)
    const { data } = await supabase.from('instansi').select('*').limit(1).single()
    if (data) {
        setForm({
            id: data.id,
            nama_instansi: data.nama_instansi || '',
            alamat: data.alamat || '',
            kota: data.kota || '',
            kepala_instansi: data.kepala_instansi || '',
            no_telp: data.no_telp || '',
            email: data.email || ''
        })
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault()
      setSaving(true)
      try {
          const { error } = await supabase.from('instansi').upsert(form)
          if (error) throw error
          alert("Identitas instansi berhasil disimpan!")
      } catch (err: any) {
          alert("Gagal menyimpan: " + err.message)
      } finally {
          setSaving(false)
      }
  }

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-600"/></div>

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        
        <div className="flex items-center gap-4 mb-6">
            <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600"><ArrowLeft size={20}/></Link>
            <h1 className="text-2xl font-bold text-slate-900">Identitas Sekolah</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <p className="text-sm text-slate-500">
                    Data ini akan digunakan sebagai <strong>Kop Surat</strong> pada Laporan Jurnal, Slip Gaji, dan Raport Santri.
                </p>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
                
                {/* IDENTITAS UTAMA */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                            <Building size={16} className="text-blue-500"/> Nama Instansi / TPQ
                        </label>
                        <input 
                            type="text" required
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                            placeholder="Contoh: TPQ AL-HIDAYAH"
                            value={form.nama_instansi}
                            onChange={e => setForm({...form, nama_instansi: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <MapPin size={16} className="text-orange-500"/> Kota / Kabupaten
                            </label>
                            <input 
                                type="text" required
                                className="w-full p-3 border border-slate-300 rounded-lg"
                                placeholder="Contoh: Sleman"
                                value={form.kota}
                                onChange={e => setForm({...form, kota: e.target.value})}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">*Digunakan untuk tanggal surat (Sleman, 20 Feb 2024)</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <Phone size={16} className="text-green-500"/> Kontak (Telp/Email)
                            </label>
                            <input 
                                type="text"
                                className="w-full p-3 border border-slate-300 rounded-lg"
                                placeholder="Opsional"
                                value={form.no_telp}
                                onChange={e => setForm({...form, no_telp: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Alamat Lengkap</label>
                        <textarea 
                            required rows={3}
                            className="w-full p-3 border border-slate-300 rounded-lg"
                            placeholder="Jalan, RT/RW, Kelurahan, Kecamatan..."
                            value={form.alamat}
                            onChange={e => setForm({...form, alamat: e.target.value})}
                        ></textarea>
                    </div>
                </div>

                <hr className="border-slate-100"/>

                {/* PENANDATANGAN */}
                <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                        <User size={16} className="text-purple-500"/> Nama Kepala / Direktur
                    </label>
                    <input 
                        type="text" required
                        className="w-full p-3 border border-slate-300 rounded-lg"
                        placeholder="Nama lengkap beserta gelar..."
                        value={form.kepala_instansi}
                        onChange={e => setForm({...form, kepala_instansi: e.target.value})}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">*Akan muncul di kolom tanda tangan laporan.</p>
                </div>

                <div className="pt-4">
                    <button 
                        type="submit" 
                        disabled={saving}
                        className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-blue-700 flex justify-center items-center gap-2 transition-all active:scale-95"
                    >
                        {saving ? <Loader2 className="animate-spin"/> : <><Save size={20}/> SIMPAN PENGATURAN</>}
                    </button>
                </div>

            </form>
        </div>

      </div>
    </div>
  )
}