'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// Pastikan Service Key ada agar tidak error saat build
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase URL atau Service Role Key belum disetting di .env.local")
}

// Client Admin khusus Server
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// --- 1. CREATE USER ---
export async function createUser(prevState: any, formData: FormData) {
  const nama = formData.get('nama') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as string

  if (!email || !password || !nama) {
      return { success: false, message: "Data tidak lengkap" }
  }

  try {
    // A. Buat Akun Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true 
    })

    if (authError) throw new Error(authError.message)
    if (!authData.user) throw new Error("Gagal membuat user.")

    // B. Simpan Profil ke Database
    const rolesArray = role === 'admin' ? ['admin', 'guru'] : ['guru']

    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: authData.user.id,
        nama_lengkap: nama,
        email: email,
        roles: rolesArray,
        status: 'aktif'
      })

    if (profileError) {
        // Rollback: Hapus akun auth jika profil gagal dibuat
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        throw new Error("Gagal menyimpan profil: " + profileError.message)
    }

    revalidatePath('/admin/users')
    return { success: true, message: `User ${nama} berhasil dibuat!` }

  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// --- 2. UPDATE USER (Baru) ---
export async function updateUser(userId: string, formData: FormData) {
  const nama = formData.get('nama') as string
  const role = formData.get('role') as string

  try {
    const rolesArray = role === 'admin' ? ['admin', 'guru'] : ['guru']

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        nama_lengkap: nama,
        roles: rolesArray
      })
      .eq('id', userId)

    if (error) throw new Error(error.message)

    revalidatePath('/admin/users')
    return { success: true, message: `Data ${nama} berhasil diperbarui!` }

  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// --- 3. DELETE USER ---
export async function deleteUser(userId: string) {
    try {
        // Hapus Auth (Cascade ke public.users biasanya otomatis, tapi kita double check)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if(error) throw error

        // Hapus Profile Manual (Jika cascade tidak jalan)
        await supabaseAdmin.from('users').delete().eq('id', userId)

        revalidatePath('/admin/users')
        return { success: true }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}