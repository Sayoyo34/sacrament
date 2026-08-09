import { useState } from 'react'
import ConfirmModal from './ConfirmModal'
import DetailModal, { DetailBlock, DetailRow } from './DetailModal'
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
  /** 'ジャンル' / 'タグ' など、エラー文に使う呼び名 */
  kind: string
  hint: string
  items: LabelItem[]
  withIcon: boolean
  prefix?: string          // タグ表示用の '#'
  accent: string
  onSave: (draft: LabelDraft) => void
  onRemove: (id: string) => void
}

/** ジャンル / タグの一覧。SubPage の中身として使う */
export default function LabelListPage({
  kind, hint, items, withIcon, prefix = '', accent, onSave, onRemove,
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
    const err = firstError(required(name, '名前'), notDuplicated(name, others, kind))
    if (err) { setError(err); return }
    onSave({ ...draft, name })
    setDraft(null)
    setError('')
  }

  return (
    <>
      <div className="subpage-action">
        <button style={{ background: accent, borderRadius: '999px', padding: '0.5rem 1.4rem' }} onClick={openNew}>
          追加
        </button>
      </div>

      <p className="summary" style={{ padding: '0 0.25rem 0.75rem' }}>{hint}</p>

      {items.length === 0 ? (
        <p className="empty-hint">まだありません<br />「追加」から作成できます</p>
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
                <span className="row-chevron">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <DetailModal
          icon={withIcon ? (draft.icon || '📦') : '🏷'}
          color={`${draft.color}55`}
          name={draft.name}
          onNameChange={v => setDraft({ ...draft, name: v })}
          namePlaceholder={withIcon ? '例: 遠征費' : '例: アイナナ'}
          onClose={() => { setDraft(null); setError('') }}
          onSave={save}
          error={error}
          onDelete={draft.id
            ? () => {
              const target = items.find(i => i.id === draft.id)
              if (target) setDeleteTarget(target)
            }
            : undefined}
        >
          {withIcon && (
            <DetailBlock icon="😊" label="アイコン">
              <IconSwatches
                value={draft.icon}
                onChange={icon => setDraft({ ...draft, icon })}
                accent={accent}
              />
            </DetailBlock>
          )}

          <DetailBlock icon="🎨" label="色">
            <ColorSwatches value={draft.color} onChange={color => setDraft({ ...draft, color })} />
          </DetailBlock>

          <DetailRow icon="👀" label="表示例">
            <span className="detail-value" style={{ color: draft.color, fontFamily: 'inherit' }}>
              {prefix}{draft.name || '（名前未入力）'}
            </span>
          </DetailRow>
        </DetailModal>
      )}

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
    </>
  )
}
