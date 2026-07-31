import type { Genre, LedgerEntry, PlanItem, SavingsEvent, Tag, Task } from './types'
import { generateId, todayStr } from './utils'

const SCHEMA_KEY = 'schemaVersion'
const SCHEMA_VERSION = 2

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

export function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export const DEFAULT_GENRES: Genre[] = [
  { id: 'g-kakin',    name: '課金',   color: '#a78bfa', icon: '💎' },
  { id: 'g-goods',    name: 'グッズ', color: '#f472b6', icon: '🎁' },
  { id: 'g-ticket',   name: 'チケット', color: '#fb923c', icon: '🎫' },
  { id: 'g-transit',  name: '交通費', color: '#60a5fa', icon: '🚄' },
  { id: 'g-food',     name: '飲食',   color: '#fbbf24', icon: '🍰' },
  { id: 'g-living',   name: '生活費', color: '#34d399', icon: '🏠' },
  { id: 'g-other',    name: 'その他', color: '#94a3b8', icon: '📦' },
]

/** 新スキーマで使うキー。リセット時もこれを消す */
export const STORAGE_KEYS = [
  'wallets', 'entries', 'planItems', 'tasks', 'savingsEvents', 'genres', 'tags', SCHEMA_KEY,
]

/** v1（シミュレーター/家計簿/タスク/タイマーの4画面時代）の旧キー */
const LEGACY_KEYS = [
  'bulletItems', 'recurringExpenses', 'presets', 'taskBonus', 'bonusBalance',
  'totalMinutes', 'bonusRate', 'capRate', 'bonusUsed',
]

interface LegacyBulletItem { id: string; name: string; estimatedCost: number; deductedAmount: number }
interface LegacyRecurring { id: string; name: string; amount: number; dayOfMonth: number; walletId: string }
interface LegacyTask { id: string; name: string; bonusAmount: number; completed: boolean; bonusApplied: boolean }
interface LegacyPreset { id: string; name: string; minutes: number }
interface LegacyEntry { id: string; walletId: string; label: string; amount: number; date: string }

/**
 * v1 → v2 移行。
 * - bulletItems + recurringExpenses → planItems（未定 / 毎月）
 * - presets（タイマー）→ tasks（タイマー付きデイリー）に統合
 * - taskBonus + タイマー累計 → savingsEvents の移行分1件として保存
 * - 前借り関連（capRate / bonusUsed）は廃止のため引き継がない
 * 旧キーは削除せず残す（不具合時に手動で戻せるようにするため）
 */
export function migrate() {
  if (load<number>(SCHEMA_KEY, 1) >= SCHEMA_VERSION) return

  const today = todayStr()

  // ── 出費履歴にジャンル/タグ/メモの欄を足す
  const legacyEntries = load<LegacyEntry[]>('entries', [])
  const entries: LedgerEntry[] = legacyEntries.map(e => ({
    id: e.id,
    walletId: e.walletId,
    label: e.label,
    amount: e.amount,
    date: e.date || today,
    genreId: '',
    tagIds: [],
    memo: '',
  }))

  // ── 欲しいもの（未定）と定期支出（毎月）を予定に統合
  const bullets = load<LegacyBulletItem[]>('bulletItems', [])
  const recurring = load<LegacyRecurring[]>('recurringExpenses', [])
  const planItems: PlanItem[] = [
    ...bullets.map((b, i) => ({
      id: b.id,
      name: b.name,
      kind: 'once' as const,
      estimatedCost: b.estimatedCost,
      deductedAmount: b.deductedAmount,
      dayOfMonth: 0,
      walletId: '',
      genreId: '',
      tagIds: [],
      memo: '',
      order: i,
    })),
    ...recurring.map((r, i) => ({
      id: r.id,
      name: r.name,
      kind: 'monthly' as const,
      estimatedCost: r.amount,
      deductedAmount: 0,
      dayOfMonth: r.dayOfMonth,
      walletId: r.walletId,
      genreId: '',
      tagIds: [],
      memo: '',
      order: i,
    })),
  ]

  // ── タスク。旧 completed は達成日不明なので今日として履歴に積む
  const legacyTasks = load<LegacyTask[]>('tasks', [])
  const tasks: Task[] = legacyTasks.map((t, i) => ({
    id: t.id,
    name: t.name,
    bonusAmount: t.bonusAmount,
    repeat: 'once' as const,
    timerMinutes: 0,
    completedDates: t.completed ? [today] : [],
    genreId: '',
    order: i,
  }))

  // ── タイマープリセットはタスクに吸収。旧レートで換算した額をボーナスとして引き継ぐ
  const bonusRate = load<number>('bonusRate', 100)
  const presets = load<LegacyPreset[]>('presets', [])
  presets.forEach((p, i) => {
    tasks.push({
      id: p.id,
      name: p.name,
      bonusAmount: Math.floor(p.minutes / 10) * bonusRate,
      repeat: 'daily',
      timerMinutes: p.minutes,
      completedDates: [],
      genreId: '',
      order: legacyTasks.length + i,
    })
  })

  // ── 貯まっていた額は履歴が無いので移行分1件にまとめる
  const taskBonus = load<number>('taskBonus', load<number>('bonusBalance', 0))
  const totalMinutes = load<number>('totalMinutes', 0)
  const carried = taskBonus + Math.floor(totalMinutes / 10) * bonusRate
  const savingsEvents: SavingsEvent[] = carried > 0
    ? [{ id: generateId(), date: today, amount: carried, taskId: '', label: '移行分（旧ボーナス累計）' }]
    : []

  save('entries', entries)
  save('planItems', planItems)
  save('tasks', tasks)
  save('savingsEvents', savingsEvents)
  save('genres', DEFAULT_GENRES)
  save('tags', [] as Tag[])
  save(SCHEMA_KEY, SCHEMA_VERSION)
}

export function resetAll() {
  ;[...STORAGE_KEYS, ...LEGACY_KEYS].forEach(k => localStorage.removeItem(k))
  // 版数を書き戻さないと次回起動で移行が再実行され、リセット後に入れたデータを空で上書きしてしまう
  save(SCHEMA_KEY, SCHEMA_VERSION)
}
