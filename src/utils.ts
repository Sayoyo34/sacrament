export function generateId() {
  return Math.random().toString(36).slice(2)
}

/** ローカル時刻での YYYY-MM-DD。toISOString はUTCになりJSTの朝に前日を返すため使わない */
export function todayStr() {
  return dateStr(new Date())
}

export function dateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** YYYY-MM-DD → YYYY-MM */
export function monthOf(date: string) {
  return date.slice(0, 7)
}

export function thisMonth() {
  return monthOf(todayStr())
}

/** YYYY-MM → 2026年7月（先頭の0は落とす） */
export function monthLabel(month: string) {
  const [y, m] = month.split('-')
  return `${y}年${Number(m)}月`
}

/** YYYY-MM-DD または YYYY-MM → YYYY */
export function yearOf(date: string) {
  return date.slice(0, 4)
}

/** 直近nヶ月を古い順で返す（YYYY-MM） */
export function recentMonths(n: number) {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

/** その月の日数。今月なら本日までの経過日数（達成率の分母に使う） */
export function daysCounted(month: string) {
  const [y, m] = month.split('-').map(Number)
  const full = new Date(y, m, 0).getDate()
  if (month !== thisMonth()) return full
  return Math.min(full, new Date().getDate())
}

/** 直近n日分の日付を古い順で返す（ハビットトラッカーのドット列用） */
export function recentDays(n: number) {
  const out: string[] = []
  const base = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(base.getDate() - i)
    out.push(dateStr(d))
  }
  return out
}

export function yen(n: number) {
  return `${n.toLocaleString()}円`
}

/** 配列の from 番目を取り出して to 番目に差し込む（to は取り出した後の位置） */
export function moveInArray<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return items
  const copy = [...items]
  const [moved] = copy.splice(from, 1)
  copy.splice(Math.max(0, Math.min(copy.length, to)), 0, moved)
  return copy
}

/**
 * 同じグループ内で to 番目へ動かし、そのグループの order を振り直す。
 * 未定と毎月、デイリーとタスクのように区分が分かれた一覧で使う。
 */
export function reorderWithinGroup<T extends { id: string; order: number }>(
  items: T[],
  id: string,
  to: number,
  groupOf: (item: T) => string,
): T[] {
  const target = items.find(i => i.id === id)
  if (!target) return items

  const group = items
    .filter(i => groupOf(i) === groupOf(target))
    .sort((a, b) => a.order - b.order)

  const from = group.findIndex(i => i.id === id)
  if (from === -1) return items

  const orderById = new Map(moveInArray(group, from, to).map((it, i) => [it.id, i]))
  return items.map(i => orderById.has(i.id) ? { ...i, order: orderById.get(i.id)! } : i)
}

/** 絞り込み用。選んだタグをすべて持っていれば一致（AND条件） */
export function matchesTags(itemTagIds: string[], selected: string[]) {
  return selected.every(id => itemTagIds.includes(id))
}
