'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, Loader2, GraduationCap, ChevronRight, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function UjianPage() {
  const supabase = createClient()
  const router = useRouter()

  const [antrian, setAntrian] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSiswa, setSelectedSiswa] = useState<any>(null) // Siswa yang sedang diuji
  
  // FORM UJIAN
  const [formUjian, setFormUjian] = useState({
      nilai_fashohah: 'B',
      nilai_tajwid: 'B',
      nilai_kelancaran: 'B',
      catatan: '',
      hasil: 'lulus', // lulus / gagal
      next_level_id: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    // 1. Ambil Antrian (status_tes = 'siap_tes')
    const { data: dataAntrian } = await supabase
        .from('siswa')
        .select('*, level(nama, urutan), kelompok(nama_kelompok)')
        .eq('status_tes', 'siap_tes')
        .order('nama_siswa')
    
    // 2. Ambil Master Level
    const { data: dataLevel } = await supabase.from('level').select('*').order('urutan')

    if(dataAntrian) setAntrian(dataAntrian)
    if(dataLevel) setLevels(dataLevel)
    setLoading(false)
  }

  // Buka Modal Ujian
  const handleOpenUjian = (siswa: any) => {
      // Cari level selanjutnya secara otomatis
      const currentUrutan = siswa.level?.urutan || 0
      const nextLvl = levels.find(l => l.urutan > currentUrutan)
      
      setSelectedSiswa(siswa)
      setFormUjian({
          nilai_fashohah: 'B',
          nilai_tajwid: 'B',
          nilai_kelancaran: 'B',
          catatan: '',
          hasil: 'lulus',
          next_level_id: nextLvl?.id || '' // Auto select next level
      })
  }

  // --- CORE LOGIC: PROSES KELULUSAN ---
  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      if(formUjian.hasil === 'lulus' && !formUjian.next_level_id) {
          alert("Mohon pilih Level Selanjutnya jika Lulus.")
          return
      }

      setSubmitting(true)
      try {
          const { data: { user } } = await supabase.auth.getUser()

          // 1. Simpan Riwayat Ujian
          const { error: errRiwayat } = await supabase.from('riwayat_ujian').insert({
              siswa_id: selectedSiswa.id,
              penguji_id: user?.id,
              level_lama_id: selectedSiswa.current_level_id,
              level_baru_id: formUjian.hasil === 'lulus' ? formUjian.next_level_id : selectedSiswa.current_level_id,
              kriteria_penilaian: { 
                  fashohah: formUjian.nilai_fashohah,
                  tajwid: formUjian.nilai_tajwid,
                  kelancaran: formUjian.nilai_kelancaran
              },
              catatan: formUjian.catatan,
              hasil: formUjian.hasil
          })
          if(errRiwayat) throw errRiwayat

          if (formUjian.hasil === 'lulus') {
              // --- JIKA LULUS: NAIK LEVEL & RESET TARGET ---
              
              // 2. Update Siswa (Level Baru & Reset Status Tes)
              await supabase.from('siswa').update({
                  current_level_id: formUjian.next_level_id,
                  status_tes: 'belum_siap' 
              }).eq('id', selectedSiswa.id)

              // 3. TARGET SYNC (Hapus Lama, Masukkan Baru)
              await supabase.from('siswa_target').delete().eq('siswa_id', selectedSiswa.id)
              
              // Ambil target level baru
              const { data: masterTargets } = await supabase
                  .from('target_pembelajaran')
                  .select('id')
                  .eq('level_id', formUjian.next_level_id)
              
              if (masterTargets && masterTargets.length > 0) {
                  const newTargets = masterTargets.map(t => ({
                      siswa_id: selectedSiswa.id,
                      target_ref_id: t.id,
                      status: 'active'
                  }))
                  await supabase.from('siswa_target').insert(newTargets)
              }

              alert(`Selamat! ${selectedSiswa.nama_siswa} berhasil naik level.`)

          } else {
              // --- JIKA GAGAL: KEMBALIKAN KE KELAS (BELUM SIAP) ---
              await supabase.from('siswa').update({ status_tes: 'belum_siap' }).eq('id', selectedSiswa.id)
              alert("Hasil ujian disimpan. Siswa dikembalikan ke status belajar.")
          }

          setSelectedSiswa(null)
          fetchData() // Refresh list

      } catch (err: any) {
          alert("Gagal memproses: " + err.message)
      } finally {
          setSubmitting(false)
      }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8">
            <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600"><ArrowLeft size={20}/></Link>
            <h1 className="text-2xl font-bold text-slate-900">Meja Ujian & Kenaikan</h1>
        </div>

        {/* LIST ANTRIAN */}
        {!selectedSiswa ? (
            <div className="space-y-4">
                <h2 className="font-bold text-slate-700 flex items-center gap-2">
                    <GraduationCap className="text-orange-500"/> Antrian Ujian ({antrian.length})
                </h2>
                
                {loading ? <Loader2 className="animate-spin text-slate-400 mx-auto"/> : 
                 antrian.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
                        Tidak ada siswa yang mengajukan ujian saat ini.
                    </div>
                 ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                        {antrian.map(siswa => (
                            <div key={siswa.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:border-orange-300 transition-all">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">{siswa.nama_siswa}</h3>
                                    <div className="text-sm text-slate-500 mt-1">
                                        Level Saat Ini: <span className="font-bold text-blue-600">{siswa.level?.nama}</span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">Kelompok: {siswa.kelompok?.nama_kelompok}</div>
                                </div>
                                <button 
                                    onClick={() => handleOpenUjian(siswa)}
                                    className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-orange-600 flex items-center gap-2"
                                >
                                    Uji Sekarang <ChevronRight size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>
                 )}
            </div>
        ) : (
            
            /* FORM PENILAIAN */
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-slate-800 p-6 text-white flex justify-between items-start">
                    <div>
                        <div className="text-xs text-slate-300 uppercase tracking-wider font-bold mb-1">Sedang Menguji</div>
                        <h2 className="text-2xl font-bold">{selectedSiswa.nama_siswa}</h2>
                        <p className="text-slate-300 text-sm mt-1">Level Asal: {selectedSiswa.level?.nama}</p>
                    </div>
                    <button onClick={() => setSelectedSiswa(null)} className="text-slate-400 hover:text-white"><XCircle/></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    
                    {/* INPUT NILAI */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {['Fashohah', 'Tajwid', 'Kelancaran'].map((kri) => (
                            <div key={kri}>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{kri}</label>
                                <select 
                                    className="w-full p-3 rounded-lg border border-slate-300 bg-slate-50 font-bold"
                                    value={(formUjian as any)[`nilai_${kri.toLowerCase()}`]}
                                    onChange={(e) => setFormUjian({...formUjian, [`nilai_${kri.toLowerCase()}`]: e.target.value})}
                                >
                                    <option value="A">A (Sangat Baik)</option>
                                    <option value="B">B (Baik)</option>
                                    <option value="C">C (Cukup)</option>
                                    <option value="D">D (Kurang)</option>
                                </select>
                            </div>
                        ))}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Catatan Penguji</label>
                        <textarea 
                            className="w-full p-3 rounded-lg border border-slate-300"
                            rows={3}
                            placeholder="Contoh: Bacaan sudah bagus, perlu memperhalus ghunnah..."
                            value={formUjian.catatan}
                            onChange={(e) => setFormUjian({...formUjian, catatan: e.target.value})}
                        ></textarea>
                    </div>

                    <div className="border-t border-slate-100 pt-6">
                        <label className="block text-sm font-bold text-slate-700 mb-4">Keputusan Akhir</label>
                        
                        <div className="flex gap-4">
                            <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${formUjian.hasil === 'lulus' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-green-200'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" name="hasil" value="lulus" checked={formUjian.hasil === 'lulus'} onChange={() => setFormUjian({...formUjian, hasil: 'lulus'})} className="w-5 h-5 text-green-600"/>
                                    <div>
                                        <div className="font-bold text-green-800">LULUS</div>
                                        <div className="text-xs text-green-600">Siswa naik level berikutnya.</div>
                                    </div>
                                </div>
                            </label>

                            <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${formUjian.hasil === 'gagal' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-red-200'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" name="hasil" value="gagal" checked={formUjian.hasil === 'gagal'} onChange={() => setFormUjian({...formUjian, hasil: 'gagal'})} className="w-5 h-5 text-red-600"/>
                                    <div>
                                        <div className="font-bold text-red-800">BELUM LULUS</div>
                                        <div className="text-xs text-red-600">Siswa tetap di level ini.</div>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* PILIH LEVEL BARU (Hanya jika Lulus) */}
                    {formUjian.hasil === 'lulus' && (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 animate-in slide-in-from-top-2">
                            <label className="block text-sm font-bold text-blue-800 mb-2">Naik ke Level / Jilid:</label>
                            <select 
                                className="w-full p-3 rounded-lg border border-blue-300 bg-white font-bold text-blue-900"
                                value={formUjian.next_level_id}
                                onChange={(e) => setFormUjian({...formUjian, next_level_id: e.target.value})}
                            >
                                <option value="">-- Pilih Level Baru --</option>
                                {levels.map(l => (
                                    <option key={l.id} value={l.id}>{l.nama}</option>
                                ))}
                            </select>
                            <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                                <AlertTriangle size={12}/> Target pembelajaran akan otomatis diganti sesuai level baru.
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setSelectedSiswa(null)} className="px-6 py-3 rounded-lg border border-slate-300 font-bold text-slate-600 hover:bg-slate-50">Batal</button>
                        <button 
                            type="submit" 
                            disabled={submitting}
                            className={`flex-1 font-bold py-3 rounded-lg text-white shadow-lg flex justify-center items-center gap-2 ${formUjian.hasil === 'lulus' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                            {submitting ? <Loader2 className="animate-spin"/> : <><CheckCircle size={20}/> SIMPAN KEPUTUSAN</>}
                        </button>
                    </div>

                </form>
            </div>
        )}

      </div>
    </div>
  )
}