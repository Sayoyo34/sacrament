import { useState } from 'react'
import type { Wallet, LedgerEntry } from '../types'

interface Props {
  wallets: Wallet[]
  entries: LedgerEntry[]
  totalBalance: number
  onAddWallet: (name: string, initial: number) => void
  onEditWallet: (id: string, name: string, balance: number) => void
  onRemoveWallet: (id: string) => void
  onAddEntry: (walletId: string, label: string, amount: number, type: 'expense' | 'income') => void
  onRemoveEntry: (id: string) => void
}

export default function LedgerPage({
  wallets, entries, totalBalance,
  onAddWallet, onEditWallet, onRemoveWallet, onAddEntry, onRemoveEntry,
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

  const [entryWalletId, setEntryWalletId] = useState('')
  const [entryLabel, setEntryLabel] = useState('')
  const [entryAmount, setEntryAmount] = useState<number>(0)
  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense')

  const [walletName, setWalletName] = useState('')
  const [walletInitial, setWalletInitial] = useState<number>(0)

  function openEntryModal() {
    if (wallets.length === 0) { setWalletModal(true); return }
    if (!entryWalletId) setEntryWalletId(wallets[0].id)
    setEntryModal(true)
  }

  function handleAddEntry() {
    if (!entryLabel.trim() || !entryWalletId || entryAmount === 0) return
    onAddEntry(entryWalletId, entryLabel.trim(), entryAmount, entryType)
    setEntryLabel('')
    setEntryAmount(0)
    setEntryType('expense')
    setEntryModal(false)
  }

  function handleAddWallet() {
    if (!walletName.trim()) return
    onAddWallet(walletName.trim(), walletInitial)
    setWalletName('')
    setWalletInitial(0)
  }

  const recentEntries = [...entries].reverse().slice(0, 20)

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

        {/* 出費一覧 */}
        <div className="section-header">
          <h3>最近の出費一覧</h3>
          {entries.length > 0 && (
            <button className="btn-sub" onClick={() => setEditMode(e => !e)}>
              {editMode ? '完了' : '編集'}
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="empty-hint">まだ記録がありません</p>
        ) : (
          <ul className="item-list">
            {recentEntries.map(e => {
              const wallet = wallets.find(w => w.id === e.walletId)
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
                    {editMode && (
                      <button className="btn-danger" onClick={() => onRemoveEntry(e.id)}>削除</button>
                    )}
                  </div>
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
                      <button className="btn-danger" onClick={() => { onRemoveWallet(w.id); setEditingWalletId(null) }}>削除</button>
                    </div>
                  </div>
                ) : (
                  <div className="wallet-row">
                    <span className="wallet-name">{w.name}</span>
                    <span className="wallet-balance">{w.balance.toLocaleString()}円</span>
                    <button className="btn-sub" onClick={() => startWalletEdit(w)}>編集</button>
                    <button className="btn-danger" onClick={() => onRemoveWallet(w.id)}>削除</button>
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
    </div>
  )
}
