import { useState } from 'react'
import ConfirmModal from './ConfirmModal'
import { DetailRow } from './DetailModal'
import { ColorSwatches, IconSwatches } from './Swatches'
import { ICONS, PALETTE } from '../palette'
import { firstError, notDuplicated, required } from '../validation'

export interface LabelItem {
  id: string
  name: string
  color: string
  icon?: string
}

export interface LabelDraft {
  id: string | null
  name: string
  color: string
  icon: string
}

interface Props {
  title: string
  hint: string
  items: LabelItem[]
  withIcon: boolean
  prefix?: string          // タグ表示用の '#'
  accent: string
  soft: string
  onSave: (draft: LabelDraft) => void
  onRemove: (id: string) => void
  onClose: () => void
}

/** ジャンル / タグの一覧・追加・編集・削除を行うシート */
export default function LabelManager({
  title, hint, items, withIcon, prefix = '', accent, soft, onSave, onRemove, onClose,
}: Props) {
  const [draft, setDraft] = useState<LabelDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LabelItem | null>(null)
  const [error, setError] = useState('')

  function openNew() {
    setError('')
    setDraft({ id: null, name: '', color: PALETTE[0], icon: withIcon ? ICONS[0] : '' })
  }

  function save() {
    if (!draft) return
    const name = draft.name.trim().replace(/^#/, '')
    const others = items.filter(i => i.id !== draft.id).map(i => i.name)
    const err = firstError(
      required(name, '名前'),
      notDuplicated(name, others, title.replace('管理', '')),
    )
    if (err) { setError(err); return }
    onSave({ ...draft, name })
    setDraft(null)
    setError('')
  }

  return (
    <div className="modal-overlay detail-overlay" onClick={onClose}>
      <div className="detail-sheet" onClick={e => e.stopPropagation()}>
        <div className="detail-head" style={{ background: soft }}>
          <div className="detail-head-bar">
            <button className="icon-btn" onClick={onClose} aria-label="閉じる">✕</button>
            <button className="detail-save" style={{ background: accent }} onClick={openNew}>＋ 追加</button>
          </div>
          <div className="detail-title-row">
            <span className="detail-name" style={{ fontSize: '1.15rem', fontWeight: 700 }}>{title}</span>
          </div>
        </div>

        <div className="detail-body">
          <p className="summary" style={{ padding: '0 0.25rem 0.75rem' }}>{hint}</p>

          {items.length === 0 ? (
            <p className="empty-hint">まだありません<br />右上の「＋ 追加」から作成できます</p>
          ) : (
            <ul className="item-list">
              {items.map(it => (
                <li key={it.id}>
                  <button
                    className="row-card"
                    onClick={() => {
                      setError('')
                      setDraft({ id: it.id, name: it.name, color: it.color, icon: it.icon ?? '' })
                    }}
                  >
                    <span
                      className="genre-dot"
                      style={{ background: `${it.color}33`, width: 34, height: 34, fontSize: 17 }}
                    >
                      {withIcon ? it.icon : ''}
                    </span>
                    <span className="row-main">
                      <span className="row-title" style={{ color: it.color }}>{prefix}{it.name}</span>
                    </span>
                    <span className="row-note">{it.color}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {draft && (
            <div className="card" style={{ marginTop: '0.5rem' }}>
              <div className="modal-title">{draft.id ? '編集' : '新規作成'}</div>

              {error && <p className="form-error" role="alert">{error}</p>}

              <DetailRow icon="✏️" label="名前">
                <input
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  placeholder={withIcon ? '例: 遠征費' : '例: アイナナ'}
                  autoFocus
                />
              </DetailRow>

              {withIcon && (
                <div className="detail-block">
                  <div className="detail-row" style={{ borderBottom: 'none', padding: 0, margin: 0, background: 'none', boxShadow: 'none' }}>
                    <span className="detail-row-icon">😊</span>
                    <span className="detail-row-label">アイコン</span>
                  </div>
                  <div className="detail-block-body">
                    <IconSwatches
                      value={draft.icon}
                      onChange={icon => setDraft({ ...draft, icon })}
                      accent={accent}
                    />
                  </div>
                </div>
              )}

              <div className="detail-block">
                <div className="detail-row" style={{ borderBottom: 'none', padding: 0, margin: 0, background: 'none', boxShadow: 'none' }}>
                  <span className="detail-row-icon">🎨</span>
                  <span className="detail-row-label">色</span>
                </div>
                <div className="detail-block-body">
                  <ColorSwatches value={draft.color} onChange={color => setDraft({ ...draft, color })} />
                </div>
              </div>

              <div className="form-actions">
                <button className="btn-sub" onClick={() => setDraft(null)}>キャンセル</button>
                {draft.id && (
                  <button
                    className="btn-danger"
                    onClick={() => {
                      const target = items.find(i => i.id === draft.id)
                      if (target) setDeleteTarget(target)
                    }}
                  >
                    削除
                  </button>
                )}
                <button style={{ background: accent }} onClick={save}>保存</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          message={
            withIcon
              ? `ジャンル「${deleteTarget.name}」を削除します。このジャンルが付いた項目は未設定に戻ります。よろしいですか？`
              : `タグ「${deleteTarget.name}」を削除します。このタグが付いた項目から外れます。よろしいですか？`
          }
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onRemove(deleteTarget.id); setDeleteTarget(null); setDraft(null) }}
        />
      )}
    </div>
  )
}
