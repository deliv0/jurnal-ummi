'use client' // Wajib untuk komponen interaktif

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Save, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function JurnalForm({ 
  siswa, 
  targets, 
  user 
}: { 
  siswa: any, 
  targets: any[], 
  user: any 
}) {
  const supabase = createClient()
  const router = useRouter()
  
  // State untuk melacak Accordion mana yang terbuka
  const [openTargetId, setOpenTargetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Fungsi toggle accordion (Buka satu, tutup yang lain)
  const toggleAccordion = (id: string) => {
    setOpenTargetId(openTargetId === id ? null : id)
  }

  // Fungsi Simpan Nilai
  const handleSave = async (e: React.FormEvent<HTMLFormElement>, targetId: string, siswaTargetId: string) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const nilai = formData.get('nilai')
    const catatan = formData.get('catatan')

    // Kirim ke Database
    const { error } = await supabase
      .from('jurnal_harian')
      .insert({
        siswa_target_id: siswaTargetId,
        guru_id: user.id, // Guru yang login
        created_by: user.id,
        nilai: Number(nilai),
        catatan: String(catatan),
        tgl_jurnal: new Date().toISOString()
      })

    setLoading(false)

    if (error) {
      alert('Gagal menyimpan: ' + error.message)
    } else {
      alert('Data Berhasil Disimpan!')
      setOpenTargetId(null) // Tutup accordion
      router.refresh() // Update data di layar
    }
  }

  return (
    <div className="space-y-4">
      {targets.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all">
          
          {/* HEADER ACCORDION (Bisa diklik) */}
          <button
            onClick={() => toggleAccordion(item.id)}
            className={`flex w-full items-center justify-between px-6 py-4 text-left transition-colors ${
              openTargetId === item.id ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
            }`}
          >
            <div>
              <h3 className="font-semibold text-slate-900">
                {item.target_pembelajaran.judul}
              </h3>
              <p className="text-xs text-slate-500 uppercase tracking-wider">
                {item.target_pembelajaran.kategori_target}
              </p>
            </div>
            {openTargetId === item.id ? <ChevronUp className="text-blue-600" /> : <ChevronDown className="text-slate-400" />}
          </button>

          {/* ISI ACCORDION (Form Input) */}
          {openTargetId === item.id && (
            <div className="border-t border-slate-100 bg-white p-6">
              <form onSubmit={(e) => handleSave(e, item.target_ref_id, item.id)}>
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Nilai (0-100)
                  </label>
                  <input
                    name="nilai"
                    type="number"
                    min="0"
                    max="100"
                    required
                    className="block w-full rounded-md border-slate-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border"
                    placeholder="Contoh: 85"
                  />
                </div>

                <div className="mb-6">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Catatan Guru
                  </label>
                  <textarea
                    name="catatan"
                    rows={3}
                    className="block w-full rounded-md border-slate-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border"
                    placeholder="Contoh: Bacaan lancar, tajwid perlu diperbaiki."
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-blue-300"
                >
                  {loading ? 'Menyimpan...' : <><Save size={18} /> Simpan Jurnal</>}
                </button>
              </form>
            </div>
          )}
        </div>
      ))}

      {targets.length === 0 && (
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-6 text-center text-red-600">
          Siswa ini belum memiliki Target Pembelajaran aktif. Hubungi Admin.
        </div>
      )}
    </div>
  )
}