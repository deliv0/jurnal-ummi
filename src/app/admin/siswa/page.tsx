'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { Plus, Upload, Search, Trash2, Edit, Loader2, FileSpreadsheet, X, Download, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx' 

export default function SiswaPage() {
  const supabase = createClient()

  // STATE DATA
  const [siswa, setSiswa] = useState<any[]>([])
  const [filteredSiswa, setFilteredSiswa] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [kelompoks, setKelompoks] = useState<any[]>([])
  
  // STATE UI
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // FORM ADD DATA
  const [newSiswa, setNewSiswa] = useState({
      nama_siswa: '',
      nis: '', 
      gender: 'L',
      level_id: '',
      kelompok_id: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: dataSiswa } = await supabase
        .from('siswa')
        .select('*, level(nama), kelompok(nama_kelompok)')
        .eq('status', 'aktif') 
        .order('nama_siswa')
    
    const { data: dataLevel } = await supabase.from('level').select('*').order('urutan')
    const { data: dataKelompok } = await supabase.from('kelompok').select('*').order('nama_kelompok')

    if(dataSiswa) {
        setSiswa(dataSiswa)
        setFilteredSiswa(dataSiswa)
    }
    if(dataLevel) setLevels(dataLevel)
    if(dataKelompok) setKelompoks(dataKelompok)
    setLoading(false)
  }

  // LOGIC SEARCH
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      const term = e.target.value.toLowerCase()
      setSearch(term)
      const filtered = siswa.filter(s => 
          s.nama_siswa.toLowerCase().includes(term) || 
          (s.nis && s.nis.toLowerCase().includes(term))
      )
      setFilteredSiswa(filtered)
  }

  // LOGIC ADD MANUAL
  const handleAddSiswa = async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitting(true)
      try {
          if (newSiswa.nis) {
              const { data: cekNis } = await supabase.from('siswa').select('id').eq('nis', newSiswa.nis).single()
              if (cekNis) throw new Error("NIS sudah terdaftar!")
          }

          const { error } = await supabase.from('siswa').insert({
              nama_siswa: newSiswa.nama_siswa,
              nis: newSiswa.nis,
              gender: newSiswa.gender,
              current_level_id: newSiswa.level_id || null,
              kelompok_id: newSiswa.kelompok_id || null,
              status: 'aktif'
          })

          if (error) throw error

          alert('Siswa berhasil ditambahkan!')
          setShowAddModal(false)
          setNewSiswa({ nama_siswa: '', nis: '', gender: 'L', level_id: '', kelompok_id: '' })
          fetchData()

      } catch (err: any) {
          alert("Gagal: " + err.message)
      } finally {
          setSubmitting(false)
      }
  }

  // --- LOGIC BARU: DOWNLOAD DATA EXISTING (UNTUK DIEDIT) ---
  const handleDownloadData = () => {
      // Kita export ID agar nanti saat upload ulang, sistem tahu ini update data lama
      const exportData = siswa.map(s => ({
          SYSTEM_ID: s.id, // JANGAN DIUBAH USER
          NAMA: s.nama_siswa,
          NIS: s.nis || '', // KOSONG JIKA BELUM ADA
          GENDER: s.gender,
          LEVEL_SAAT_INI: s.level?.nama || '',
          KELOMPOK: s.kelompok?.nama_kelompok || ''
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "DataSiswa")
      
      // Nama file dengan tanggal agar tidak bingung
      const fileName = `Data_Siswa_Update_${new Date().toISOString().slice(0,10)}.xlsx`
      XLSX.writeFile(wb, fileName)
  }

  // --- LOGIC BARU: IMPORT CERDAS (INSERT / UPDATE) ---
  const handleFileUpload = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (evt: any) => {
          const bstr = evt.target.result
          const wb = XLSX.read(bstr, { type: 'binary' })
          const wsname = wb.SheetNames[0]
          const ws = wb.Sheets[wsname]
          const data: any[] = XLSX.utils.sheet_to_json(ws)

          // Cek apakah ini file update (ada kolom SYSTEM_ID) atau file baru
          const isUpdateMode = data.length > 0 && 'SYSTEM_ID' in data[0]

          const confirmMsg = isUpdateMode 
            ? `Ditemukan ${data.length} data dengan ID Sistem.\nMode: UPDATE DATA LAMA (Mengisi NIS/Edit Nama).\nLanjutkan?`
            : `Ditemukan ${data.length} data baru.\nMode: TAMBAH SISWA BARU.\nLanjutkan?`

          if (confirm(confirmMsg)) {
              setSubmitting(true)
              try {
                  if (isUpdateMode) {
                      // --- MODE 1: UPDATE BULK ---
                      let updatedCount = 0
                      
                      // Supabase belum support bulk update different values natively dengan mudah via client
                      // Kita loop update (aman untuk 81 siswa, masih cepat)
                      for (const row of data) {
                          if (row.SYSTEM_ID) {
                              await supabase.from('siswa').update({
                                  nama_siswa: row['NAMA'],
                                  nis: row['NIS'] ? String(row['NIS']) : null, // Pastikan string
                                  gender: row['GENDER']
                              }).eq('id', row.SYSTEM_ID)
                              updatedCount++
                          }
                      }
                      alert(`Berhasil memperbarui ${updatedCount} data siswa!`)

                  } else {
                      // --- MODE 2: INSERT BULK (LAMA) ---
                      const payload = data.map(row => ({
                          nama_siswa: row['Nama'] || row['nama'] || row['NAMA'],
                          nis: row['NIS'] || row['nis'] || null, 
                          gender: row['L/P'] === 'P' ? 'P' : 'L',
                          status: 'aktif'
                      }))
                      const { error } = await supabase.from('siswa').insert(payload)
                      if(error) throw error
                      alert("Import siswa baru berhasil!")
                  }

                  setShowImportModal(false)
                  fetchData()
              } catch (err: any) {
                  alert("Gagal Proses: " + err.message)
              } finally {
                  setSubmitting(false)
              }
          }
      }
      reader.readAsBinaryString(file)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & ACTIONS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Data Santri</h1>
                <p className="text-slate-500 text-sm">Total: {siswa.length} Santri Aktif</p>
            </div>
            <div className="flex gap-2 flex-wrap">
                {/* TOMBOL DOWNLOAD DATA (BARU) */}
                <button onClick={handleDownloadData} className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-green-100">
                    <Download size={18}/> Backup / Edit Excel
                </button>
                
                <button onClick={() => setShowImportModal(true)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-slate-50">
                    <FileSpreadsheet size={18}/> Upload / Import
                </button>
                <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-blue-700 shadow-md">
                    <Plus size={18}/> Tambah
                </button>
            </div>
        </div>

        {/* SEARCH BAR */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={20}/>
                <input 
                    type="text" 
                    placeholder="Cari berdasarkan Nama atau NIS..." 
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={search}
                    onChange={handleSearch}
                />
            </div>
        </div>

        {/* TABEL DATA */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Nama Santri</th>
                            <th className="px-6 py-4">NIS</th> 
                            <th className="px-6 py-4">L/P</th>
                            <th className="px-6 py-4">Level</th>
                            <th className="px-6 py-4">Kelompok</th>
                            <th className="px-6 py-4 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500"/></td></tr>
                        ) : filteredSiswa.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">Data tidak ditemukan</td></tr>
                        ) : (
                            filteredSiswa.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-800">{s.nama_siswa}</td>
                                    <td className="px-6 py-4 font-mono text-slate-600">{s.nis || '-'}</td> 
                                    <td className="px-6 py-4">{s.gender}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold border border-blue-100">
                                            {s.level?.nama || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{s.kelompok?.nama_kelompok || '-'}</td>
                                    <td className="px-6 py-4 text-center">
                                        <Link href={`/admin/siswa/${s.id}`} className="inline-block p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                                            <Edit size={18}/>
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

      </div>

      {/* MODAL ADD MANUAL */}
      {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-slate-800">Tambah Santri Baru</h2>
                      <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-red-500"><X/></button>
                  </div>
                  <form onSubmit={handleAddSiswa} className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Nama Lengkap</label>
                          <input type="text" required className="w-full p-3 border rounded-lg" 
                              value={newSiswa.nama_siswa} onChange={e => setNewSiswa({...newSiswa, nama_siswa: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">NIS (Wajib)</label>
                              <input type="text" required className="w-full p-3 border rounded-lg" 
                                  value={newSiswa.nis} onChange={e => setNewSiswa({...newSiswa, nis: e.target.value})} placeholder="Contoh: 2024001"/>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                              <select className="w-full p-3 border rounded-lg bg-white" 
                                  value={newSiswa.gender} onChange={e => setNewSiswa({...newSiswa, gender: e.target.value})}>
                                  <option value="L">Laki-laki</option>
                                  <option value="P">Perempuan</option>
                              </select>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Level / Jilid</label>
                              <select className="w-full p-3 border rounded-lg bg-white" 
                                  value={newSiswa.level_id} onChange={e => setNewSiswa({...newSiswa, level_id: e.target.value})}>
                                  <option value="">- Pilih -</option>
                                  {levels.map(l => <option key={l.id} value={l.id}>{l.nama}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Kelompok</label>
                              <select className="w-full p-3 border rounded-lg bg-white" 
                                  value={newSiswa.kelompok_id} onChange={e => setNewSiswa({...newSiswa, kelompok_id: e.target.value})}>
                                  <option value="">- Pilih -</option>
                                  {kelompoks.map(k => <option key={k.id} value={k.id}>{k.nama_kelompok}</option>)}
                              </select>
                          </div>
                      </div>
                      <button disabled={submitting} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-4 hover:bg-blue-700 flex justify-center items-center gap-2">
                          {submitting ? <Loader2 className="animate-spin"/> : 'SIMPAN DATA'}
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL IMPORT EXCEL (SMART) */}
      {showImportModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center">
                  <h2 className="text-xl font-bold text-slate-800 mb-2">Upload Data Siswa</h2>
                  <p className="text-sm text-slate-500 mb-6">
                    Gunakan tombol <strong>Backup / Edit Excel</strong> untuk mendapatkan template data siswa yang sudah ada. Isi kolom NIS lalu upload kembali di sini.
                  </p>
                  
                  <label className="block w-full border-2 border-dashed border-slate-300 rounded-xl p-8 cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all">
                      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                      <Upload className="mx-auto text-slate-400 mb-2" size={32}/>
                      <span className="text-sm font-bold text-slate-600">Klik untuk Upload File</span>
                  </label>

                  <button onClick={() => setShowImportModal(false)} className="mt-6 text-slate-400 hover:text-slate-600 text-sm font-bold">
                      Batal
                  </button>
              </div>
          </div>
      )}

    </div>
  )
}