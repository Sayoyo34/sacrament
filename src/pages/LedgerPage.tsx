import { useState } from 'react'
import type { Genre, LedgerEntry, Tag, Wallet } from '../types'
import DetailModal, { DetailBlock, DetailRow } from '../components/DetailModal'
import ConfirmModal from '../components/ConfirmModal'
import { GenreDot, GenreSelect, TagList, TagPicker } from '../components/Pickers'
import TopTabs from '../components/TopTabs'
import { themeOf } from '../theme'
import { monthLabel, monthOf, thisMonth, todayStr, yen } from '../utils'

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
}

interface WalletDraft {
  id: string | null
  name: string
  balance: number
}

interface Props {
  wallets: Wallet[]
  entries: LedgerEntry[]
  genres: Genre[]
  tags: Tag[]
  totalBalance: number
  onSaveEntry: (draft: EntryDraft) => void
  onRemoveEntry: (id: string) => void
  onSaveWallet: (draft: WalletDraft) => void
  onRemoveWallet: (id: string) => void
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function LedgerPage({
  wallets, entries, genres, tags, totalBalance,
  onSaveEntry, onRemoveEntry, onSaveWallet, onRemoveWallet,
}: Props) {
  const theme = themeOf('ledger')
  const [tab, setTab] = useState<Tab>('ledger')
  const [month, setMonth] = useState(thisMonth())
  const [draft, setDraft] = useState<EntryDraft | null>(null)
  const [walletDraft, setWalletDraft] = useState<WalletDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'entry' | 'wallet'; id: string; name: string } | null>(null)

  const monthEntries = entries
    .filter(e => monthOf(e.date) === month)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))

  const monthExpense = monthEntries
    .filter(e => e.amount < 0)
    .reduce((s, e) => s + Math.abs(e.amount), 0)

  function openNewEntry() {
    if (wallets.length === 0) { setTab('wallet'); openNewWallet(); return }
    setDraft({
      id: null, label: '', amount: 0, type: 'expense', date: todayStr(),
      walletId: wallets[0].id, genreId: '', tagIds: [], memo: '',
    })
  }

  function openEntry(e: LedgerEntry) {
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

  function saveEntry() {
    if (!draft || !draft.label.trim() || !draft.walletId || draft.amount === 0) return
    onSaveEntry({ ...draft, label: draft.label.trim() })
    setDraft(null)
  }

  function openNewWallet() {
    setWalletDraft({ id: null, name: '', balance: 0 })
  }

  function saveWallet() {
    if (!walletDraft || !walletDraft.name.trim()) return
    onSaveWallet({ ...walletDraft, name: walletDraft.name.trim() })
    setWalletDraft(null)
  }

  const draftGenre = genres.find(g => g.id === draft?.genreId)

  return (
    <div className="page">
      <TopTabs
        tabs={[{ id: 'ledger' as Tab, label: '家計簿' }, { id: 'wallet' as Tab, label: '財布' }]}
        active={tab}
        onChange={setTab}
        accent={theme.accent}
        soft={theme.soft}
      />

      <div className="page-scroll">
        {tab === 'ledger' ? (
          <>
            <div className="hero-card">
              <div className="hero-label">{monthLabel(month)}の出費</div>
              <div className="hero-number">¥{monthExpense.toLocaleString()}</div>
            </div>

            <div className="section-header">
              <h3>{monthLabel(month)}</h3>
              <span className="month-nav">
                <button className="link-btn" onClick={() => setMonth(shiftMonth(month, -1))}>‹ 前月</button>
                <button className="link-btn" onClick={() => setMonth(shiftMonth(month, 1))}>翌月 ›</button>
              </span>
            </div>

            {monthEntries.length === 0 ? (
              <p className="empty-hint">この月の記録がありません<br />+ボタンで追加できます</p>
            ) : (
              <ul className="item-list">
                {monthEntries.map(e => {
                  const wallet = wallets.find(w => w.id === e.walletId)
                  return (
                    <li key={e.id}>
                      <button className="row-card" onClick={() => openEntry(e)}>
                        <GenreDot genres={genres} genreId={e.genreId} fallback="📝" />
                        <span className="row-main">
                          <span className="row-title">{e.label}</span>
                          <span className="row-sub">
                            {e.date}
                            <TagList tags={tags} ids={e.tagIds} />
                          </span>
                        </span>
                        <span className="row-right">
                          <span className={`row-amount ${e.amount < 0 ? 'remaining-negative' : 'remaining-positive'}`}>
                            {e.amount > 0 ? '+' : '-'}¥{Math.abs(e.amount).toLocaleString()}
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

            <div className="section-header"><h3>口座別資産</h3></div>
            {wallets.length === 0 ? (
              <p className="empty-hint">口座がありません<br />+ボタンで追加できます</p>
            ) : (
              <ul className="item-list">
                {wallets.map(w => (
                  <li key={w.id}>
                    <button className="row-card" onClick={() => setWalletDraft({ id: w.id, name: w.name, balance: w.balance })}>
                      <GenreDot genres={genres} genreId="" fallback="💳" />
                      <span className="row-main">
                        <span className="row-title">{w.name}</span>
                      </span>
                      <span className={`row-amount${w.balance < 0 ? ' remaining-negative' : ''}`}>
                        ¥{w.balance.toLocaleString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="fab-row">
          <button
            className="fab"
            style={{ background: theme.accent, boxShadow: `0 4px 14px ${theme.accent}66` }}
            onClick={tab === 'ledger' ? openNewEntry : openNewWallet}
          >
            +
          </button>
        </div>
      </div>

      {draft && (
        <DetailModal
          icon={draftGenre?.icon ?? '📝'}
          color={draftGenre ? `${draftGenre.color}55` : theme.soft}
          name={draft.label}
          onNameChange={v => setDraft({ ...draft, label: v })}
          namePlaceholder="例: 新幹線"
          onClose={() => setDraft(null)}
          onSave={saveEntry}
          onDelete={draft.id ? () => setDeleteTarget({ kind: 'entry', id: draft.id!, name: draft.label }) : undefined}
        >
          <DetailRow icon="🔁" label="種別">
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

          <DetailRow icon="💰" label="金額">
            <input
              type="number"
              value={draft.amount || ''}
              onChange={e => setDraft({ ...draft, amount: Number(e.target.value) })}
              placeholder="0"
              min={0}
            />
          </DetailRow>

          <DetailRow icon="📅" label="日付">
            <input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
          </DetailRow>

          <DetailRow icon="💳" label="口座">
            <select value={draft.walletId} onChange={e => setDraft({ ...draft, walletId: e.target.value })}>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </DetailRow>

          <DetailRow icon="💙" label="ジャンル">
            <GenreSelect genres={genres} value={draft.genreId} onChange={v => setDraft({ ...draft, genreId: v })} />
          </DetailRow>

          <DetailBlock icon="🏷" label="タグ">
            <TagPicker tags={tags} value={draft.tagIds} onChange={ids => setDraft({ ...draft, tagIds: ids })} />
          </DetailBlock>

          <DetailBlock icon="📝" label="メモ">
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
          icon="💳"
          color={theme.soft}
          name={walletDraft.name}
          onNameChange={v => setWalletDraft({ ...walletDraft, name: v })}
          namePlaceholder="例: PayPay"
          onClose={() => setWalletDraft(null)}
          onSave={saveWallet}
          onDelete={walletDraft.id ? () => setDeleteTarget({ kind: 'wallet', id: walletDraft.id!, name: walletDraft.name }) : undefined}
        >
          <DetailRow icon="💰" label="残高">
            <input
              type="number"
              value={walletDraft.balance || ''}
              onChange={e => setWalletDraft({ ...walletDraft, balance: Number(e.target.value) })}
              placeholder="0"
            />
          </DetailRow>
          <p className="summary" style={{ padding: '0.5rem 0.25rem' }}>
            現在の残高 {yen(walletDraft.balance)}。取引を記録すると自動で増減します。
          </p>
        </DetailModal>
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
    </div>
  )
}

export type { EntryDraft, WalletDraft }

