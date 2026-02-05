import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from 'next/link';
import { Home, Users, User, LayoutGrid, Settings } from 'lucide-react'; 

const inter = Inter({ subsets: ["latin"] });

// 1. SETTING PWA & SEO
export const metadata: Metadata = {
  title: "Jurnal Ummi Digital",
  description: "Sistem Manajemen Pembelajaran Al-Quran",
  manifest: "/manifest.json", // WAJIB ADA AGAR BISA DIINSTALL
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  }
};

// 2. SETTING VIEWPORT (Agar tampilan HP pas/tidak zoom)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>
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
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2 px-6 flex justify-between items-center z-40 md:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
      
      {/* 1. KELOMPOK (Shortcut Mengajar) */}
      <Link href="/admin/kelompok" className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 active:text-blue-700 transition-colors w-12">
        <Users size={22} />
        <span className="text-[10px] font-medium">Kelas</span>
      </Link>

      {/* 2. SISWA */}
      <Link href="/admin/siswa" className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 active:text-blue-700 transition-colors w-12">
        <User size={22} />
        <span className="text-[10px] font-medium">Santri</span>
      </Link>

      {/* 3. MENU TENGAH (HOME DASHBOARD) */}
      {/* Tombol ini diangkat ke atas (-mt-8) agar menonjol */}
      <Link href="/" className="-mt-8 bg-blue-600 rounded-full p-3 shadow-lg shadow-blue-200 border-4 border-slate-50 hover:bg-blue-700 transition-all active:scale-95">
         <LayoutGrid size={24} className="text-white"/>
      </Link>

      {/* 4. LAPORAN (Shortcut Backup) */}
      <Link href="/admin/laporan" className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 active:text-blue-700 transition-colors w-12">
        <Home size={22} />
        <span className="text-[10px] font-medium">Laporan</span>
      </Link>

      {/* 5. PENGATURAN (Settings) */}
      <Link href="/admin/pengaturan" className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 active:text-blue-700 transition-colors w-12">
        <Settings size={22} />
        <span className="text-[10px] font-medium">Akun</span>
      </Link>

    </div>
  )
}