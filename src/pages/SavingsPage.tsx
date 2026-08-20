import { useEffect, useRef, useState } from 'react'
import type { ActiveTimer, Genre, GoalDraft, GoalRow, SavingsEvent, Task, TaskRepeat } from '../types'
import DetailModal, { DetailBlock, DetailRow, ReadValue } from '../components/DetailModal'
import ConfirmModal from '../components/ConfirmModal'
import Sheet from '../components/Sheet'
import { GenreDot, GenreSelect } from '../components/Pickers'
import type { LabelDraft } from '../components/LabelListPage'
import EditableList, { EditToolbar, ReorderButton, type EditRow } from '../components/EditableList'
import TimerOverlay from '../components/TimerOverlay'
import { useEditSession } from '../useEditSession'
import { ColorSwatches, IconSwatches } from '../components/Swatches'
import { readableColor } from '../palette'
import TopTabs from '../components/TopTabs'
import { useSwipeTabs } from '../useSwipeNav'
import { themeOf } from '../theme'
import { monthLabel, monthOf, recentDays, thisMonth, todayStr, yen } from '../utils'
import { firstError, notNegative, positive, required } from '../validation'

type Tab = 'tasks' | 'goals'

interface TaskDraft {
  id: string | null
  name: string
  bonusAmount: number
  repeat: TaskRepeat
  useTimer: boolean
  timerMinutes: number
  genreId: string
  goalId: string
}

/** タスクを介さずに貯金を足すときの入力内容（給料天引きなど） */
interface SavingsDraft {
  amount: number
  goalId: string
  date: string
  label: string
}

interface Props {
  tasks: Task[]
  savingsEvents: SavingsEvent[]
  genres: Genre[]
  goalRows: GoalRow[]
  savingsEarned: number
  savingsWithdrawn: number
  onSaveTask: (draft: TaskDraft) => void
  onRemoveTask: (id: string) => void
  onApplyTaskEdit: (orderedIds: string[], removedIds: string[]) => void
  onCompleteTask: (id: string) => void
  onUncompleteTask: (id: string) => void
  onSaveGoal: (draft: GoalDraft) => void
  onRemoveGoals: (ids: string[]) => void
  onApplyGoalEdit: (orderedIds: string[], removedIds: string[]) => void
  onAddSavings: (draft: SavingsDraft) => void
  onRemoveSavingsEvent: (id: string) => void
  onAssignSavings: (eventIds: string[], goalId: string) => void
  onSaveGenre: (draft: LabelDraft) => string
}

export default function SavingsPage({
  tasks, savingsEvents, genres, goalRows, savingsEarned, savingsWithdrawn,
  onSaveTask, onRemoveTask, onApplyTaskEdit,
  onCompleteTask, onUncompleteTask, onSaveGoal, onRemoveGoals, onApplyGoalEdit,
  onAddSavings, onRemoveSavingsEvent, onAssignSavings, onSaveGenre,
}: Props) {
  const savingsKept = savingsEarned - savingsWithdrawn
  const theme = themeOf('savings')
  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null)
  const [deleteGoal, setDeleteGoal] = useState<GoalRow | null>(null)
  const [savingsDraft, setSavingsDraft] = useState<SavingsDraft | null>(null)
  const [savingsError, setSavingsError] = useState('')
  const [deleteEvent, setDeleteEvent] = useState<SavingsEvent | null>(null)
  const [blockedEvent, setBlockedEvent] = useState<SavingsEvent | null>(null)
  const [sorting, setSorting] = useState(false)                        // 振り分けシート
  const [sortPick, setSortPick] = useState<Set<string>>(new Set())
  const [sortGoalId, setSortGoalId] = useState('')
  const [sortError, setSortError] = useState('')
  const [taskError, setTaskError] = useState('')
  const [goalError, setGoalError] = useState('')
  const [reordering, setReordering] = useState<TaskRepeat | null>(null)
  const [confirmSave, setConfirmSave] = useState(false)
  const session = useEditSession<Task>()

  function startReorder(repeat: TaskRepeat, group: Task[]) {
    setReordering(repeat)
    session.start(group)
  }

  function exitReorder() {
    setReordering(null)
    session.cancel()
  }

  function commitReorder() {
    onApplyTaskEdit(session.draft.map(t => t.id), session.removed)
    exitReorder()
    setConfirmSave(false)
  }

  // 貯金目標の並び替え（「行き先なし」は対象外なので除いて渡す）
  const goalSession = useEditSession<GoalRow>()
  const [confirmGoalSave, setConfirmGoalSave] = useState(false)

  function commitGoalReorder() {
    onApplyGoalEdit(goalSession.draft.map(g => g.id), goalSession.removed)
    goalSession.cancel()
    setConfirmGoalSave(false)
  }
  const [tab, setTab] = useState<Tab>('tasks')
  function changeTab(t: Tab) { setTab(t); exitReorder(); goalSession.cancel() }
  const swipe = useSwipeTabs(['tasks', 'goals'] as const, tab, changeTab)
  const [draft, setDraft] = useState<TaskDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [timer, setTimer] = useState<ActiveTimer | null>(null)
  const [paused, setPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishedRef = useRef<string | null>(null)
  const completeRef = useRef(onCompleteTask)
  completeRef.current = onCompleteTask

  useEffect(() => {
    if (timer && !paused) {
      intervalRef.current = setInterval(() => {
        setTimer(prev => {
          if (!prev) return null
          if (prev.remaining <= 1) {
            clearInterval(intervalRef.current!)
            finishedRef.current = prev.taskId
            return null
          }
          return { ...prev, remaining: prev.remaining - 1 }
        })
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timer?.taskId, paused])

  useEffect(() => {
    if (timer === null && finishedRef.current !== null) {
      const id = finishedRef.current
      finishedRef.current = null
      completeRef.current(id)
    }
  }, [timer])

  const today = todayStr()
  const week = recentDays(7)
  const sorted = tasks.slice().sort((a, b) => a.order - b.order)
  const dailies = sorted.filter(t => t.repeat === 'daily')
  const onces = sorted.filter(t => t.repeat === 'once')

  const monthSavings = savingsEvents
    .filter(e => monthOf(e.date) === thisMonth() && e.amount > 0)
    .reduce((s, e) => s + e.amount, 0)

  function isDone(t: Task) {
    return t.repeat === 'daily' ? t.completedDates.includes(today) : t.completedDates.length > 0
  }

  function openNew() {
    setTaskError('')
    setDraft({ id: null, name: '', bonusAmount: 0, repeat: 'once', useTimer: false, timerMinutes: 25, genreId: '', goalId: '' })
  }

  function openTask(t: Task) {
    setTaskError('')
    setDraft({
      id: t.id, name: t.name, bonusAmount: t.bonusAmount, repeat: t.repeat,
      useTimer: t.timerMinutes > 0, timerMinutes: t.timerMinutes || 25, genreId: t.genreId, goalId: t.goalId,
    })
  }

  /** true を返すと詳細表示に戻る。新規はそのまま閉じて一覧へ */
  function saveTask() {
    if (!draft) return false
    const error = firstError(
      required(draft.name, 'タスク名'),
      notNegative(draft.bonusAmount, 'つもり貯金額'),
      () => draft.useTimer && draft.timerMinutes < 1 ? 'タイマーの時間は1分以上で入力してください' : null,
    )
    if (error) { setTaskError(error); return false }
    onSaveTask({ ...draft, name: draft.name.trim() })
    setTaskError('')
    if (draft.id === null) { setDraft(null); return false }
    setDraft({ ...draft, name: draft.name.trim() })
    return true
  }

  function startTimer(t: Task) {
    setPaused(false)
    setTimer({ taskId: t.id, totalSeconds: t.timerMinutes * 60, remaining: t.timerMinutes * 60 })
  }

  /** 行の中身。並び替え中はハビットのドット列を隠す */
  function taskBody(t: Task, compact: boolean) {
    const done = isDone(t)
    const daily = t.repeat === 'daily'
    return (
      <>
        <GenreDot genres={genres} genreId={t.genreId} fallback={t.timerMinutes > 0 ? '⏱' : '📋'} />
        <span className="row-main">
          <span className={`row-title${done && !daily ? ' struck' : ''}`}>
            {t.name}{t.timerMinutes > 0 ? ` (${t.timerMinutes}分)` : ''}
          </span>
          <span className="row-bonus">+ ¥{t.bonusAmount.toLocaleString()}</span>
          {daily && !compact && (
            <span className="habit-dots">
              {week.map(d => (
                <span
                  key={d}
                  className={`habit-dot${t.completedDates.includes(d) ? ' on' : ''}`}
                  style={t.completedDates.includes(d) ? { background: theme.accent } : undefined}
                  title={d}
                />
              ))}
            </span>
          )}
        </span>
      </>
    )
  }

  function renderTask(t: Task) {
    const done = isDone(t)
    const daily = t.repeat === 'daily'
    const body = taskBody(t, false)

    return (
      <li key={t.id}>
        <div className={`row-card${done ? ' done' : ''}`}>
          <button className="row-tap" onClick={() => openTask(t)}>{body}</button>

          {done ? (
            <button
              className="check-btn on"
              style={{ background: theme.accent }}
              onClick={() => onUncompleteTask(t.id)}
              title={daily ? '本日分を取り消す' : '達成を取り消す'}
            >
              ✓
            </button>
          ) : t.timerMinutes > 0 ? (
            <button
              className="check-btn play"
              style={{ borderColor: theme.accent, color: theme.accent }}
              onClick={() => startTimer(t)}
              title="タイマーを開始"
            >
              ▶
            </button>
          ) : (
            <button
              className="check-btn"
              style={{ borderColor: theme.accent }}
              onClick={() => onCompleteTask(t.id)}
              title="達成"
            />
          )}
        </div>
        {done && daily && <div className="done-note">本日分達成済み</div>}
      </li>
    )
  }

  /** 「行き先なし」は並び替えも削除もできないので、実在する目標だけ扱う */
  const realGoals = goalRows.filter(g => g.id)

  // ── 貯める・記録の後始末 ────────────────
  /** 行き先を決めずに貯めた分。目標ではなく「仕分け待ち」として扱う */
  const inbox = goalRows.find(g => g.id === '') ?? null
  const inboxEvents = savingsEvents
    .filter(e => e.goalId === '' && e.amount > 0)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))

  /** 目標ごとの直近の記録。パネルの中に出して、その場で取り消せるようにする */
  function recentOf(goalId: string) {
    return savingsEvents
      .filter(e => e.goalId === goalId && e.amount > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
  }

  function openAddSavings() {
    setSavingsError('')
    setSavingsDraft({ amount: 0, goalId: '', date: todayStr(), label: '' })
  }

  function submitSavings() {
    if (!savingsDraft) return
    const error = firstError(positive(savingsDraft.amount, '金額'))
    if (error) { setSavingsError(error); return }
    onAddSavings(savingsDraft)
    setSavingsDraft(null)
    setSavingsError('')
  }

  /** 消すと切り崩し済みの額を下回ってしまう記録は、残高がマイナスになるので消させない */
  function requestDeleteEvent(e: SavingsEvent) {
    const row = goalRows.find(g => g.id === e.goalId)
    if (row && row.earned - e.amount < row.withdrawn) setBlockedEvent(e)
    else setDeleteEvent(e)
  }

  function openSorting() {
    setSortPick(new Set(inboxEvents.map(e => e.id)))
    setSortGoalId(realGoals[0]?.id ?? '')
    setSortError('')
    setSorting(true)
  }

  function togglePick(id: string) {
    setSortPick(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSortError('')
  }

  const pickedTotal = inboxEvents.filter(e => sortPick.has(e.id)).reduce((s, e) => s + e.amount, 0)

  function submitSorting() {
    if (sortPick.size === 0) { setSortError('振り分ける記録を選んでください'); return }
    if (!sortGoalId) { setSortError('行き先を選んでください'); return }
    // 未定の分から切り崩し済みがあると、移しすぎたときに残高がマイナスになる
    if (inbox && pickedTotal > inbox.kept) {
      setSortError(`未定から切り崩した分があるため、${yen(inbox.kept)} までしか振り分けられません`)
      return
    }
    onAssignSavings([...sortPick], sortGoalId)
    setSorting(false)
  }

  function goalBody(g: GoalRow) {
    const ratio = g.targetAmount > 0 ? Math.min(1, g.kept / g.targetAmount) : 0
    return (
      <>
        <span className="genre-dot" style={{ background: `${g.color}33`, width: 40, height: 40, fontSize: 20 }}>
          {g.icon}
        </span>
        <span className="row-main">
          <span className="row-title">{g.name}</span>
          <span className="row-sub">
            {g.targetAmount > 0
              ? `${g.kept.toLocaleString()} / ${g.targetAmount.toLocaleString()}円`
              : `${g.kept.toLocaleString()}円（上限なし）`}
          </span>
          <span className="bar">
            <span className="bar-fill" style={{ width: `${ratio * 100}%`, background: g.color }} />
          </span>
        </span>
        {g.targetAmount > 0 && (
          <span className="row-amount" style={{ color: readableColor(g.color) }}>{Math.round(ratio * 100)}%</span>
        )}
      </>
    )
  }

  function renderSection(repeat: TaskRepeat, group: Task[], title: string, emptyHint: string) {
    const inReorder = reordering === repeat
    const rows: EditRow[] = session.draft.map(t => ({ id: t.id, content: taskBody(t, true) }))
    const count = inReorder ? session.draft.length : group.length

    return (
      <>
        <div className="section-header">
          <h3>{title} ({count})</h3>
          {group.length > 1 && reordering === null && (
            <ReorderButton onClick={() => startReorder(repeat, group)} />
          )}
        </div>

        {inReorder && (
          <EditToolbar
            selectedCount={session.selected.size}
            removedCount={session.removed.length}
            accent={theme.accent}
            onCancel={exitReorder}
            onDelete={session.removeSelected}
            onDone={() => session.removed.length > 0 ? setConfirmSave(true) : commitReorder()}
          />
        )}

        {inReorder ? (
          <EditableList
            rows={rows}
            selected={session.selected}
            accent={theme.accent}
            onToggle={session.toggle}
            onReorder={session.reorder}
          />
        ) : group.length === 0 ? (
          <p className="empty-hint">{emptyHint}</p>
        ) : (
          <ul className="item-list">{group.map(renderTask)}</ul>
        )}
      </>
    )
  }

  const timerTask = tasks.find(t => t.id === timer?.taskId)
  const timerGenre = genres.find(g => g.id === timerTask?.genreId)
  const draftGenre = genres.find(g => g.id === draft?.genreId)

  return (
    <div className="page">
      {timer && timerTask && (
        <TimerOverlay
          taskName={timerTask.name}
          remaining={timer.remaining}
          totalSeconds={timer.totalSeconds}
          paused={paused}
          accent={timerGenre?.color ?? theme.accent}
          soft={theme.soft}
          onTogglePause={() => setPaused(p => !p)}
          onCancel={() => { setTimer(null); setPaused(false) }}
        />
      )}

      <TopTabs
        tabs={[{ id: 'tasks' as Tab, label: 'タスク' }, { id: 'goals' as Tab, label: '貯金目標' }]}
        active={tab}
        onChange={changeTab}
        accent={theme.accent}
        soft={theme.soft}
      />

      <div className="page-scroll" {...swipe}>
        {tab === 'tasks' ? (
          <>
            {renderSection('daily', dailies, 'デイリーミッション', '毎日続けたいことを登録できます')}
            {renderSection('once', onces, 'タスク', '一度きりのタスクがありません')}

            <div className="fab-row">
              <button
                className="fab"
                style={{ background: theme.accent, boxShadow: `0 4px 14px ${theme.accent}66` }}
                onClick={openNew}
              >
                +
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="hero-card">
              <div className="hero-label">取っておいている額</div>
              <div className="hero-number">¥{savingsKept.toLocaleString()}</div>
            </div>

            <div className="card">
              <div className="calc-row"><span>貯めた額（累計）</span><span>¥{savingsEarned.toLocaleString()}</span></div>
              <div className="calc-row"><span>切り崩した額</span><span>−¥{savingsWithdrawn.toLocaleString()}</span></div>
              <hr className="divider" />
              <div className="calc-row"><span>{monthLabel(thisMonth())}に貯めた額</span><span>¥{monthSavings.toLocaleString()}</span></div>
            </div>

            {inbox && inbox.kept > 0 && !goalSession.editing && (
              <button className="inbox-row" onClick={openSorting}>
                <span className="inbox-main">
                  <span className="inbox-title">行き先が未定のお金</span>
                  <span className="inbox-note">
                    {realGoals.length > 0 ? '目標に振り分けられます' : 'まず目標を作りましょう'}
                  </span>
                </span>
                <span className="inbox-amount">¥{inbox.kept.toLocaleString()}</span>
                <span className="row-chevron">›</span>
              </button>
            )}

            <div className="section-header">
              <h3>目標 ({goalSession.editing ? goalSession.draft.length : realGoals.length})</h3>
              {!goalSession.editing && (
                <div className="header-actions">
                  {realGoals.length > 1 && <ReorderButton onClick={() => goalSession.start(realGoals)} />}
                  <button
                    className="reorder-open"
                    aria-label="目標を追加"
                    title="目標を追加"
                    onClick={() => {
                      setGoalError('')
                      setGoalDraft({ id: null, name: '', icon: '🐷', color: '#f472b6', targetAmount: 0 })
                    }}
                  >
                    ＋
                  </button>
                </div>
              )}
            </div>

            {goalSession.editing && (
              <EditToolbar
                selectedCount={goalSession.selected.size}
                removedCount={goalSession.removed.length}
                accent={theme.accent}
                onCancel={goalSession.cancel}
                onDelete={goalSession.removeSelected}
                onDone={() => goalSession.removed.length > 0 ? setConfirmGoalSave(true) : commitGoalReorder()}
              />
            )}

            {goalSession.editing ? (
              <EditableList
                rows={goalSession.draft.map(g => ({ id: g.id, content: goalBody(g) }))}
                selected={goalSession.selected}
                accent={theme.accent}
                onToggle={goalSession.toggle}
                onReorder={goalSession.reorder}
              />
            ) : realGoals.length === 0 ? (
              <p className="empty-hint">
                貯金の行き先を作れます<br />右上の＋から追加できます
              </p>
            ) : (
              <ul className="item-list">
                {realGoals.map(g => (
                  <li key={g.id}>
                    <button
                      className="row-card"
                      onClick={() => {
                        setGoalError('')
                        setGoalDraft({ id: g.id, name: g.name, icon: g.icon, color: g.color, targetAmount: g.targetAmount })
                      }}
                    >
                      {goalBody(g)}
                      <span className="row-chevron">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!goalSession.editing && (
              <div className="fab-row">
                <button
                  className="fab"
                  style={{ background: theme.accent, boxShadow: `0 4px 14px ${theme.accent}66` }}
                  aria-label="貯金を追加"
                  title="貯金を追加"
                  onClick={openAddSavings}
                >
                  ¥
                </button>
              </div>
            )}

            <p className="summary" style={{ textAlign: 'center', padding: '1rem 0' }}>
              貯めるときは¥ボタンから。目標をタップすると詳細や直近の記録が見られます。
              切り崩しは「予定 &gt; 計算」タブ、記録の全体は「分析 &gt; 貯金履歴」から見られます
            </p>
          </>
        )}
      </div>

      {draft && (
        <DetailModal
          icon={draftGenre?.icon ?? (draft.useTimer ? '⏱' : '📋')}
          color={draftGenre ? `${draftGenre.color}55` : theme.soft}
          name={draft.name}
          onNameChange={v => setDraft({ ...draft, name: v })}
          namePlaceholder="例: 部屋の掃除"
          onClose={() => { setDraft(null); setTaskError('') }}
          onSave={saveTask}
          startInEdit={draft.id === null}
          error={taskError}
          onDelete={draft.id ? () => setDeleteTarget({ id: draft.id!, name: draft.name }) : undefined}
        >
          <DetailRow
            icon="🔁"
            label="繰り返し"
            value={<ReadValue>{draft.repeat === 'once' ? '一度きり' : '毎日'}</ReadValue>}
          >
            <div className="type-toggle">
              <button
                className={draft.repeat !== 'once' ? 'btn-sub' : ''}
                onClick={() => setDraft({ ...draft, repeat: 'once' })}
              >一度きり</button>
              <button
                className={draft.repeat !== 'daily' ? 'btn-sub' : ''}
                onClick={() => setDraft({ ...draft, repeat: 'daily' })}
              >毎日</button>
            </div>
          </DetailRow>

          <DetailRow icon="💰" label="つもり貯金額" value={<ReadValue>{yen(draft.bonusAmount)}</ReadValue>}>
            <input
              type="number"
              value={draft.bonusAmount || ''}
              onChange={e => setDraft({ ...draft, bonusAmount: Number(e.target.value) })}
              placeholder="0"
              min={0}
            />
          </DetailRow>

          <DetailRow
            icon="⏱"
            label="タイマー"
            value={
              <ReadValue muted={!draft.useTimer}>
                {draft.useTimer ? `${draft.timerMinutes}分` : 'なし'}
              </ReadValue>
            }
          >
            <div className="type-toggle">
              <button
                className={draft.useTimer ? 'btn-sub' : ''}
                onClick={() => setDraft({ ...draft, useTimer: false })}
              >なし</button>
              <button
                className={!draft.useTimer ? 'btn-sub' : ''}
                onClick={() => setDraft({ ...draft, useTimer: true })}
              >使う</button>
            </div>
          </DetailRow>

          {draft.useTimer && (
            <DetailRow icon="🕒" label="時間（分）" value={null}>
              <input
                type="number"
                value={draft.timerMinutes || ''}
                onChange={e => setDraft({ ...draft, timerMinutes: Number(e.target.value) })}
                min={1}
              />
            </DetailRow>
          )}

          <DetailRow
            icon="💙"
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

          <DetailRow
            icon="🎯"
            label="貯金先"
            value={
              <ReadValue muted={!draft.goalId}>
                {goalRows.find(g => g.id === draft.goalId && g.id)
                  ? `${goalRows.find(g => g.id === draft.goalId)!.icon} ${goalRows.find(g => g.id === draft.goalId)!.name}`
                  : '指定なし'}
              </ReadValue>
            }
          >
            {realGoals.length === 0 ? (
              <p className="summary">
                貯金先は「貯金目標」タブの＋から作れます。決めずに進めても、あとから振り分けられます
              </p>
            ) : (
              <select value={draft.goalId} onChange={e => setDraft({ ...draft, goalId: e.target.value })}>
                <option value="">指定なし</option>
                {realGoals.map(g => (
                  <option key={g.id} value={g.id}>{g.icon} {g.name}</option>
                ))}
              </select>
            )}
          </DetailRow>
        </DetailModal>
      )}

      {goalDraft && (
        <DetailModal
          icon={goalDraft.icon || '🐷'}
          color={`${goalDraft.color}55`}
          name={goalDraft.name}
          onNameChange={v => setGoalDraft({ ...goalDraft, name: v })}
          namePlaceholder="例: 一人暮らし初期費用"
          onClose={() => { setGoalDraft(null); setGoalError('') }}
          error={goalError}
          onSave={() => {
            const error = firstError(
              required(goalDraft.name, '目標の名前'),
              notNegative(goalDraft.targetAmount, '目標額'),
            )
            if (error) { setGoalError(error); return false }
            onSaveGoal({ ...goalDraft, name: goalDraft.name.trim() })
            setGoalError('')
            if (goalDraft.id === null) { setGoalDraft(null); return false }
            setGoalDraft({ ...goalDraft, name: goalDraft.name.trim() })
            return true
          }}
          startInEdit={goalDraft.id === null}
          onDelete={goalDraft.id
            ? () => {
              const row = goalRows.find(g => g.id === goalDraft.id)
              if (row) setDeleteGoal(row)
            }
            : undefined}
        >
          {goalDraft.id && (() => {
            const row = goalRows.find(g => g.id === goalDraft.id)
            if (!row) return null
            return (
              <>
                <DetailRow icon="🐷" label="現在の貯金額" value={<ReadValue>{yen(row.kept)}</ReadValue>}>
                  <span className="detail-value">{yen(row.kept)}</span>
                </DetailRow>
                {row.withdrawn > 0 && (
                  <DetailRow icon="✂️" label="切り崩し済み" value={<ReadValue>{yen(row.withdrawn)}</ReadValue>}>
                    <span className="detail-value">{yen(row.withdrawn)}</span>
                  </DetailRow>
                )}
                {recentOf(row.id).length > 0 && (
                  <DetailBlock icon="🕒" label="直近の記録">
                    <div className="inline-recent">
                      {recentOf(row.id).map(e => (
                        <div className="inline-recent-row" key={e.id}>
                          <span className="inline-recent-name">{e.label}</span>
                          <span className="inline-recent-date">{e.date}</span>
                          <span className="inline-recent-amount">+¥{e.amount.toLocaleString()}</span>
                          {e.taskId === '' ? (
                            <button className="link-btn" onClick={() => requestDeleteEvent(e)}>
                              取り消す
                            </button>
                          ) : (
                            <span className="inline-recent-lock" title="タスクの達成を取り消すと戻ります">タスク</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </DetailBlock>
                )}
              </>
            )
          })()}

          <DetailRow
            icon="🎯"
            label="目標額"
            value={
              <ReadValue muted={goalDraft.targetAmount === 0}>
                {goalDraft.targetAmount > 0 ? yen(goalDraft.targetAmount) : '上限なし'}
              </ReadValue>
            }
          >
            <input
              type="number"
              value={goalDraft.targetAmount || ''}
              onChange={e => setGoalDraft({ ...goalDraft, targetAmount: Number(e.target.value) })}
              placeholder="未入力なら上限なし"
              min={0}
            />
          </DetailRow>

          <DetailBlock
            icon="😊"
            label="見た目"
            value={
              <span className="genre-dot" style={{ background: `${goalDraft.color}33`, width: 40, height: 40, fontSize: 20 }}>
                {goalDraft.icon || '🐷'}
              </span>
            }
          >
            <IconSwatches
              value={goalDraft.icon}
              onChange={icon => setGoalDraft({ ...goalDraft, icon })}
              accent={theme.accent}
            />
            <div style={{ marginTop: '0.75rem' }}>
              <ColorSwatches value={goalDraft.color} onChange={color => setGoalDraft({ ...goalDraft, color })} />
            </div>
          </DetailBlock>
        </DetailModal>
      )}

      {savingsDraft && (
        <Sheet onClose={() => { setSavingsDraft(null); setSavingsError('') }} sheetClassName="modal">
          {requestClose => (
            <>
              <div className="modal-title">貯金を追加</div>

              {savingsError && <p className="form-error" role="alert">{savingsError}</p>}

              <div className="form-row">
                <label htmlFor="sv-amount">金額</label>
                <input
                  id="sv-amount"
                  type="number"
                  inputMode="numeric"
                  value={savingsDraft.amount || ''}
                  onChange={e => setSavingsDraft({ ...savingsDraft, amount: Number(e.target.value) })}
                  placeholder="0"
                  min={0}
                  autoFocus
                />
              </div>

              <div className="form-row">
                <label htmlFor="sv-goal">行き先</label>
                <select
                  id="sv-goal"
                  value={savingsDraft.goalId}
                  onChange={e => setSavingsDraft({ ...savingsDraft, goalId: e.target.value })}
                >
                  <option value="">あとで決める</option>
                  {realGoals.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="sv-date">日付</label>
                <input
                  id="sv-date"
                  type="date"
                  value={savingsDraft.date}
                  onChange={e => setSavingsDraft({ ...savingsDraft, date: e.target.value })}
                />
              </div>

              <div className="form-row">
                <label htmlFor="sv-label">名目</label>
                <input
                  id="sv-label"
                  type="text"
                  value={savingsDraft.label}
                  onChange={e => setSavingsDraft({ ...savingsDraft, label: e.target.value })}
                  placeholder="給料天引き"
                />
              </div>

              <p className="summary" style={{ lineHeight: 1.7 }}>
                口座のお金は動きません。「使えるお金」から取り置くだけです。
              </p>

              <div className="form-actions">
                <button className="btn-sub" onClick={requestClose}>
                  キャンセル
                </button>
                <button style={{ background: theme.accent }} onClick={submitSavings}>追加する</button>
              </div>
            </>
          )}
        </Sheet>
      )}

      {sorting && (
        <Sheet onClose={() => setSorting(false)} sheetClassName="modal">
          {requestClose => (
            <>
              <div className="modal-title">行き先を決める</div>

              {sortError && <p className="form-error" role="alert">{sortError}</p>}

              {realGoals.length === 0 ? (
                <>
                  <p className="summary" style={{ lineHeight: 1.8, marginBottom: '1rem' }}>
                    振り分け先の目標がまだありません。先に目標を作ってください。
                  </p>
                  <div className="form-actions">
                    <button className="btn-sub" onClick={requestClose}>閉じる</button>
                    <button
                      style={{ background: theme.accent }}
                      onClick={() => {
                        setSorting(false)
                        setGoalError('')
                        setGoalDraft({ id: null, name: '', icon: '🐷', color: '#f472b6', targetAmount: 0 })
                      }}
                    >
                      目標を作る
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="sort-list">
                    {inboxEvents.map(e => {
                      const on = sortPick.has(e.id)
                      return (
                        <button
                          key={e.id}
                          className={`sort-row${on ? ' on' : ''}`}
                          style={on ? { borderColor: theme.accent } : undefined}
                          onClick={() => togglePick(e.id)}
                        >
                          <span
                            className={`sort-check${on ? ' on' : ''}`}
                            style={on ? { background: theme.accent, borderColor: theme.accent } : undefined}
                          >
                            {on ? '✓' : ''}
                          </span>
                          <span className="sort-main">
                            <span className="sort-name">{e.label}</span>
                            <span className="sort-date">{e.date}</span>
                          </span>
                          <span className="sort-amount">¥{e.amount.toLocaleString()}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="form-row" style={{ marginTop: '0.9rem' }}>
                    <label htmlFor="sort-goal">行き先</label>
                    <select id="sort-goal" value={sortGoalId} onChange={e => { setSortGoalId(e.target.value); setSortError('') }}>
                      {realGoals.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                    </select>
                  </div>

                  <div className="form-actions">
                    <button className="btn-sub" onClick={requestClose}>キャンセル</button>
                    <button style={{ background: theme.accent }} onClick={submitSorting}>
                      {sortPick.size > 0 ? `${yen(pickedTotal)} を振り分ける` : '振り分ける'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </Sheet>
      )}

      {deleteEvent && (
        <ConfirmModal
          message={`「${deleteEvent.label}」で貯めた ${yen(deleteEvent.amount)} の記録を消します。よろしいですか？`}
          onCancel={() => setDeleteEvent(null)}
          onConfirm={() => { onRemoveSavingsEvent(deleteEvent.id); setDeleteEvent(null) }}
        />
      )}

      {blockedEvent && (
        <Sheet onClose={() => setBlockedEvent(null)} sheetClassName="modal">
          {requestClose => (
            <>
              <div className="modal-title">取り消せません</div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-h)', lineHeight: 1.7, marginBottom: '1.25rem' }}>
                この {yen(blockedEvent.amount)} を消すと、すでに切り崩した額を下回ってしまいます。
                先に「予定 &gt; 計算」タブで切り崩しを戻してください。
              </p>
              <div className="form-actions">
                <button className="btn-sub" onClick={requestClose}>閉じる</button>
              </div>
            </>
          )}
        </Sheet>
      )}

      {deleteGoal && (
        <ConfirmModal
          message={`貯金目標「${deleteGoal.name}」を削除します。貯めた ${yen(deleteGoal.kept)} は行き先なしとして残ります。よろしいですか？`}
          onCancel={() => setDeleteGoal(null)}
          onConfirm={() => { onRemoveGoals([deleteGoal.id]); setDeleteGoal(null); setGoalDraft(null) }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`「${deleteTarget.name}」を削除します。貯めた分の記録も削除されます。よろしいですか？`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onRemoveTask(deleteTarget.id); setDeleteTarget(null); setDraft(null) }}
        />
      )}

      {confirmSave && (
        <ConfirmModal
          message={`${session.removed.length}件のタスクを削除して並び順を保存します。それぞれで貯めた分の記録も消え、取り消せません。よろしいですか？`}
          confirmText="保存する"
          onCancel={() => setConfirmSave(false)}
          onConfirm={commitReorder}
        />
      )}

      {confirmGoalSave && (
        <ConfirmModal
          message={`${goalSession.removed.length}件の貯金目標を削除して並び順を保存します。貯めた分は行き先なしとして残りますが、目標は元に戻せません。よろしいですか？`}
          confirmText="保存する"
          onCancel={() => setConfirmGoalSave(false)}
          onConfirm={commitGoalReorder}
        />
      )}
    </div>
  )
}

export type { SavingsDraft, TaskDraft }
