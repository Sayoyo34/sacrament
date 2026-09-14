import type { Genre, Goal, LedgerEntry, PlanItem, SavingsEvent, Tag, Task, Wallet } from './types'
import { supabase } from './supabaseClient'

export interface AppData {
  wallets: Wallet[]
  entries: LedgerEntry[]
  planItems: PlanItem[]
  tasks: Task[]
  savingsEvents: SavingsEvent[]
  goals: Goal[]
  genres: Genre[]
  tags: Tag[]
}

/** このタブ自身の書き込みをRealtimeで受け取ってもループしないよう、書き込みごとに印を付ける */
export function clientId(): string {
  const key = 'cloudSyncClientId'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

/**
 * キー順に左右されない比較用の文字列。
 * クラウド側(jsonb)はキーを並べ替えて返すので、素の JSON.stringify ではローカルと一致しない
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj).sort().filter(k => obj[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** データの指紋（cyrb53）。前回同期時点の状態を丸ごと保存すると容量が倍になるので、ハッシュだけ持つ */
export function fingerprint(data: AppData): string {
  const str = stableStringify(data)
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${str.length}:${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}`
}

const SYNC_BASE_KEY = 'cloudSyncBase'
const SYNC_BACKUP_KEY = 'cloudSyncBackup'

/** 最後にクラウドと一致していた時点の指紋。ページを閉じても残すため localStorage に置く */
function loadSyncBase(userId: string): string | null {
  try {
    const raw = localStorage.getItem(SYNC_BASE_KEY)
    const base = raw ? (JSON.parse(raw) as { userId: string; fingerprint: string }) : null
    return base?.userId === userId ? base.fingerprint : null
  } catch { return null }
}

export function saveSyncBase(userId: string, fp: string) {
  localStorage.setItem(SYNC_BASE_KEY, JSON.stringify({ userId, fingerprint: fp }))
}

/** どちらかを選んで捨てる前に、捨てる側を1件だけ控えておく（手動で戻せるように） */
export function saveSyncBackup(side: 'local' | 'cloud', data: AppData) {
  try {
    localStorage.setItem(SYNC_BACKUP_KEY, JSON.stringify({ side, savedAt: new Date().toISOString(), data }))
  } catch { /* 容量不足でも選択自体は進める */ }
}

function isBlank(d: AppData): boolean {
  // ジャンルは初期値が入っているので見ない
  return [d.wallets, d.entries, d.planItems, d.tasks, d.savingsEvents, d.goals, d.tags].every(a => a.length === 0)
}

/**
 * ログイン直後にどちらのデータを正とするか決める。
 * - push: この端末にだけ未送信の変更がある（クラウドは前回から変わっていない）
 * - pull: この端末は前回から変わっていない、または空
 * - conflict: 両方変わっている／この端末で同期した記録が無いのに中身が違う → 利用者に選んでもらう
 */
export function decideInitialSync(userId: string, local: AppData, cloud: AppData | null): 'same' | 'push' | 'pull' | 'conflict' {
  if (!cloud) return 'push'
  const l = fingerprint(local)
  const c = fingerprint(cloud)
  if (l === c) return 'same'
  const base = loadSyncBase(userId)
  if (base === l) return 'pull'
  if (base === c) return 'push'
  if (base === null && isBlank(local)) return 'pull'
  return 'conflict'
}

export function summarize(d: AppData) {
  const latest = d.entries.reduce((max, e) => (e.date > max ? e.date : max), '')
  return {
    entries: d.entries.length,
    latestEntryDate: latest,
    wallets: d.wallets.length,
    planItems: d.planItems.length,
    tasks: d.tasks.length,
  }
}

export async function pullCloudState(userId: string): Promise<AppData | null> {
  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.data as AppData | undefined) ?? null
}

export async function pushCloudState(userId: string, data: AppData) {
  const { error } = await supabase
    .from('app_state')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString(), client_id: clientId() })
  if (error) throw error
}

export function subscribeCloudState(userId: string, onChange: (data: AppData) => void) {
  const channel = supabase
    .channel(`app_state:${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'app_state', filter: `user_id=eq.${userId}` },
      payload => {
        const row = payload.new as { data: AppData; client_id?: string }
        if (row.client_id === clientId()) return
        onChange(row.data)
      },
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
