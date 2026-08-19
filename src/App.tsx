import { useState, useEffect } from 'react'
import type { Genre, Goal, GoalDraft, GoalRow, LedgerEntry, PlanItem, SavingsEvent, Tag, Task, Wallet } from './types'
import LedgerPage, { type EntryDraft, type WalletDraft } from './pages/LedgerPage'
import PlansPage, { type PlanDraft } from './pages/PlansPage'
import SavingsPage, { type SavingsDraft, type TaskDraft } from './pages/SavingsPage'
import AnalysisPage from './pages/AnalysisPage'
import MorePage from './pages/MorePage'
import BottomNav from './components/BottomNav'
import type { LabelDraft } from './components/LabelListPage'
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
  const [goals, setGoals] = useState<Goal[]>(() => load('goals', []))
  const [genres, setGenres] = useState<Genre[]>(() => load('genres', DEFAULT_GENRES))
  const [tags, setTags] = useState<Tag[]>(() => load('tags', []))

  useEffect(() => { save('wallets', wallets) }, [wallets])
  useEffect(() => { save('entries', entries) }, [entries])
  useEffect(() => { save('planItems', planItems) }, [planItems])
  useEffect(() => { save('tasks', tasks) }, [tasks])
  useEffect(() => { save('savingsEvents', savingsEvents) }, [savingsEvents])
  useEffect(() => { save('goals', goals) }, [goals])
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

  /** 並び替えの「保存」で、並び順の確定と削除をまとめて反映する */
  function applyPlanEdit(orderedIds: string[], removedIds: string[]) {
    setPlanItems(prev => {
      const kept = removedIds.length ? prev.filter(p => !removedIds.includes(p.id)) : prev
      const orderById = new Map(orderedIds.map((id, i) => [id, i]))
      return kept.map(p => orderById.has(p.id) ? { ...p, order: orderById.get(p.id)! } : p)
    })
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
        timerMinutes: minutes, completedDates: [], genreId: d.genreId, goalId: d.goalId, order,
      }])
      return
    }
    setTasks(prev => prev.map(t => t.id === d.id
      ? { ...t, name: d.name, bonusAmount: d.bonusAmount, repeat: d.repeat, timerMinutes: minutes, genreId: d.genreId, goalId: d.goalId }
      : t))
  }

  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    setSavingsEvents(prev => prev.filter(e => e.taskId !== id))
  }

  function applyTaskEdit(orderedIds: string[], removedIds: string[]) {
    setTasks(prev => {
      const kept = removedIds.length ? prev.filter(t => !removedIds.includes(t.id)) : prev
      const orderById = new Map(orderedIds.map((id, i) => [id, i]))
      return kept.map(t => orderById.has(t.id) ? { ...t, order: orderById.get(t.id)! } : t)
    })
    if (removedIds.length) {
      setSavingsEvents(prev => prev.filter(e => !removedIds.includes(e.taskId)))
    }
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
        id: generateId(), date: today, amount: t.bonusAmount, taskId: t.id, goalId: t.goalId, label: t.name,
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

  // ── 手動の貯金（給料天引きなど、タスク以外で貯めた分） ──
  /** タスク由来と同じ器に積む。taskId が空なのが手動で入れた印 */
  function addSavings(d: SavingsDraft) {
    setSavingsEvents(prev => [...prev, {
      id: generateId(), date: d.date, amount: d.amount, taskId: '',
      goalId: d.goalId, label: d.label.trim() || '手動で追加',
    }])
  }

  function removeSavingsEvent(id: string) {
    setSavingsEvents(prev => prev.filter(e => e.id !== id))
  }

  /** 行き先を決めずに貯めた分を、あとから目標へ振り分ける */
  function assignSavings(eventIds: string[], goalId: string) {
    setSavingsEvents(prev => prev.map(e => eventIds.includes(e.id) ? { ...e, goalId } : e))
  }

  // ── 貯金目標 ───────────────────────────
  function saveGoal(d: GoalDraft) {
    if (d.id === null) {
      const order = goals.reduce((m, g) => Math.max(m, g.order), -1) + 1
      setGoals(prev => [...prev, {
        id: generateId(), name: d.name, icon: d.icon || '🐷', color: d.color,
        targetAmount: d.targetAmount, order,
      }])
      return
    }
    setGoals(prev => prev.map(g => g.id === d.id
      ? { ...g, name: d.name, icon: d.icon || '🐷', color: d.color, targetAmount: d.targetAmount }
      : g))
  }

  /** 消した目標を参照していた貯金の記録とタスクを、行き先なしに戻す */
  function unassignGoals(ids: string[]) {
    setSavingsEvents(prev => prev.map(e => ids.includes(e.goalId) ? { ...e, goalId: '' } : e))
    setTasks(prev => prev.map(t => ids.includes(t.goalId) ? { ...t, goalId: '' } : t))
  }

  /** 目標を消しても貯めた記録は消さず、行き先なしに戻すだけにする */
  function removeGoals(ids: string[]) {
    setGoals(prev => prev.filter(g => !ids.includes(g.id)))
    unassignGoals(ids)
  }

  function applyGoalEdit(orderedIds: string[], removedIds: string[]) {
    setGoals(prev => {
      const kept = removedIds.length ? prev.filter(g => !removedIds.includes(g.id)) : prev
      const orderById = new Map(orderedIds.map((id, i) => [id, i]))
      return kept.map(g => orderById.has(g.id) ? { ...g, order: orderById.get(g.id)! } : g)
    })
    if (removedIds.length) unassignGoals(removedIds)
  }

  // ── つもり貯金の切り崩し ────────────────
  /** 切り崩しはマイナス額のイベントとして積む（履歴として残す） */
  function withdrawSavings(goalId: string, amount: number) {
    const stat = savingsByGoal.get(goalId) ?? { earned: 0, withdrawn: 0 }
    const capped = Math.min(amount, stat.earned - stat.withdrawn)
    if (capped <= 0) return
    setSavingsEvents(prev => [...prev, {
      id: generateId(), date: todayStr(), amount: -capped, taskId: '', goalId, label: '切り崩し',
    }])
  }

  /** 新しい切り崩しから順に取り消す。使い切ったイベントは消す */
  function undoWithdrawSavings(goalId: string, amount: number) {
    const stat = savingsByGoal.get(goalId) ?? { earned: 0, withdrawn: 0 }
    let left = Math.min(amount, stat.withdrawn)
    if (left <= 0) return
    setSavingsEvents(prev => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0 && left > 0; i--) {
        const ev = next[i]
        if (ev.amount >= 0 || ev.goalId !== goalId) continue
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
  /** 保存した項目の id を返す。項目追加の途中でその場作成した時に、作った先を選ぶのに使う */
  function saveGenre(d: LabelDraft): string {
    if (d.id === null) {
      const id = generateId()
      setGenres(prev => [...prev, { id, name: d.name, color: d.color, icon: d.icon || '📦' }])
      return id
    }
    setGenres(prev => prev.map(g => g.id === d.id ? { ...g, name: d.name, color: d.color, icon: d.icon || '📦' } : g))
    return d.id
  }

  /** 削除したジャンルを参照している項目は未設定に戻す */
  /** 消したジャンルを参照していた項目を未設定に戻す */
  function unassignGenres(ids: string[]) {
    setEntries(prev => prev.map(e => ids.includes(e.genreId) ? { ...e, genreId: '' } : e))
    setPlanItems(prev => prev.map(p => ids.includes(p.genreId) ? { ...p, genreId: '' } : p))
    setTasks(prev => prev.map(t => ids.includes(t.genreId) ? { ...t, genreId: '' } : t))
  }

  function removeGenres(ids: string[]) {
    setGenres(prev => prev.filter(g => !ids.includes(g.id)))
    unassignGenres(ids)
  }

  /** ジャンルとタグは配列の並びがそのまま表示順 */
  function applyGenreEdit(orderedIds: string[], removedIds: string[]) {
    setGenres(prev => {
      const kept = prev.filter(g => !removedIds.includes(g.id))
      const byId = new Map(kept.map(g => [g.id, g]))
      const ordered = orderedIds.map(id => byId.get(id)).filter((g): g is Genre => !!g)
      // 並び順に載っていないものが万一あれば末尾に残す
      const rest = kept.filter(g => !orderedIds.includes(g.id))
      return [...ordered, ...rest]
    })
    if (removedIds.length) unassignGenres(removedIds)
  }

  function saveTag(d: LabelDraft): string {
    if (d.id === null) {
      const id = generateId()
      setTags(prev => [...prev, { id, name: d.name, color: d.color }])
      return id
    }
    setTags(prev => prev.map(t => t.id === d.id ? { ...t, name: d.name, color: d.color } : t))
    return d.id
  }

  /** 削除したタグは各項目のタグ一覧からも外す */
  /** 消したタグを各項目のタグ一覧から外す */
  function unassignTags(ids: string[]) {
    setEntries(prev => prev.map(e => e.tagIds.some(x => ids.includes(x))
      ? { ...e, tagIds: e.tagIds.filter(x => !ids.includes(x)) } : e))
    setPlanItems(prev => prev.map(p => p.tagIds.some(x => ids.includes(x))
      ? { ...p, tagIds: p.tagIds.filter(x => !ids.includes(x)) } : p))
  }

  function removeTags(ids: string[]) {
    setTags(prev => prev.filter(t => !ids.includes(t.id)))
    unassignTags(ids)
  }

  function applyTagEdit(orderedIds: string[], removedIds: string[]) {
    setTags(prev => {
      const kept = prev.filter(t => !removedIds.includes(t.id))
      const byId = new Map(kept.map(t => [t.id, t]))
      const ordered = orderedIds.map(id => byId.get(id)).filter((t): t is Tag => !!t)
      const rest = kept.filter(t => !orderedIds.includes(t.id))
      return [...ordered, ...rest]
    })
    if (removedIds.length) unassignTags(removedIds)
  }

  // ── リセット ───────────────────────────
  function handleReset() {
    resetAll()
    setWallets([])
    setEntries([])
    setPlanItems([])
    setTasks([])
    setSavingsEvents([])
    setGoals([])
    setGenres(DEFAULT_GENRES)
    setTags([])
    setPage('ledger')
  }

  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0)
  // 貯めた額（プラス）と切り崩した額（マイナス）を分けて持ち、差し引きが取っておく額になる
  const savingsEarned = savingsEvents.reduce((s, e) => s + Math.max(0, e.amount), 0)
  const savingsWithdrawn = savingsEvents.reduce((s, e) => s + Math.max(0, -e.amount), 0)

  const savingsByGoal = new Map<string, { earned: number; withdrawn: number }>()
  savingsEvents.forEach(e => {
    const cur = savingsByGoal.get(e.goalId) ?? { earned: 0, withdrawn: 0 }
    if (e.amount > 0) cur.earned += e.amount
    else cur.withdrawn += -e.amount
    savingsByGoal.set(e.goalId, cur)
  })

  function rowOf(id: string, name: string, icon: string, color: string, targetAmount: number): GoalRow {
    const s = savingsByGoal.get(id) ?? { earned: 0, withdrawn: 0 }
    return { id, name, icon, color, targetAmount, earned: s.earned, withdrawn: s.withdrawn, kept: s.earned - s.withdrawn }
  }

  const unassigned = savingsByGoal.get('')
  const goalRows: GoalRow[] = [
    ...goals.slice().sort((a, b) => a.order - b.order)
      .map(g => rowOf(g.id, g.name, g.icon, g.color, g.targetAmount)),
    // 行き先を決めていない貯金は、実際にある時だけ末尾に出す
    ...(unassigned && (unassigned.earned > 0 || unassigned.withdrawn > 0)
      ? [rowOf('', '行き先なし', '🐷', '#94a3b8', 0)]
      : []),
  ]

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
            onSaveGenre={saveGenre}
            onSaveTag={saveTag}
          />
        )}
        {page === 'savings' && (
          <SavingsPage
            tasks={tasks}
            savingsEvents={savingsEvents}
            genres={genres}
            goalRows={goalRows}
            savingsEarned={savingsEarned}
            savingsWithdrawn={savingsWithdrawn}
            onSaveTask={saveTask}
            onRemoveTask={removeTask}
            onApplyTaskEdit={applyTaskEdit}
            onCompleteTask={completeTask}
            onUncompleteTask={uncompleteTask}
            onSaveGoal={saveGoal}
            onRemoveGoals={removeGoals}
            onApplyGoalEdit={applyGoalEdit}
            onAddSavings={addSavings}
            onRemoveSavingsEvent={removeSavingsEvent}
            onAssignSavings={assignSavings}
            onSaveGenre={saveGenre}
          />
        )}
        {page === 'plans' && (
          <PlansPage
            planItems={planItems}
            wallets={wallets}
            genres={genres}
            tags={tags}
            totalBalance={totalBalance}
            goalRows={goalRows}
            onSavePlan={savePlan}
            onRemovePlan={removePlan}
            onApplyPlanEdit={applyPlanEdit}
            onDeduct={deductPlan}
            onUndoDeduct={undoDeductPlan}
            onSaveGenre={saveGenre}
            onSaveTag={saveTag}
            onWithdrawSavings={withdrawSavings}
            onUndoWithdrawSavings={undoWithdrawSavings}
          />
        )}
        {page === 'analysis' && (
          <AnalysisPage
            entries={entries}
            genres={genres}
            tags={tags}
            tasks={tasks}
            savingsEvents={savingsEvents}
          />
        )}
        {page === 'more' && (
          <MorePage
            genres={genres}
            tags={tags}
            onSaveGenre={saveGenre}
            onRemoveGenres={removeGenres}
            onApplyGenreEdit={applyGenreEdit}
            onSaveTag={saveTag}
            onRemoveTags={removeTags}
            onApplyTagEdit={applyTagEdit}
            onReset={handleReset}
          />
        )}
      </div>
      <BottomNav page={page} onChange={setPage} />
    </div>
  )
}
