import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabase = Boolean(url && anonKey)

/** env未設定でもアプリ全体が壊れないよう、未設定時はダミーURLでクライアントだけ作る（hasSupabaseがfalseなら呼び出し側で使わない） */
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder')
