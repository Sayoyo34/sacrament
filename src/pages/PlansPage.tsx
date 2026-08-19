import { useState, type ReactNode } from 'react'
import type { Genre, GoalRow, PlanItem, PlanKind, Tag, Wallet } from '../types'
import DetailModal, { DetailBlock, DetailRow, ReadValue } from '../components/DetailModal'
import ConfirmModal from '../components/ConfirmModal'
import CalcSummary, { type CalcSegment } from '../components/CalcSummary'
import InlineDeduct from '../components/InlineDeduct'
import { GenreDot, GenreSelect, TagList, TagPicker } from '../components/Pickers'
import type { LabelDraft } from '../components/LabelListPage'
import EditableList, { EditToolbar, ReorderButton, type EditRow } from '../components/EditableList'
import { useEditSession } from '../useEditSession'
import TopTabs from '../components/TopTabs'
import { readableColor } from '../palette'
import { themeOf } from '../theme'
import { yen } from '../utils'
import { firstError, inRange, notNegative, required } from '../validation'

type Tab = 'list' | 'calc'

interface PlanDraft {
  id: string | null
  name: string
  kind: PlanKind
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
  onDeduct: (id: string, amount: number) => void
  onUndoDeduct: (id: string, amount: number) => void
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
  onDeduct, onUndoDeduct, onWithdrawSavings, onUndoWithdrawSavings,
  onSaveGenre, onSaveTag,
}: Props) {
  const theme = themeOf('plans')
  const [tab, setTab] = useState<Tab>('list')
  const [editing, setEditing] = useState<PlanDraft | null>(null)   // 一覧タブ：内容の編集
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [editError, setEditError] = useState('')
  const [reordering, setReordering] = useState<PlanKind | null>(null)
  const [confirmSave, setConfirmSave] = useState(false)
  const session = useEditSession<PlanItem>()

  // ── 計算タブの状態 ─────────────────────
  const [openId, setOpenId] = useState<string | null>(null)     // その場で開いている行（plan: / goal:）
  const [showBreakdown, setShowBreakdown] = useState(false)     // サマリーの内訳
  const [openMonthly, setOpenMonthly] = useState(false)
  const [openSavings, setOpenSavings] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)   // 確定前の増減
  const [infoId, setInfoId] = useState<string | null>(null)     // 毎月項目の情報シート

  function startReorder(kind: PlanKind, group: PlanItem[]) {
    setReordering(kind)
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
  const once = sorted.filter(p => p.kind === 'once')
  const monthly = sorted.filter(p => p.kind === 'monthly')

  const deducted = once.reduce((s, p) => s + p.deductedAmount, 0)
  const unspent = once.reduce((s, p) => s + Math.max(0, p.estimatedCost - p.deductedAmount), 0)
  const monthlyTotal = monthly.reduce((s, p) => s + p.estimatedCost, 0)
  const savingsKept = goalRows.reduce((s, g) => s + g.kept, 0)
  const remaining = totalBalance - deducted - monthlyTotal - savingsKept

  // 差し引きの内訳。色はテーマ色の濃淡で揃え、画面全体の色数を増やさない
  const segments: CalcSegment[] = [
    { label: '未定の引き済み', amount: deducted, color: theme.accent },
    { label: '毎月の支出', amount: monthlyTotal, color: `color-mix(in srgb, ${theme.accent} 58%, #fff)` },
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
      id: null, name: '', kind: 'once', estimatedCost: 0, dayOfMonth: 0,
      walletId: wallets[0]?.id ?? '', genreId: '', tagIds: [], memo: '',
    })
  }

  function openEdit(p: PlanItem) {
    setEditError('')
    setEditing({
      id: p.id, name: p.name, kind: p.kind, estimatedCost: p.estimatedCost,
      dayOfMonth: p.dayOfMonth, walletId: p.walletId, genreId: p.genreId,
      tagIds: p.tagIds, memo: p.memo,
    })
  }

  /** true を返すと詳細表示に戻る。新規はそのまま閉じて一覧へ */
  function saveEdit() {
    if (!editing) return false
    const error = firstError(
      required(editing.name, '予定名'),
      notNegative(editing.estimatedCost, '金額'),
      // 引き落とし日は任意。入れるなら 1〜31
      () => editing.kind === 'monthly' && editing.dayOfMonth !== 0
        ? inRange(editing.dayOfMonth, 1, 31, '引き落とし日')()
        : null,
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
        <GenreDot genres={genres} genreId={p.genreId} fallback="🗒" />
        <span className="row-main">
          <span className="row-title">
            {p.kind === 'monthly' && p.dayOfMonth > 0 ? `毎月${p.dayOfMonth}日 ` : ''}{p.name}
          </span>
          <span className="row-sub"><TagList tags={tags} ids={p.tagIds} /></span>
        </span>
        {!compact && <span className="row-right"><span className="row-amount">¥{p.estimatedCost.toLocaleString()}</span></span>}
      </>
    )
  }

  function renderSection(kind: PlanKind, group: PlanItem[], title: string, emptyHint: string) {
    const inReorder = reordering === kind
    const rows: EditRow[] = session.draft.map(p => ({ id: p.id, content: rowBody(p, true) }))
    const count = inReorder ? session.draft.length : group.length

    return (
      <>
        <div className="section-header">
          <h3>{title} ({count})</h3>
          {group.length > 1 && reordering === null && (
            <ReorderButton onClick={() => startReorder(kind, group)} />
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
  /** 引く／戻すを行の下に開く未定の行 */
  function renderCalcRow(p: PlanItem) {
    const key = `plan:${p.id}`
    const open = openId === key
    // 進捗の色はジャンルではなくテーマ色。一覧で色を持つのはタグだけにする
    const color = theme.accent
    const left = p.estimatedCost - p.deductedAmount
    const finished = p.estimatedCost > 0 && p.deductedAmount >= p.estimatedCost
    const pct = p.estimatedCost > 0 ? Math.round((p.deductedAmount / p.estimatedCost) * 100) : 0

    return (
      <li key={p.id}>
        <button
          className={`row-card${finished && !open ? ' done' : ''}${open ? ' expanded' : ''}`}
          style={open ? { borderColor: theme.accent } : undefined}
          onClick={() => openRow(key)}
        >
          <GenreDot genres={genres} genreId={p.genreId} fallback="🗒" />
          <span className="row-main">
            <span className={`row-title${finished ? ' struck' : ''}`}>{p.name}</span>
            <Progress ratio={p.estimatedCost > 0 ? p.deductedAmount / p.estimatedCost : 0} color={color} />
          </span>
          <span className="row-right">
            <span className="row-note">¥{p.deductedAmount.toLocaleString()} / {p.estimatedCost.toLocaleString()}</span>
            <span className="row-amount" style={{ color }}>{pct}%</span>
          </span>
          <span className="row-chevron">{open ? '⌃' : '⌄'}</span>
        </button>

        {open && (p.estimatedCost > 0 ? (
          <InlineDeduct
            remaining={left}
            done={p.deductedAmount}
            accent={theme.accent}
            budget={remaining}
            budgetSign={-1}
            onDeduct={amount => onDeduct(p.id, amount)}
            onUndo={amount => onUndoDeduct(p.id, amount)}
            onPreview={setPreview}
            onClose={() => setOpenId(null)}
          />
        ) : (
          <div className="inline-panel" style={{ borderColor: theme.accent }}>
            <p className="summary">
              予測金額が未設定です。「出費予定」タブで金額を入れると、ここから引けるようになります。
            </p>
            <div className="inline-actions">
              <button className="btn-sub" onClick={() => setOpenId(null)}>閉じる</button>
            </div>
          </div>
        ))}
      </li>
    )
  }

  /** 切り崩し／戻すを行の下に開く貯金の行 */
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
            <span className="row-note">切崩 ¥{g.withdrawn.toLocaleString()} / {g.earned.toLocaleString()}</span>
            <span className="row-amount" style={{ color: readableColor(g.color) }}>残 ¥{g.kept.toLocaleString()}</span>
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
            deductVerb={{ now: '切り崩す', past: '切り崩した' }}
            info={
              <>
                <p className="summary">
                  貯めた額 {yen(g.earned)}　切り崩し済み {yen(g.withdrawn)}　残り {yen(g.kept)}
                  {g.targetAmount > 0 && `　目標 ${yen(g.targetAmount)}`}
                </p>
                <p className="summary">切り崩した分は取っておく額から外れ、その分だけ使える金額が増えます。</p>
              </>
            }
            onDeduct={amount => onWithdrawSavings(g.id, amount)}
            onUndo={amount => onUndoWithdrawSavings(g.id, amount)}
            onPreview={setPreview}
            onClose={() => setOpenId(null)}
            confirmLabel={amount =>
              `「${g.name}」から ${yen(amount)} を切り崩します。取っておくはずだったお金です。本当によろしいですか？`}
          />
        )}
      </li>
    )
  }

  /** 触らなくても自動で引かれているものを畳んでおくカード */
  function groupCard(
    icon: string, title: string, sub: string, amount: number,
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
          <span className="row-amount">−¥{amount.toLocaleString()}</span>
          <span className="row-chevron">{open ? '⌃' : '⌄'}</span>
        </button>
        {open && <ul className="item-list sub-list">{children}</ul>}
      </li>
    )
  }

  return (
    <div className="page">
      <TopTabs
        tabs={[{ id: 'list' as Tab, label: '出費予定' }, { id: 'calc' as Tab, label: '計算' }]}
        active={tab}
        onChange={t => {
          setTab(t)
          setEditing(null)
          setOpenId(null)
          setPreview(null)
          exitReorder()
        }}
        accent={theme.accent}
        soft={theme.soft}
      />

      <div className="page-scroll">
        {tab === 'list' ? (
          <>
            {renderSection('once', once, '未定', 'まだ予定がありません')}
            {renderSection('monthly', monthly, '毎月', '定期支出の登録がありません')}
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
              unspent={unspent}
              preview={preview}
              open={showBreakdown}
              onToggle={() => setShowBreakdown(v => !v)}
            />

            <div className="section-header">
              <h3>未定 ({once.length})</h3>
              {once.length > 0 && <span className="section-hint">タップしてその場で引く</span>}
            </div>
            {once.length === 0 ? (
              <p className="empty-hint">まだ予定がありません</p>
            ) : (
              <ul className="item-list">{once.map(renderCalcRow)}</ul>
            )}

            {(monthly.length > 0 || goalRows.length > 0) && (
              <>
                <div className="section-header">
                  <h3>自動で引かれているもの</h3>
                  <span className="section-hint">タップで内訳</span>
                </div>
                <ul className="item-list">
                  {monthly.length > 0 && groupCard(
                    '🔁',
                    `毎月の支出  ${monthly.length}件`,
                    '常に全額が引かれます',
                    monthlyTotal,
                    openMonthly,
                    () => setOpenMonthly(v => !v),
                    monthly.map(p => (
                      <li key={p.id}>
                        <button className="row-card" onClick={() => setInfoId(p.id)}>
                          <GenreDot genres={genres} genreId={p.genreId} fallback="🗒" />
                          <span className="row-main">
                            <span className="row-title">
                              {p.dayOfMonth > 0 ? `毎月${p.dayOfMonth}日 ` : ''}{p.name}
                            </span>
                            <span className="row-sub">
                              {wallets.find(w => w.id === p.walletId)?.name ?? '口座未設定'}
                            </span>
                          </span>
                          <span className="row-amount">¥{p.estimatedCost.toLocaleString()}</span>
                        </button>
                      </li>
                    )),
                  )}

                  {goalRows.length > 0 && groupCard(
                    '🐷',
                    `つもり貯金  ${goalRows.length}件`,
                    '切り崩すと使える金額が増えます',
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
          icon={editGenre?.icon ?? '🗒'}
          color={editGenre ? `${editGenre.color}55` : theme.soft}
          name={editing.name}
          onNameChange={v => setEditing({ ...editing, name: v })}
          namePlaceholder="例: ライブ遠征費"
          onClose={() => { setEditing(null); setEditError('') }}
          onSave={saveEdit}
          startInEdit={editing.id === null}
          error={editError}
          onDelete={editing.id ? () => setDeleteTarget({ id: editing.id!, name: editing.name }) : undefined}
        >
          <DetailRow icon="🔁" label="種類" value={<ReadValue>{editing.kind === 'once' ? '未定' : '毎月'}</ReadValue>}>
            <div className="type-toggle">
              <button
                className={editing.kind !== 'once' ? 'btn-sub' : ''}
                onClick={() => setEditing({ ...editing, kind: 'once' })}
              >未定</button>
              <button
                className={editing.kind !== 'monthly' ? 'btn-sub' : ''}
                onClick={() => setEditing({ ...editing, kind: 'monthly' })}
              >毎月</button>
            </div>
          </DetailRow>

          <DetailRow
            icon="💰"
            label={editing.kind === 'once' ? '予測金額' : '金額'}
            value={<ReadValue>{yen(editing.estimatedCost)}</ReadValue>}
          >
            <input
              type="number"
              value={editing.estimatedCost || ''}
              onChange={e => setEditing({ ...editing, estimatedCost: Number(e.target.value) })}
              placeholder="0"
              min={0}
            />
          </DetailRow>

          {editing.kind === 'monthly' && (
            <>
              <DetailRow
                icon="📅"
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
                icon="💳"
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
            </>
          )}

          <DetailRow
            icon="💙"
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
            icon="🏷"
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
            icon="📝"
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

          {editing.id && editing.kind === 'once' && (
            <p className="summary" style={{ padding: '0 0.25rem' }}>
              引く・戻すの操作は「計算」タブから行えます
            </p>
          )}
        </DetailModal>
      )}

      {/* 計算タブ：毎月の支出の詳細（金額は変えられない） */}
      {info && (
        <DetailModal
          icon={infoGenre?.icon ?? '🗒'}
          color={infoGenre ? `${infoGenre.color}55` : theme.soft}
          name={info.name}
          onClose={() => setInfoId(null)}
        >
          <DetailRow icon="💰" label="金額">
            <span className="detail-value">{yen(info.estimatedCost)}</span>
          </DetailRow>
          {info.dayOfMonth > 0 && (
            <DetailRow icon="📅" label="引き落とし日">
              <span className="detail-value">毎月{info.dayOfMonth}日</span>
            </DetailRow>
          )}
          {info.walletId && (
            <DetailRow icon="💳" label="口座">
              <span className="detail-value">{wallets.find(w => w.id === info.walletId)?.name ?? '未設定'}</span>
            </DetailRow>
          )}
          <p className="summary" style={{ padding: '0.5rem 0.25rem' }}>
            毎月の支出は常に全額が差し引かれます。内容の変更は「出費予定」タブから行えます。
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
