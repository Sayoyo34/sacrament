import type { Genre, Goal, LedgerEntry, PlanItem, SavingsEvent, Tag, Task, Wallet } from './types'
import { generateId, todayStr } from './utils'

const SCHEMA_KEY = 'schemaVersion'
const SCHEMA_VERSION = 7

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
  'wallets', 'entries', 'planItems', 'tasks', 'savingsEvents', 'goals', 'genres', 'tags', SCHEMA_KEY,
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
  const from = load<number>(SCHEMA_KEY, 1)
  if (from >= SCHEMA_VERSION) return
  if (from < 2) migrateV1toV2()
  if (from < 3) migrateV2toV3()
  if (from < 4) migrateV3toV4()
  if (from < 6) migrateToV6()
  if (from < 7) migrateToV7()
  save(SCHEMA_KEY, SCHEMA_VERSION)
}

interface LegacyPlanItemV3 {
  id: string; name: string; kind: 'once' | 'monthly'; estimatedCost: number; deductedAmount: number
  dayOfMonth: number; walletId: string; genreId: string; tagIds: string[]; memo: string; order: number
}

/**
 * v3 → v4: 出費予定は「サブスク／クレカ後払いの確定額」だけに絞り、
 * 買うか未定だった欲しいもの（kind: 'once'）は貯金目標に引っ越す。
 * 既に引いていた分（deductedAmount）は、貯めた記録として引き継ぐ。
 */
function migrateV3toV4() {
  const legacyPlans = load<LegacyPlanItemV3[]>('planItems', [])
  const goals = load<Goal[]>('goals', [])
  const events = load<SavingsEvent[]>('savingsEvents', [])
  const today = todayStr()

  let order = goals.reduce((m, g) => Math.max(m, g.order), -1) + 1
  const newGoals: Goal[] = []
  const newEvents: SavingsEvent[] = []

  legacyPlans.filter(p => p.kind === 'once').forEach(p => {
    const goalId = generateId()
    newGoals.push({ id: goalId, name: p.name, icon: '🎯', color: '#fb923c', targetAmount: p.estimatedCost, order: order++ })
    if (p.deductedAmount > 0) {
      newEvents.push({
        id: generateId(), date: today, amount: p.deductedAmount, taskId: '', goalId,
        label: '移行分（出費予定の未定から）',
      })
    }
  })

  const planItems: PlanItem[] = legacyPlans.filter(p => p.kind === 'monthly').map(p => ({
    id: p.id, name: p.name, category: 'subscription' as const, estimatedCost: p.estimatedCost,
    frequency: 'monthly' as const, month: 0,
    dayOfMonth: p.dayOfMonth, walletId: p.walletId, genreId: p.genreId, tagIds: p.tagIds, memo: p.memo, order: p.order,
  }))

  save('planItems', planItems)
  save('goals', [...goals, ...newGoals])
  save('savingsEvents', [...events, ...newEvents])
}

interface LegacyPlanItemV4 {
  id: string; name: string; category: 'subscription' | 'credit'; estimatedCost: number
  dayOfMonth: number; walletId: string; genreId: string; tagIds: string[]; memo: string; order: number
}
type LegacyWalletV4 = { id: string; name: string; balance: number }
type LegacyEntryV4 = Omit<LedgerEntry, 'transfer'>

/**
 * → v6: クレカ後払いは「出費予定の手入力」をやめ、口座（isCredit）として扱う。
 * 既存の credit プランは、未精算額をそのまま引き継いだクレカ口座に引っ越す。
 * 口座・家計簿の既存データには isCredit / transfer 等の新フィールドを補う。
 */
function migrateToV6() {
  const legacyWallets = load<LegacyWalletV4[]>('wallets', [])
  const legacyEntries = load<LegacyEntryV4[]>('entries', [])
  const legacyPlans = load<LegacyPlanItemV4[]>('planItems', [])
  const today = todayStr()

  const wallets: Wallet[] = legacyWallets.map(w => ({ ...w, isCredit: false, billingDay: 0, payFromWalletId: '' }))
  const entries: LedgerEntry[] = legacyEntries.map(e => ({ ...e, transfer: false }))

  legacyPlans.filter(p => p.category === 'credit').forEach(p => {
    const walletId = generateId()
    wallets.push({
      id: walletId, name: p.name, balance: -p.estimatedCost,
      isCredit: true, billingDay: p.dayOfMonth, payFromWalletId: p.walletId,
    })
    if (p.estimatedCost > 0) {
      entries.push({
        id: generateId(), walletId, label: `${p.name}（移行分）`, amount: -p.estimatedCost,
        date: today, genreId: p.genreId, tagIds: p.tagIds, memo: p.memo, transfer: false,
      })
    }
  })

  save('wallets', wallets)
  save('entries', entries)
  save('planItems', legacyPlans.filter(p => p.category === 'subscription'))
}

type LegacyPlanItemV6 = Omit<PlanItem, 'frequency' | 'month'>

/** v6 → v7: 定期支出に頻度（毎月／毎年）を持たせる。既存分は全部「毎月」として引き継ぐ */
function migrateToV7() {
  const legacyPlans = load<LegacyPlanItemV6[]>('planItems', [])
  save('planItems', legacyPlans.map(p => ({ ...p, frequency: 'monthly' as const, month: 0 })))
}

/** v2 → v3: つもり貯金に「貯金目標」という行き先の概念を足す */
function migrateV2toV3() {
  const events = load<SavingsEvent[]>('savingsEvents', [])
  save('savingsEvents', events.map(e => ({ ...e, goalId: e.goalId ?? '' })))

  const tasks = load<Task[]>('tasks', [])
  save('tasks', tasks.map(t => ({ ...t, goalId: t.goalId ?? '' })))

  save('goals', load('goals', []))
}

function migrateV1toV2() {
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
    transfer: false,
  }))

  // ── 欲しいもの（未定）と定期支出（毎月）を予定に統合
  const bullets = load<LegacyBulletItem[]>('bulletItems', [])
  const recurring = load<LegacyRecurring[]>('recurringExpenses', [])
  const planItems: LegacyPlanItemV3[] = [
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
    goalId: '',
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
      goalId: '',
      order: legacyTasks.length + i,
    })
  })

  // ── 貯まっていた額は履歴が無いので移行分1件にまとめる
  const taskBonus = load<number>('taskBonus', load<number>('bonusBalance', 0))
  const totalMinutes = load<number>('totalMinutes', 0)
  const carried = taskBonus + Math.floor(totalMinutes / 10) * bonusRate
  const savingsEvents: SavingsEvent[] = carried > 0
    ? [{ id: generateId(), date: today, amount: carried, taskId: '', goalId: '', label: '移行分（旧ボーナス累計）' }]
    : []

  save('entries', entries)
  save('planItems', planItems)
  save('tasks', tasks)
  save('savingsEvents', savingsEvents)
  save('genres', DEFAULT_GENRES)
  save('tags', [] as Tag[])
}

export function resetAll() {
  ;[...STORAGE_KEYS, ...LEGACY_KEYS].forEach(k => localStorage.removeItem(k))
  // 版数を書き戻さないと次回起動で移行が再実行され、リセット後に入れたデータを空で上書きしてしまう
  save(SCHEMA_KEY, SCHEMA_VERSION)
}
