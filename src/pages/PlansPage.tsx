import { useState, type ReactNode } from 'react'
import {
  PiArrowsClockwise, PiCalendarBlank, PiCheck, PiCoins, PiCreditCard,
  PiNotePencil, PiNotepad, PiPiggyBank, PiSquaresFour, PiTag, PiWallet,
} from 'react-icons/pi'
import type { Genre, GoalRow, PlanCategory, PlanFrequency, PlanItem, Tag, Wallet } from '../types'
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
  frequency: PlanFrequency
  month: number
  dayOfMonth: number
  walletId: string
  genreId: string
  tagIds: string[]
  memo: string
}

/** 「毎月○日」「毎年○月○日」のような短い日付表示。どちらも未設定なら「未設定」 */
function shortDateText(p: Pick<PlanItem, 'frequency' | 'month' | 'dayOfMonth'>) {
  if (p.frequency === 'yearly') {
    if (p.month > 0 && p.dayOfMonth > 0) return `毎年${p.month}月${p.dayOfMonth}日`
    if (p.month > 0) return `毎年${p.month}月`
    if (p.dayOfMonth > 0) return `毎年${p.dayOfMonth}日`
    return '未設定'
  }
  return p.dayOfMonth > 0 ? `毎月${p.dayOfMonth}日` : '未設定'
}

/** 一覧行用。「毎月○日に支払い」「支払い日未設定」のような文言 */
function paymentLabel(p: Pick<PlanItem, 'frequency' | 'month' | 'dayOfMonth'>) {
  const text = shortDateText(p)
  return text === '未設定' ? '支払い日未設定' : `${text}に支払い`
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
    setPicked(new Set())
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
  const [openSavings, setOpenSavings] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)   // 確定前の増減
  const [infoId, setInfoId] = useState<string | null>(null)     // 出費予定の情報シート
  const [creditInfoWalletId, setCreditInfoWalletId] = useState<string | null>(null)  // クレカ口座の情報シート（読み取り専用）
  const [picked, setPicked] = useState<Set<string>>(new Set())  // 「もし買ったら」で選んだウィッシュ。保存しない

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

  const subsTotal = subs.reduce((s, p) => s + p.estimatedCost, 0)
  const savingsKept = goalRows.reduce((s, g) => s + g.kept, 0)
  const remaining = totalBalance - subsTotal - savingsKept

  // 差し引きの内訳。色はテーマ色の濃淡で揃え、画面全体の色数を増やさない
  const segments: CalcSegment[] = [
    { label: '定期支出', amount: subsTotal, color: theme.accent },
    { label: 'つもり貯金', amount: savingsKept, color: `color-mix(in srgb, ${theme.accent} 30%, #fff)` },
  ]
  // ── もし買ったら（ウィッシュのお試し計算。実データは動かさない） ──
  // 金額未定のウィッシュは計算できないので並べない
  const wishes = goalRows.filter(g => g.id && g.targetAmount > 0)
  const hiddenWishCount = goalRows.filter(g => g.id && g.targetAmount === 0).length
  /** 買ったときに使える金額から減る分。積んだつもり貯金はもう引かれているので、その分は二重に引かない */
  const wishCost = (g: GoalRow) => Math.max(0, g.targetAmount - g.kept)
  const simDelta = -wishes.filter(g => picked.has(g.id)).reduce((s, g) => s + wishCost(g), 0)
  const shownPreview = preview === null && simDelta === 0 ? null : (preview ?? 0) + simDelta

  function togglePick(id: string) {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const groupTint = `color-mix(in srgb, ${theme.accent} 15%, #fff)`

  const info = infoId ? planItems.find(p => p.id === infoId) ?? null : null
  // クレジットカードの実データは財布（Wallet）側。ここでは読み取るだけで、編集・清算は財布タブに誘導する
  const creditWallets = wallets.filter(w => w.isCredit)
  const creditInfo = creditInfoWalletId ? wallets.find(w => w.id === creditInfoWalletId) ?? null : null
  const editGenre = genres.find(g => g.id === editing?.genreId)
  const infoGenre = genres.find(g => g.id === info?.genreId)

  function openRow(key: string) {
    setOpenId(prev => prev === key ? null : key)
    setPreview(null)
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

  // ── 一覧タブ ───────────────────────────
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
            budget={remaining + simDelta}
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
          <GenreDot genres={genres} genreId={p.genreId} fallback={<PiArrowsClockwise />} />
          <span className="row-main">
            <span className="row-title">{p.name}</span>
            <span className="row-sub">
              {paymentLabel(p)}
              ・{wallets.find(w => w.id === p.walletId)?.name ?? '口座未設定'}
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
            {renderSection('subscription', subs, '定期支出', '定期支出の登録がありません')}

            <div className="section-header">
              <h3>クレジットカード ({creditWallets.length})</h3>
            </div>
            {creditWallets.length === 0 ? (
              <p className="empty-hint">「家計簿」タブの「財布」でクレジットカードの口座を作ると、ここに表示されます</p>
            ) : (
              <ul className="item-list">
                {creditWallets.map(w => (
                  <li key={w.id}>
                    <button className="row-card" onClick={() => setCreditInfoWalletId(w.id)}>
                      <GenreDot genres={genres} genreId="" fallback={<PiCreditCard />} />
                      <span className="row-main">
                        <span className="row-title">{w.name}</span>
                        <span className="row-sub">
                          {w.billingDay > 0 ? `毎月${w.billingDay}日引き落とし` : '引き落とし日未設定'}
                        </span>
                      </span>
                      <span className={`row-amount${w.balance < 0 ? ' remaining-negative' : ''}`}>
                        {w.balance < 0 ? `未精算 ${(-w.balance).toLocaleString()}円` : '0円'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="summary" style={{ padding: '0 0.25rem' }}>
              いつ買うか決めていないものは「貯金」タブのウィッシュにメモしておけます
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
              preview={shownPreview}
              open={showBreakdown}
              onToggle={() => setShowBreakdown(v => !v)}
            />

            <div className="section-header">
              <h3>もし買ったら</h3>
              {picked.size > 0 ? (
                <button className="link-btn section-hint" onClick={() => setPicked(new Set())}>選択をクリア</button>
              ) : (
                <span className="section-hint">タップで試算</span>
              )}
            </div>
            {wishes.length === 0 ? (
              <p className="empty-hint">
                「貯金」タブのウィッシュに金額を入れて登録すると、<br />買ったら残りがいくらになるかをここで試せます
              </p>
            ) : (
              <>
                <div className="sort-list">
                  {wishes.map(g => {
                    const on = picked.has(g.id)
                    const cost = wishCost(g)
                    return (
                      <button
                        key={g.id}
                        className={`sort-row${on ? ' on' : ''}`}
                        style={on ? { borderColor: theme.accent } : undefined}
                        onClick={() => togglePick(g.id)}
                        aria-pressed={on}
                      >
                        <span
                          className={`sort-check${on ? ' on' : ''}`}
                          style={on ? { background: theme.accent, borderColor: theme.accent } : undefined}
                        >
                          {on ? <PiCheck /> : ''}
                        </span>
                        <span className="sort-main">
                          <span className="sort-name">{g.icon} {g.name}</span>
                          <span className="sort-date">
                            {yen(g.targetAmount)}{g.kept > 0 && ` − 貯めた分 ${yen(Math.min(g.kept, g.targetAmount))}`}
                          </span>
                        </span>
                        <span className="sort-amount">{cost > 0 ? `−${cost.toLocaleString()}円` : '貯金で足りる'}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="summary" style={{ padding: '0.4rem 0.25rem 0', lineHeight: 1.7 }}>
                  試算だけで、記録やつもり貯金は変わりません。
                  {hiddenWishCount > 0 && `金額が未定のウィッシュ（${hiddenWishCount}件）は表示していません。`}
                </p>
              </>
            )}

            {(planItems.length > 0 || goalRows.length > 0) && (
              <>
                <div className="section-header">
                  <h3>自動で引かれているもの</h3>
                  <span className="section-hint">タップで内訳</span>
                </div>
                <ul className="item-list">
                  {subs.length > 0 && groupCard(
                    <PiArrowsClockwise />,
                    `定期支出  ${subs.length}件`,
                    '常に全額が引かれます',
                    subsTotal,
                    openSubs,
                    () => setOpenSubs(v => !v),
                    subs.map(planGroupRow),
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
          icon={editGenre?.icon ?? <PiNotepad />}
          color={editGenre ? `${editGenre.color}55` : theme.soft}
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
          icon={infoGenre?.icon ?? <PiNotepad />}
          color={infoGenre ? `${infoGenre.color}55` : theme.soft}
          name={info.name}
          onClose={() => setInfoId(null)}
        >
          <DetailRow icon={<PiCoins />} label="金額">
            <span className="detail-value">{yen(info.estimatedCost)}</span>
          </DetailRow>
          {(info.dayOfMonth > 0 || info.month > 0) && (
            <DetailRow icon={<PiCalendarBlank />} label="支払い日">
              <span className="detail-value">{shortDateText(info)}</span>
            </DetailRow>
          )}
          {info.walletId && (
            <DetailRow icon={<PiWallet />} label="口座">
              <span className="detail-value">{wallets.find(w => w.id === info.walletId)?.name ?? '未設定'}</span>
            </DetailRow>
          )}
          <p className="summary" style={{ padding: '0.5rem 0.25rem' }}>
            出費予定は常に全額が差し引かれます。内容の変更は「出費予定」タブから行えます。
          </p>
        </DetailModal>
      )}

      {/* 出費予定タブ：クレカ口座の情報（読み取り専用。実データと操作は財布タブ） */}
      {creditInfo && (
        <DetailModal
          icon={<PiCreditCard />}
          color={theme.soft}
          name={creditInfo.name}
          onClose={() => setCreditInfoWalletId(null)}
        >
          <DetailRow icon={<PiCoins />} label="未精算の残高">
            <span className="detail-value">{yen(Math.max(0, -creditInfo.balance))}</span>
          </DetailRow>
          {creditInfo.billingDay > 0 && (
            <DetailRow icon={<PiCalendarBlank />} label="引き落とし日">
              <span className="detail-value">毎月{creditInfo.billingDay}日</span>
            </DetailRow>
          )}
          {creditInfo.payFromWalletId && (
            <DetailRow icon={<PiWallet />} label="引き落とし元の口座">
              <span className="detail-value">
                {wallets.find(w => w.id === creditInfo.payFromWalletId)?.name ?? '未設定'}
              </span>
            </DetailRow>
          )}
          <p className="summary" style={{ padding: '0.5rem 0.25rem' }}>
            支払いの記録や清算は「家計簿」タブの「財布」から行えます。
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
