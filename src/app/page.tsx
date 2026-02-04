import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { 
  LogOut, 
  Users, 
  BookOpen, 
  GraduationCap, 
  ClipboardCheck, 
  TrendingUp, 
  Calendar, 
  AlertCircle, 
  ChevronRight, 
  BarChart3, 
  Search, 
  Clock, 
  Activity, 
  Shield, 
  Settings,
  FileText,
  UserCheck
} from 'lucide-react'

// Agar greeting sesuai waktu user (Server Time -> WIB)
export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const supabase = await createClient()

  // 1. Cek User Session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  // 2. Ambil Data User Profile
  const { data: userProfile } = await supabase.from('users').select('*').eq('id', user.id).single()
  const isAdmin = userProfile?.roles && JSON.stringify(userProfile.roles).includes('admin')

  // LOGIC SAPAAN WAKTU (WIB)
  const now = new Date()
  const wibHour = Number(now.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jakarta' }))
  
  let greeting = 'Selamat Pagi'
  if (wibHour >= 11 && wibHour < 15) greeting = 'Selamat Siang'
  else if (wibHour >= 15 && wibHour < 18) greeting = 'Selamat Sore'
  else if (wibHour >= 18 || wibHour < 4) greeting = 'Selamat Malam'

  // =========================================
  // ADMIN DATA FETCHING
  // =========================================
  let stats = {
    totalSiswa: 0,
    totalKelompok: 0,
    siapUjian: 0,
    jurnalHariIni: 0,
    levelDist: [] as any[],
    recentLogs: [] as any[]
  }

  if (isAdmin) {
    const { count: countSiswa } = await supabase.from('siswa').select('*', { count: 'exact', head: true })
    const { count: countKelompok } = await supabase.from('kelompok').select('*', { count: 'exact', head: true })
    const { count: countUjian } = await supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('status_tes', 'siap_tes')
    
    const todayStart = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) 
    const { count: countJurnal } = await supabase.from('jurnal_harian').select('*', { count: 'exact', head: true }).gte('created_at', todayStart)

    // A. Distribusi Level
    const { data: rawSiswa } = await supabase.from('siswa').select('level (nama)').not('current_level_id', 'is', null)
    const distMap: Record<string, number> = {}
    rawSiswa?.forEach((s: any) => { const n = s.level?.nama || '?'; distMap[n] = (distMap[n] || 0) + 1 })
    const sortedDist = Object.entries(distMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)

    // B. Log Aktivitas Terkini (Live Feed)
    const { data: recentData } = await supabase
        .from('jurnal_harian')
        .select(`
            created_at,
            halaman_ayat,
            nilai,
            users ( nama_lengkap ),
            siswa_target (
                siswa ( nama_siswa, current_level_id ),
                target_pembelajaran ( judul )
            )
        `)
        .order('created_at', { ascending: false })
        .limit(5)

    stats = {
        totalSiswa: countSiswa || 0,
        totalKelompok: countKelompok || 0,
        siapUjian: countUjian || 0,
        jurnalHariIni: countJurnal || 0,
        levelDist: sortedDist,
        recentLogs: recentData || []
    }
  }

  // --- DATA KELOMPOK (FETCH ALL UNTUK FITUR BADAL) ---
  const { data: allKelompok } = await supabase
    .from('kelompok')
    .select('*, users!guru_utama_id(nama_lengkap)')
    .order('nama_kelompok', { ascending: true })

  // Pisahkan: Kelas Saya vs Kelas Lain
  const myGroups = allKelompok?.filter((k: any) => k.guru_utama_id === user.id) || []
  const otherGroups = allKelompok?.filter((k: any) => k.guru_utama_id !== user.id) || []

  // Action Logout
  const signOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    return redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      
      {/* HEADER */}
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-slate-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-blue-200 shadow-sm">
                <BookOpen size={20} />
            </div>
            <span className="text-lg font-bold text-slate-800 tracking-tight hidden sm:block">Jurnal<span className="text-blue-600">Ummi</span></span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block leading-tight">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Pengguna</div>
                <div className="text-sm font-semibold text-slate-700 truncate max-w-[150px]">
                    {userProfile?.nama_lengkap || 'Guru'}
                </div>
            </div>
            <Link href="/settings" className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Pengaturan Akun">
                <Settings size={18} />
            </Link>
            <form action={signOut}>
              <button className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors" title="Keluar">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        
        {/* WELCOME SECTION */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">{greeting}, {userProfile?.nama_lengkap?.split(' ')[0]} 👋</h2>
                <p className="text-slate-500">Berikut adalah ringkasan aktivitas sekolah hari ini.</p>
            </div>
            <div className="text-sm text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
                <Calendar size={14}/> {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
        </div>

        {/* --- DASHBOARD ADMIN --- */}
        {isAdmin && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* 1. KEY METRICS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={<Users/>} label="Total Santri" value={stats.totalSiswa} sub="Aktif" color="blue" />
                    <StatCard icon={<Users/>} label="Total Kelompok" value={stats.totalKelompok} sub="Kelas Belajar" color="purple" />
                    <StatCard icon={<TrendingUp/>} label="Jurnal Hari Ini" value={stats.jurnalHariIni} sub="Input Masuk" color="green" />
                    
                    <Link href="/admin/ujian" className="relative overflow-hidden bg-white p-5 rounded-xl border border-orange-200 shadow-sm hover:shadow-md hover:border-orange-400 transition-all cursor-pointer group">
                        <div className="absolute -right-4 -top-4 bg-orange-100 w-20 h-20 rounded-full group-hover:scale-110 transition-transform"></div>
                        <div className="relative z-10 flex justify-between items-start">
                            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><ClipboardCheck size={20}/></div>
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </span>
                        </div>
                        <div className="relative z-10 mt-4">
                            <div className="text-3xl font-bold text-slate-900">{stats.siapUjian}</div>
                            <div className="text-xs text-slate-500 font-medium group-hover:text-orange-600 flex items-center gap-1">
                                Antrian Ujian <ChevronRight size={12}/>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* 2. SPLIT VIEW */}
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* LEFT: ACTIVITY FEED */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Activity size={18} className="text-blue-500"/> Live Activity
                            </h3>
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Realtime</span>
                        </div>
                        <div className="divide-y divide-slate-50 flex-1">
                            {stats.recentLogs.length > 0 ? (
                                stats.recentLogs.map((log: any, i) => (
                                    <div key={i} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-bold text-slate-700">{log.users?.nama_lengkap || 'Guru'}</span>
                                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                <Clock size={10}/>
                                                {new Date(log.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600">
                                            Menilai <span className="font-medium text-blue-600">{log.siswa_target?.siswa?.nama_siswa}</span>
                                        </p>
                                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                            <span className="bg-slate-100 px-1.5 rounded text-slate-600">{log.siswa_target?.target_pembelajaran?.judul}</span>
                                            <span>&bull;</span>
                                            <span>{log.halaman_ayat}</span>
                                            {log.nilai && <span className="font-bold bg-yellow-50 text-yellow-700 px-1 rounded">{log.nilai}</span>}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">Belum ada aktivitas hari ini.</div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: SHORTCUTS & CHART */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wider text-slate-400">Menu Manajemen</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
                                <ShortcutItem href="/admin/kurikulum" icon={<BookOpen/>} label="Kurikulum" color="blue"/>
                                <ShortcutItem href="/admin/kelompok" icon={<Users/>} label="Kelompok" color="purple"/>
                                <ShortcutItem href="/admin/siswa" icon={<GraduationCap/>} label="Data Santri" color="indigo"/>
                                <ShortcutItem href="/admin/ujian" icon={<ClipboardCheck/>} label="Ujian" color="orange"/>
                                <ShortcutItem href="/admin/laporan" icon={<FileText/>} label="Laporan" color="green"/>
                                <ShortcutItem href="/admin/keuangan" icon={<Users/>} label="Keuangan" color="red"/> {/* UPDATE LINK */}
                                <ShortcutItem href="/admin/users" icon={<Shield/>} label="User / Guru" color="slate"/>
                                <ShortcutItem href="/admin/pengaturan" icon={<Settings/>} label="Identitas" color="slate"/>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <BarChart3 size={18} className="text-slate-400"/> Distribusi Level Santri
                            </h3>
                            <div className="space-y-4">
                                {stats.levelDist.length > 0 ? (
                                    stats.levelDist.map((item, idx) => (
                                        <div key={idx} className="group">
                                            <div className="flex justify-between text-xs mb-1.5">
                                                <span className="font-medium text-slate-700">{item.name}</span>
                                                <span className="font-bold text-slate-900">{item.count} <span className="text-slate-400 font-normal">santri</span></span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                <div 
                                                    className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-out" 
                                                    style={{ width: `${(item.count / stats.totalSiswa) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-400 text-center py-4">Belum ada data statistik.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- JADWAL SAYA (UTAMA) --- */}
        <div>
             <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Jadwal Mengajar Saya</h2>
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {myGroups.length > 0 ? (
                myGroups.map((item: any) => (
                <Link
                    key={item.id}
                    href={`/kelompok/${item.id}`}
                    className="group relative block rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                {item.nama_kelompok.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {item.nama_kelompok}
                                </h3>
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Clock size={12}/> {item.jadwal_sesi || 'Belum diatur'}
                                </p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors"/>
                    </div>
                </Link>
                ))
            ) : (
                <div className="col-span-full rounded-xl border-2 border-dashed border-slate-300 p-8 text-center bg-slate-50/50">
                    <Users className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-500">Anda belum memiliki jadwal mengajar.</p>
                </div>
            )}
            </div>
        </div>

        {/* --- MENU BADAL (KELAS LAIN) --- */}
        {otherGroups.length > 0 && (
            <details className="group pt-4 border-t border-slate-200">
                <summary className="flex items-center gap-2 cursor-pointer text-slate-500 hover:text-blue-600 font-semibold select-none list-none">
                     <span className="p-1 bg-slate-100 rounded group-open:bg-blue-100 group-open:text-blue-600 transition-colors"><ChevronRight size={18} className="transition-transform group-open:rotate-90"/></span>
                     <span>Gantikan Guru Lain (Badal)</span>
                     <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">{otherGroups.length} Kelas</span>
                </summary>
                
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex gap-2 mb-4 text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100 items-start">
                        <UserCheck size={16} className="mt-0.5 shrink-0"/>
                        <p><strong>Mode Badal:</strong> Anda akan masuk ke kelas guru lain. Honor sesi ini akan tercatat atas nama Anda sebagai Guru Pengganti.</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {otherGroups.map((item: any) => (
                            <Link
                                key={item.id}
                                href={`/kelompok/${item.id}`}
                                className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-orange-400 hover:shadow-md transition-all opacity-80 hover:opacity-100"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                                            {item.nama_kelompok.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-sm">
                                            {item.nama_kelompok}
                                            </h3>
                                            <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                                Guru Utama: <span className="font-bold">{item.users?.nama_lengkap || '-'}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-1 rounded">
                                        BADAL
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </details>
        )}

      </main>
    </div>
  )
}

// =========================================
// SUB COMPONENTS
// =========================================

function StatCard({ icon, label, value, sub, color }: any) {
    const colors: any = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        green: 'bg-green-50 text-green-600 border-green-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
    }
    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <div className={`p-2 rounded-lg ${colors[color] || colors.blue}`}>{icon}</div>
            </div>
            <div>
                <div className="text-3xl font-bold text-slate-900 tracking-tight">{value}</div>
                <div className="text-xs text-slate-500 font-medium">{label}</div>
            </div>
        </div>
    )
}

function ShortcutItem({ href, icon, label, color }: any) {
    const hoverColors: any = {
        blue: 'group-hover:text-blue-600',
        purple: 'group-hover:text-purple-600',
        indigo: 'group-hover:text-indigo-600',
        orange: 'group-hover:text-orange-600',
        red: 'group-hover:text-red-600',
        green: 'group-hover:text-green-600',
        slate: 'group-hover:text-slate-800',
    }

    return (
        <Link href={href} className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md hover:scale-105 transition-all border border-slate-100 group">
            <div className={`mb-2 text-slate-400 transition-colors ${hoverColors[color] || 'group-hover:text-blue-600'}`}>
                {icon}
            </div>
            <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 text-center">{label}</span>
        </Link>
    )
}