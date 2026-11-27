import { useEffect, useRef, useState, type ReactNode } from 'react'
import ConfirmModal from './ConfirmModal'
import { withinAmount } from '../validation'

interface Props {
  /** まだ引ける額 */
  remaining: number
  accent: string
  /** 引く操作が使える金額に与える符号。予定は −1、つもり貯金の取り崩しは +1 */
  budgetSign: 1 | -1
  /** ボタンや見出しに使う動詞（引く / 取り崩す） */
  verb?: string
  /** 金額欄の上に出す補足（貯めた額など） */
  info?: ReactNode
  onDeduct: (amount: number) => void
  /** 入力に応じた増減額を親に伝える。null で通常表示に戻す */
  onPreview: (delta: number | null) => void
  onClose: () => void
  /** 渡すと確定前に確認をはさむ（つもり貯金の取り崩し用） */
  confirmLabel?: (amount: number) => string
}

/**
 * 行の下にその場で開く引くパネル。
 * 確定前の増減は onPreview で親に渡し、画面上部の結果カードに反映させる。
 */
export default function InlineDeduct({
  remaining, accent, budgetSign, verb = '引く',
  info, onDeduct, onPreview, onClose, confirmLabel,
}: Props) {
  const [amount, setAmount] = useState(0)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState<number | null>(null)

  // 親の onPreview は毎レンダー変わるので、片付け用に ref で持つ
  const previewRef = useRef(onPreview)
  previewRef.current = onPreview
  useEffect(() => () => previewRef.current(null), [])

  function changeAmount(next: number) {
    setAmount(next)
    setError('')
    previewRef.current(next > 0 && next <= remaining ? next * budgetSign : null)
  }

  function submit() {
    const e = withinAmount(amount, remaining)()
    if (e) { setError(e); return }
    if (confirmLabel) { setConfirming(amount); return }
    onDeduct(amount)
    onClose()
  }

  return (
    <div className="inline-panel" style={{ borderColor: accent }}>
      {info && <div className="inline-info">{info}</div>}

      <div className="inline-amount">
        <span className="inline-amount-label">{verb}金額</span>
        <div className="inline-input" style={{ borderColor: accent }}>
          <input
            type="number"
            inputMode="numeric"
            value={amount || ''}
            onChange={e => changeAmount(Number(e.target.value))}
            placeholder="0"
            min={0}
          />
          <span className="inline-unit">円</span>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="inline-actions">
        <button className="btn-sub" onClick={onClose}>キャンセル</button>
        <button style={{ background: accent }} onClick={submit}>
          {amount > 0 && amount === remaining ? `全額${verb}` : `この金額で${verb}`}
        </button>
      </div>

      {confirming !== null && confirmLabel && (
        <ConfirmModal
          message={confirmLabel(confirming)}
          confirmText={verb}
          onCancel={() => setConfirming(null)}
          onConfirm={() => { onDeduct(confirming); setConfirming(null); onClose() }}
        />
      )}
    </div>
  )
}
