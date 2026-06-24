import { useState } from 'react'
import type { BulletItem, Task } from './types'
import './App.css'

const SAVINGS_RATE = 0.3

function generateId() {
  return Math.random().toString(36).slice(2)
}

function App() {
  // ① 砦設定
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0)
  const [savingsTarget, setSavingsTarget] = useState<number>(0)
  const [hobbyBudget, setHobbyBudget] = useState<number | null>(null)

  // ② バレットジャーナル
  const [bulletItems, setBulletItems] = useState<BulletItem[]>([])
  const [bulletName, setBulletName] = useState('')
  const [bulletCost, setBulletCost] = useState<number>(0)
  const [remainingBudget, setRemainingBudget] = useState<number | null>(null)

  // ③ お布施ボーナス
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskName, setTaskName] = useState('')
  const [taskBonus, setTaskBonus] = useState<number>(0)
  const [bonusBalance, setBonusBalance] = useState<number>(0)

  function calcHobbyBudget() {
    const budget = monthlyIncome - savingsTarget
    setHobbyBudget(budget)
    setRemainingBudget(budget + bonusBalance)
  }

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
    setRemainingBudget(prev => prev !== null ? prev - item.estimatedCost : null)
  }

  function removeBulletItem(id: string) {
    const item = bulletItems.find(i => i.id === id)
    if (item?.deducted) {
      setRemainingBudget(prev => prev !== null ? prev + item.estimatedCost : null)
    }
    setBulletItems(prev => prev.filter(i => i.id !== id))
  }

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
    setRemainingBudget(prev => prev !== null ? prev + task.bonusAmount : null)
  }

  function removeTask(id: string) {
    const task = tasks.find(t => t.id === id)
    if (task?.bonusApplied) {
      setBonusBalance(prev => prev - task.bonusAmount)
      setRemainingBudget(prev => prev !== null ? prev - task.bonusAmount : null)
    }
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const totalDeducted = bulletItems.filter(i => i.deducted).reduce((s, i) => s + i.estimatedCost, 0)
  const totalPending = bulletItems.filter(i => !i.deducted).reduce((s, i) => s + i.estimatedCost, 0)

  return (
    <div className="app">
      <h1>推し活費用管理</h1>

      {/* ① 砦設定 */}
      <section className="section">
        <h2>① 砦設定</h2>
        <div className="field-group">
          <label>
            月収 (円):
            <input
              type="number"
              value={monthlyIncome || ''}
              onChange={e => setMonthlyIncome(Number(e.target.value))}
            />
          </label>
          <label>
            貯金額 (円):
            <input
              type="number"
              value={savingsTarget || ''}
              onChange={e => setSavingsTarget(Number(e.target.value))}
            />
            {monthlyIncome > 0 && (
              <button onClick={() => setSavingsTarget(Math.floor(monthlyIncome * SAVINGS_RATE))}>
                推奨値 ({Math.floor(monthlyIncome * SAVINGS_RATE).toLocaleString()}円)
              </button>
            )}
          </label>
          <button className="calc-button" onClick={calcHobbyBudget}>
            趣味費用許容額を計算
          </button>
          {hobbyBudget !== null && (
            <p>
              📦 許容額: <strong>{hobbyBudget.toLocaleString()}円</strong>
              {bonusBalance > 0 && <> + ボーナス <strong>{bonusBalance.toLocaleString()}円</strong></>}
              {' '}→ 残り{' '}
              <strong className={(remainingBudget ?? 0) < 0 ? 'remaining-negative' : 'remaining-positive'}>
                {(remainingBudget ?? 0).toLocaleString()}円
              </strong>
            </p>
          )}
        </div>
      </section>

      {/* ② 今後の出費予定 */}
      <section className="section">
        <h2>② 今後の出費予定</h2>
        <div className="input-row">
          <input
            value={bulletName}
            onChange={e => setBulletName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addBulletItem()}
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
            onKeyDown={e => e.key === 'Enter' && addTask()}
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
