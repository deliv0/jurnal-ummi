'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// Kita gunakan Library 'supabase-js' langsung (bukan helper Next.js) 
// karena kita butuh akses Admin dengan Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function createUser(prevState: any, formData: FormData) {
  const nama = String(formData.get('nama'))
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))
  const role = String(formData.get('role')) // 'admin' atau 'guru'

  try {
    // 1. Buat User di Supabase Auth (Database Akun)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Langsung verifikasi email agar bisa login
    })

    if (authError) throw new Error(authError.message)
    if (!authData.user) throw new Error("Gagal membuat user.")

    // 2. Tentukan Roles (Array)
    const rolesArray = role === 'admin' ? ['admin', 'guru'] : ['guru']

    // 3. Masukkan Data Profil ke Tabel 'users' (Database Profil)
    // Kita gunakan Upsert agar jika trigger database sudah membuatnya, kita tinggal update isinya
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: authData.user.id,
        nama_lengkap: nama,
        email: email,
        roles: rolesArray
      })

    if (profileError) {
        // Jika gagal simpan profil, hapus akun auth biar tidak jadi sampah
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        throw new Error("Gagal menyimpan profil: " + profileError.message)
    }

    revalidatePath('/admin/users')
    return { success: true, message: `User ${nama} berhasil dibuat!` }

  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function deleteUser(userId: string) {
    try {
        // Hapus dari Auth (Otomatis profile di public.users terhapus jika settingan cascade benar)
        // Tapi kita hapus manual dua-duanya biar aman
        
        // 1. Hapus Auth
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if(error) throw error

        // 2. Hapus Profile (Opsional jika cascade, tapi aman dilakukan)
        await supabaseAdmin.from('users').delete().eq('id', userId)

        revalidatePath('/admin/users')
        return { success: true }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}