import { useEffect, useRef, useState } from 'react'
import type { ActiveTimer, Genre, GoalDraft, GoalRow, SavingsEvent, Task, TaskRepeat } from '../types'
import DetailModal, { DetailBlock, DetailRow } from '../components/DetailModal'
import ConfirmModal from '../components/ConfirmModal'
import { GenreDot, GenreSelect } from '../components/Pickers'
import { ColorSwatches, IconSwatches } from '../components/Swatches'
import TopTabs from '../components/TopTabs'
import { themeOf } from '../theme'
import { monthLabel, monthOf, recentDays, thisMonth, todayStr, yen } from '../utils'
import { firstError, notNegative, required } from '../validation'

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

interface Props {
  tasks: Task[]
  savingsEvents: SavingsEvent[]
  genres: Genre[]
  goalRows: GoalRow[]
  savingsEarned: number
  savingsWithdrawn: number
  onSaveTask: (draft: TaskDraft) => void
  onRemoveTask: (id: string) => void
  onCompleteTask: (id: string) => void
  onUncompleteTask: (id: string) => void
  onSaveGoal: (draft: GoalDraft) => void
  onRemoveGoal: (id: string) => void
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function SavingsPage({
  tasks, savingsEvents, genres, goalRows, savingsEarned, savingsWithdrawn,
  onSaveTask, onRemoveTask, onCompleteTask, onUncompleteTask, onSaveGoal, onRemoveGoal,
}: Props) {
  const savingsKept = savingsEarned - savingsWithdrawn
  const theme = themeOf('savings')
  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null)
  const [deleteGoal, setDeleteGoal] = useState<GoalRow | null>(null)
  const [taskError, setTaskError] = useState('')
  const [goalError, setGoalError] = useState('')
  const [tab, setTab] = useState<Tab>('tasks')
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

  function saveTask() {
    if (!draft) return
    const error = firstError(
      required(draft.name, 'タスク名'),
      notNegative(draft.bonusAmount, 'つもり貯金額'),
      () => draft.useTimer && draft.timerMinutes < 1 ? 'タイマーの時間は1分以上で入力してください' : null,
    )
    if (error) { setTaskError(error); return }
    onSaveTask({ ...draft, name: draft.name.trim() })
    setTaskError('')
    setDraft(null)
  }

  function startTimer(t: Task) {
    setPaused(false)
    setTimer({ taskId: t.id, totalSeconds: t.timerMinutes * 60, remaining: t.timerMinutes * 60 })
  }

  function renderTask(t: Task) {
    const done = isDone(t)
    const daily = t.repeat === 'daily'
    return (
      <li key={t.id}>
        <div className={`row-card${done ? ' done' : ''}`}>
          <button className="row-tap" onClick={() => openTask(t)}>
            <GenreDot genres={genres} genreId={t.genreId} fallback={t.timerMinutes > 0 ? '⏱' : '📋'} />
            <span className="row-main">
              <span className={`row-title${done && !daily ? ' struck' : ''}`}>
                {t.name}{t.timerMinutes > 0 ? ` (${t.timerMinutes}分)` : ''}
              </span>
              <span className="row-bonus">+ ¥{t.bonusAmount.toLocaleString()}</span>
              {daily && (
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
          </button>

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

  const timerTask = tasks.find(t => t.id === timer?.taskId)
  const draftGenre = genres.find(g => g.id === draft?.genreId)

  return (
    <div className="page">
      <TopTabs
        tabs={[{ id: 'tasks' as Tab, label: 'タスク' }, { id: 'goals' as Tab, label: '貯金目標' }]}
        active={tab}
        onChange={setTab}
        accent={theme.accent}
        soft={theme.soft}
      />

      <div className="page-scroll">
        {tab === 'tasks' ? (
          <>
            {timer && (
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="summary">{timerTask?.name}</div>
                <div className="timer-display">{fmt(timer.remaining)}</div>
                <div className="timer-controls">
                  <button style={{ background: theme.accent }} onClick={() => setPaused(p => !p)}>
                    {paused ? '再開' : '一時停止'}
                  </button>
                  <button className="btn-sub" onClick={() => { setTimer(null); setPaused(false) }}>キャンセル</button>
                </div>
              </div>
            )}

            <div className="section-header"><h3>デイリーミッション ({dailies.length})</h3></div>
            {dailies.length === 0 ? (
              <p className="empty-hint">毎日続けたいことを登録できます</p>
            ) : (
              <ul className="item-list">{dailies.map(renderTask)}</ul>
            )}

            <div className="section-header"><h3>タスク ({onces.length})</h3></div>
            {onces.length === 0 ? (
              <p className="empty-hint">一度きりのタスクがありません</p>
            ) : (
              <ul className="item-list">{onces.map(renderTask)}</ul>
            )}

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

            <div className="section-header"><h3>目標 ({goalRows.filter(g => g.id).length})</h3></div>
            {goalRows.length === 0 ? (
              <p className="empty-hint">
                貯金の行き先を作れます<br />+ボタンで追加できます
              </p>
            ) : (
              <ul className="item-list">
                {goalRows.map(g => {
                  const ratio = g.targetAmount > 0 ? Math.min(1, g.kept / g.targetAmount) : 0
                  const unassigned = g.id === ''
                  return (
                    <li key={g.id || '__none'}>
                      <button
                        className="row-card"
                        style={unassigned ? { cursor: 'default' } : undefined}
                        onClick={() => {
                          if (unassigned) return
                          setGoalError('')
                          setGoalDraft({ id: g.id, name: g.name, icon: g.icon, color: g.color, targetAmount: g.targetAmount })
                        }}
                      >
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
                          <span className="row-amount" style={{ color: g.color }}>{Math.round(ratio * 100)}%</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="fab-row">
              <button
                className="fab"
                style={{ background: theme.accent, boxShadow: `0 4px 14px ${theme.accent}66` }}
                onClick={() => {
                  setGoalError('')
                  setGoalDraft({ id: null, name: '', icon: '🐷', color: '#f472b6', targetAmount: 0 })
                }}
              >
                +
              </button>
            </div>

            <div className="section-header"><h3>最近の記録</h3></div>
            {savingsEvents.length === 0 ? (
              <p className="empty-hint">タスクを達成すると貯まります</p>
            ) : (
              <ul className="item-list">
                {savingsEvents.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map(ev => (
                  <li key={ev.id}>
                    <div className="row-card" style={{ cursor: 'default' }}>
                      <GenreDot genres={genres} genreId="" fallback={ev.amount < 0 ? '✂️' : '🐷'} />
                      <span className="row-main">
                        <span className="row-title">{ev.label}</span>
                        <span className="row-sub">{ev.date}</span>
                      </span>
                      <span
                        className="row-amount"
                        style={{ color: ev.amount < 0 ? '#e53e3e' : theme.accent }}
                      >
                        {ev.amount < 0 ? '−' : '+'}¥{Math.abs(ev.amount).toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="summary" style={{ textAlign: 'center', padding: '1rem 0' }}>
              切り崩しは「予定 &gt; 計算」タブから行えます
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
          error={taskError}
          onDelete={draft.id ? () => setDeleteTarget({ id: draft.id!, name: draft.name }) : undefined}
        >
          <DetailRow icon="🔁" label="繰り返し">
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

          <DetailRow icon="💰" label="つもり貯金額">
            <input
              type="number"
              value={draft.bonusAmount || ''}
              onChange={e => setDraft({ ...draft, bonusAmount: Number(e.target.value) })}
              placeholder="0"
              min={0}
            />
          </DetailRow>

          <DetailRow icon="⏱" label="タイマー">
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
            <DetailRow icon="🕒" label="時間（分）">
              <input
                type="number"
                value={draft.timerMinutes || ''}
                onChange={e => setDraft({ ...draft, timerMinutes: Number(e.target.value) })}
                min={1}
              />
            </DetailRow>
          )}

          <DetailRow icon="💙" label="ジャンル">
            <GenreSelect genres={genres} value={draft.genreId} onChange={v => setDraft({ ...draft, genreId: v })} />
          </DetailRow>

          <DetailRow icon="🎯" label="貯金先">
            <select value={draft.goalId} onChange={e => setDraft({ ...draft, goalId: e.target.value })}>
              <option value="">指定なし</option>
              {goalRows.filter(g => g.id).map(g => (
                <option key={g.id} value={g.id}>{g.icon} {g.name}</option>
              ))}
            </select>
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
            if (error) { setGoalError(error); return }
            onSaveGoal({ ...goalDraft, name: goalDraft.name.trim() })
            setGoalDraft(null)
            setGoalError('')
          }}
          onDelete={goalDraft.id
            ? () => {
              const row = goalRows.find(g => g.id === goalDraft.id)
              if (row) setDeleteGoal(row)
            }
            : undefined}
        >
          <DetailRow icon="🎯" label="目標額">
            <input
              type="number"
              value={goalDraft.targetAmount || ''}
              onChange={e => setGoalDraft({ ...goalDraft, targetAmount: Number(e.target.value) })}
              placeholder="未入力なら上限なし"
              min={0}
            />
          </DetailRow>

          {goalDraft.id && (() => {
            const row = goalRows.find(g => g.id === goalDraft.id)
            if (!row) return null
            return (
              <>
                <DetailRow icon="🐷" label="貯まっている額">
                  <span className="detail-value">{yen(row.kept)}</span>
                </DetailRow>
                {row.withdrawn > 0 && (
                  <DetailRow icon="✂️" label="切り崩し済み">
                    <span className="detail-value">{yen(row.withdrawn)}</span>
                  </DetailRow>
                )}
              </>
            )
          })()}

          <DetailBlock icon="😊" label="アイコン">
            <IconSwatches
              value={goalDraft.icon}
              onChange={icon => setGoalDraft({ ...goalDraft, icon })}
              accent={theme.accent}
            />
          </DetailBlock>

          <DetailBlock icon="🎨" label="色">
            <ColorSwatches value={goalDraft.color} onChange={color => setGoalDraft({ ...goalDraft, color })} />
          </DetailBlock>
        </DetailModal>
      )}

      {deleteGoal && (
        <ConfirmModal
          message={`貯金目標「${deleteGoal.name}」を削除します。貯めた ${yen(deleteGoal.kept)} は行き先なしとして残ります。よろしいですか？`}
          onCancel={() => setDeleteGoal(null)}
          onConfirm={() => { onRemoveGoal(deleteGoal.id); setDeleteGoal(null); setGoalDraft(null) }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`「${deleteTarget.name}」を削除します。貯めた分の記録も削除されます。よろしいですか？`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onRemoveTask(deleteTarget.id); setDeleteTarget(null); setDraft(null) }}
        />
      )}
    </div>
  )
}

export type { TaskDraft }
