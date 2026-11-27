import type { LedgerEntry, PlanCategory, PlanFrequency, PlanItem } from './types'

export interface PlanDraft {
  id: string | null
  name: string
  category: PlanCategory
  estimatedCost: number
  frequency: PlanFrequency
  month: number
  dayOfMonth: number
  walletId: string
  genreId: string
  tagIds: string[]
  memo: string
}

type DateFields = Pick<PlanItem, 'frequency' | 'month' | 'dayOfMonth'>

/** 「毎月○日」「毎年○月○日」のような短い日付表示。どちらも未設定なら「未設定」 */
export function shortDateText(p: DateFields) {
  if (p.frequency === 'yearly') {
    if (p.month > 0 && p.dayOfMonth > 0) return `毎年${p.month}月${p.dayOfMonth}日`
    if (p.month > 0) return `毎年${p.month}月`
    if (p.dayOfMonth > 0) return `毎年${p.dayOfMonth}日`
    return '未設定'
  }
  return p.dayOfMonth > 0 ? `毎月${p.dayOfMonth}日` : '未設定'
}

/** 一覧行用。「毎月○日に支払い」「支払い日未設定」のような文言 */
export function paymentLabel(p: DateFields) {
  const text = shortDateText(p)
  return text === '未設定' ? '支払い日未設定' : `${text}に支払い`
}

/**
 * 指定した月（YYYY-MM）に引き落とされる定期支出。
 * 毎月のものは全件、毎年のものは支払い月がその月のものだけ（月未設定の毎年分は月を決められないので含めない）。
 */
export function plansDueIn(planItems: PlanItem[], month: string) {
  const m = Number(month.split('-')[1])
  return planItems
    .filter(p => p.frequency === 'monthly' || p.month === m)
    .sort((a, b) => (a.dayOfMonth || 99) - (b.dayOfMonth || 99) || a.order - b.order)
}

/** 年・月（0始まり）・日から、その月に実在する YYYY-MM-DD。31日や30日は月末に丸める（月の繰り上がり・繰り下がりも可） */
export function clampedDate(year: number, month0: number, day: number) {
  const first = new Date(year, month0, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const d = new Date(first.getFullYear(), first.getMonth(), Math.min(day, last))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** YYYY-MM の初日と末日 */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  return { from: clampedDate(y, m - 1, 1), to: clampedDate(y, m - 1, 31) }
}

/**
 * 期間 [from, to] の中で定期支出が発生する日付。
 * 支払い日が未設定のものは日を決められないので、期間の最終日に1回発生したことにする。
 * 毎年のもので支払い月が未設定なら、いつ発生するか分からないので数えない。
 */
export function planOccurrencesIn(p: PlanItem, from: string, to: string): string[] {
  if (p.frequency === 'yearly' && p.month === 0) return []
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  const dates: string[] = []
  for (let i = (fy * 12 + fm - 1); i <= (ty * 12 + tm - 1); i++) {
    const y = Math.floor(i / 12), m0 = i % 12
    if (p.frequency === 'yearly' && p.month !== m0 + 1) continue
    if (p.dayOfMonth === 0) {
      if (i === ty * 12 + tm - 1) dates.push(to)
      continue
    }
    const d = clampedDate(y, m0, p.dayOfMonth)
    if (d >= from && d <= to) dates.push(d)
  }
  return dates
}

export interface PlanOccurrence {
  plan: PlanItem
  /** 記録するときに使う日付 */
  date: string
  /** この期間に、この定期支出から作った記録がある */
  recorded: boolean
  /** 記録済みなら実際に記録した額、まだなら登録額（目安） */
  amount: number
}

/** 期間内の発生を、記録済みかどうか付きで返す。日付順 */
export function occurrencesIn(plans: PlanItem[], entries: LedgerEntry[], from: string, to: string): PlanOccurrence[] {
  return plans.flatMap(p => {
    const dates = planOccurrencesIn(p, from, to)
    if (dates.length === 0) return []
    const recorded = entries
      .filter(e => e.planId === p.id && e.date >= from && e.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date))
    return dates.map((date, i) => ({
      plan: p, date, recorded: i < recorded.length,
      amount: i < recorded.length ? -recorded[i].amount : p.estimatedCost,
    }))
  }).sort((a, b) => a.date.localeCompare(b.date) || a.plan.order - b.plan.order)
}
