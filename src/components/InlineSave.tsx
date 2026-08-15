import { useState, type ReactNode } from 'react'
import type { GoalRow } from '../types'
import { firstError, positive } from '../validation'

interface Props {
  goal: GoalRow
  accent: string
  onSave: (amount: number) => void
  onClose: () => void
  /** この目標の直近の記録。取り消しの導線をパネル内に置くため */
  children?: ReactNode
}

/** よく使う額。貯める側は上限がないので固定でよい */
const PRESETS = [1000, 3000, 5000, 10000]

/**
 * 目標の行の下にその場で開く「貯める」パネル。
 * 行そのものが行き先なので、行き先を選ばせる手間がない。
 */
export default function InlineSave({ goal, accent, onSave, onClose, children }: Props) {
  const [amount, setAmount] = useState(0)
  const [error, setError] = useState('')

  const after = goal.kept + (amount > 0 ? amount : 0)
  const left = goal.targetAmount > 0 ? Math.max(0, goal.targetAmount - after) : 0

  function submit() {
    const e = firstError(positive(amount, '金額'))
    if (e) { setError(e); return }
    onSave(amount)
    onClose()
  }

  return (
    <div className="inline-panel" style={{ borderColor: accent }}>
      <div className="inline-amount">
        <span className="inline-amount-label">貯める金額</span>
        <div className="inline-input" style={{ borderColor: accent }}>
          <input
            type="number"
            inputMode="numeric"
            value={amount || ''}
            onChange={e => { setAmount(Number(e.target.value)); setError('') }}
            placeholder="0"
            min={0}
            autoFocus
          />
          <span className="inline-unit">円</span>
        </div>
      </div>

      <div className="inline-chips">
        {PRESETS.map(v => (
          <button
            key={v}
            className={`inline-chip${amount === v ? ' on' : ''}`}
            style={amount === v ? { borderColor: accent, color: accent } : undefined}
            onClick={() => { setAmount(v); setError('') }}
          >
            {v >= 10000 ? `${v / 10000}万` : `${v / 1000}千`}
          </button>
        ))}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="inline-preview">
        <span>
          貯めたあと
          {goal.targetAmount > 0 && amount > 0 && `（目標まであと ¥${left.toLocaleString()}）`}
        </span>
        <strong style={{ color: amount > 0 ? accent : 'var(--text-h)' }}>¥{after.toLocaleString()}</strong>
      </div>

      <div className="inline-actions">
        <button className="btn-sub" onClick={onClose}>キャンセル</button>
        <button style={{ background: accent }} onClick={submit}>貯める</button>
      </div>

      {children}
    </div>
  )
}
