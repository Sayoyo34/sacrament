import { useState } from 'react'
import ConfirmModal from './ConfirmModal'
import DetailModal, { DetailBlock, DetailRow } from './DetailModal'
import EditableList, { EditToolbar, ReorderButton, type EditRow } from './EditableList'
import { useEditSession } from '../useEditSession'
import { ColorSwatches, IconSwatches } from './Swatches'
import { ICONS, PALETTE } from '../palette'
import { firstError, maxLength, notDuplicated, required } from '../validation'

/** ジャンルは一覧やグラフの凡例など狭い場所に出るため短め、タグは推し名など多少長くても遊べるように広め */
const GENRE_NAME_MAX = 8
const TAG_NAME_MAX = 20

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
  /** 'ジャンル' / 'タグ' など、エラー文や確認文に使う呼び名 */
  kind: string
  hint: string
  items: LabelItem[]
  withIcon: boolean
  prefix?: string          // タグ表示用の '#'
  accent: string
  onSave: (draft: LabelDraft) => void
  onRemove: (ids: string[]) => void
  onApplyEdit: (orderedIds: string[], removedIds: string[]) => void
}

/** ジャンル / タグの一覧。SubPage の中身として使う */
export default function LabelListPage({
  kind, hint, items, withIcon, prefix = '', accent, onSave, onRemove, onApplyEdit,
}: Props) {
  const [draft, setDraft] = useState<LabelDraft | null>(null)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [confirmSave, setConfirmSave] = useState(false)
  const session = useEditSession<LabelItem>()
  const nameMax = withIcon ? GENRE_NAME_MAX : TAG_NAME_MAX

  function openNew() {
    setError('')
    setDraft({ id: null, name: '', color: PALETTE[0], icon: withIcon ? ICONS[0] : '' })
  }

  /** true を返すと詳細表示に戻る。新規はそのまま閉じて一覧へ */
  function save() {
    if (!draft) return false
    const name = draft.name.trim().replace(/^#/, '')
    const others = items.filter(i => i.id !== draft.id).map(i => i.name)
    const err = firstError(required(name, '名前'), maxLength(name, nameMax, '名前'), notDuplicated(name, others, kind))
    if (err) { setError(err); return false }
    onSave({ ...draft, name })
    setError('')
    if (draft.id === null) { setDraft(null); return false }
    setDraft({ ...draft, name })
    return true
  }

  function commit() {
    onApplyEdit(session.draft.map(i => i.id), session.removed)
    session.cancel()
    setConfirmSave(false)
  }

  const label = (it: LabelItem) => (
    <>
      <span className="genre-dot" style={{ background: `${it.color}33`, width: 34, height: 34, fontSize: 17 }}>
        {withIcon ? it.icon : ''}
      </span>
      <span className="row-main">
        <span className="row-title" style={{ color: it.color }}>{prefix}{it.name}</span>
      </span>
    </>
  )

  const rows: EditRow[] = session.draft.map(it => ({ id: it.id, content: label(it) }))

  return (
    <>
      {session.editing ? (
        <EditToolbar
          selectedCount={session.selected.size}
          removedCount={session.removed.length}
          accent={accent}
          onCancel={session.cancel}
          onDelete={session.removeSelected}
          onDone={() => session.removed.length > 0 ? setConfirmSave(true) : commit()}
        />
      ) : (
        items.length > 1 && (
          <div className="subpage-action">
            <ReorderButton onClick={() => session.start(items)} />
          </div>
        )
      )}

      {!session.editing && <p className="summary" style={{ padding: '0 0.25rem 0.75rem' }}>{hint}</p>}

      {session.editing ? (
        <EditableList
          rows={rows}
          selected={session.selected}
          accent={accent}
          onToggle={session.toggle}
          onReorder={session.reorder}
        />
      ) : items.length === 0 ? (
        <p className="empty-hint">まだありません<br />+ボタンで追加できます</p>
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
                {label(it)}
                <span className="row-chevron">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!session.editing && (
        <div className="fab-row">
          <button
            className="fab"
            style={{ background: accent, boxShadow: `0 4px 14px ${accent}66` }}
            onClick={openNew}
          >
            +
          </button>
        </div>
      )}

      {draft && (
        <DetailModal
          icon={withIcon ? (draft.icon || '📦') : '🏷'}
          color={`${draft.color}55`}
          name={draft.name}
          onNameChange={v => setDraft({ ...draft, name: v })}
          namePlaceholder={withIcon ? '例: 遠征費' : '例: 推しの名前'}
          nameMaxLength={nameMax}
          onClose={() => { setDraft(null); setError('') }}
          onSave={save}
          startInEdit={draft.id === null}
          error={error}
          onDelete={draft.id ? () => setDeleteTarget(draft.id) : undefined}
        >
          <DetailBlock
            icon="😊"
            label="見た目"
            value={
              <span className="genre-dot" style={{ background: `${draft.color}33`, width: 40, height: 40, fontSize: 20 }}>
                {withIcon ? (draft.icon || '📦') : ''}
              </span>
            }
          >
            {withIcon && (
              <IconSwatches
                value={draft.icon}
                onChange={icon => setDraft({ ...draft, icon })}
                accent={accent}
              />
            )}
            <div style={{ marginTop: withIcon ? '0.75rem' : 0 }}>
              <ColorSwatches value={draft.color} onChange={color => setDraft({ ...draft, color })} />
            </div>
          </DetailBlock>

          <DetailRow icon="👀" label="表示例" value={null}>
            <span className="detail-value" style={{ color: draft.color, fontFamily: 'inherit' }}>
              {prefix}{draft.name || '（名前未入力）'}
            </span>
          </DetailRow>
        </DetailModal>
      )}

      {deleteTarget && (
        <ConfirmModal
          message={
            `${kind}「${items.find(i => i.id === deleteTarget)?.name ?? ''}」を削除します。`
            + (withIcon
              ? 'このジャンルが付いた項目は未設定に戻ります。よろしいですか？'
              : 'このタグが付いた項目から外れます。よろしいですか？')
          }
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onRemove([deleteTarget]); setDeleteTarget(null); setDraft(null) }}
        />
      )}

      {confirmSave && (
        <ConfirmModal
          message={
            `${session.removed.length}件の${kind}を削除して並び順を保存します。削除は取り消せません。よろしいですか？`
            + (withIcon ? '\nこのジャンルが付いた項目は未設定に戻ります。' : '\nこのタグが付いた項目から外れます。')
          }
          confirmText="保存する"
          onCancel={() => setConfirmSave(false)}
          onConfirm={commit}
        />
      )}
    </>
  )
}
