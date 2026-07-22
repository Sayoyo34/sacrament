import { useState } from 'react'
import type { Wallet, LedgerEntry, RecurringExpense } from '../types'
import ConfirmModal from '../components/ConfirmModal'

interface Props {
  wallets: Wallet[]
  entries: LedgerEntry[]
  recurringExpenses: RecurringExpense[]
  totalBalance: number
  onAddWallet: (name: string, initial: number) => void
  onEditWallet: (id: string, name: string, balance: number) => void
  onRemoveWallet: (id: string) => void
  onAddEntry: (walletId: string, label: string, amount: number, type: 'expense' | 'income', date: string) => void
  onEditEntry: (id: string, walletId: string, label: string, amount: number, type: 'expense' | 'income', date: string) => void
  onRemoveEntry: (id: string) => void
  onAddRecurring: (name: string, amount: number, dayOfMonth: number, walletId: string) => void
  onEditRecurring: (id: string, name: string, amount: number, dayOfMonth: number, walletId: string) => void
  onRemoveRecurring: (id: string) => void
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function LedgerPage({
  wallets, entries, recurringExpenses, totalBalance,
  onAddWallet, onEditWallet, onRemoveWallet, onAddEntry, onEditEntry, onRemoveEntry,
  onAddRecurring, onEditRecurring, onRemoveRecurring,
}: Props) {
  const [entryModal, setEntryModal] = useState(false)
  const [walletModal, setWalletModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null)
  const [editWalletName, setEditWalletName] = useState('')
  const [editWalletBalance, setEditWalletBalance] = useState<number>(0)

  function startWalletEdit(w: Wallet) {
    setEditingWalletId(w.id)
    setEditWalletName(w.name)
    setEditWalletBalance(w.balance)
  }

  function saveWalletEdit() {
    if (!editingWalletId || !editWalletName.trim()) return
    onEditWallet(editingWalletId, editWalletName.trim(), editWalletBalance)
    setEditingWalletId(null)
  }

  const [recurringModal, setRecurringModal] = useState(false)
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null)
  const [editRecurringName, setEditRecurringName] = useState('')
  const [editRecurringAmount, setEditRecurringAmount] = useState<number>(0)
  const [editRecurringDay, setEditRecurringDay] = useState<number>(0)
  const [editRecurringWalletId, setEditRecurringWalletId] = useState('')

  const [recurringName, setRecurringName] = useState('')
  const [recurringAmount, setRecurringAmount] = useState<number>(0)
  const [recurringDay, setRecurringDay] = useState<number>(0)
  const [recurringWalletId, setRecurringWalletId] = useState('')

  const [deleteRecurringTarget, setDeleteRecurringTarget] = useState<{ id: string; name: string } | null>(null)

  function openRecurringModal() {
    if (wallets.length === 0) { setWalletModal(true); return }
    if (!recurringWalletId) setRecurringWalletId(wallets[0].id)
    setRecurringModal(true)
  }

  function startRecurringEdit(r: RecurringExpense) {
    setEditingRecurringId(r.id)
    setEditRecurringName(r.name)
    setEditRecurringAmount(r.amount)
    setEditRecurringDay(r.dayOfMonth)
    setEditRecurringWalletId(r.walletId)
  }

  function saveRecurringEdit() {
    if (!editingRecurringId || !editRecurringName.trim() || !editRecurringWalletId) return
    onEditRecurring(editingRecurringId, editRecurringName.trim(), editRecurringAmount, editRecurringDay, editRecurringWalletId)
    setEditingRecurringId(null)
  }

  function handleAddRecurring() {
    if (!recurringName.trim() || !recurringWalletId) return
    onAddRecurring(recurringName.trim(), recurringAmount, recurringDay, recurringWalletId)
    setRecurringName('')
    setRecurringAmount(0)
    setRecurringDay(0)
  }

  const monthlyRecurringTotal = recurringExpenses.reduce((s, r) => s + r.amount, 0)

  const [entryWalletId, setEntryWalletId] = useState('')
  const [entryLabel, setEntryLabel] = useState('')
  const [entryAmount, setEntryAmount] = useState<number>(0)
  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense')
  const [entryDate, setEntryDate] = useState(todayStr())

  const [walletName, setWalletName] = useState('')
  const [walletInitial, setWalletInitial] = useState<number>(0)

  const [deleteWalletTarget, setDeleteWalletTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteEntryTarget, setDeleteEntryTarget] = useState<{ id: string; label: string } | null>(null)

  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editEntryWalletId, setEditEntryWalletId] = useState('')
  const [editEntryLabel, setEditEntryLabel] = useState('')
  const [editEntryAmount, setEditEntryAmount] = useState<number>(0)
  const [editEntryType, setEditEntryType] = useState<'expense' | 'income'>('expense')
  const [editEntryDate, setEditEntryDate] = useState('')

  function startEntryEdit(e: LedgerEntry) {
    setEditingEntryId(e.id)
    setEditEntryWalletId(e.walletId)
    setEditEntryLabel(e.label)
    setEditEntryAmount(Math.abs(e.amount))
    setEditEntryType(e.amount < 0 ? 'expense' : 'income')
    setEditEntryDate(e.date || todayStr())
  }

  function saveEntryEdit() {
    if (!editingEntryId || !editEntryLabel.trim() || !editEntryWalletId || editEntryAmount === 0) return
    onEditEntry(editingEntryId, editEntryWalletId, editEntryLabel.trim(), editEntryAmount, editEntryType, editEntryDate)
    setEditingEntryId(null)
  }

  function openEntryModal() {
    if (wallets.length === 0) { setWalletModal(true); return }
    if (!entryWalletId) setEntryWalletId(wallets[0].id)
    setEntryModal(true)
  }

  function handleAddEntry() {
    if (!entryLabel.trim() || !entryWalletId || entryAmount === 0) return
    onAddEntry(entryWalletId, entryLabel.trim(), entryAmount, entryType, entryDate)
    setEntryLabel('')
    setEntryAmount(0)
    setEntryType('expense')
    setEntryDate(todayStr())
    setEntryModal(false)
  }

  function handleAddWallet() {
    if (!walletName.trim()) return
    onAddWallet(walletName.trim(), walletInitial)
    setWalletName('')
    setWalletInitial(0)
  }

  const filteredEntries = entries
    .filter(e => {
      if (filterFrom && (!e.date || e.date < filterFrom)) return false
      if (filterTo && (!e.date || e.date > filterTo)) return false
      return true
    })
    .slice()
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  return (
    <div className="page">
      <div className="page-scroll">
        {/* 純資産 */}
        <div className="card stat-card">
          <div className="stat-label">純資産</div>
          <div className={`stat-number${totalBalance < 0 ? ' negative' : ''}`}>
            {totalBalance.toLocaleString()}円
          </div>
        </div>

        {/* 口座別資産 */}
        <div className="card">
          <div className="section-header" style={{ marginTop: 0 }}>
            <h3>口座別資産</h3>
          </div>
          {wallets.length === 0 ? (
            <p className="summary" style={{ padding: '0.25rem 0' }}>口座がありません</p>
          ) : (
            wallets.map(w => (
              <div key={w.id} className="wallet-row">
                <span className="wallet-name">{w.name}</span>
                <span className={`wallet-balance${w.balance < 0 ? ' negative' : ''}`}>
                  {w.balance.toLocaleString()}円
                </span>
              </div>
            ))
          )}
          <button className="link-btn" onClick={() => setWalletModal(true)}>
            &gt; 口座の追加・編集
          </button>
        </div>

        {/* 定期支出 */}
        <div className="card">
          <div className="section-header" style={{ marginTop: 0 }}>
            <h3>定期支出</h3>
          </div>
          {recurringExpenses.length === 0 ? (
            <p className="summary" style={{ padding: '0.25rem 0' }}>登録がありません</p>
          ) : (
            <>
              <div className="summary" style={{ padding: '0.25rem 0' }}>
                月額(目安) {monthlyRecurringTotal.toLocaleString()}円
              </div>
              {recurringExpenses
                .slice()
                .sort((a, b) => a.dayOfMonth - b.dayOfMonth)
                .map(r => {
                  const wallet = wallets.find(w => w.id === r.walletId)
                  return (
                    <div key={r.id} className="wallet-row">
                      <span className="wallet-name">
                        {r.dayOfMonth > 0 ? `毎月${r.dayOfMonth}日　` : ''}{r.name}
                        <span className="entry-wallet-tag" style={{ marginLeft: '0.4rem' }}>{wallet?.name ?? '?'}</span>
                      </span>
                      <span className="wallet-balance">{r.amount.toLocaleString()}円</span>
                    </div>
                  )
                })}
            </>
          )}
          <button className="link-btn" onClick={openRecurringModal}>
            &gt; 定期支出の管理
          </button>
        </div>

        {/* 出費履歴 */}
        <div className="section-header">
          <h3>出費履歴</h3>
          {entries.length > 0 && (
            <button className="btn-sub" onClick={() => { setEditMode(e => !e); setEditingEntryId(null) }}>
              {editMode ? '完了' : '編集'}
            </button>
          )}
        </div>

        {entries.length > 0 && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              style={{ flex: 1, minWidth: '130px' }}
            />
            <span className="summary">〜</span>
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              style={{ flex: 1, minWidth: '130px' }}
            />
            {(filterFrom || filterTo) && (
              <button className="btn-sub" onClick={() => { setFilterFrom(''); setFilterTo('') }}>クリア</button>
            )}
          </div>
        )}

        {entries.length === 0 ? (
          <p className="empty-hint">まだ記録がありません</p>
        ) : filteredEntries.length === 0 ? (
          <p className="empty-hint">この期間の記録がありません</p>
        ) : (
          <ul className="item-list">
            {filteredEntries.map(e => {
              const wallet = wallets.find(w => w.id === e.walletId)

              if (editMode && editingEntryId === e.id) {
                return (
                  <li key={e.id} className="item-card">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div className="type-toggle">
                        <button
                          className={editEntryType !== 'expense' ? 'btn-sub' : ''}
                          onClick={() => setEditEntryType('expense')}
                        >支出</button>
                        <button
                          className={editEntryType !== 'income' ? 'btn-sub' : ''}
                          onClick={() => setEditEntryType('income')}
                        >収入</button>
                      </div>
                      <select value={editEntryWalletId} onChange={ev => setEditEntryWalletId(ev.target.value)}>
                        {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                      <input
                        value={editEntryLabel}
                        onChange={ev => setEditEntryLabel(ev.target.value)}
                        placeholder="項目名"
                      />
                      <input
                        type="number"
                        value={editEntryAmount || ''}
                        onChange={ev => setEditEntryAmount(Number(ev.target.value))}
                        placeholder="金額"
                        min={0}
                      />
                      <input
                        type="date"
                        value={editEntryDate}
                        onChange={ev => setEditEntryDate(ev.target.value)}
                      />
                      <div className="item-actions">
                        <button onClick={saveEntryEdit}>保存</button>
                        <button className="btn-sub" onClick={() => setEditingEntryId(null)}>キャンセル</button>
                        <button className="btn-danger" onClick={() => { setEditingEntryId(null); setDeleteEntryTarget({ id: e.id, label: e.label }) }}>削除</button>
                      </div>
                    </div>
                  </li>
                )
              }

              return (
                <li key={e.id} className="item-card">
                  <div className="item-card-top">
                    <span className="item-name">
                      <span className="entry-wallet-tag">{wallet?.name ?? '?'}</span>
                      {e.label}
                    </span>
                    <span className={`item-amount ${e.amount < 0 ? 'remaining-negative' : 'remaining-positive'}`}>
                      {e.amount > 0 ? '+' : ''}{e.amount.toLocaleString()}円
                    </span>
                  </div>
                  <div className="summary" style={{ marginTop: '0.15rem' }}>{e.date || '日付不明'}</div>
                  {editMode && (
                    <div className="item-actions">
                      <button className="btn-sub" onClick={() => startEntryEdit(e)}>編集</button>
                      <button className="btn-danger" onClick={() => setDeleteEntryTarget({ id: e.id, label: e.label })}>削除</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="fab-row">
          <button className="fab" onClick={openEntryModal}>+</button>
        </div>
      </div>

      {/* 取引追加モーダル */}
      {entryModal && (
        <div className="modal-overlay" onClick={() => setEntryModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">取引を記録</div>
            <div className="form-row">
              <label>種別</label>
              <div className="type-toggle">
                <button
                  className={entryType !== 'expense' ? 'btn-sub' : ''}
                  onClick={() => setEntryType('expense')}
                >支出</button>
                <button
                  className={entryType !== 'income' ? 'btn-sub' : ''}
                  onClick={() => setEntryType('income')}
                >収入</button>
              </div>
            </div>
            <div className="form-row">
              <label>口座</label>
              <select value={entryWalletId} onChange={e => setEntryWalletId(e.target.value)}>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>項目名</label>
              <input
                value={entryLabel}
                onChange={e => setEntryLabel(e.target.value)}
                placeholder="例: 飯"
                autoFocus
              />
            </div>
            <div className="form-row">
              <label>金額</label>
              <input
                type="number"
                value={entryAmount || ''}
                onChange={e => setEntryAmount(Number(e.target.value))}
                placeholder="0"
                min={0}
              />
            </div>
            <div className="form-row">
              <label>日付</label>
              <input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button className="btn-sub" onClick={() => setEntryModal(false)}>キャンセル</button>
              <button onClick={handleAddEntry}>記録</button>
            </div>
          </div>
        </div>
      )}

      {/* 口座管理モーダル */}
      {walletModal && (
        <div className="modal-overlay" onClick={() => setWalletModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">口座の追加・編集</div>
            {wallets.map(w => (
              <div key={w.id}>
                {editingWalletId === w.id ? (
                  <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <input
                      value={editWalletName}
                      onChange={e => setEditWalletName(e.target.value)}
                      placeholder="口座名"
                    />
                    <input
                      type="number"
                      value={editWalletBalance || ''}
                      onChange={e => setEditWalletBalance(Number(e.target.value))}
                      placeholder="残高"
                    />
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={saveWalletEdit}>保存</button>
                      <button className="btn-sub" onClick={() => setEditingWalletId(null)}>キャンセル</button>
                      <button className="btn-danger" onClick={() => { setEditingWalletId(null); setDeleteWalletTarget({ id: w.id, name: w.name }) }}>削除</button>
                    </div>
                  </div>
                ) : (
                  <div className="wallet-row">
                    <span className="wallet-name">{w.name}</span>
                    <span className="wallet-balance">{w.balance.toLocaleString()}円</span>
                    <button className="btn-sub" onClick={() => startWalletEdit(w)}>編集</button>
                    <button className="btn-danger" onClick={() => setDeleteWalletTarget({ id: w.id, name: w.name })}>削除</button>
                  </div>
                )}
              </div>
            ))}
            <hr className="divider" />
            <div className="form-row">
              <label>口座名</label>
              <input
                value={walletName}
                onChange={e => setWalletName(e.target.value)}
                placeholder="例: PayPay"
              />
            </div>
            <div className="form-row">
              <label>初期残高</label>
              <input
                type="number"
                value={walletInitial || ''}
                onChange={e => setWalletInitial(Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <button style={{ width: '100%', padding: '0.75rem' }} onClick={handleAddWallet}>
              口座を追加
            </button>
          </div>
        </div>
      )}

      {/* 定期支出管理モーダル */}
      {recurringModal && (
        <div className="modal-overlay" onClick={() => setRecurringModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">定期支出の管理</div>
            {recurringExpenses.map(r => (
              <div key={r.id}>
                {editingRecurringId === r.id ? (
                  <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <input
                      value={editRecurringName}
                      onChange={e => setEditRecurringName(e.target.value)}
                      placeholder="名前（例: Netflix）"
                    />
                    <select value={editRecurringWalletId} onChange={e => setEditRecurringWalletId(e.target.value)}>
                      {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <input
                      type="number"
                      value={editRecurringAmount || ''}
                      onChange={e => setEditRecurringAmount(Number(e.target.value))}
                      placeholder="金額"
                      min={0}
                    />
                    <input
                      type="number"
                      value={editRecurringDay || ''}
                      onChange={e => setEditRecurringDay(Number(e.target.value))}
                      placeholder="毎月の引き落とし日（1〜31、任意）"
                      min={1}
                      max={31}
                    />
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={saveRecurringEdit}>保存</button>
                      <button className="btn-sub" onClick={() => setEditingRecurringId(null)}>キャンセル</button>
                      <button className="btn-danger" onClick={() => { setEditingRecurringId(null); setDeleteRecurringTarget({ id: r.id, name: r.name }) }}>削除</button>
                    </div>
                  </div>
                ) : (
                  <div className="wallet-row">
                    <span className="wallet-name">
                      {r.dayOfMonth > 0 ? `毎月${r.dayOfMonth}日　` : ''}{r.name}
                    </span>
                    <span className="wallet-balance">{r.amount.toLocaleString()}円</span>
                    <button className="btn-sub" onClick={() => startRecurringEdit(r)}>編集</button>
                    <button className="btn-danger" onClick={() => setDeleteRecurringTarget({ id: r.id, name: r.name })}>削除</button>
                  </div>
                )}
              </div>
            ))}
            <hr className="divider" />
            <div className="form-row">
              <label>名前</label>
              <input
                value={recurringName}
                onChange={e => setRecurringName(e.target.value)}
                placeholder="例: Netflix"
              />
            </div>
            <div className="form-row">
              <label>口座</label>
              <select value={recurringWalletId} onChange={e => setRecurringWalletId(e.target.value)}>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>金額</label>
              <input
                type="number"
                value={recurringAmount || ''}
                onChange={e => setRecurringAmount(Number(e.target.value))}
                placeholder="0"
                min={0}
              />
            </div>
            <div className="form-row">
              <label>引き落とし日</label>
              <input
                type="number"
                value={recurringDay || ''}
                onChange={e => setRecurringDay(Number(e.target.value))}
                placeholder="毎月◯日（任意）"
                min={1}
                max={31}
              />
            </div>
            <button style={{ width: '100%', padding: '0.75rem' }} onClick={handleAddRecurring}>
              定期支出を追加
            </button>
          </div>
        </div>
      )}

      {deleteWalletTarget && (
        <ConfirmModal
          message={`「${deleteWalletTarget.name}」を削除します。関連する取引記録も削除されます。よろしいですか？`}
          onCancel={() => setDeleteWalletTarget(null)}
          onConfirm={() => { onRemoveWallet(deleteWalletTarget.id); setDeleteWalletTarget(null) }}
        />
      )}

      {deleteEntryTarget && (
        <ConfirmModal
          message={`「${deleteEntryTarget.label}」の記録を削除します。よろしいですか？`}
          onCancel={() => setDeleteEntryTarget(null)}
          onConfirm={() => { onRemoveEntry(deleteEntryTarget.id); setDeleteEntryTarget(null) }}
        />
      )}

      {deleteRecurringTarget && (
        <ConfirmModal
          message={`「${deleteRecurringTarget.name}」を削除します。よろしいですか？`}
          onCancel={() => setDeleteRecurringTarget(null)}
          onConfirm={() => { onRemoveRecurring(deleteRecurringTarget.id); setDeleteRecurringTarget(null) }}
        />
      )}
    </div>
  )
}
