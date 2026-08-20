import { useRef } from 'react'
import type { TouchEvent } from 'react'

const THRESHOLD = 60 // px
const RATIO = 1.5 // 縦の動きに対して横がこの倍以上ないと横スワイプと見なさない

interface Options {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

/** 横スワイプでページ・タブを切り替えるためのタッチ判定 */
export function useSwipeNav({ onSwipeLeft, onSwipeRight }: Options) {
  const start = useRef<{ x: number; y: number } | null>(null)

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
  }

  function onTouchEnd(e: TouchEvent) {
    const from = start.current
    start.current = null
    if (!from) return
    const t = e.changedTouches[0]
    const dx = t.clientX - from.x
    const dy = t.clientY - from.y
    if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy) * RATIO) return
    if (dx < 0) onSwipeLeft?.()
    else onSwipeRight?.()
  }

  return { onTouchStart, onTouchEnd }
}

/** 隣接するタブへ横スワイプで移動する。端のタブでは反対側へのスワイプは何もしない */
export function useSwipeTabs<T extends string>(tabs: readonly T[], active: T, onChange: (id: T) => void) {
  const index = tabs.indexOf(active)
  return useSwipeNav({
    onSwipeLeft: index < tabs.length - 1 ? () => onChange(tabs[index + 1]) : undefined,
    onSwipeRight: index > 0 ? () => onChange(tabs[index - 1]) : undefined,
  })
}
