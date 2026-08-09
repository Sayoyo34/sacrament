interface Props {
  canUp: boolean
  canDown: boolean
  accent: string
  onUp: () => void
  onDown: () => void
}

/**
 * 並び替え中に行の右端へ出す上下ボタン。
 * スマホでのドラッグは縦スクロールと取り合いになるため、確実に動く上下移動にしている。
 */
export default function ReorderButtons({ canUp, canDown, accent, onUp, onDown }: Props) {
  return (
    <span className="reorder-btns">
      <button
        className="reorder-btn"
        style={{ borderColor: accent, color: accent }}
        onClick={onUp}
        disabled={!canUp}
        aria-label="上へ移動"
      >
        ↑
      </button>
      <button
        className="reorder-btn"
        style={{ borderColor: accent, color: accent }}
        onClick={onDown}
        disabled={!canDown}
        aria-label="下へ移動"
      >
        ↓
      </button>
    </span>
  )
}

/** セクション見出しに置く「並び替え / 完了」の切り替えリンク */
export function ReorderToggle({ active, accent, onToggle }: {
  active: boolean
  accent: string
  onToggle: () => void
}) {
  return (
    <button className="link-btn" style={{ color: accent }} onClick={onToggle}>
      {active ? '完了' : '並び替え'}
    </button>
  )
}
