import { useState } from 'react'
import {
  PiArrowsClockwise, PiCalendarBlank, PiCoins, PiNotePencil, PiNotepad,
  PiSquaresFour, PiTag, PiWallet,
} from 'react-icons/pi'
import type { Genre, PlanItem, Tag, Wallet } from '../types'
import DetailModal, { DetailBlock, DetailRow, ReadValue } from './DetailModal'
import ConfirmModal from './ConfirmModal'
import { GenreDot, GenreSelect, TagList, TagPicker } from './Pickers'
import type { LabelDraft } from './LabelListPage'
import EditableList, { EditToolbar, ReorderButton, type EditRow } from './EditableList'
import { useEditSession } from '../useEditSession'
import { paymentLabel, shortDateText, type PlanDraft } from '../plans'
import { yen } from '../utils'
import { firstError, inRange, notNegative, required } from '../validation'

interface Props {
  planItems: PlanItem[]
  wallets: Wallet[]
  genres: Genre[]
  tags: Tag[]
  accent: string
  soft: string
  onSavePlan: (draft: PlanDraft) => void
  onRemovePlan: (id: string) => void
  onApplyPlanEdit: (orderedIds: string[], removedIds: string[]) => void
  onSaveGenre: (draft: LabelDraft) => string
  onSaveTag: (draft: LabelDraft) => string
}

/** 「その他」から開く定期支出の登録・編集。計算は「予定」タブ、今月分は家計簿の上部で見る */
export default function PlanListPage({
  planItems, wallets, genres, tags, accent, soft,
  onSavePlan, onRemovePlan, onApplyPlanEdit, onSaveGenre, onSaveTag,
}: Props) {
  const [editing, setEditing] = useState<PlanDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [editError, setEditError] = useState('')
  const [confirmSave, setConfirmSave] = useState(false)
  const session = useEditSession<PlanItem>()

  const subs = planItems.slice().sort((a, b) => a.order - b.order).filter(p => p.category === 'subscription')
  const monthlyTotal = subs.reduce((s, p) => s + (p.frequency === 'yearly' ? p.estimatedCost / 12 : p.estimatedCost), 0)
  const editGenre = genres.find(g => g.id === editing?.genreId)

  function commitReorder() {
    onApplyPlanEdit(session.draft.map(p => p.id), session.removed)
    session.cancel()
    setConfirmSave(false)
  }

  function openNew() {
    setEditError('')
    setEditing({
      id: null, name: '', category: 'subscription', estimatedCost: 0,
      frequency: 'monthly', month: 0, dayOfMonth: 0,
      walletId: wallets[0]?.id ?? '', genreId: '', tagIds: [], memo: '',
    })
  }

  function openEdit(p: PlanItem) {
    setEditError('')
    setEditing({
      id: p.id, name: p.name, category: p.category, estimatedCost: p.estimatedCost,
      frequency: p.frequency, month: p.month, dayOfMonth: p.dayOfMonth, walletId: p.walletId, genreId: p.genreId,
      tagIds: p.tagIds, memo: p.memo,
    })
  }

  /** true を返すと詳細表示に戻る。新規はそのまま閉じて一覧へ */
  function saveEdit() {
    if (!editing) return false
    const error = firstError(
      required(editing.name, '名前'),
      notNegative(editing.estimatedCost, '金額'),
      // 支払い日・支払い月はどちらも任意。入れるならそれぞれ 1〜31 / 1〜12
      () => editing.dayOfMonth !== 0 ? inRange(editing.dayOfMonth, 1, 31, '支払い日')() : null,
      () => editing.frequency === 'yearly' && editing.month !== 0 ? inRange(editing.month, 1, 12, '支払い月')() : null,
    )
    if (error) { setEditError(error); return false }
    onSavePlan({ ...editing, name: editing.name.trim() })
    setEditError('')
    if (editing.id === null) { setEditing(null); return false }
    setEditing({ ...editing, name: editing.name.trim() })
    return true
  }

  /** 行の中身。並び替え中は右側の金額を隠してハンドルの場所を空ける */
  function rowBody(p: PlanItem, compact: boolean) {
    return (
      <>
        <GenreDot genres={genres} genreId={p.genreId} fallback={<PiArrowsClockwise />} />
        <span className="row-main">
          <span className="row-title">{p.name}</span>
          <span className="row-sub">
            {paymentLabel(p)}
            <TagList tags={tags} ids={p.tagIds} />
          </span>
        </span>
        {!compact && <span className="row-right"><span className="row-amount">{p.estimatedCost.toLocaleString()}円</span></span>}
      </>
    )
  }

  const rows: EditRow[] = session.draft.map(p => ({ id: p.id, content: rowBody(p, true) }))

  return (
    <>
      <p className="summary" style={{ padding: '0 0.25rem 0.5rem', lineHeight: 1.7 }}>
        毎月・毎年決まって出ていくお金を登録します。合計は「予定」タブの計算で差し引かれます。
      </p>

      <div className="section-header">
        <h3>定期支出 ({session.editing ? session.draft.length : subs.length})</h3>
        {subs.length > 1 && !session.editing && <ReorderButton onClick={() => session.start(subs)} />}
      </div>

      {session.editing && (
        <EditToolbar
          selectedCount={session.selected.size}
          removedCount={session.removed.length}
          accent={accent}
          onCancel={session.cancel}
          onDelete={session.removeSelected}
          onDone={() => session.removed.length > 0 ? setConfirmSave(true) : commitReorder()}
        />
      )}

      {session.editing ? (
        <EditableList
          rows={rows}
          selected={session.selected}
          accent={accent}
          onToggle={session.toggle}
          onReorder={session.reorder}
        />
      ) : subs.length === 0 ? (
        <p className="empty-hint">定期支出の登録がありません<br />+ボタンで追加できます</p>
      ) : (
        <>
          <ul className="item-list">
            {subs.map(p => (
              <li key={p.id}>
                <button className="row-card" onClick={() => openEdit(p)}>{rowBody(p, false)}</button>
              </li>
            ))}
          </ul>
          <p className="summary" style={{ padding: '0.4rem 0.25rem 0' }}>
            月あたり 約{yen(Math.round(monthlyTotal))}（毎年のものは12で割って計算）
          </p>
        </>
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

      {editing && (
        <DetailModal
          icon={editGenre?.icon ?? <PiNotepad />}
          color={editGenre ? `${editGenre.color}55` : soft}
          name={editing.name}
          onNameChange={v => setEditing({ ...editing, name: v })}
          namePlaceholder="例: Netflix"
          onClose={() => { setEditing(null); setEditError('') }}
          onSave={saveEdit}
          startInEdit={editing.id === null}
          error={editError}
          onDelete={editing.id ? () => setDeleteTarget({ id: editing.id!, name: editing.name }) : undefined}
        >
          <DetailRow icon={<PiCoins />} label="金額" value={<ReadValue>{yen(editing.estimatedCost)}</ReadValue>}>
            <input
              type="number"
              value={editing.estimatedCost || ''}
              onChange={e => setEditing({ ...editing, estimatedCost: Number(e.target.value) })}
              placeholder="0"
              min={0}
            />
          </DetailRow>

          <DetailRow
            icon={<PiArrowsClockwise />}
            label="頻度"
            value={<ReadValue>{editing.frequency === 'yearly' ? '毎年' : '毎月'}</ReadValue>}
          >
            <div className="type-toggle">
              <button
                className={editing.frequency !== 'monthly' ? 'btn-sub' : ''}
                onClick={() => setEditing({ ...editing, frequency: 'monthly', month: 0 })}
              >毎月</button>
              <button
                className={editing.frequency !== 'yearly' ? 'btn-sub' : ''}
                onClick={() => setEditing({ ...editing, frequency: 'yearly' })}
              >毎年</button>
            </div>
          </DetailRow>

          <DetailRow
            icon={<PiCalendarBlank />}
            label="支払い日"
            value={<ReadValue muted={editing.dayOfMonth === 0 && editing.month === 0}>{shortDateText(editing)}</ReadValue>}
          >
            {editing.frequency === 'yearly' && (
              <select
                value={editing.month}
                onChange={e => setEditing({ ...editing, month: Number(e.target.value) })}
                style={{ marginBottom: '0.5rem' }}
              >
                <option value={0}>月を選択（任意）</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            )}
            <input
              type="number"
              value={editing.dayOfMonth || ''}
              onChange={e => setEditing({ ...editing, dayOfMonth: Number(e.target.value) })}
              placeholder={editing.frequency === 'yearly' ? '日（任意）' : '毎月◯日（任意）'}
              min={1}
              max={31}
            />
          </DetailRow>

          <DetailRow
            icon={<PiWallet />}
            label="口座"
            value={
              <ReadValue muted={!editing.walletId}>
                {wallets.find(w => w.id === editing.walletId)?.name ?? '未設定'}
              </ReadValue>
            }
          >
            <select value={editing.walletId} onChange={e => setEditing({ ...editing, walletId: e.target.value })}>
              <option value="">未設定</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </DetailRow>

          <DetailRow
            icon={<PiSquaresFour />}
            label="ジャンル"
            value={
              <ReadValue muted={!editGenre}>
                {editGenre ? `${editGenre.icon} ${editGenre.name}` : '未設定'}
              </ReadValue>
            }
          >
            <GenreSelect
              genres={genres} value={editing.genreId} onChange={v => setEditing({ ...editing, genreId: v })}
              accent={accent} onCreate={g => onSaveGenre({ id: null, ...g })}
            />
          </DetailRow>

          <DetailBlock
            icon={<PiTag />}
            label="タグ"
            value={editing.tagIds.length > 0
              ? <TagList tags={tags} ids={editing.tagIds} />
              : <span className="summary">なし</span>}
          >
            <TagPicker
              tags={tags} value={editing.tagIds} onChange={ids => setEditing({ ...editing, tagIds: ids })}
              accent={accent} onCreate={t => onSaveTag({ id: null, name: t.name, color: t.color, icon: '' })}
            />
          </DetailBlock>

          <DetailBlock
            icon={<PiNotePencil />}
            label="メモ"
            value={<p className={editing.memo ? 'detail-memo' : 'summary'}>{editing.memo || 'なし'}</p>}
          >
            <textarea
              value={editing.memo}
              onChange={e => setEditing({ ...editing, memo: e.target.value })}
              placeholder="メモを追加..."
              rows={4}
            />
          </DetailBlock>
        </DetailModal>
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`「${deleteTarget.name}」を削除します。よろしいですか？`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onRemovePlan(deleteTarget.id); setDeleteTarget(null); setEditing(null) }}
        />
      )}

      {confirmSave && (
        <ConfirmModal
          message={`${session.removed.length}件の定期支出を削除して並び順を保存します。削除は取り消せません。よろしいですか？`}
          confirmText="保存する"
          onCancel={() => setConfirmSave(false)}
          onConfirm={commitReorder}
        />
      )}
    </>
  )
}
