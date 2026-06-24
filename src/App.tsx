import { useState } from 'react'
import type { Wallet, LedgerEntry, BulletItem, Task } from './types'
import './App.css'

function generateId() {
  return Math.random().toString(36).slice(2)
}

function App() {
  // ① 家計簿
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [walletName, setWalletName] = useState('')
  const [walletInitial, setWalletInitial] = useState<number>(0)

  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [entryWalletId, setEntryWalletId] = useState('')
  const [entryLabel, setEntryLabel] = useState('')
  const [entryAmount, setEntryAmount] = useState<number>(0)
  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense')

  // ② バレットジャーナル
  const [bulletItems, setBulletItems] = useState<BulletItem[]>([])
  const [bulletName, setBulletName] = useState('')
  const [bulletCost, setBulletCost] = useState<number>(0)

  // ③ お布施ボーナス
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskName, setTaskName] = useState('')
  const [taskBonus, setTaskBonus] = useState<number>(0)
  const [bonusBalance, setBonusBalance] = useState<number>(0)

  // ウォレット追加
  function addWallet() {
    if (!walletName.trim()) return
    const wallet: Wallet = {
      id: generateId(),
      name: walletName.trim(),
      balance: walletInitial,
    }
    setWallets(prev => [...prev, wallet])
    if (entryWalletId === '') setEntryWalletId(wallet.id)
    setWalletName('')
    setWalletInitial(0)
  }

  function removeWallet(id: string) {
    setWallets(prev => prev.filter(w => w.id !== id))
    setEntries(prev => prev.filter(e => e.walletId !== id))
    if (entryWalletId === id) setEntryWalletId('')
  }

  // 取引追加
  function addEntry() {
    if (!entryLabel.trim() || !entryWalletId || entryAmount === 0) return
    const signed = entryType === 'expense' ? -Math.abs(entryAmount) : Math.abs(entryAmount)
    const entry: LedgerEntry = {
      id: generateId(),
      walletId: entryWalletId,
      label: entryLabel.trim(),
      amount: signed,
    }
    setEntries(prev => [...prev, entry])
    setWallets(prev => prev.map(w => w.id === entryWalletId ? { ...w, balance: w.balance + signed } : w))
    setEntryLabel('')
    setEntryAmount(0)
  }

  function removeEntry(id: string) {
    const entry = entries.find(e => e.id === id)
    if (!entry) return
    setEntries(prev => prev.filter(e => e.id !== id))
    setWallets(prev => prev.map(w => w.id === entry.walletId ? { ...w, balance: w.balance - entry.amount } : w))
  }

  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0)

  // ② バレットジャーナル
  function addBulletItem() {
    if (!bulletName.trim()) return
    const item: BulletItem = {
      id: generateId(),
      name: bulletName.trim(),
      estimatedCost: bulletCost,
      deducted: false,
    }
    setBulletItems(prev => [...prev, item])
    setBulletName('')
    setBulletCost(0)
  }

  function deductItem(id: string) {
    const item = bulletItems.find(i => i.id === id)
    if (!item || item.deducted) return
    setBulletItems(prev => prev.map(i => i.id === id ? { ...i, deducted: true } : i))
  }

  function removeBulletItem(id: string) {
    setBulletItems(prev => prev.filter(i => i.id !== id))
  }

  const totalDeducted = bulletItems.filter(i => i.deducted).reduce((s, i) => s + i.estimatedCost, 0)
  const totalPending = bulletItems.filter(i => !i.deducted).reduce((s, i) => s + i.estimatedCost, 0)
  const remainingBudget = totalBalance + bonusBalance - totalDeducted

  // ③ お布施ボーナス
  function addTask() {
    if (!taskName.trim()) return
    const task: Task = {
      id: generateId(),
      name: taskName.trim(),
      bonusAmount: taskBonus,
      completed: false,
      bonusApplied: false,
    }
    setTasks(prev => [...prev, task])
    setTaskName('')
    setTaskBonus(0)
  }

  function completeTask(id: string) {
    const task = tasks.find(t => t.id === id)
    if (!task || task.completed) return
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true, bonusApplied: true } : t))
    setBonusBalance(prev => prev + task.bonusAmount)
  }

  function removeTask(id: string) {
    const task = tasks.find(t => t.id === id)
    if (task?.bonusApplied) {
      setBonusBalance(prev => prev - task.bonusAmount)
    }
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="app">
      <h1>推し活費用管理</h1>

      {/* ① 家計簿 */}
      <section className="section">
        <h2>① 家計簿</h2>

        <div className="subsection">
          <h3>支払い方法を追加</h3>
          <div className="input-row">
            <input
              value={walletName}
              onChange={e => setWalletName(e.target.value)}
              placeholder="名前（現金・PayPay・クレカ…）"
            />
            <input
              type="number"
              value={walletInitial || ''}
              onChange={e => setWalletInitial(Number(e.target.value))}
              placeholder="初期残高"
            />
            <button onClick={addWallet}>追加</button>
          </div>
        </div>

        {wallets.length > 0 && (
          <div className="subsection">
            <h3>残高一覧</h3>
            <ul className="item-list">
              {wallets.map(w => (
                <li key={w.id} className="item-row">
                  <span className="item-name">
                    {w.name}: <strong className={w.balance < 0 ? 'remaining-negative' : ''}>{w.balance.toLocaleString()}円</strong>
                  </span>
                  <button onClick={() => removeWallet(w.id)}>削除</button>
                </li>
              ))}
            </ul>
            <div className="summary">合計: <strong>{totalBalance.toLocaleString()}円</strong></div>
          </div>
        )}

        {wallets.length > 0 && (
          <div className="subsection">
            <h3>取引を記録</h3>
            <div className="input-row">
              <select
                value={entryWalletId}
                onChange={e => setEntryWalletId(e.target.value)}
              >
                <option value="" disabled>支払い方法</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <input
                value={entryLabel}
                onChange={e => setEntryLabel(e.target.value)}
                placeholder="項目名"
              />
              <input
                type="number"
                value={entryAmount || ''}
                onChange={e => setEntryAmount(Number(e.target.value))}
                placeholder="金額"
                min={0}
              />
              <select
                value={entryType}
                onChange={e => setEntryType(e.target.value as 'expense' | 'income')}
              >
                <option value="expense">支出</option>
                <option value="income">収入</option>
              </select>
              <button onClick={addEntry}>記録</button>
            </div>

            {entries.length > 0 && (
              <ul className="item-list" style={{ marginTop: '0.5rem' }}>
                {entries.map(e => {
                  const wallet = wallets.find(w => w.id === e.walletId)
                  return (
                    <li key={e.id} className="item-row">
                      <span className="item-name">
                        [{wallet?.name}] {e.label}:{' '}
                        <span className={e.amount < 0 ? 'remaining-negative' : 'remaining-positive'}>
                          {e.amount > 0 ? '+' : ''}{e.amount.toLocaleString()}円
                        </span>
                      </span>
                      <button onClick={() => removeEntry(e.id)}>削除</button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ② 出費予定 */}
      <section className="section">
        <h2>② 出費予定</h2>
        {wallets.length > 0 && (
          <p className="summary" style={{ marginBottom: '0.5rem' }}>
            残り使える金額:{' '}
            <strong className={remainingBudget < 0 ? 'remaining-negative' : 'remaining-positive'}>
              {remainingBudget.toLocaleString()}円
            </strong>
            {bonusBalance > 0 && <span>（うちボーナス {bonusBalance.toLocaleString()}円）</span>}
          </p>
        )}
        <div className="input-row">
          <input
            value={bulletName}
            onChange={e => setBulletName(e.target.value)}
            placeholder="予定名"
          />
          <input
            type="number"
            value={bulletCost || ''}
            onChange={e => setBulletCost(Number(e.target.value))}
            placeholder="予測金額"
          />
          <button onClick={addBulletItem}>追加</button>
        </div>
        {bulletItems.length === 0 ? (
          <p className="empty-hint">まだ予定がありません</p>
        ) : (
          <ul className="item-list">
            {bulletItems.map(item => (
              <li key={item.id} className="item-row">
                <span className={`item-name${item.deducted ? ' deducted' : ''}`}>
                  {item.deducted ? '✓' : '•'} {item.name} — {item.estimatedCost.toLocaleString()}円
                </span>
                {!item.deducted && <button onClick={() => deductItem(item.id)}>引く</button>}
                <button onClick={() => removeBulletItem(item.id)}>削除</button>
              </li>
            ))}
          </ul>
        )}
        {bulletItems.length > 0 && (
          <div className="summary">
            引き済み: {totalDeducted.toLocaleString()}円 / 未引き予定: {totalPending.toLocaleString()}円
          </div>
        )}
      </section>

      {/* ③ お布施ボーナス */}
      <section className="section">
        <h2>③ お布施ボーナス</h2>
        <p className="description">
          リアルタスクを達成するとボーナスが付与され、趣味費用に上乗せされます。
        </p>
        <div className="input-row">
          <input
            value={taskName}
            onChange={e => setTaskName(e.target.value)}
            placeholder="タスク名"
          />
          <input
            type="number"
            value={taskBonus || ''}
            onChange={e => setTaskBonus(Number(e.target.value))}
            placeholder="ボーナス額"
          />
          <button onClick={addTask}>追加</button>
        </div>
        {tasks.length === 0 ? (
          <p className="empty-hint">タスクがありません</p>
        ) : (
          <ul className="item-list">
            {tasks.map(task => (
              <li key={task.id} className="item-row">
                <span className={`item-name${task.completed ? ' deducted' : ''}`}>
                  {task.completed ? '🎉' : '📋'} {task.name} — +{task.bonusAmount.toLocaleString()}円
                </span>
                {!task.completed && <button onClick={() => completeTask(task.id)}>達成！</button>}
                <button onClick={() => removeTask(task.id)}>削除</button>
              </li>
            ))}
          </ul>
        )}
        <p>
          💰 累計ボーナス残高: <strong>{bonusBalance.toLocaleString()}円</strong>
        </p>
      </section>
    </div>
  )
}

export default App
