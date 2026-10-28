import { createClient } from '@supabase/supabase-js'
import { CLOUD_SYNC_ENABLED } from './features'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// ログイン機能を切った版（iOS v1）では、キーがあっても使わない
export const hasSupabase = CLOUD_SYNC_ENABLED && Boolean(url && anonKey)

/** env未設定でもアプリ全体が壊れないよう、未設定時はダミーURLでクライアントだけ作る（hasSupabaseがfalseなら呼び出し側で使わない） */
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder')
