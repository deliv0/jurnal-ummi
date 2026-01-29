'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, UserPlus, Trash2, Shield, User, Loader2, CheckCircle, AlertCircle, Key } from 'lucide-react'
import { createUser, deleteUser } from './actions' // Import Server Actions tadi

export default function AdminUsersPage() {
  const supabase = createClient()
  
  // STATE
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // FORM STATE
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  // 1. FETCH USERS
  const fetchUsers = async () => {
    setLoading(true)
    // Kita ambil dari tabel public.users
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('nama_lengkap', { ascending: true })
    
    if(data) setUsers(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // 2. HANDLE CREATE USER
  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    const formData = new FormData(e.target)
    
    // Panggil Server Action
    const result = await createUser(null, formData)

    if (result.success) {
        setMessage({ type: 'success', text: result.message })
        setShowForm(false)
        e.target.reset()
        fetchUsers() // Refresh list
    } else {
        setMessage({ type: 'error', text: result.message })
    }
    setIsSubmitting(false)
  }

  // 3. HANDLE DELETE USER
  const handleDelete = async (id: string, nama: string) => {
      if(!confirm(`Yakin ingin menghapus user ${nama}? Data ini tidak bisa dikembalikan.`)) return

      const result = await deleteUser(id)
      if(result.success) {
          fetchUsers()
      } else {
          alert("Gagal menghapus: " + result.message)
      }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600">
            <ArrowLeft size={20}/>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manajemen Pengguna</h1>
            <p className="text-slate-500">Kelola akun Guru dan Admin</p>
          </div>
        </div>

        {/* FEEDBACK */}
        {message && (
            <div className={`mb-4 p-4 rounded-md flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                {message.text}
            </div>
        )}

        {/* TOMBOL TAMBAH */}
        {!showForm && (
            <button 
                onClick={() => setShowForm(true)}
                className="mb-6 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
                <UserPlus size={18}/> Tambah Guru Baru
            </button>
        )}

        {/* FORM TAMBAH USER */}
        {showForm && (
            <div className="mb-8 bg-white p-6 rounded-xl shadow-md border border-slate-200 animate-in fade-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Formulir User Baru</h3>
                    <button onClick={() => setShowForm(false)} className="text-sm text-slate-400 hover:text-red-500">Batal</button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                            <input name="nama" type="text" required className="w-full p-2 border rounded-lg" placeholder="Contoh: Ustadz Ahmad"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email (Login)</label>
                            <input name="email" type="email" required className="w-full p-2 border rounded-lg" placeholder="email@sekolah.com"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                            <input name="password" type="text" required minLength={6} className="w-full p-2 border rounded-lg" placeholder="Minimal 6 karakter"/>
                            <p className="text-xs text-slate-500 mt-1">Sarankan password yang kuat.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Hak Akses (Role)</label>
                            <select name="role" className="w-full p-2 border rounded-lg">
                                <option value="guru">Guru (Standard)</option>
                                <option value="admin">Admin (Full Access)</option>
                            </select>
                        </div>
                    </div>
                    <div className="pt-2">
                        <button disabled={isSubmitting} className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
                            {isSubmitting ? <Loader2 className="animate-spin"/> : <UserPlus size={18}/>}
                            Buat Akun
                        </button>
                    </div>
                </form>
            </div>
        )}

        {/* LIST USER */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="p-4 text-sm font-semibold text-slate-600">Nama Guru</th>
                        <th className="p-4 text-sm font-semibold text-slate-600 hidden md:table-cell">Email</th>
                        <th className="p-4 text-sm font-semibold text-slate-600">Role</th>
                        <th className="p-4 text-sm font-semibold text-slate-600 text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                        const isAdminRole = JSON.stringify(u.roles).includes('admin')
                        return (
                            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <div className="font-medium text-slate-900">{u.nama_lengkap}</div>
                                    <div className="text-xs text-slate-400 md:hidden">{u.email}</div>
                                </td>
                                <td className="p-4 text-sm text-slate-600 hidden md:table-cell">{u.email}</td>
                                <td className="p-4">
                                    {isAdminRole ? (
                                        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-bold">
                                            <Shield size={12}/> Admin
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-medium">
                                            <User size={12}/> Guru
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-right">
                                    <button 
                                        onClick={() => handleDelete(u.id, u.nama_lengkap)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all" 
                                        title="Hapus User"
                                    >
                                        <Trash2 size={18}/>
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {users.length === 0 && !loading && (
                <div className="p-8 text-center text-slate-500">Belum ada user.</div>
            )}
        </div>
      </div>
    </div>
  )
}