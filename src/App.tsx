import { useState, useEffect } from 'react'
import type { Genre, LedgerEntry, PlanItem, SavingsEvent, Tag, Task, Wallet } from './types'
import LedgerPage, { type EntryDraft, type WalletDraft } from './pages/LedgerPage'
import PlansPage, { type PlanDraft } from './pages/PlansPage'
import SavingsPage, { type TaskDraft } from './pages/SavingsPage'
import AnalysisPage from './pages/AnalysisPage'
import MorePage from './pages/MorePage'
import BottomNav from './components/BottomNav'
import type { LabelDraft } from './components/LabelManager'
import { DEFAULT_GENRES, load, resetAll, save } from './storage'
import type { Page } from './theme'
import { generateId, todayStr } from './utils'
import './App.css'

export default function App() {
  const [page, setPage] = useState<Page>('ledger')

  const [wallets, setWallets] = useState<Wallet[]>(() => load('wallets', []))
  const [entries, setEntries] = useState<LedgerEntry[]>(() => load('entries', []))
  const [planItems, setPlanItems] = useState<PlanItem[]>(() => load('planItems', []))
  const [tasks, setTasks] = useState<Task[]>(() => load('tasks', []))
  const [savingsEvents, setSavingsEvents] = useState<SavingsEvent[]>(() => load('savingsEvents', []))
  const [genres, setGenres] = useState<Genre[]>(() => load('genres', DEFAULT_GENRES))
  const [tags, setTags] = useState<Tag[]>(() => load('tags', []))

  useEffect(() => { save('wallets', wallets) }, [wallets])
  useEffect(() => { save('entries', entries) }, [entries])
  useEffect(() => { save('planItems', planItems) }, [planItems])
  useEffect(() => { save('tasks', tasks) }, [tasks])
  useEffect(() => { save('savingsEvents', savingsEvents) }, [savingsEvents])
  useEffect(() => { save('genres', genres) }, [genres])
  useEffect(() => { save('tags', tags) }, [tags])

  // ── 家計簿 ─────────────────────────────
  function saveEntry(d: EntryDraft) {
    const signed = d.type === 'expense' ? -Math.abs(d.amount) : Math.abs(d.amount)
    if (d.id === null) {
      setEntries(prev => [...prev, {
        id: generateId(), walletId: d.walletId, label: d.label, amount: signed,
        date: d.date, genreId: d.genreId, tagIds: d.tagIds, memo: d.memo,
      }])
      setWallets(prev => prev.map(w => w.id === d.walletId ? { ...w, balance: w.balance + signed } : w))
      return
    }
    const old = entries.find(e => e.id === d.id)
    if (!old) return
    setEntries(prev => prev.map(e => e.id === d.id
      ? { ...e, walletId: d.walletId, label: d.label, amount: signed, date: d.date, genreId: d.genreId, tagIds: d.tagIds, memo: d.memo }
      : e))
    setWallets(prev => prev.map(w => {
      let balance = w.balance
      if (w.id === old.walletId) balance -= old.amount
      if (w.id === d.walletId) balance += signed
      return balance === w.balance ? w : { ...w, balance }
    }))
  }

  function removeEntry(id: string) {
    const e = entries.find(x => x.id === id)
    if (!e) return
    setEntries(prev => prev.filter(x => x.id !== id))
    setWallets(prev => prev.map(w => w.id === e.walletId ? { ...w, balance: w.balance - e.amount } : w))
  }

  function saveWallet(d: WalletDraft) {
    if (d.id === null) {
      setWallets(prev => [...prev, { id: generateId(), name: d.name, balance: d.balance }])
      return
    }
    setWallets(prev => prev.map(w => w.id === d.id ? { ...w, name: d.name, balance: d.balance } : w))
  }

  function removeWallet(id: string) {
    setWallets(prev => prev.filter(w => w.id !== id))
    setEntries(prev => prev.filter(e => e.walletId !== id))
    setPlanItems(prev => prev.map(p => p.walletId === id ? { ...p, walletId: '' } : p))
  }

  // ── 予定 ───────────────────────────────
  function savePlan(d: PlanDraft) {
    if (d.id === null) {
      const order = planItems.reduce((m, p) => Math.max(m, p.order), -1) + 1
      setPlanItems(prev => [...prev, {
        id: generateId(), name: d.name, kind: d.kind, estimatedCost: d.estimatedCost,
        deductedAmount: 0, dayOfMonth: d.dayOfMonth, walletId: d.walletId,
        genreId: d.genreId, tagIds: d.tagIds, memo: d.memo, order,
      }])
      return
    }
    setPlanItems(prev => prev.map(p => p.id === d.id ? {
      ...p, name: d.name, kind: d.kind, estimatedCost: d.estimatedCost,
      dayOfMonth: d.dayOfMonth, walletId: d.walletId,
      genreId: d.genreId, tagIds: d.tagIds, memo: d.memo,
      // 予測金額を下げたら引き済みがはみ出さないよう丸める
      deductedAmount: Math.min(p.deductedAmount, d.estimatedCost),
    } : p))
  }

  function removePlan(id: string) {
    setPlanItems(prev => prev.filter(p => p.id !== id))
  }

  function deductPlan(id: string, amount: number) {
    setPlanItems(prev => prev.map(p => p.id === id
      ? { ...p, deductedAmount: Math.min(p.estimatedCost, p.deductedAmount + amount) }
      : p))
  }

  function undoDeductPlan(id: string, amount: number) {
    setPlanItems(prev => prev.map(p => p.id === id
      ? { ...p, deductedAmount: Math.max(0, p.deductedAmount - amount) }
      : p))
  }

  // ── 貯金（タスク） ─────────────────────
  function saveTask(d: TaskDraft) {
    const minutes = d.useTimer ? Math.max(1, d.timerMinutes) : 0
    if (d.id === null) {
      const order = tasks.reduce((m, t) => Math.max(m, t.order), -1) + 1
      setTasks(prev => [...prev, {
        id: generateId(), name: d.name, bonusAmount: d.bonusAmount, repeat: d.repeat,
        timerMinutes: minutes, completedDates: [], genreId: d.genreId, order,
      }])
      return
    }
    setTasks(prev => prev.map(t => t.id === d.id
      ? { ...t, name: d.name, bonusAmount: d.bonusAmount, repeat: d.repeat, timerMinutes: minutes, genreId: d.genreId }
      : t))
  }

  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    setSavingsEvents(prev => prev.filter(e => e.taskId !== id))
  }

  function completeTask(id: string) {
    const t = tasks.find(x => x.id === id)
    if (!t) return
    const today = todayStr()
    const already = t.repeat === 'daily' ? t.completedDates.includes(today) : t.completedDates.length > 0
    if (already) return

    setTasks(prev => prev.map(x => x.id === id ? { ...x, completedDates: [...x.completedDates, today] } : x))
    if (t.bonusAmount > 0) {
      setSavingsEvents(prev => [...prev, {
        id: generateId(), date: today, amount: t.bonusAmount, taskId: t.id, label: t.name,
      }])
    }
  }

  function uncompleteTask(id: string) {
    const t = tasks.find(x => x.id === id)
    if (!t) return
    const today = todayStr()
    // 一度きりは達成日がいつであれ取り消す。デイリーは今日の分だけ戻す
    const removedDate = t.repeat === 'daily' ? today : t.completedDates[t.completedDates.length - 1]
    if (removedDate === undefined) return

    setTasks(prev => prev.map(x => x.id === id
      ? { ...x, completedDates: x.completedDates.filter(d => d !== removedDate) }
      : x))

    setSavingsEvents(prev => {
      const idx = prev.findIndex(e => e.taskId === id && e.date === removedDate)
      return idx === -1 ? prev : prev.filter((_, i) => i !== idx)
    })
  }

  // ── つもり貯金の切り崩し ────────────────
  /** 切り崩しはマイナス額のイベントとして積む（履歴として残す） */
  function withdrawSavings(amount: number) {
    const capped = Math.min(amount, savingsKept)
    if (capped <= 0) return
    setSavingsEvents(prev => [...prev, {
      id: generateId(), date: todayStr(), amount: -capped, taskId: '', label: '切り崩し',
    }])
  }

  /** 新しい切り崩しから順に取り消す。使い切ったイベントは消す */
  function undoWithdrawSavings(amount: number) {
    let left = Math.min(amount, savingsWithdrawn)
    if (left <= 0) return
    setSavingsEvents(prev => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0 && left > 0; i--) {
        const ev = next[i]
        if (ev.amount >= 0) continue
        const take = Math.min(left, -ev.amount)
        left -= take
        const rest = ev.amount + take
        if (rest === 0) next.splice(i, 1)
        else next[i] = { ...ev, amount: rest }
      }
      return next
    })
  }

  // ── ジャンル / タグ ────────────────────
  function saveGenre(d: LabelDraft) {
    if (d.id === null) {
      setGenres(prev => [...prev, { id: generateId(), name: d.name, color: d.color, icon: d.icon || '📦' }])
      return
    }
    setGenres(prev => prev.map(g => g.id === d.id ? { ...g, name: d.name, color: d.color, icon: d.icon || '📦' } : g))
  }

  /** 削除したジャンルを参照している項目は未設定に戻す */
  function removeGenre(id: string) {
    setGenres(prev => prev.filter(g => g.id !== id))
    setEntries(prev => prev.map(e => e.genreId === id ? { ...e, genreId: '' } : e))
    setPlanItems(prev => prev.map(p => p.genreId === id ? { ...p, genreId: '' } : p))
    setTasks(prev => prev.map(t => t.genreId === id ? { ...t, genreId: '' } : t))
  }

  function saveTag(d: LabelDraft) {
    if (d.id === null) {
      setTags(prev => [...prev, { id: generateId(), name: d.name, color: d.color }])
      return
    }
    setTags(prev => prev.map(t => t.id === d.id ? { ...t, name: d.name, color: d.color } : t))
  }

  /** 削除したタグは各項目のタグ一覧からも外す */
  function removeTag(id: string) {
    setTags(prev => prev.filter(t => t.id !== id))
    setEntries(prev => prev.map(e => e.tagIds.includes(id) ? { ...e, tagIds: e.tagIds.filter(x => x !== id) } : e))
    setPlanItems(prev => prev.map(p => p.tagIds.includes(id) ? { ...p, tagIds: p.tagIds.filter(x => x !== id) } : p))
  }

  // ── リセット ───────────────────────────
  function handleReset() {
    resetAll()
    setWallets([])
    setEntries([])
    setPlanItems([])
    setTasks([])
    setSavingsEvents([])
    setGenres(DEFAULT_GENRES)
    setTags([])
    setPage('ledger')
  }

  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0)
  // 貯めた額（プラス）と切り崩した額（マイナス）を分けて持ち、差し引きが取っておく額になる
  const savingsEarned = savingsEvents.reduce((s, e) => s + Math.max(0, e.amount), 0)
  const savingsWithdrawn = savingsEvents.reduce((s, e) => s + Math.max(0, -e.amount), 0)
  const savingsKept = savingsEarned - savingsWithdrawn

  return (
    <div className="app-shell">
      <div className="page-content">
        {page === 'ledger' && (
          <LedgerPage
            wallets={wallets}
            entries={entries}
            genres={genres}
            tags={tags}
            totalBalance={totalBalance}
            onSaveEntry={saveEntry}
            onRemoveEntry={removeEntry}
            onSaveWallet={saveWallet}
            onRemoveWallet={removeWallet}
          />
        )}
        {page === 'savings' && (
          <SavingsPage
            tasks={tasks}
            savingsEvents={savingsEvents}
            genres={genres}
            savingsEarned={savingsEarned}
            savingsWithdrawn={savingsWithdrawn}
            onSaveTask={saveTask}
            onRemoveTask={removeTask}
            onCompleteTask={completeTask}
            onUncompleteTask={uncompleteTask}
          />
        )}
        {page === 'plans' && (
          <PlansPage
            planItems={planItems}
            wallets={wallets}
            genres={genres}
            tags={tags}
            totalBalance={totalBalance}
            savingsEarned={savingsEarned}
            savingsWithdrawn={savingsWithdrawn}
            onSavePlan={savePlan}
            onRemovePlan={removePlan}
            onDeduct={deductPlan}
            onUndoDeduct={undoDeductPlan}
            onWithdrawSavings={withdrawSavings}
            onUndoWithdrawSavings={undoWithdrawSavings}
          />
        )}
        {page === 'analysis' && (
          <AnalysisPage
            entries={entries}
            genres={genres}
            tasks={tasks}
            savingsEvents={savingsEvents}
          />
        )}
        {page === 'more' && (
          <MorePage
            genres={genres}
            tags={tags}
            onSaveGenre={saveGenre}
            onRemoveGenre={removeGenre}
            onSaveTag={saveTag}
            onRemoveTag={removeTag}
            onReset={handleReset}
          />
        )}
      </div>
      <BottomNav page={page} onChange={setPage} />
    </div>
  )
}
