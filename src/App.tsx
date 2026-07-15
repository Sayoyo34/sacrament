import { useState, useEffect } from 'react'
import type { Wallet, LedgerEntry, BulletItem, Task, TimerPreset } from './types'
import SimulatorPage from './pages/SimulatorPage'
import LedgerPage from './pages/LedgerPage'
import TaskPage from './pages/TaskPage'
import TimerPage from './pages/TimerPage'
import BottomNav from './components/BottomNav'
import './App.css'

type Page = 'simulator' | 'ledger' | 'tasks' | 'timer'

function generateId() {
  return Math.random().toString(36).slice(2)
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

const DEFAULT_PRESETS: TimerPreset[] = [
  { id: 'p10', name: '準備運動', minutes: 10 },
  { id: 'p25', name: 'スパッと', minutes: 25 },
  { id: 'p60', name: 'じっくり', minutes: 60 },
]

export default function App() {
  const [page, setPage] = useState<Page>('simulator')

  const [wallets, setWallets] = useState<Wallet[]>(() => load('wallets', []))
  const [entries, setEntries] = useState<LedgerEntry[]>(() => load('entries', []))
  const [bulletItems, setBulletItems] = useState<BulletItem[]>(() => load('bulletItems', []))
  const [tasks, setTasks] = useState<Task[]>(() => load('tasks', []))
  const [bonusBalance, setBonusBalance] = useState<number>(() => load('bonusBalance', 0))
  const [presets, setPresets] = useState<TimerPreset[]>(() => load('presets', DEFAULT_PRESETS))
  const [totalMinutes, setTotalMinutes] = useState<number>(() => load('totalMinutes', 0))
  const [bonusRate, setBonusRate] = useState<number>(() => load('bonusRate', 100))

  useEffect(() => { localStorage.setItem('wallets', JSON.stringify(wallets)) }, [wallets])
  useEffect(() => { localStorage.setItem('entries', JSON.stringify(entries)) }, [entries])
  useEffect(() => { localStorage.setItem('bulletItems', JSON.stringify(bulletItems)) }, [bulletItems])
  useEffect(() => { localStorage.setItem('tasks', JSON.stringify(tasks)) }, [tasks])
  useEffect(() => { localStorage.setItem('bonusBalance', JSON.stringify(bonusBalance)) }, [bonusBalance])
  useEffect(() => { localStorage.setItem('presets', JSON.stringify(presets)) }, [presets])
  useEffect(() => { localStorage.setItem('totalMinutes', JSON.stringify(totalMinutes)) }, [totalMinutes])
  useEffect(() => { localStorage.setItem('bonusRate', JSON.stringify(bonusRate)) }, [bonusRate])

  // 家計簿
  function addWallet(name: string, initial: number) {
    setWallets(prev => [...prev, { id: generateId(), name, balance: initial }])
  }
  function removeWallet(id: string) {
    setWallets(prev => prev.filter(w => w.id !== id))
    setEntries(prev => prev.filter(e => e.walletId !== id))
  }
  function addEntry(walletId: string, label: string, amount: number, type: 'expense' | 'income') {
    const signed = type === 'expense' ? -Math.abs(amount) : Math.abs(amount)
    setEntries(prev => [...prev, { id: generateId(), walletId, label, amount: signed }])
    setWallets(prev => prev.map(w => w.id === walletId ? { ...w, balance: w.balance + signed } : w))
  }
  function removeEntry(id: string) {
    const e = entries.find(x => x.id === id)
    if (!e) return
    setEntries(prev => prev.filter(x => x.id !== id))
    setWallets(prev => prev.map(w => w.id === e.walletId ? { ...w, balance: w.balance - e.amount } : w))
  }

  // シミュレーター
  function addBulletItem(name: string, cost: number) {
    setBulletItems(prev => [...prev, { id: generateId(), name, estimatedCost: cost, deductedAmount: 0 }])
  }
  function deductFull(id: string) {
    setBulletItems(prev => prev.map(i => i.id === id ? { ...i, deductedAmount: i.estimatedCost } : i))
  }
  function undoDeduct(id: string) {
    setBulletItems(prev => prev.map(i => i.id === id ? { ...i, deductedAmount: 0 } : i))
  }
  function deductPartial(id: string, amount: number) {
    setBulletItems(prev => prev.map(i => i.id === id
      ? { ...i, deductedAmount: Math.min(i.estimatedCost, i.deductedAmount + amount) }
      : i))
  }
  function editBulletItem(id: string, name: string, cost: number) {
    setBulletItems(prev => prev.map(i => i.id === id ? { ...i, name, estimatedCost: cost } : i))
  }
  function removeBulletItem(id: string) {
    setBulletItems(prev => prev.filter(i => i.id !== id))
  }

  // タスク
  function addTask(name: string, bonus: number) {
    setTasks(prev => [...prev, { id: generateId(), name, bonusAmount: bonus, completed: false, bonusApplied: false }])
  }
  function completeTask(id: string) {
    const t = tasks.find(x => x.id === id)
    if (!t || t.completed) return
    setTasks(prev => prev.map(x => x.id === id ? { ...x, completed: true, bonusApplied: true } : x))
    setBonusBalance(prev => prev + t.bonusAmount)
  }
  function removeTask(id: string) {
    const t = tasks.find(x => x.id === id)
    if (t?.bonusApplied) setBonusBalance(prev => prev - t.bonusAmount)
    setTasks(prev => prev.filter(x => x.id !== id))
  }

  // タイマー
  function addPreset(name: string, minutes: number) {
    setPresets(prev => [...prev, { id: generateId(), name, minutes }])
  }
  function editPreset(id: string, name: string, minutes: number) {
    setPresets(prev => prev.map(p => p.id === id ? { ...p, name, minutes } : p))
  }
  function removePreset(id: string) {
    setPresets(prev => prev.filter(p => p.id !== id))
  }
  function handleTimerComplete(completedMinutes: number) {
    setTotalMinutes(m => {
      const newTotal = m + completedMinutes
      const bonus = Math.floor(newTotal / 10) * bonusRate - Math.floor(m / 10) * bonusRate
      if (bonus > 0) setBonusBalance(b => b + bonus)
      return newTotal
    })
  }

  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0)
  const totalDeducted = bulletItems.reduce((s, i) => s + i.deductedAmount, 0)
  const totalPending = bulletItems.reduce((s, i) => s + (i.estimatedCost - i.deductedAmount), 0)
  const remainingBudget = totalBalance + bonusBalance - totalDeducted

  return (
    <div className="app-shell">
      <div className="page-content">
        {page === 'simulator' && (
          <SimulatorPage
            totalBalance={totalBalance}
            bonusBalance={bonusBalance}
            remainingBudget={remainingBudget}
            bulletItems={bulletItems}
            totalDeducted={totalDeducted}
            totalPending={totalPending}
            onAddItem={addBulletItem}
            onEditItem={editBulletItem}
            onDeductFull={deductFull}
            onUndoDeduct={undoDeduct}
            onDeductPartial={deductPartial}
            onRemoveItem={removeBulletItem}
          />
        )}
        {page === 'ledger' && (
          <LedgerPage
            wallets={wallets}
            entries={entries}
            totalBalance={totalBalance}
            onAddWallet={addWallet}
            onRemoveWallet={removeWallet}
            onAddEntry={addEntry}
            onRemoveEntry={removeEntry}
          />
        )}
        {page === 'tasks' && (
          <TaskPage
            tasks={tasks}
            bonusBalance={bonusBalance}
            onAddTask={addTask}
            onCompleteTask={completeTask}
            onRemoveTask={removeTask}
          />
        )}
        {page === 'timer' && (
          <TimerPage
            presets={presets}
            totalMinutes={totalMinutes}
            bonusRate={bonusRate}
            onSetBonusRate={setBonusRate}
            onTimerComplete={handleTimerComplete}
            onAddPreset={addPreset}
            onEditPreset={editPreset}
            onRemovePreset={removePreset}
          />
        )}
      </div>
      <BottomNav page={page} onChange={setPage} />
    </div>
  )
}
