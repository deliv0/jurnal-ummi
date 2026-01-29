import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from 'next/link';
import { Home, Users, User, LayoutGrid } from 'lucide-react'; // Import Icon

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jurnal Ummi Digital",
  description: "Sistem Manajemen Pembelajaran Al-Quran",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={inter.className}>
        {children}
        
        {/* --- MOBILE APP BAR (Hanya Muncul di Layar Kecil) --- */}
        <MobileNavBar />
        
      </body>
    </html>
  );
}

// Komponen Navigasi Bawah ala Aplikasi Mobile
function MobileNavBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2 px-6 flex justify-between items-center z-50 md:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      
      {/* 1. HOME (Dashboard) */}
      <Link href="/" className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 active:text-blue-700 transition-colors">
        <Home size={24} />
        <span className="text-[10px] font-medium">Beranda</span>
      </Link>

      {/* 2. KELOMPOK (Shortcut Mengajar) */}
      <Link href="/admin/kelompok" className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 active:text-blue-700 transition-colors">
        <Users size={24} />
        <span className="text-[10px] font-medium">Kelas</span>
      </Link>

      {/* 3. MENU TENGAH (Floating Action Button - Opsional, Visual Saja) */}
      <div className="-mt-8 bg-blue-600 rounded-full p-3 shadow-lg shadow-blue-200 border-4 border-slate-50">
         <LayoutGrid size={24} className="text-white"/>
      </div>

      {/* 4. SISWA */}
      <Link href="/admin/siswa" className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 active:text-blue-700 transition-colors">
        <User size={24} />
        <span className="text-[10px] font-medium">Santri</span>
      </Link>

      {/* 5. PENGATURAN (Settings) */}
      <Link href="/admin/pengaturan" className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 active:text-blue-700 transition-colors">
        <User size={24} />
        <span className="text-[10px] font-medium">Akun</span>
      </Link>

    </div>
  )
}