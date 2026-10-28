/**
 * 版ごとに出し入れする機能。
 * Web版（Vercel）は今までどおり全部入り。App Store の v1 は `--mode ios`（.env.ios）で下の2つを切る。
 * アップデートで戻すときは .env.ios の値を true にするだけ。
 */
const flag = (v: string | undefined) => v !== 'false'

/** ログイン（マジックリンク／パスワード）と Supabase クラウド同期 */
export const CLOUD_SYNC_ENABLED = flag(import.meta.env.VITE_FEATURE_CLOUD_SYNC)

/** 礼拝タイマー（時間を計って達成するタスク） */
export const TIMER_ENABLED = flag(import.meta.env.VITE_FEATURE_TIMER)
