import { yen } from './utils'

/** 不備があればエラー文、問題なければ null を返す */
export type Check = () => string | null

export function firstError(...checks: Check[]): string | null {
  for (const c of checks) {
    const e = c()
    if (e) return e
  }
  return null
}

export function required(value: string, label: string): Check {
  return () => value.trim() ? null : `${label}を入力してください`
}

export function positive(value: number, label: string): Check {
  return () => value > 0 ? null : `${label}を入力してください`
}

export function notNegative(value: number, label: string): Check {
  return () => value >= 0 ? null : `${label}は0以上で入力してください`
}

export function selected(value: string, label: string): Check {
  return () => value ? null : `${label}を選んでください`
}

export function inRange(value: number, min: number, max: number, label: string): Check {
  return () => value >= min && value <= max ? null : `${label}は${min}〜${max}の範囲で入力してください`
}

export function maxLength(value: string, max: number, label: string): Check {
  return () => value.trim().length > max ? `${label}は${max}文字までです` : null
}

export function notDuplicated(name: string, existing: string[], label: string): Check {
  return () => existing.some(n => n === name.trim()) ? `同じ名前の${label}がすでにあります` : null
}

/** 引く／切り崩す／戻す の金額 */
export function withinAmount(value: number, max: number): Check {
  return () => {
    if (value <= 0) return '金額を入力してください'
    if (value > max) return `${yen(max)}までしか指定できません`
    return null
  }
}
