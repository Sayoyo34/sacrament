import { useState } from 'react'
import ConfirmModal from './ConfirmModal'
import { DetailRow } from './DetailModal'

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

const PALETTE = [
  '#f472b6', '#fb923c', '#fbbf24', '#34d399', '#2dd4bf',
  '#60a5fa', '#a78bfa', '#f87171', '#94a3b8', '#c084fc',
]

const ICONS = [
  '💎', '🎁', '🎫', '🚄', '🍰', '🏠', '📦', '🎮',
  '📚', '💊', '👕', '☕', '🎤', '🎬', '✈️', '🐾',
]

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

  function openNew() {
    setDraft({ id: null, name: '', color: PALETTE[0], icon: withIcon ? ICONS[0] : '' })
  }

  function save() {
    if (!draft || !draft.name.trim()) return
    onSave({ ...draft, name: draft.name.trim().replace(/^#/, '') })
    setDraft(null)
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
                    onClick={() => setDraft({ id: it.id, name: it.name, color: it.color, icon: it.icon ?? '' })}
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
                    <div className="swatch-grid">
                      {ICONS.map(ic => (
                        <button
                          key={ic}
                          className={`icon-swatch${draft.icon === ic ? ' on' : ''}`}
                          style={draft.icon === ic ? { borderColor: accent } : undefined}
                          onClick={() => setDraft({ ...draft, icon: ic })}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                    <input
                      value={draft.icon}
                      onChange={e => setDraft({ ...draft, icon: e.target.value })}
                      placeholder="好きな絵文字を直接入力"
                      style={{ marginTop: '0.5rem' }}
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
                  <div className="swatch-grid">
                    {PALETTE.map(c => (
                      <button
                        key={c}
                        className={`color-swatch${draft.color.toLowerCase() === c ? ' on' : ''}`}
                        style={{ background: c }}
                        onClick={() => setDraft({ ...draft, color: c })}
                        aria-label={c}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={draft.color}
                    onChange={e => setDraft({ ...draft, color: e.target.value })}
                    style={{ marginTop: '0.5rem', height: '40px', padding: '0.2rem' }}
                  />
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
