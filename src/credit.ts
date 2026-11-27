import type { LedgerEntry, PlanItem, Wallet } from './types'
import { clampedDate, monthRange, occurrencesIn, type PlanOccurrence } from './plans'

/** 「15日締め・翌月10日払い」のような説明。未設定の部分は省く */
export function creditScheduleText(w: Pick<Wallet, 'closingDay' | 'payMonthOffset' | 'billingDay'>) {
  const close = w.closingDay > 0 ? (w.closingDay >= 31 ? '月末締め' : `${w.closingDay}日締め`) : ''
  const pay = w.billingDay > 0
    ? `${w.payMonthOffset === 2 ? '翌々月' : close ? '翌月' : '毎月'}${w.billingDay}日払い`
    : '引き落とし日未設定'
  return close ? `${close}・${pay}` : pay
}

export interface CreditBill {
  wallet: Wallet
  /** 引き落とし日（YYYY-MM-DD）。引き落とし日が未設定なら '' */
  payDate: string
  /** 請求額の見込み＝記録済みの分＋まだ記録していないカード払いの定期支出 */
  amount: number
  /** 家計簿に記録済みの分（清算するときの額面） */
  recordedAmount: number
  /** 締め期間（両端を含む）。締め日が未設定なら null */
  period: { from: string; to: string } | null
  /** この請求に入るカード払いの定期支出 */
  plans: PlanOccurrence[]
  /** まだ締まっていない（このあとの記録で金額が増える） */
  open: boolean
  /** その月に清算（引き落としの記録）が済んでいる */
  settled: boolean
}

/**
 * 指定した月（YYYY-MM）に引き落とされるクレカの請求。
 * 締め日があれば「締め期間の支出 − 返金」を記録から数える。無ければ未精算額の全額を今月分として扱う。
 * どちらも、その期間に発生するのにまだ記録していないカード払いの定期支出を見込みに足す。
 * 締め日なしの未来・過去の月は金額を決められないので出さない。
 */
export function creditBillsIn(
  wallets: Wallet[], entries: LedgerEntry[], planItems: PlanItem[], month: string, today: string,
): CreditBill[] {
  const [y, m] = month.split('-').map(Number)
  const m0 = m - 1
  const isThisMonth = today.slice(0, 7) === month

  return wallets.filter(w => w.isCredit).flatMap<CreditBill>(w => {
    const payDate = w.billingDay > 0 ? clampedDate(y, m0, w.billingDay) : ''
    const settledAmount = entries
      .filter(e => e.walletId === w.id && e.transfer && e.amount > 0 && e.date.slice(0, 7) === month)
      .reduce((s, e) => s + e.amount, 0)
    const settled = settledAmount > 0
    const cardPlans = planItems.filter(p => p.walletId === w.id)

    if (w.closingDay <= 0) {
      if (!isThisMonth) return []
      const { from, to } = monthRange(month)
      const plans = occurrencesIn(cardPlans, entries, from, to)
      // 清算済みなら清算した額を、まだなら未精算の全額を今月分として見せる
      const recordedAmount = settled ? settledAmount : Math.max(0, -w.balance)
      const amount = recordedAmount + (settled ? 0 : unrecordedTotal(plans))
      if (amount === 0 && plans.length === 0) return []
      return [{ wallet: w, payDate, amount, recordedAmount, period: null, plans, open: false, settled }]
    }

    const offset = w.payMonthOffset === 2 ? 2 : 1
    const to = clampedDate(y, m0 - offset, w.closingDay)
    const prevClose = clampedDate(y, m0 - offset - 1, w.closingDay)
    const [py, pm, pd] = prevClose.split('-').map(Number)
    // 前回の締め日の翌日。締め日が月末だと clampedDate が同じ月末に丸めるので、そのときは翌月1日
    const dayAfter = clampedDate(py, pm - 1, pd + 1)
    const start = dayAfter > prevClose ? dayAfter : clampedDate(py, pm, 1)

    const recordedAmount = Math.max(0, -entries
      .filter(e => e.walletId === w.id && !e.transfer && e.date >= start && e.date <= to)
      .reduce((s, e) => s + e.amount, 0))
    const plans = occurrencesIn(cardPlans, entries, start, to)
    const amount = recordedAmount + unrecordedTotal(plans)
    if (amount <= 0 && !settled) return []
    return [{ wallet: w, payDate, amount, recordedAmount, period: { from: start, to }, plans, open: today <= to, settled }]
  })
}

function unrecordedTotal(plans: PlanOccurrence[]) {
  return plans.filter(o => !o.recorded).reduce((s, o) => s + o.amount, 0)
}
