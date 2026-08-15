import { useEffect, useRef, useState, type ReactNode } from 'react'
import ConfirmModal from './ConfirmModal'
import { withinAmount } from '../validation'

/** 動詞の活用ぶんだけ持つ。「引く」→「引いたあと残るお金」 */
interface Verb {
  now: string   // 引く / 切り崩す / 戻す
  past: string  // 引いた / 切り崩した / 戻した
}

type Mode = 'deduct' | 'undo'

interface Props {
  /** まだ引ける額 */
  remaining: number
  /** 引き済み（＝戻せる額） */
  done: number
  accent: string
  /** 現在の「このあと使える金額」。プレビューの土台 */
  budget: number
  /** 引く操作が使える金額に与える符号。予定は −1、つもり貯金の切り崩しは +1 */
  budgetSign: 1 | -1
  deductVerb?: Verb
  /** 金額欄の上に出す補足（貯めた額・残りなど） */
  info?: ReactNode
  onDeduct: (amount: number) => void
  onUndo: (amount: number) => void
  /** 入力に応じた増減額を親に伝える。null で通常表示に戻す */
  onPreview: (delta: number | null) => void
  onClose: () => void
  /** 渡すと確定前に確認をはさむ（つもり貯金の切り崩し用） */
  confirmLabel?: (amount: number) => string
}

const UNDO: Verb = { now: '戻す', past: '戻した' }

/**
 * 行の下にその場で開く引く／戻すパネル。
 * 確定前に「このあといくら残るか」を出して、結果を見ながら金額を決められるようにする。
 */
export default function InlineDeduct({
  remaining, done, accent, budget, budgetSign,
  deductVerb = { now: '引く', past: '引いた' },
  info, onDeduct, onUndo, onPreview, onClose, confirmLabel,
}: Props) {
  const canDeduct = remaining > 0
  const [mode, setMode] = useState<Mode>(canDeduct ? 'deduct' : 'undo')
  const [amount, setAmount] = useState(0)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState<number | null>(null)

  // 親の onPreview は毎レンダー変わるので、片付け用に ref で持つ
  const previewRef = useRef(onPreview)
  previewRef.current = onPreview
  useEffect(() => () => previewRef.current(null), [])

  const verb = mode === 'deduct' ? deductVerb : UNDO
  const max = mode === 'deduct' ? remaining : done
  const sign = mode === 'deduct' ? budgetSign : -budgetSign
  const valid = amount > 0 && amount <= max
  const after = budget + (valid ? amount * sign : 0)

  function changeAmount(next: number) {
    setAmount(next)
    setError('')
    previewRef.current(next > 0 && next <= max ? next * sign : null)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setAmount(0)
    setError('')
    previewRef.current(null)
  }

  function submit() {
    const e = withinAmount(amount, max)()
    if (e) { setError(e); return }
    if (mode === 'deduct' && confirmLabel) { setConfirming(amount); return }
    if (mode === 'deduct') onDeduct(amount)
    else onUndo(amount)
    onClose()
  }

  // 全額・半分・よく使う額。重複と上限超えは落とす
  const presets = [
    { label: '全額', value: max },
    { label: '半分', value: Math.round(max / 2) },
    { label: '1万', value: 10000 },
    { label: '5千', value: 5000 },
  ].filter((p, i, all) => p.value > 0 && p.value <= max && all.findIndex(q => q.value === p.value) === i)

  return (
    <div className="inline-panel" style={{ borderColor: accent }}>
      {info && <div className="inline-info">{info}</div>}

      {canDeduct && done > 0 && (
        <div className="inline-modes">
          <button
            className={mode === 'deduct' ? '' : 'btn-sub'}
            style={mode === 'deduct' ? { background: accent } : undefined}
            onClick={() => switchMode('deduct')}
          >
            {deductVerb.now}
          </button>
          <button
            className={mode === 'undo' ? '' : 'btn-sub'}
            style={mode === 'undo' ? { background: accent } : undefined}
            onClick={() => switchMode('undo')}
          >
            戻す
          </button>
        </div>
      )}

      <div className="inline-amount">
        <span className="inline-amount-label">{verb.now}金額</span>
        <div className="inline-input" style={{ borderColor: accent }}>
          <input
            type="number"
            inputMode="numeric"
            value={amount || ''}
            onChange={e => changeAmount(Number(e.target.value))}
            placeholder="0"
            min={0}
            autoFocus
          />
          <span className="inline-unit">円</span>
        </div>
      </div>

      {presets.length > 0 && (
        <div className="inline-chips">
          {presets.map(p => (
            <button
              key={p.label}
              className={`inline-chip${amount === p.value ? ' on' : ''}`}
              style={amount === p.value ? { borderColor: accent, color: accent } : undefined}
              onClick={() => changeAmount(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="inline-preview">
        <span>{verb.past}あと残るお金</span>
        <strong style={{ color: valid ? accent : 'var(--text-h)' }}>¥{after.toLocaleString()}</strong>
      </div>

      <div className="inline-actions">
        <button className="btn-sub" onClick={onClose}>キャンセル</button>
        <button style={{ background: accent }} onClick={submit}>
          {amount > 0 && amount === max ? `全額${verb.now}` : `この金額で${verb.now}`}
        </button>
      </div>

      {confirming !== null && confirmLabel && (
        <ConfirmModal
          message={confirmLabel(confirming)}
          confirmText={deductVerb.now}
          onCancel={() => setConfirming(null)}
          onConfirm={() => { onDeduct(confirming); setConfirming(null); onClose() }}
        />
      )}
    </div>
  )
}
