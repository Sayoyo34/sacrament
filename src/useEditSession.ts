import { useState } from 'react'
import { moveInArray } from './utils'

/**
 * 並び替え中の状態。確定するまで元の一覧には触らず、
 * ここに持った下書きだけを書き換える（✕で元に戻せるようにするため）。
 */
export function useEditSession<T extends { id: string }>() {
  const [draft, setDraft] = useState<T[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [removed, setRemoved] = useState<string[]>([])

  function start(items: T[]) {
    setDraft(items)
    setSelected(new Set())
    setRemoved([])
  }

  function cancel() {
    setDraft(null)
    setSelected(new Set())
    setRemoved([])
  }

  function reorder(id: string, to: number) {
    setDraft(d => d ? moveInArray(d, d.findIndex(x => x.id === id), to) : d)
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** 選択中の行を下書きから外す。確定するまで実際には消えない */
  function removeSelected() {
    if (selected.size === 0) return
    setDraft(d => d ? d.filter(x => !selected.has(x.id)) : d)
    setRemoved(r => [...r, ...selected])
    setSelected(new Set())
  }

  return {
    editing: draft !== null,
    draft: draft ?? [],
    selected,
    removed,
    start,
    cancel,
    reorder,
    toggle,
    removeSelected,
  }
}
