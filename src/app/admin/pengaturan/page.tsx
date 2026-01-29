'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Save, Building, Loader2, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function PengaturanPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)
  
  // Default Values
  const [formData, setFormData] = useState({
    id: '',
    nama_instansi: '',
    alamat: '',
    kota: '',
    telepon: '',
    email: '',
    kepala_instansi: '',
    nomor_induk_kepala: '',
    logo_url: '' // <-- KOLOM BARU
  })

  // 1. LOAD DATA
  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from('instansi').select('*').limit(1).single()
      if (data) {
        setFormData({
            id: data.id,
            nama_instansi: data.nama_instansi || '',
            alamat: data.alamat || '',
            kota: data.kota || '',
            telepon: data.telepon || '',
            email: data.email || '',
            kepala_instansi: data.kepala_instansi || '',
            nomor_induk_kepala: data.nomor_induk_kepala || '',
            logo_url: data.logo_url || ''
        })
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  // 2. HANDLE SIMPAN
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
        let error = null
        if (formData.id) {
            const { error: err } = await supabase.from('instansi').update(formData).eq('id', formData.id)
            error = err
        } else {
            const { error: err } = await supabase.from('instansi').insert(formData)
            error = err
        }

        if (error) throw error
        setMessage({ type: 'success', text: 'Identitas Sekolah berhasil diperbarui!' })
        router.refresh()
    } catch (err: any) {
        setMessage({ type: 'error', text: err.message })
    } finally {
        setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl">
        
        <div className="mb-6 flex items-center gap-4">
          <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600">
            <ArrowLeft size={20}/>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Identitas Sekolah</h1>
            <p className="text-slate-500">Pengaturan data untuk Kop Surat & Raport</p>
          </div>
        </div>

        {message && (
            <div className={`mb-4 p-4 rounded-md flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                {message.text}
            </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center gap-2 text-blue-800 font-semibold">
                <Building size={20}/> Form Data Instansi
            </div>
            
            <div className="p-6 space-y-6">
                {/* LOGO URL */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <ImageIcon size={16}/> Link Logo Sekolah (URL)
                    </label>
                    <input name="logo_url" value={formData.logo_url} onChange={handleChange}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm" 
                        placeholder="https://website-sekolah.com/logo.png"/>
                    <p className="text-xs text-slate-500 mt-1">
                        *Masukkan link gambar logo (format .png/.jpg). Jika kosong, logo tidak akan muncul.
                    </p>
                </div>

                {/* IDENTITAS UMUM */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nama Instansi / TPQ</label>
                        <input name="nama_instansi" value={formData.nama_instansi} onChange={handleChange} required
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="TPQ AL-HIDAYAH"/>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Alamat Lengkap</label>
                        <textarea name="alamat" value={formData.alamat} onChange={handleChange} rows={2}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Jl. Mawar No. 10..."/>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Kota / Kabupaten</label>
                        <input name="kota" value={formData.kota} onChange={handleChange}
                            className="w-full p-2 border border-slate-300 rounded-lg" placeholder="Jakarta Selatan"/>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Telepon</label>
                        <input name="telepon" value={formData.telepon} onChange={handleChange}
                            className="w-full p-2 border border-slate-300 rounded-lg" placeholder="0812-xxxx-xxxx"/>
                    </div>
                    
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Sekolah</label>
                        <input name="email" value={formData.email} onChange={handleChange}
                            className="w-full p-2 border border-slate-300 rounded-lg" placeholder="admin@sekolah.com"/>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Data Kepala Sekolah</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Kepala TPQ</label>
                            <input name="kepala_instansi" value={formData.kepala_instansi} onChange={handleChange}
                                className="w-full p-2 border border-slate-300 rounded-lg" placeholder="H. Abdullah, Lc."/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">NIP / NIY (Opsional)</label>
                            <input name="nomor_induk_kepala" value={formData.nomor_induk_kepala} onChange={handleChange}
                                className="w-full p-2 border border-slate-300 rounded-lg" placeholder="12345678"/>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200">
                <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex justify-center items-center gap-2">
                    {saving ? <Loader2 className="animate-spin"/> : <><Save size={20}/> SIMPAN PENGATURAN</>}
                </button>
            </div>
        </form>
      </div>
    </div>
  )
}