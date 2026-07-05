import { Fragment, useState, useEffect, useRef } from 'react'
import type { Wallet, LedgerEntry, BulletItem, Task, TimerPreset, ActiveTimer } from './types'
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

  // ② 出費予定
  const [bulletItems, setBulletItems] = useState<BulletItem[]>([])
  const [bulletName, setBulletName] = useState('')
  const [bulletCost, setBulletCost] = useState<number>(0)
  const [partialInputId, setPartialInputId] = useState<string | null>(null)
  const [partialAmount, setPartialAmount] = useState<number>(0)

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
      deductedAmount: 0,
    }
    setBulletItems(prev => [...prev, item])
    setBulletName('')
    setBulletCost(0)
  }

  // 全額引く
  function deductFull(id: string) {
    setBulletItems(prev => prev.map(i => i.id === id ? { ...i, deductedAmount: i.estimatedCost } : i))
    if (partialInputId === id) {
      setPartialInputId(null)
      setPartialAmount(0)
    }
  }

  // 引いた分を外す（0に戻す）
  function undoDeduct(id: string) {
    setBulletItems(prev => prev.map(i => i.id === id ? { ...i, deductedAmount: 0 } : i))
  }

  // 一部引く入力欄を開く
  function openPartialInput(id: string) {
    setPartialInputId(id)
    setPartialAmount(0)
  }

  function cancelPartialInput() {
    setPartialInputId(null)
    setPartialAmount(0)
  }

  // 一部引くを確定
  function confirmPartialDeduct(id: string) {
    if (partialAmount <= 0) return
    setBulletItems(prev => prev.map(i => {
      if (i.id !== id) return i
      const nextAmount = Math.min(i.estimatedCost, i.deductedAmount + partialAmount)
      return { ...i, deductedAmount: nextAmount }
    }))
    setPartialInputId(null)
    setPartialAmount(0)
  }

  function removeBulletItem(id: string) {
    setBulletItems(prev => prev.filter(i => i.id !== id))
    if (partialInputId === id) cancelPartialInput()
  }

  const totalDeducted = bulletItems.reduce((s, i) => s + i.deductedAmount, 0)
  const totalPending = bulletItems.reduce((s, i) => s + (i.estimatedCost - i.deductedAmount), 0)
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

  // ④ 礼拝タイマー
  const DEFAULT_PRESETS: TimerPreset[] = [
    { id: 'p10', name: '準備運動', minutes: 10 },
    { id: 'p25', name: 'スパッと', minutes: 25 },
    { id: 'p60', name: 'じっくり', minutes: 60 },
  ]
  const [presets, setPresets] = useState<TimerPreset[]>(DEFAULT_PRESETS)
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [timerDone, setTimerDone] = useState(false)
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [bonusRate, setBonusRate] = useState(100) // 円 per 10分
  const [editingPreset, setEditingPreset] = useState<TimerPreset | null>(null)
  const [newPresetName, setNewPresetName] = useState('')
  const [newPresetMinutes, setNewPresetMinutes] = useState<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (activeTimer && !isPaused) {
      intervalRef.current = setInterval(() => {
        setActiveTimer(prev => {
          if (!prev) return null
          if (prev.remaining <= 1) {
            clearInterval(intervalRef.current!)
            const completedMinutes = Math.floor(prev.totalSeconds / 60)
            setTotalMinutes(m => {
              const newTotal = m + completedMinutes
              const bonus = Math.floor(newTotal / 10) * bonusRate - Math.floor(m / 10) * bonusRate
              if (bonus > 0) setBonusBalance(b => b + bonus)
              return newTotal
            })
            setTimerDone(true)
            return null
          }
          return { ...prev, remaining: prev.remaining - 1 }
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [activeTimer?.presetId, isPaused, bonusRate])

  function startTimer(preset: TimerPreset) {
    setTimerDone(false)
    setIsPaused(false)
    setActiveTimer({ presetId: preset.id, totalSeconds: preset.minutes * 60, remaining: preset.minutes * 60 })
  }

  function cancelTimer() {
    setActiveTimer(null)
    setIsPaused(false)
    setTimerDone(false)
  }

  function addPreset() {
    if (!newPresetName.trim() || newPresetMinutes <= 0) return
    setPresets(prev => [...prev, { id: generateId(), name: newPresetName.trim(), minutes: newPresetMinutes }])
    setNewPresetName('')
    setNewPresetMinutes(0)
  }

  function saveEditPreset() {
    if (!editingPreset) return
    setPresets(prev => prev.map(p => p.id === editingPreset.id ? editingPreset : p))
    setEditingPreset(null)
  }

  function removePreset(id: string) {
    setPresets(prev => prev.filter(p => p.id !== id))
    if (activeTimer?.presetId === id) cancelTimer()
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const earnedBonus = Math.floor(totalMinutes / 10) * bonusRate
  const activePreset = presets.find(p => p.id === activeTimer?.presetId)

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
            <div className="summary">手元残高合計: <strong>{totalBalance.toLocaleString()}円</strong></div>
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
            {bulletItems.map(item => {
              const fullyDeducted = item.deductedAmount > 0 && item.deductedAmount >= item.estimatedCost
              const partiallyDeducted = item.deductedAmount > 0 && item.deductedAmount < item.estimatedCost
              const remaining = item.estimatedCost - item.deductedAmount
              return (
                <Fragment key={item.id}>
                  <li className="item-row">
                    <span className={`item-name${fullyDeducted ? ' deducted' : partiallyDeducted ? ' partial' : ''}`}>
                      {fullyDeducted ? '✓' : partiallyDeducted ? '◐' : '•'} {item.name} — {item.estimatedCost.toLocaleString()}円
                      {partiallyDeducted && ` （引済 ${item.deductedAmount.toLocaleString()}円 / 残り ${remaining.toLocaleString()}円）`}
                    </span>
                    {fullyDeducted ? (
                      <button onClick={() => undoDeduct(item.id)}>外す</button>
                    ) : (
                      <>
                        <button onClick={() => deductFull(item.id)}>全額引く</button>
                        <button onClick={() => openPartialInput(item.id)}>一部引く</button>
                        {partiallyDeducted && <button onClick={() => undoDeduct(item.id)}>外す</button>}
                      </>
                    )}
                    <button onClick={() => removeBulletItem(item.id)}>削除</button>
                  </li>
                  {partialInputId === item.id && (
                    <li className="item-row partial-input-row">
                      <input
                        type="number"
                        value={partialAmount || ''}
                        onChange={e => setPartialAmount(Number(e.target.value))}
                        placeholder="引く金額"
                        min={0}
                        max={remaining}
                        style={{ width: 100 }}
                      />
                      <button onClick={() => confirmPartialDeduct(item.id)}>確定</button>
                      <button onClick={cancelPartialInput}>キャンセル</button>
                    </li>
                  )}
                </Fragment>
              )
            })}
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

      {/* ④ 礼拝タイマー */}
      <section className="section">
        <h2>④ 礼拝タイマー</h2>
        <p className="description">
          タイマーを使った合計時間に応じてボーナスが加算されます。
        </p>

        {/* レート設定 */}
        <div className="subsection">
          <label className="keep-row">
            レート: 10分 =
            <input
              type="number"
              value={bonusRate}
              onChange={e => setBonusRate(Number(e.target.value))}
              min={100}
              step={100}
              style={{ width: 80 }}
            />
            円
          </label>
          <div className="summary" style={{ marginTop: '0.3rem' }}>
            累計: {totalMinutes}分 → 獲得ボーナス: <strong>{earnedBonus.toLocaleString()}円</strong>
          </div>
        </div>

        {/* タイマー本体 */}
        <div className="subsection">
          {activeTimer ? (
            <div className="timer-active">
              <div className="timer-display">{formatTime(activeTimer.remaining)}</div>
              <div className="timer-label">{activePreset?.name}</div>
              <button onClick={() => setIsPaused(p => !p)}>
                {isPaused ? '再開' : '一時停止'}
              </button>
              <button onClick={cancelTimer}>キャンセル</button>
            </div>
          ) : (
            <div className="timer-presets">
              {presets.map(preset => (
                <div key={preset.id} className="preset-row">
                  {editingPreset?.id === preset.id ? (
                    <>
                      <input
                        value={editingPreset.name}
                        onChange={e => setEditingPreset({ ...editingPreset, name: e.target.value })}
                        style={{ width: 80 }}
                      />
                      <input
                        type="number"
                        value={editingPreset.minutes}
                        onChange={e => setEditingPreset({ ...editingPreset, minutes: Number(e.target.value) })}
                        style={{ width: 60 }}
                      />
                      分
                      <button onClick={saveEditPreset}>保存</button>
                      <button onClick={() => setEditingPreset(null)}>キャンセル</button>
                    </>
                  ) : (
                    <>
                      <button className="timer-btn" onClick={() => startTimer(preset)}>
                        <span className="preset-name">{preset.name}</span>
                        <span className="preset-minutes">{preset.minutes}分</span>
                      </button>
                      <button onClick={() => setEditingPreset({ ...preset })}>編集</button>
                      <button onClick={() => removePreset(preset.id)}>削除</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 完了通知 */}
        {timerDone && (
          <div className="timer-done">
            ✨ タイマー完了！お疲れさまでした
            <button onClick={() => setTimerDone(false)}>閉じる</button>
          </div>
        )}

        {/* プリセット追加 */}
        <div className="subsection">
          <h3>タイマーを追加</h3>
          <div className="input-row">
            <input
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              placeholder="名前"
              style={{ width: 80 }}
            />
            <input
              type="number"
              value={newPresetMinutes || ''}
              onChange={e => setNewPresetMinutes(Number(e.target.value))}
              placeholder="分"
              min={1}
              style={{ width: 60 }}
            />
            分
            <button onClick={addPreset}>追加</button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
