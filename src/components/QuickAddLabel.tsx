import { useState } from 'react'
import { ColorSwatches, IconSwatches } from './Swatches'
import { ICONS, PALETTE } from '../palette'
import { firstError, maxLength, notDuplicated, required } from '../validation'

interface Props {
  /** 'ジャンル' / 'タグ' など、エラー文に使う呼び名 */
  kind: string
  withIcon: boolean
  nameMax: number
  existingNames: string[]
  accent: string
  onCancel: () => void
  onCreate: (draft: { name: string; icon: string; color: string }) => void
}

/**
 * 家計簿などの項目を追加する途中で、ジャンル/タグをその場で新規作成するための小さいシート。
 * 「その他 > ジャンル/タグ管理」の作成フォームと同じ項目（名前・アイコン・色）を出す。
 */
export default function QuickAddLabel({ kind, withIcon, nameMax, existingNames, accent, onCancel, onCreate }: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(withIcon ? ICONS[0] : '')
  const [color, setColor] = useState(PALETTE[0])
  const [error, setError] = useState('')

  function submit() {
    const trimmed = name.trim().replace(/^#/, '')
    const err = firstError(
      required(trimmed, '名前'),
      maxLength(trimmed, nameMax, '名前'),
      notDuplicated(trimmed, existingNames, kind),
    )
    if (err) { setError(err); return }
    onCreate({ name: trimmed, icon, color })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">{kind}を追加</div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="form-row">
          <label htmlFor="quick-add-name">名前</label>
          <input
            id="quick-add-name"
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder={withIcon ? '例: 遠征費' : '例: 推しの名前'}
            maxLength={nameMax}
            autoFocus
          />
        </div>

        {withIcon && (
          <div className="form-row">
            <label>アイコン</label>
            <IconSwatches value={icon} onChange={setIcon} accent={accent} />
          </div>
        )}

        <div className="form-row">
          <label>色</label>
          <ColorSwatches value={color} onChange={setColor} />
        </div>

        <div className="form-actions">
          <button className="btn-sub" onClick={onCancel}>キャンセル</button>
          <button style={{ background: accent }} onClick={submit}>追加する</button>
        </div>
      </div>
    </div>
  )
}
