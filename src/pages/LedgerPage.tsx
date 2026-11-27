import { useEffect, useState } from 'react'
import {
  PiArrowsClockwise, PiCalendarBlank, PiCoins, PiCreditCard,
  PiLightbulb, PiNotePencil, PiReceipt, PiSquaresFour, PiTag, PiWallet,
} from 'react-icons/pi'
import type { Genre, LedgerEntry, PlanItem, Tag, Wallet } from '../types'
import DetailModal, { DetailBlock, DetailRow, ReadValue } from '../components/DetailModal'
import ConfirmModal from '../components/ConfirmModal'
import Sheet from '../components/Sheet'
import { GenreDot, GenreSelect, TagFilter, TagList, TagPicker } from '../components/Pickers'
import type { LabelDraft } from '../components/LabelListPage'
import EditableList, { EditToolbar, ReorderButton } from '../components/EditableList'
import { useEditSession } from '../useEditSession'
import TopTabs from '../components/TopTabs'
import { useSwipeTabs } from '../useSwipeNav'
import { themeOf } from '../theme'
import { monthRange, occurrencesIn, type PlanOccurrence } from '../plans'
import { creditBillsIn, creditScheduleText, type CreditBill } from '../credit'
import { byNewest, matchesTags, monthLabel, monthOf, thisMonth, todayStr, yen } from '../utils'
import { firstError, positive, required, selected } from '../validation'

type Tab = 'ledger' | 'wallet'

interface EntryDraft {
  id: string | null
  label: string
  amount: number
  type: 'expense' | 'income'
  date: string
  walletId: string
  genreId: string
  tagIds: string[]
  memo: string
  /** 引き落とし予定の定期支出から記録するときの元の PlanItem */
  planId?: string
  /** その定期支出の登録額。金額欄に最初から入れておき、通信料など違う月は書き換えてもらう */
  planHint?: number
}

interface WalletDraft {
  id: string | null
  name: string
  balance: number
  isCredit: boolean
  billingDay: number
  payFromWalletId: string
  closingDay: number
  payMonthOffset: number
}

interface Props {
  wallets: Wallet[]
  entries: LedgerEntry[]
  planItems: PlanItem[]
  genres: Genre[]
  tags: Tag[]
  totalBalance: number
  onSaveEntry: (draft: EntryDraft) => void
  onRemoveEntry: (id: string) => void
  onSaveWallet: (draft: WalletDraft) => void
  onRemoveWallet: (id: string) => void
  onSettleCredit: (walletId: string, actualAmount: number, face?: number) => void
  onSaveGenre: (draft: LabelDraft) => string
  onSaveTag: (draft: LabelDraft) => string
  onApplyWalletEdit: (orderedIds: string[], removedIds: string[]) => void
}

/** YYYY-MM-DD → 10/16 */
function shortDay(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function LedgerPage({
  wallets, entries, planItems, genres, tags, totalBalance,
  onSaveEntry, onRemoveEntry, onSaveWallet, onRemoveWallet, onSettleCredit, onSaveGenre, onSaveTag,
  onApplyWalletEdit,
}: Props) {
  const theme = themeOf('ledger')
  const [tab, setTab] = useState<Tab>('ledger')
  const [month, setMonth] = useState(thisMonth())
  const [draft, setDraft] = useState<EntryDraft | null>(null)
  const [walletDraft, setWalletDraft] = useState<WalletDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'entry' | 'wallet'; id: string; name: string } | null>(null)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [entryError, setEntryError] = useState('')
  const [walletError, setWalletError] = useState('')
  const [settleTarget, setSettleTarget] = useState<{
    walletId: string; name: string; faceTotal: number; partial: boolean; unrecorded: PlanOccurrence[]
  } | null>(null)
  const [settleAmount, setSettleAmount] = useState(0)
  const [openDue, setOpenDue] = useState(false)   // 引き落とし予定の内訳
  /** 保存した記録が、いま見ている月とは別の月に入ったときの知らせ（YYYY-MM） */
  const [savedElsewhere, setSavedElsewhere] = useState<string | null>(null)

  // 知らせは数秒で消す
  useEffect(() => {
    if (!savedElsewhere) return
    const id = setTimeout(() => setSavedElsewhere(null), 5000)
    return () => clearTimeout(id)
  }, [savedElsewhere])

  // 口座の並び替え（確定するまで下書きだけを書き換える）
  const walletSession = useEditSession<Wallet>()
  const [confirmWalletSave, setConfirmWalletSave] = useState(false)

  function commitWalletEdit() {
    onApplyWalletEdit(walletSession.draft.map(w => w.id), walletSession.removed)
    walletSession.cancel()
    setConfirmWalletSave(false)
  }

  /** タブを離れるときは、確定していない並び替えを畳んでおく（スワイプ移動も同じ） */
  function changeTab(next: Tab) {
    setTab(next)
    walletSession.cancel()
  }

  const swipe = useSwipeTabs(['ledger', 'wallet'] as const, tab, changeTab)

  const monthEntries = byNewest(
    entries.filter(e => monthOf(e.date) === month && matchesTags(e.tagIds, filterTags)),
    e => e.date,
  )

  const monthExpense = monthEntries
    .filter(e => e.amount < 0 && !e.transfer)
    .reduce((s, e) => s + Math.abs(e.amount), 0)

  // 表示中の月の引き落とし予定（口座払いの定期支出＋クレカの請求）。
  // カード払いの定期支出は、そのカードの締め期間の請求の中に入れて二重に数えない
  const isThisMonth = month === thisMonth()
  // 先の月は記録・清算できない（記録するとその月の一覧に入り、今月を見ていると見当たらなくなるため）
  const isFutureMonth = month > thisMonth()
  const todayDate = todayStr()
  const creditIds = new Set(wallets.filter(w => w.isCredit).map(w => w.id))
  const bills = creditBillsIn(wallets, entries, planItems, month, todayDate)
  const { from: monthFrom, to: monthTo } = monthRange(month)
  const bankOccs = occurrencesIn(planItems.filter(p => !creditIds.has(p.walletId)), entries, monthFrom, monthTo)
  type DueRow =
    | { kind: 'plan'; key: string; date: string; amount: number; done: boolean; occ: PlanOccurrence }
    | { kind: 'credit'; key: string; date: string; amount: number; done: boolean; bill: CreditBill }
  const dueRows: DueRow[] = [
    ...bankOccs.map(o => ({
      kind: 'plan' as const, key: `${o.plan.id}:${o.date}`, date: o.plan.dayOfMonth > 0 ? o.date : '',
      amount: o.amount, done: o.recorded, occ: o,
    })),
    ...bills.map(b => ({
      kind: 'credit' as const, key: b.wallet.id, date: b.payDate, amount: b.amount, done: b.settled, bill: b,
    })),
  ].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
  const dueTotal = dueRows.reduce((s, r) => s + r.amount, 0)
  const remainingRows = dueRows.filter(r => !r.done)
  const remainingTotal = remainingRows.reduce((s, r) => s + r.amount, 0)

  /**
   * 定期支出の1回分を記録する入力画面を開く。金額は登録額を入れておき、毎月変わるものはその場で書き換えてもらう。
   * 支払い日が未設定のものは日付を決められないので、未来の日付にならないよう今日を上限にする
   */
  function recordOcc(o: PlanOccurrence) {
    const date = o.plan.dayOfMonth === 0 && o.date > todayDate ? todayDate : o.date
    setEntryError('')
    setDraft({
      id: null, label: o.plan.name, amount: o.plan.estimatedCost, type: 'expense', date,
      walletId: o.plan.walletId, genreId: o.plan.genreId, tagIds: o.plan.tagIds, memo: '',
      planId: o.plan.id, planHint: o.plan.estimatedCost,
    })
  }

  const filterNames = filterTags
    .map(id => tags.find(t => t.id === id)?.name)
    .filter(Boolean)
    .map(n => `#${n}`)
    .join(' ')

  function openNewEntry() {
    if (wallets.length === 0) {
      setTab('wallet')
      openNewWallet()
      setWalletError('取引を記録するには、先に口座を1つ作ってください')
      return
    }
    setEntryError('')
    setDraft({
      id: null, label: '', amount: 0, type: 'expense', date: todayStr(),
      walletId: wallets[0].id, genreId: '', tagIds: [], memo: '',
    })
  }

  function openEntry(e: LedgerEntry) {
    setEntryError('')
    setDraft({
      id: e.id,
      label: e.label,
      amount: Math.abs(e.amount),
      type: e.amount < 0 ? 'expense' : 'income',
      date: e.date || todayStr(),
      walletId: e.walletId,
      genreId: e.genreId,
      tagIds: e.tagIds,
      memo: e.memo,
    })
  }

  /** true を返すと詳細表示に戻る。新規はそのまま閉じて一覧へ */
  function saveEntry() {
    if (!draft) return false
    const error = firstError(
      required(draft.label, '項目名'),
      selected(draft.walletId, '口座'),
      positive(draft.amount, '金額'),
      required(draft.date, '日付'),
    )
    if (error) { setEntryError(error); return false }
    onSaveEntry({ ...draft, label: draft.label.trim() })
    setEntryError('')
    // カード払いのサブスク（使った日＝前月）や日付の書き換えで、表示中の月の一覧から見えなくなる場合に知らせる
    setSavedElsewhere(monthOf(draft.date) !== month ? monthOf(draft.date) : null)
    if (draft.id === null) { setDraft(null); return false }
    setDraft({ ...draft, label: draft.label.trim() })
    return true
  }

  function openNewWallet() {
    setWalletError('')
    setWalletDraft({ id: null, name: '', balance: 0, isCredit: false, billingDay: 0, payFromWalletId: '', closingDay: 0, payMonthOffset: 1 })
  }

  function saveWallet() {
    if (!walletDraft) return false
    const error = firstError(required(walletDraft.name, '口座名'))
    if (error) { setWalletError(error); return false }
    onSaveWallet({ ...walletDraft, name: walletDraft.name.trim() })
    setWalletError('')
    if (walletDraft.id === null) { setWalletDraft(null); return false }
    setWalletDraft({ ...walletDraft, name: walletDraft.name.trim() })
    return true
  }

  /** 締め日のあるカードは今月の請求額だけを清算し、締め後の利用分は未精算に残す */
  /** 今月の請求（未清算のもの）。締め日のないカードは未精算の全額が今月分になる */
  function currentBill(w: Wallet) {
    return creditBillsIn([w], entries, planItems, thisMonth(), todayStr()).find(b => !b.settled)
  }

  function settleFace(w: Wallet, bill = currentBill(w)) {
    const owed = Math.max(0, -w.balance)
    const face = bill && w.closingDay > 0 ? Math.min(owed, bill.recordedAmount) : owed
    return { face, partial: face < owed }
  }

  function openSettle(w: Wallet, bill = currentBill(w)) {
    const { face, partial } = settleFace(w, bill)
    const unrecorded = bill?.plans.filter(o => !o.recorded) ?? []
    setSettleTarget({ walletId: w.id, name: w.name, faceTotal: face, partial, unrecorded })
    setSettleAmount(face)
  }

  function confirmSettle() {
    if (!settleTarget) return
    onSettleCredit(settleTarget.walletId, Math.max(0, settleAmount), settleTarget.faceTotal)
    setSettleTarget(null)
    setWalletDraft(null)
  }

  /** 口座1行の中身。並び替え中の行でもそのまま使う */
  function walletBody(w: Wallet) {
    const owed = w.isCredit && w.balance < 0 ? -w.balance : 0
    return (
      <>
        <GenreDot genres={genres} genreId="" fallback={<PiCreditCard />} />
        <span className="row-main">
          <span className="row-title">{w.name}</span>
          {w.isCredit && (
            <span className="row-sub">{creditScheduleText(w)}</span>
          )}
        </span>
        <span className={`row-amount${w.balance < 0 ? ' remaining-negative' : ''}`}>
          {owed > 0 ? `未精算 ${owed.toLocaleString()}円` : `${w.balance.toLocaleString()}円`}
        </span>
      </>
    )
  }

  /** 引き落とし予定の行の右端。済みなら状態の文字、操作できるならボタン、できなければ何も出さない */
  function dueAction(status: string | null, onClick: (() => void) | null, label: string, fallback = '口座未設定') {
    if (status) return <span className="due-status">{status}</span>
    if (!onClick) return fallback ? <span className="due-status">{fallback}</span> : null
    return (
      <button className="due-action" style={{ background: theme.accent }} onClick={onClick}>{label}</button>
    )
  }

  const draftGenre = genres.find(g => g.id === draft?.genreId)

  return (
    <div className="page">
      <TopTabs
        tabs={[{ id: 'ledger' as Tab, label: '家計簿' }, { id: 'wallet' as Tab, label: '財布' }]}
        active={tab}
        onChange={changeTab}
        accent={theme.accent}
        soft={theme.soft}
      />

      <div className="page-scroll" {...swipe}>
        {tab === 'ledger' ? (
          <>
            <div className="hero-card">
              <div className="hero-label">
                {monthLabel(month)}の出費{filterNames && `（${filterNames}）`}
              </div>
              <div className="hero-number">¥{monthExpense.toLocaleString()}</div>
            </div>

            {dueRows.length > 0 && (
              <div className="due-card">
                <button className={`row-card${openDue ? ' group-open' : ''}`} onClick={() => setOpenDue(v => !v)}>
                  <GenreDot genres={genres} genreId="" fallback={<PiArrowsClockwise />} />
                  <span className="row-main">
                    <span className="row-title">{isThisMonth ? '今月' : monthLabel(month)}の引き落とし予定</span>
                    <span className="row-sub">
                      {remainingRows.length > 0
                        ? `残り ${remainingRows.length}件・${yen(remainingTotal)}`
                        : 'すべて記録・清算済みです'}
                      {bills.some(b => b.open) && '・締め前の分あり'}
                    </span>
                  </span>
                  <span className="row-amount">{dueTotal.toLocaleString()}円</span>
                  <span className="row-chevron">{openDue ? '⌃' : '⌄'}</span>
                </button>
                {openDue && (
                  <ul className="item-list sub-list">
                    {dueRows.map(r => (
                      <li key={r.key}>
                        {r.kind === 'plan' ? (
                          <div className={`row-card due-row${r.done ? ' done' : ''}`}>
                            <GenreDot genres={genres} genreId={r.occ.plan.genreId} fallback={<PiArrowsClockwise />} />
                            <span className="row-main">
                              <span className="row-title">{r.occ.plan.name}</span>
                              <span className="row-sub">
                                {r.date ? shortDay(r.date) : '日付未設定'}・{wallets.find(w => w.id === r.occ.plan.walletId)?.name ?? '口座未設定'}
                                {!r.done && '・金額は目安'}
                              </span>
                            </span>
                            <span className="row-amount">{r.amount.toLocaleString()}円</span>
                            {isFutureMonth
                              ? null
                              : dueAction(r.done ? '記録済み' : null, r.occ.plan.walletId ? () => recordOcc(r.occ) : null, '記録')}
                          </div>
                        ) : (
                          <>
                            <div className={`row-card due-row${r.done ? ' done' : ''}`}>
                              <GenreDot genres={genres} genreId="" fallback={<PiCreditCard />} />
                              <span className="row-main">
                                <span className="row-title">{r.bill.wallet.name}</span>
                                <span className="row-sub">
                                  {r.date ? shortDay(r.date) : '日付未設定'}
                                  {r.bill.period
                                    ? `・${shortDay(r.bill.period.from)}〜${shortDay(r.bill.period.to)}の利用分${r.bill.open ? '（締め前）' : ''}`
                                    : '・未精算の全額'}
                                </span>
                              </span>
                              <span className="row-amount">{r.amount.toLocaleString()}円</span>
                              {dueAction(
                                r.done ? '清算済み' : r.bill.open ? '締め前' : null,
                                isThisMonth && r.bill.wallet.payFromWalletId ? () => openSettle(r.bill.wallet, r.bill) : null,
                                '清算',
                                isThisMonth ? '引き落とし元未設定' : '',
                              )}
                            </div>
                            {r.bill.plans.length > 0 && (
                              <ul className="due-nested">
                                {r.bill.plans.map(o => (
                                  <li key={`${o.plan.id}:${o.date}`} className={`due-nested-row${o.recorded || r.done ? ' done' : ''}`}>
                                    <span className="row-main">
                                      <span className="row-title">{o.plan.name}</span>
                                      <span className="row-sub">{o.plan.dayOfMonth > 0 ? shortDay(o.date) : '日付未設定'}・カード払い{!o.recorded && '・金額は目安'}</span>
                                    </span>
                                    <span className="row-amount">{o.amount.toLocaleString()}円</span>
                                    {!isFutureMonth && dueAction(o.recorded ? '記録済み' : r.done ? '—' : null, () => recordOcc(o), '記録')}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="section-header">
              <h3>{monthLabel(month)}</h3>
              <span className="month-nav">
                <button className="link-btn" onClick={() => setMonth(shiftMonth(month, -1))}>‹ 前月</button>
                <button className="link-btn" onClick={() => setMonth(shiftMonth(month, 1))}>翌月 ›</button>
              </span>
            </div>

            <TagFilter tags={tags} selected={filterTags} onChange={setFilterTags} />

            {monthEntries.length === 0 ? (
              <p className="empty-hint">
                {filterTags.length > 0
                  ? <>絞り込みに一致する記録がありません<br />タグを外すと全件表示されます</>
                  : <>この月の記録がありません<br />+ボタンで追加できます</>}
              </p>
            ) : (
              <ul className="item-list">
                {monthEntries.map(e => {
                  const wallet = wallets.find(w => w.id === e.walletId)
                  return (
                    <li key={e.id}>
                      <button className="row-card" onClick={() => openEntry(e)}>
                        <GenreDot genres={genres} genreId={e.genreId} fallback={<PiReceipt />} />
                        <span className="row-main">
                          <span className="row-title">{e.label}</span>
                          <span className="row-sub">
                            {e.date}
                            {e.transfer && <span className="row-chip">振替</span>}
                            <TagList tags={tags} ids={e.tagIds} />
                          </span>
                        </span>
                        <span className="row-right">
                          <span className={`row-amount ${e.amount < 0 ? 'remaining-negative' : 'remaining-positive'}`}>
                            {e.amount > 0 ? '+' : '-'}{Math.abs(e.amount).toLocaleString()}円
                          </span>
                          <span className="row-note">{wallet?.name ?? '?'}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        ) : (
          <>
            <div className="hero-card">
              <div className="hero-label">純資産</div>
              <div className="hero-number">¥{totalBalance.toLocaleString()}</div>
            </div>

            <div className="section-header">
              <h3>口座別資産 ({walletSession.editing ? walletSession.draft.length : wallets.length})</h3>
              {wallets.length > 1 && !walletSession.editing && (
                <ReorderButton onClick={() => walletSession.start(wallets)} />
              )}
            </div>

            {walletSession.editing && (
              <EditToolbar
                selectedCount={walletSession.selected.size}
                removedCount={walletSession.removed.length}
                accent={theme.accent}
                onCancel={walletSession.cancel}
                onDelete={walletSession.removeSelected}
                onDone={() => walletSession.removed.length > 0 ? setConfirmWalletSave(true) : commitWalletEdit()}
              />
            )}

            {walletSession.editing ? (
              <EditableList
                rows={walletSession.draft.map(w => ({ id: w.id, content: walletBody(w) }))}
                selected={walletSession.selected}
                accent={theme.accent}
                onToggle={walletSession.toggle}
                onReorder={walletSession.reorder}
              />
            ) : wallets.length === 0 ? (
              <p className="empty-hint">口座がありません<br />+ボタンで追加できます</p>
            ) : (
              <ul className="item-list">
                {wallets.map(w => (
                  <li key={w.id}>
                    <button
                      className="row-card"
                      onClick={() => {
                        setWalletError('')
                        setWalletDraft({
                          id: w.id, name: w.name, balance: w.balance,
                          isCredit: w.isCredit, billingDay: w.billingDay, payFromWalletId: w.payFromWalletId,
                          closingDay: w.closingDay, payMonthOffset: w.payMonthOffset,
                        })
                      }}
                    >
                      {walletBody(w)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* 引き落とし予定を開いている間は、右端の「記録」「清算」ボタンに重ならないよう＋を隠す（閉じれば戻る） */}
        {!walletSession.editing && !(tab === 'ledger' && openDue) && (
          <div className="fab-row">
            <button
              className="fab"
              style={{ background: theme.accent, boxShadow: `0 4px 14px ${theme.accent}66` }}
              onClick={tab === 'ledger' ? openNewEntry : openNewWallet}
            >
              +
            </button>
          </div>
        )}
      </div>

      {savedElsewhere && (
        <div className="toast" role="status">
          <span>{monthLabel(savedElsewhere)}の記録に入りました</span>
          <button
            className="toast-action"
            onClick={() => { setMonth(savedElsewhere); setTab('ledger'); setSavedElsewhere(null) }}
          >
            見る
          </button>
        </div>
      )}

      {draft && (
        <DetailModal
          icon={draftGenre?.icon ?? <PiReceipt />}
          color={draftGenre ? `${draftGenre.color}55` : theme.soft}
          name={draft.label}
          onNameChange={v => setDraft({ ...draft, label: v })}
          namePlaceholder="例: 新幹線"
          onClose={() => { setDraft(null); setEntryError('') }}
          onSave={saveEntry}
          startInEdit={draft.id === null}
          error={entryError}
          onDelete={draft.id ? () => setDeleteTarget({ kind: 'entry', id: draft.id!, name: draft.label }) : undefined}
        >
          <DetailRow icon={<PiArrowsClockwise />} label="種別" value={<ReadValue>{draft.type === 'expense' ? '支出' : '収入'}</ReadValue>}>
            <div className="type-toggle">
              <button
                className={draft.type !== 'expense' ? 'btn-sub' : ''}
                onClick={() => setDraft({ ...draft, type: 'expense' })}
              >支出</button>
              <button
                className={draft.type !== 'income' ? 'btn-sub' : ''}
                onClick={() => setDraft({ ...draft, type: 'income' })}
              >収入</button>
            </div>
          </DetailRow>

          <DetailRow
            icon={<PiCoins />}
            label="金額"
            value={
              <ReadValue>
                {draft.type === 'expense' ? '−' : '+'}{yen(draft.amount)}
              </ReadValue>
            }
          >
            <input
              type="number"
              value={draft.amount || ''}
              onChange={e => setDraft({ ...draft, amount: Number(e.target.value) })}
              placeholder={draft.planHint ? `目安 ${draft.planHint.toLocaleString()}` : '0'}
              min={0}
            />
            {draft.planHint !== undefined && draft.planHint > 0 && (
              <p className="summary" style={{ marginTop: '0.4rem' }}>
                {draft.amount === draft.planHint
                  ? '登録額を入れています。今月の額が違えば書き換えてください'
                  : `登録額は${yen(draft.planHint)}です`}
              </p>
            )}
          </DetailRow>

          <DetailRow icon={<PiCalendarBlank />} label="日付" value={<ReadValue>{draft.date}</ReadValue>}>
            <input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
          </DetailRow>

          <DetailRow
            icon={<PiCreditCard />}
            label="口座"
            value={<ReadValue>{wallets.find(w => w.id === draft.walletId)?.name ?? '未設定'}</ReadValue>}
          >
            <select value={draft.walletId} onChange={e => setDraft({ ...draft, walletId: e.target.value })}>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </DetailRow>

          <DetailRow
            icon={<PiSquaresFour />}
            label="ジャンル"
            value={
              <ReadValue muted={!draftGenre}>
                {draftGenre ? `${draftGenre.icon} ${draftGenre.name}` : '未設定'}
              </ReadValue>
            }
          >
            <GenreSelect
              genres={genres} value={draft.genreId} onChange={v => setDraft({ ...draft, genreId: v })}
              accent={theme.accent} onCreate={g => onSaveGenre({ id: null, ...g })}
            />
          </DetailRow>

          <DetailBlock
            icon={<PiTag />}
            label="タグ"
            value={draft.tagIds.length > 0
              ? <TagList tags={tags} ids={draft.tagIds} />
              : <span className="summary">なし</span>}
          >
            <TagPicker
              tags={tags} value={draft.tagIds} onChange={ids => setDraft({ ...draft, tagIds: ids })}
              accent={theme.accent} onCreate={t => onSaveTag({ id: null, name: t.name, color: t.color, icon: '' })}
            />
          </DetailBlock>

          <DetailBlock
            icon={<PiNotePencil />}
            label="メモ"
            value={<p className={draft.memo ? 'detail-memo' : 'summary'}>{draft.memo || 'なし'}</p>}
          >
            <textarea
              value={draft.memo}
              onChange={e => setDraft({ ...draft, memo: e.target.value })}
              placeholder="メモを追加..."
              rows={4}
            />
          </DetailBlock>
        </DetailModal>
      )}

      {walletDraft && (
        <DetailModal
          icon={<PiCreditCard />}
          color={theme.soft}
          name={walletDraft.name}
          onNameChange={v => setWalletDraft({ ...walletDraft, name: v })}
          namePlaceholder={walletDraft.isCredit ? '例: 楽天カード' : '例: PayPay'}
          onClose={() => { setWalletDraft(null); setWalletError('') }}
          onSave={saveWallet}
          startInEdit={walletDraft.id === null}
          error={walletError}
          onDelete={walletDraft.id ? () => setDeleteTarget({ kind: 'wallet', id: walletDraft.id!, name: walletDraft.name }) : undefined}
        >
          <DetailRow
            icon={<PiArrowsClockwise />}
            label="種類"
            value={<ReadValue>{walletDraft.isCredit ? 'クレジットカード' : 'ふつうの口座'}</ReadValue>}
          >
            <div className="type-toggle">
              <button
                className={walletDraft.isCredit ? 'btn-sub' : ''}
                onClick={() => setWalletDraft({ ...walletDraft, isCredit: false })}
              >ふつうの口座</button>
              <button
                className={!walletDraft.isCredit ? 'btn-sub' : ''}
                onClick={() => setWalletDraft({ ...walletDraft, isCredit: true })}
              >クレジットカード</button>
            </div>
          </DetailRow>

          <DetailRow
            icon={<PiCoins />}
            label={walletDraft.isCredit ? '未精算の残高' : '残高'}
            value={<ReadValue>{yen(walletDraft.balance)}</ReadValue>}
          >
            <input
              type="number"
              value={walletDraft.balance || ''}
              onChange={e => setWalletDraft({ ...walletDraft, balance: Number(e.target.value) })}
              placeholder="0"
            />
          </DetailRow>
          <DetailRow icon={<PiLightbulb />} label="" value={null}>
            <span className="summary">取引を記録すると自動で増減します</span>
          </DetailRow>

          {walletDraft.isCredit && (
            <>
              <DetailRow
                icon={<PiCalendarBlank />}
                label="締め日"
                value={
                  <ReadValue muted={walletDraft.closingDay === 0}>
                    {walletDraft.closingDay === 0 ? '未設定' : walletDraft.closingDay >= 31 ? '月末' : `毎月${walletDraft.closingDay}日`}
                  </ReadValue>
                }
              >
                <input
                  type="number"
                  value={walletDraft.closingDay || ''}
                  onChange={e => setWalletDraft({ ...walletDraft, closingDay: Number(e.target.value) })}
                  placeholder="毎月◯日（月末は31・任意）"
                  min={1}
                  max={31}
                />
              </DetailRow>

              <DetailRow
                icon={<PiArrowsClockwise />}
                label="支払い月"
                value={<ReadValue>{walletDraft.payMonthOffset === 2 ? '締めた翌々月' : '締めた翌月'}</ReadValue>}
              >
                <div className="type-toggle">
                  <button
                    className={walletDraft.payMonthOffset === 2 ? 'btn-sub' : ''}
                    onClick={() => setWalletDraft({ ...walletDraft, payMonthOffset: 1 })}
                  >翌月</button>
                  <button
                    className={walletDraft.payMonthOffset !== 2 ? 'btn-sub' : ''}
                    onClick={() => setWalletDraft({ ...walletDraft, payMonthOffset: 2 })}
                  >翌々月</button>
                </div>
              </DetailRow>

              <DetailRow
                icon={<PiCalendarBlank />}
                label="引き落とし日"
                value={
                  <ReadValue muted={walletDraft.billingDay === 0}>
                    {walletDraft.billingDay > 0 ? `毎月${walletDraft.billingDay}日` : '未設定'}
                  </ReadValue>
                }
              >
                <input
                  type="number"
                  value={walletDraft.billingDay || ''}
                  onChange={e => setWalletDraft({ ...walletDraft, billingDay: Number(e.target.value) })}
                  placeholder="毎月◯日（任意）"
                  min={1}
                  max={31}
                />
              </DetailRow>

              <DetailRow
                icon={<PiWallet />}
                label="引き落とし元の口座"
                value={
                  <ReadValue muted={!walletDraft.payFromWalletId}>
                    {wallets.find(w => w.id === walletDraft.payFromWalletId)?.name ?? '未設定'}
                  </ReadValue>
                }
              >
                <select
                  value={walletDraft.payFromWalletId}
                  onChange={e => setWalletDraft({ ...walletDraft, payFromWalletId: e.target.value })}
                >
                  <option value="">未設定</option>
                  {wallets.filter(w => w.id !== walletDraft.id).map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </DetailRow>

              {walletDraft.balance < 0 && (() => {
                const saved = wallets.find(w => w.id === walletDraft.id)
                const { face, partial } = saved ? settleFace(saved) : { face: -walletDraft.balance, partial: false }
                const settleBody = walletDraft.payFromWalletId ? (
                  <button className="btn-sub" style={{ width: '100%' }} onClick={() => saved && openSettle(saved)}>
                    {partial ? `今月の請求 ${yen(face)}` : `未精算 ${yen(face)}`} を清算する
                  </button>
                ) : (
                  <p className="summary">清算するには、先に「引き落とし元の口座」を設定してください</p>
                )
                return (
                  <DetailRow icon={<PiReceipt />} label="清算" value={settleBody}>
                    {settleBody}
                  </DetailRow>
                )
              })()}
            </>
          )}
        </DetailModal>
      )}

      {settleTarget && (
        <Sheet onClose={() => setSettleTarget(null)} sheetClassName="modal">
          {requestClose => (
            <>
              <div className="modal-title">清算 - {settleTarget.name}</div>
              <p className="summary" style={{ marginBottom: '0.75rem' }}>
                {settleTarget.partial ? '今月の請求額' : '未精算の合計'} {yen(settleTarget.faceTotal)}
              </p>
              {settleTarget.partial && (
                <p className="summary" style={{ marginBottom: '0.75rem' }}>
                  締め日より後に使った分は来月の請求として残ります
                </p>
              )}
              {settleTarget.unrecorded.length > 0 && (
                <p className="summary remaining-negative" style={{ marginBottom: '0.75rem' }}>
                  まだ記録していない定期支出があります（{settleTarget.unrecorded.map(o => o.plan.name).join('、')}）。
                  先に引き落とし予定から記録すると、請求額に含まれます
                </p>
              )}
              <div className="form-row">
                <label>実際に引き落とされた額</label>
                <input
                  type="number"
                  value={settleAmount || ''}
                  onChange={e => setSettleAmount(Number(e.target.value))}
                  placeholder="0"
                  min={0}
                />
              </div>
              <p className="summary" style={{ marginBottom: '0.75rem' }}>
                割引・キャッシュバックが入るカードは、実際に引き落とされる金額に書き換えてください
              </p>
              <div className="form-actions">
                <button className="btn-sub" onClick={requestClose}>キャンセル</button>
                <button style={{ background: theme.accent }} onClick={confirmSettle}>清算する</button>
              </div>
            </>
          )}
        </Sheet>
      )}

      {deleteTarget && (
        <ConfirmModal
          message={
            deleteTarget.kind === 'wallet'
              ? `「${deleteTarget.name}」を削除します。関連する取引記録も削除されます。よろしいですか？`
              : `「${deleteTarget.name}」の記録を削除します。よろしいですか？`
          }
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget.kind === 'wallet') { onRemoveWallet(deleteTarget.id); setWalletDraft(null) }
            else { onRemoveEntry(deleteTarget.id); setDraft(null) }
            setDeleteTarget(null)
          }}
        />
      )}

      {confirmWalletSave && (
        <ConfirmModal
          message={`${walletSession.removed.length}件の口座を削除して並び順を保存します。それぞれの取引記録も消え、取り消せません。よろしいですか？`}
          confirmText="保存する"
          onCancel={() => setConfirmWalletSave(false)}
          onConfirm={commitWalletEdit}
        />
      )}
    </div>
  )
}

export type { EntryDraft, WalletDraft }

