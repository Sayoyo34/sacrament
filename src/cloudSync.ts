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
