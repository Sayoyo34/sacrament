import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

export interface EditRow {
  id: string
  content: ReactNode
}

interface Props {
  rows: EditRow[]
  selected: Set<string>
  accent: string
  onToggle: (id: string) => void
  /** to は「動かす項目を抜いた後の配列における位置」 */
  onReorder: (id: string, to: number) => void
}

interface DragState {
  id: string
  from: number
  to: number
  dy: number
  height: number
}

/** 3本線のマーク。ドラッグハンドルと並び替えボタンで共用する */
export function HandleIcon() {
  return <span className="handle-icon"><i /><i /><i /></span>
}

/** セクション見出しなどに置く、並び替えを始めるボタン */
export function ReorderButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="reorder-open" onClick={onClick} aria-label="並び替え" title="並び替え">
      <HandleIcon />
    </button>
  )
}

/**
 * 並び替え中の一覧。左のチェックで複数選択、右のハンドルをつまんで上下に動かす。
 * ハンドルの上でだけドラッグを始めるので、一覧そのものは普通に縦スクロールできる。
 */
export default function EditableList({ rows, selected, accent, onToggle, onReorder }: Props) {
  const listRef = useRef<HTMLUListElement>(null)
  const rectsRef = useRef<{ top: number; height: number }[]>([])
  const startYRef = useRef(0)
  const [drag, setDrag] = useState<DragState | null>(null)
  // 描画用の state とは別に ref にも持つ。
  // 再描画を待たずに pointerup が最新の位置を読めるようにするため
  const dragRef = useRef<DragState | null>(null)

  function updateDrag(next: DragState | null) {
    dragRef.current = next
    setDrag(next)
  }

  function handleDown(e: ReactPointerEvent, index: number, id: string) {
    const list = listRef.current
    if (!list) return
    rectsRef.current = ([...list.children] as HTMLElement[]).map(el => {
      const r = el.getBoundingClientRect()
      return { top: r.top, height: r.height }
    })
    startYRef.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
    updateDrag({ id, from: index, to: index, dy: 0, height: rectsRef.current[index].height })
  }

  function handleMove(e: ReactPointerEvent) {
    const cur = dragRef.current
    if (!cur) return
    const rects = rectsRef.current
    const dy = e.clientY - startYRef.current
    // つまんだ行の見た目上の中心が、他の何行分の中心を追い越したか
    const center = rects[cur.from].top + rects[cur.from].height / 2 + dy
    let to = 0
    rects.forEach((r, i) => {
      if (i !== cur.from && center > r.top + r.height / 2) to++
    })
    if (dy !== cur.dy || to !== cur.to) updateDrag({ ...cur, dy, to })
  }

  function handleUp() {
    const cur = dragRef.current
    if (!cur) return
    updateDrag(null)
    if (cur.to !== cur.from) onReorder(cur.id, cur.to)
  }

  /** ドラッグ中に各行をどれだけずらして見せるか */
  function offsetOf(i: number) {
    if (!drag) return 0
    if (i === drag.from) return drag.dy
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.height
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return drag.height
    return 0
  }

  return (
    <ul className="item-list edit-list" ref={listRef}>
      {rows.map((row, i) => {
        const isDragged = drag?.from === i
        const on = selected.has(row.id)
        return (
          <li
            key={row.id}
            style={{
              position: 'relative',
              zIndex: isDragged ? 5 : undefined,
              transform: `translateY(${offsetOf(i)}px)`,
              transition: drag && !isDragged ? 'transform 0.18s ease' : undefined,
            }}
          >
            <div className={`row-card edit-row${isDragged ? ' dragging' : ''}`}>
              <button
                className={`select-circle${on ? ' on' : ''}`}
                style={on ? { background: accent, borderColor: accent } : undefined}
                onClick={() => onToggle(row.id)}
                aria-label={on ? '選択を外す' : '選択する'}
              >
                {on ? '✓' : ''}
              </button>

              {row.content}

              <span
                className="drag-handle"
                onPointerDown={e => handleDown(e, i, row.id)}
                onPointerMove={handleMove}
                onPointerUp={handleUp}
                onPointerCancel={handleUp}
                aria-label="ドラッグして並び替え"
                role="button"
              >
                <HandleIcon />
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** 並び替え中に一覧の上へ出す操作バー（取り消し / まとめて削除 / 保存） */
export function EditToolbar({ selectedCount, removedCount, accent, onCancel, onDelete, onDone }: {
  selectedCount: number
  removedCount: number
  accent: string
  onCancel: () => void
  onDelete: () => void
  onDone: () => void
}) {
  const status = selectedCount > 0
    ? `${selectedCount}件を選択中`
    : removedCount > 0
      ? `${removedCount}件を削除予定`
      : 'ハンドルをつまんで並び替え'

  return (
    <div className="edit-toolbar">
      <button className="round-btn" onClick={onCancel} aria-label="変更を取り消す" title="変更を取り消す">✕</button>

      <span className="edit-count">{status}</span>

      <span className="edit-toolbar-right">
        <button
          className="round-btn"
          onClick={onDelete}
          disabled={selectedCount === 0}
          aria-label="選択した項目を削除"
        >
          🗑
        </button>
        <button
          className="round-btn"
          style={{ background: accent, color: '#fff' }}
          onClick={onDone}
          aria-label="保存"
          title="保存"
        >
          ✓
        </button>
      </span>
    </div>
  )
}
