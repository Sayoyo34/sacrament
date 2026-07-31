import { useEffect, useRef, useState } from 'react'
import type { ActiveTimer, Genre, SavingsEvent, Task, TaskRepeat } from '../types'
import DetailModal, { DetailRow } from '../components/DetailModal'
import ConfirmModal from '../components/ConfirmModal'
import { GenreDot, GenreSelect } from '../components/Pickers'
import TopTabs from '../components/TopTabs'
import { themeOf } from '../theme'
import { monthLabel, monthOf, recentDays, thisMonth, todayStr } from '../utils'

type Tab = 'tasks' | 'goals'

interface TaskDraft {
  id: string | null
  name: string
  bonusAmount: number
  repeat: TaskRepeat
  useTimer: boolean
  timerMinutes: number
  genreId: string
}

interface Props {
  tasks: Task[]
  savingsEvents: SavingsEvent[]
  genres: Genre[]
  savingsEarned: number
  savingsWithdrawn: number
  onSaveTask: (draft: TaskDraft) => void
  onRemoveTask: (id: string) => void
  onCompleteTask: (id: string) => void
  onUncompleteTask: (id: string) => void
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function SavingsPage({
  tasks, savingsEvents, genres, savingsEarned, savingsWithdrawn,
  onSaveTask, onRemoveTask, onCompleteTask, onUncompleteTask,
}: Props) {
  const savingsKept = savingsEarned - savingsWithdrawn
  const theme = themeOf('savings')
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
    setDraft({ id: null, name: '', bonusAmount: 0, repeat: 'once', useTimer: false, timerMinutes: 25, genreId: '' })
  }

  function openTask(t: Task) {
    setDraft({
      id: t.id, name: t.name, bonusAmount: t.bonusAmount, repeat: t.repeat,
      useTimer: t.timerMinutes > 0, timerMinutes: t.timerMinutes || 25, genreId: t.genreId,
    })
  }

  function saveTask() {
    if (!draft || !draft.name.trim()) return
    onSaveTask({ ...draft, name: draft.name.trim() })
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
              目標ごとの貯金先（緊急用・一人暮らし初期費用など）は次回の実装分です
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
          onClose={() => setDraft(null)}
          onSave={saveTask}
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
        </DetailModal>
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
