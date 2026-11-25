import { useState, type ReactNode } from 'react'
import {
  PiArrowsClockwise, PiCalendarBlank, PiCoins, PiCreditCard,
  PiNotePencil, PiNotepad, PiPiggyBank, PiSquaresFour, PiTag,
} from 'react-icons/pi'
import type { Genre, GoalRow, PlanCategory, PlanItem, Tag, Wallet } from '../types'
import DetailModal, { DetailBlock, DetailRow, ReadValue } from '../components/DetailModal'
import ConfirmModal from '../components/ConfirmModal'
import CalcSummary, { type CalcSegment } from '../components/CalcSummary'
import InlineDeduct from '../components/InlineDeduct'
import { GenreDot, GenreSelect, TagList, TagPicker } from '../components/Pickers'
import type { LabelDraft } from '../components/LabelListPage'
import EditableList, { EditToolbar, ReorderButton, type EditRow } from '../components/EditableList'
import { useEditSession } from '../useEditSession'
import TopTabs from '../components/TopTabs'
import { useSwipeTabs } from '../useSwipeNav'
import { readableColor } from '../palette'
import { themeOf } from '../theme'
import { yen } from '../utils'
import { firstError, inRange, notNegative, required } from '../validation'

type Tab = 'list' | 'calc'

interface PlanDraft {
  id: string | null
  name: string
  category: PlanCategory
  estimatedCost: number
  dayOfMonth: number
  walletId: string
  genreId: string
  tagIds: string[]
  memo: string
}

interface Props {
  planItems: PlanItem[]
  wallets: Wallet[]
  genres: Genre[]
  tags: Tag[]
  totalBalance: number
  goalRows: GoalRow[]
  onSavePlan: (draft: PlanDraft) => void
  onRemovePlan: (id: string) => void
  onApplyPlanEdit: (orderedIds: string[], removedIds: string[]) => void
  onWithdrawSavings: (goalId: string, amount: number) => void
  onUndoWithdrawSavings: (goalId: string, amount: number) => void
  onSaveGenre: (draft: LabelDraft) => string
  onSaveTag: (draft: LabelDraft) => string
}

function Progress({ ratio, color }: { ratio: number; color: string }) {
  return (
    <span className="bar">
      <span className="bar-fill" style={{ width: `${Math.min(100, ratio * 100)}%`, background: color }} />
    </span>
  )
}

export default function PlansPage({
  planItems, wallets, genres, tags, totalBalance, goalRows,
  onSavePlan, onRemovePlan, onApplyPlanEdit,
  onWithdrawSavings, onUndoWithdrawSavings,
  onSaveGenre, onSaveTag,
}: Props) {
  const theme = themeOf('plans')
  const [tab, setTab] = useState<Tab>('list')
  function changeTab(t: Tab) {
    setTab(t)
    setEditing(null)
    setOpenId(null)
    setPreview(null)
    exitReorder()
  }
  const swipe = useSwipeTabs(['list', 'calc'] as const, tab, changeTab)
  const [editing, setEditing] = useState<PlanDraft | null>(null)   // 一覧タブ：内容の編集
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [editError, setEditError] = useState('')
  const [reordering, setReordering] = useState<PlanCategory | null>(null)
  const [confirmSave, setConfirmSave] = useState(false)
  const session = useEditSession<PlanItem>()

  // ── 計算タブの状態 ─────────────────────
  const [openId, setOpenId] = useState<string | null>(null)     // 貯金目標の取り崩しパネル（goal:〜）
  const [showBreakdown, setShowBreakdown] = useState(false)     // サマリーの内訳
  const [openSubs, setOpenSubs] = useState(false)
  const [openCredit, setOpenCredit] = useState(false)
  const [openSavings, setOpenSavings] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)   // 確定前の増減
  const [infoId, setInfoId] = useState<string | null>(null)     // 出費予定の情報シート

  function startReorder(category: PlanCategory, group: PlanItem[]) {
    setReordering(category)
    session.start(group)
  }

  function exitReorder() {
    setReordering(null)
    session.cancel()
  }

  function commitReorder() {
    onApplyPlanEdit(session.draft.map(p => p.id), session.removed)
    exitReorder()
    setConfirmSave(false)
  }

  const sorted = planItems.slice().sort((a, b) => a.order - b.order)
  const subs = sorted.filter(p => p.category === 'subscription')
  const credit = sorted.filter(p => p.category === 'credit')

  const subsTotal = subs.reduce((s, p) => s + p.estimatedCost, 0)
  const creditTotal = credit.reduce((s, p) => s + p.estimatedCost, 0)
  const planTotal = subsTotal + creditTotal
  const savingsKept = goalRows.reduce((s, g) => s + g.kept, 0)
  const remaining = totalBalance - planTotal - savingsKept

  // 差し引きの内訳。色はテーマ色の濃淡で揃え、画面全体の色数を増やさない
  const segments: CalcSegment[] = [
    { label: '出費予定（確定分）', amount: planTotal, color: theme.accent },
    { label: 'つもり貯金', amount: savingsKept, color: `color-mix(in srgb, ${theme.accent} 30%, #fff)` },
  ]
  const groupTint = `color-mix(in srgb, ${theme.accent} 15%, #fff)`

  const info = infoId ? planItems.find(p => p.id === infoId) ?? null : null
  const editGenre = genres.find(g => g.id === editing?.genreId)
  const infoGenre = genres.find(g => g.id === info?.genreId)

  function openRow(key: string) {
    setOpenId(prev => prev === key ? null : key)
    setPreview(null)
  }

  function openNew() {
    setEditError('')
    setEditing({
      id: null, name: '', category: 'subscription', estimatedCost: 0, dayOfMonth: 0,
      walletId: wallets[0]?.id ?? '', genreId: '', tagIds: [], memo: '',
    })
  }

  function openEdit(p: PlanItem) {
    setEditError('')
    setEditing({
      id: p.id, name: p.name, category: p.category, estimatedCost: p.estimatedCost,
      dayOfMonth: p.dayOfMonth, walletId: p.walletId, genreId: p.genreId,
      tagIds: p.tagIds, memo: p.memo,
    })
  }

  /** true を返すと詳細表示に戻る。新規はそのまま閉じて一覧へ */
  function saveEdit() {
    if (!editing) return false
    const error = firstError(
      required(editing.name, '名前'),
      notNegative(editing.estimatedCost, '金額'),
      // 引き落とし日は任意。入れるなら 1〜31
      () => editing.dayOfMonth !== 0 ? inRange(editing.dayOfMonth, 1, 31, '引き落とし日')() : null,
    )
    if (error) { setEditError(error); return false }
    onSavePlan({ ...editing, name: editing.name.trim() })
    setEditError('')
    if (editing.id === null) { setEditing(null); return false }
    setEditing({ ...editing, name: editing.name.trim() })
    return true
  }

  // ── 一覧タブ ───────────────────────────
  /** 行の中身。並び替え中は右側の金額を隠してハンドルの場所を空ける */
  function rowBody(p: PlanItem, compact: boolean) {
    return (
      <>
        <GenreDot genres={genres} genreId={p.genreId} fallback={p.category === 'credit' ? <PiCreditCard /> : <PiArrowsClockwise />} />
        <span className="row-main">
          <span className="row-title">
            {p.dayOfMonth > 0 ? `毎月${p.dayOfMonth}日 ` : ''}{p.name}
          </span>
          <span className="row-sub"><TagList tags={tags} ids={p.tagIds} /></span>
        </span>
        {!compact && <span className="row-right"><span className="row-amount">{p.estimatedCost.toLocaleString()}円</span></span>}
      </>
    )
  }

  function renderSection(category: PlanCategory, group: PlanItem[], title: string, emptyHint: string) {
    const inReorder = reordering === category
    const rows: EditRow[] = session.draft.map(p => ({ id: p.id, content: rowBody(p, true) }))
    const count = inReorder ? session.draft.length : group.length

    return (
      <>
        <div className="section-header">
          <h3>{title} ({count})</h3>
          {group.length > 1 && reordering === null && (
            <ReorderButton onClick={() => startReorder(category, group)} />
          )}
        </div>

        {inReorder && (
          <EditToolbar
            selectedCount={session.selected.size}
            removedCount={session.removed.length}
            accent={theme.accent}
            onCancel={exitReorder}
            onDelete={session.removeSelected}
            onDone={() => session.removed.length > 0 ? setConfirmSave(true) : commitReorder()}
          />
        )}

        {inReorder ? (
          <EditableList
            rows={rows}
            selected={session.selected}
            accent={theme.accent}
            onToggle={session.toggle}
            onReorder={session.reorder}
          />
        ) : group.length === 0 ? (
          <p className="empty-hint">{emptyHint}</p>
        ) : (
          <ul className="item-list">
            {group.map(p => (
              <li key={p.id}>
                <button className="row-card" onClick={() => openEdit(p)}>{rowBody(p, false)}</button>
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  // ── 計算タブ ───────────────────────────
  /** 取り崩し／戻すを行の下に開く貯金の行 */
  function renderGoalRow(g: GoalRow) {
    const key = `goal:${g.id || '__none'}`
    const open = openId === key

    return (
      <li key={g.id || '__none'}>
        <button
          className={`row-card${open ? ' expanded' : ''}`}
          style={open ? { borderColor: theme.accent } : undefined}
          onClick={() => openRow(key)}
        >
          <span className="genre-dot" style={{ background: `${g.color}33`, width: 34, height: 34, fontSize: 17 }}>
            {g.icon}
          </span>
          <span className="row-main">
            <span className="row-title">{g.name}</span>
            <Progress ratio={g.earned > 0 ? g.withdrawn / g.earned : 0} color={g.color} />
          </span>
          <span className="row-right">
            <span className="row-note">取崩 {g.withdrawn.toLocaleString()}円 / {g.earned.toLocaleString()}円</span>
            <span className="row-amount" style={{ color: readableColor(g.color) }}>残 {g.kept.toLocaleString()}円</span>
          </span>
          <span className="row-chevron">{open ? '⌃' : '⌄'}</span>
        </button>

        {open && (
          <InlineDeduct
            remaining={g.kept}
            done={g.withdrawn}
            accent={theme.accent}
            budget={remaining}
            budgetSign={1}
            deductVerb={{ now: '取り崩す', past: '取り崩した' }}
            info={
              <>
                <p className="summary">
                  貯めた額 {yen(g.earned)}　取り崩し済み {yen(g.withdrawn)}　残り {yen(g.kept)}
                  {g.targetAmount > 0 && `　目標 ${yen(g.targetAmount)}`}
                </p>
                <p className="summary">取り崩した分は取っておく額から外れ、その分だけ使える金額が増えます。</p>
              </>
            }
            onDeduct={amount => onWithdrawSavings(g.id, amount)}
            onUndo={amount => onUndoWithdrawSavings(g.id, amount)}
            onPreview={setPreview}
            onClose={() => setOpenId(null)}
            confirmLabel={amount =>
              `「${g.name}」から ${yen(amount)} を取り崩します。取っておくはずだったお金です。本当によろしいですか？`}
          />
        )}
      </li>
    )
  }

  /** 触らなくても自動で引かれているものを畳んでおくカード */
  function groupCard(
    icon: ReactNode, title: string, sub: string, amount: number,
    open: boolean, onToggle: () => void, children: ReactNode,
  ) {
    return (
      <li>
        <button className={`row-card${open ? ' group-open' : ''}`} onClick={onToggle}>
          <span className="genre-dot" style={{ background: groupTint, width: 34, height: 34, fontSize: 17 }}>
            {icon}
          </span>
          <span className="row-main">
            <span className="row-title">{title}</span>
            <span className="row-sub">{sub}</span>
          </span>
          <span className="row-amount">−{amount.toLocaleString()}円</span>
          <span className="row-chevron">{open ? '⌃' : '⌄'}</span>
        </button>
        {open && <ul className="item-list sub-list">{children}</ul>}
      </li>
    )
  }

  function planGroupRow(p: PlanItem) {
    return (
      <li key={p.id}>
        <button className="row-card" onClick={() => setInfoId(p.id)}>
          <GenreDot genres={genres} genreId={p.genreId} fallback={p.category === 'credit' ? <PiCreditCard /> : <PiArrowsClockwise />} />
          <span className="row-main">
            <span className="row-title">
              {p.dayOfMonth > 0 ? `毎月${p.dayOfMonth}日 ` : ''}{p.name}
            </span>
            <span className="row-sub">
              {wallets.find(w => w.id === p.walletId)?.name ?? '口座未設定'}
            </span>
          </span>
          <span className="row-amount">{p.estimatedCost.toLocaleString()}円</span>
        </button>
      </li>
    )
  }

  return (
    <div className="page">
      <TopTabs
        tabs={[{ id: 'list' as Tab, label: '出費予定' }, { id: 'calc' as Tab, label: '計算' }]}
        active={tab}
        onChange={changeTab}
        accent={theme.accent}
        soft={theme.soft}
      />

      <div className="page-scroll" {...swipe}>
        {tab === 'list' ? (
          <>
            {renderSection('subscription', subs, 'サブスク', '定期支出の登録がありません')}
            {renderSection('credit', credit, 'クレカ後払い', 'まだ登録がありません')}
            <p className="summary" style={{ padding: '0 0.25rem' }}>
              いつ買うか決めていないものは「貯金」タブの貯金目標から貯められます
            </p>
            <div className="fab-row">
              <button
                className="fab"
                style={{ background: theme.accent, boxShadow: `0 4px 14px ${theme.accent}66` }}
                onClick={openNew}
              >
                +
              </button>
            </div>
          </>
        ) : (
          <>
            <CalcSummary
              totalBalance={totalBalance}
              remaining={remaining}
              segments={segments}
              unspent={0}
              preview={preview}
              open={showBreakdown}
              onToggle={() => setShowBreakdown(v => !v)}
            />

            {(planItems.length > 0 || goalRows.length > 0) && (
              <>
                <div className="section-header">
                  <h3>自動で引かれているもの</h3>
                  <span className="section-hint">タップで内訳</span>
                </div>
                <ul className="item-list">
                  {subs.length > 0 && groupCard(
                    <PiArrowsClockwise />,
                    `サブスク  ${subs.length}件`,
                    '常に全額が引かれます',
                    subsTotal,
                    openSubs,
                    () => setOpenSubs(v => !v),
                    subs.map(planGroupRow),
                  )}

                  {credit.length > 0 && groupCard(
                    <PiCreditCard />,
                    `クレカ後払い  ${credit.length}件`,
                    '確定した請求額が引かれます',
                    creditTotal,
                    openCredit,
                    () => setOpenCredit(v => !v),
                    credit.map(planGroupRow),
                  )}

                  {goalRows.length > 0 && groupCard(
                    <PiPiggyBank />,
                    `つもり貯金  ${goalRows.length}件`,
                    '取り崩すと使える金額が増えます',
                    savingsKept,
                    openSavings,
                    () => setOpenSavings(v => !v),
                    goalRows.map(renderGoalRow),
                  )}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {/* 一覧タブ：内容の編集のみ */}
      {editing && (
        <DetailModal
          icon={editGenre?.icon ?? (editing.category === 'credit' ? <PiCreditCard /> : <PiNotepad />)}
          color={editGenre ? `${editGenre.color}55` : theme.soft}
          name={editing.name}
          onNameChange={v => setEditing({ ...editing, name: v })}
          namePlaceholder={editing.category === 'credit' ? '例: 楽天カード' : '例: Netflix'}
          onClose={() => { setEditing(null); setEditError('') }}
          onSave={saveEdit}
          startInEdit={editing.id === null}
          error={editError}
          onDelete={editing.id ? () => setDeleteTarget({ id: editing.id!, name: editing.name }) : undefined}
        >
          <DetailRow
            icon={<PiArrowsClockwise />}
            label="種類"
            value={<ReadValue>{editing.category === 'credit' ? 'クレカ後払い' : 'サブスク'}</ReadValue>}
          >
            <div className="type-toggle">
              <button
                className={editing.category !== 'subscription' ? 'btn-sub' : ''}
                onClick={() => setEditing({ ...editing, category: 'subscription' })}
              >サブスク</button>
              <button
                className={editing.category !== 'credit' ? 'btn-sub' : ''}
                onClick={() => setEditing({ ...editing, category: 'credit' })}
              >クレカ後払い</button>
            </div>
          </DetailRow>

          <DetailRow
            icon={<PiCoins />}
            label={editing.category === 'credit' ? '確定額' : '金額'}
            value={<ReadValue>{yen(editing.estimatedCost)}</ReadValue>}
          >
            <input
              type="number"
              value={editing.estimatedCost || ''}
              onChange={e => setEditing({ ...editing, estimatedCost: Number(e.target.value) })}
              placeholder="0"
              min={0}
            />
            {editing.category === 'credit' && (
              <p className="summary" style={{ marginTop: '0.5rem' }}>
                請求が確定したら、ここの金額を更新してください
              </p>
            )}
          </DetailRow>

          <DetailRow
            icon={<PiCalendarBlank />}
            label="引き落とし日"
            value={
              <ReadValue muted={editing.dayOfMonth === 0}>
                {editing.dayOfMonth > 0 ? `毎月${editing.dayOfMonth}日` : '未設定'}
              </ReadValue>
            }
          >
            <input
              type="number"
              value={editing.dayOfMonth || ''}
              onChange={e => setEditing({ ...editing, dayOfMonth: Number(e.target.value) })}
              placeholder="毎月◯日（任意）"
              min={1}
              max={31}
            />
          </DetailRow>

          <DetailRow
            icon={<PiCreditCard />}
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
              accent={theme.accent} onCreate={g => onSaveGenre({ id: null, ...g })}
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
              accent={theme.accent} onCreate={t => onSaveTag({ id: null, name: t.name, color: t.color, icon: '' })}
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

      {/* 計算タブ：出費予定の詳細（金額は変えられない） */}
      {info && (
        <DetailModal
          icon={infoGenre?.icon ?? (info.category === 'credit' ? <PiCreditCard /> : <PiNotepad />)}
          color={infoGenre ? `${infoGenre.color}55` : theme.soft}
          name={info.name}
          onClose={() => setInfoId(null)}
        >
          <DetailRow icon={<PiCoins />} label={info.category === 'credit' ? '確定額' : '金額'}>
            <span className="detail-value">{yen(info.estimatedCost)}</span>
          </DetailRow>
          {info.dayOfMonth > 0 && (
            <DetailRow icon={<PiCalendarBlank />} label="引き落とし日">
              <span className="detail-value">毎月{info.dayOfMonth}日</span>
            </DetailRow>
          )}
          {info.walletId && (
            <DetailRow icon={<PiCreditCard />} label="口座">
              <span className="detail-value">{wallets.find(w => w.id === info.walletId)?.name ?? '未設定'}</span>
            </DetailRow>
          )}
          <p className="summary" style={{ padding: '0.5rem 0.25rem' }}>
            出費予定は常に全額が差し引かれます。内容の変更は「出費予定」タブから行えます。
          </p>
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
          message={`${session.removed.length}件の予定を削除して並び順を保存します。削除は取り消せません。よろしいですか？`}
          confirmText="保存する"
          onCancel={() => setConfirmSave(false)}
          onConfirm={commitReorder}
        />
      )}
    </div>
  )
}

export type { PlanDraft }
