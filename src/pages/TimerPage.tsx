import { useState, useEffect, useRef } from 'react'
import type { TimerPreset, ActiveTimer } from '../types'

interface Props {
  presets: TimerPreset[]
  totalMinutes: number
  bonusRate: number
  onSetBonusRate: (rate: number) => void
  onTimerComplete: (completedMinutes: number) => void
  onAddPreset: (name: string, minutes: number) => void
  onEditPreset: (id: string, name: string, minutes: number) => void
  onRemovePreset: (id: string) => void
}

export default function TimerPage({
  presets, totalMinutes, bonusRate,
  onSetBonusRate, onTimerComplete,
  onAddPreset, onEditPreset, onRemovePreset,
}: Props) {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [timerDone, setTimerDone] = useState(false)
  const [editingPreset, setEditingPreset] = useState<TimerPreset | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMinutes, setNewMinutes] = useState<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completedSecondsRef = useRef<number | null>(null)
  const onCompleteRef = useRef(onTimerComplete)
  onCompleteRef.current = onTimerComplete

  useEffect(() => {
    if (activeTimer && !isPaused) {
      intervalRef.current = setInterval(() => {
        setActiveTimer(prev => {
          if (!prev) return null
          if (prev.remaining <= 1) {
            clearInterval(intervalRef.current!)
            completedSecondsRef.current = prev.totalSeconds
            return null
          }
          return { ...prev, remaining: prev.remaining - 1 }
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [activeTimer?.presetId, isPaused])

  useEffect(() => {
    if (activeTimer === null && completedSecondsRef.current !== null) {
      const mins = Math.floor(completedSecondsRef.current / 60)
      completedSecondsRef.current = null
      onCompleteRef.current(mins)
      setTimerDone(true)
    }
  }, [activeTimer])

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

  function handleAddPreset() {
    if (!newName.trim() || newMinutes <= 0) return
    onAddPreset(newName.trim(), newMinutes)
    setNewName('')
    setNewMinutes(0)
    setAddModal(false)
  }

  function handleSaveEdit() {
    if (!editingPreset) return
    onEditPreset(editingPreset.id, editingPreset.name, editingPreset.minutes)
    setEditingPreset(null)
  }

  function fmt(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const earnedBonus = Math.floor(totalMinutes / 10) * bonusRate
  const activePreset = presets.find(p => p.id === activeTimer?.presetId)

  return (
    <div className="page">
      <div className="page-scroll">
        <div className="card stat-card">
          <div className="stat-label">タイマーボーナス累計</div>
          <div className="stat-number">{earnedBonus.toLocaleString()}円</div>
          <div className="summary" style={{ marginTop: '0.25rem' }}>
            {totalMinutes}分（10分 = {bonusRate}円）
          </div>
        </div>

        {timerDone && (
          <div className="timer-done">
            ✨ タイマー完了！お疲れさまでした
            <button className="btn-sub" onClick={() => setTimerDone(false)}>閉じる</button>
          </div>
        )}

        {activeTimer ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="summary">{activePreset?.name}</div>
            <div className="timer-display">{fmt(activeTimer.remaining)}</div>
            <div className="timer-controls">
              <button onClick={() => setIsPaused(p => !p)}>
                {isPaused ? '再開' : '一時停止'}
              </button>
              <button className="btn-sub" onClick={cancelTimer}>キャンセル</button>
            </div>
          </div>
        ) : (
          <>
            <div className="section-header">
              <h3>タイマーを選択</h3>
            </div>
            <div className="timer-presets">
              {presets.map(preset => (
                <div key={preset.id}>
                  {editingPreset?.id === preset.id ? (
                    <div className="card preset-edit-row">
                      <input
                        value={editingPreset.name}
                        onChange={e => setEditingPreset({ ...editingPreset, name: e.target.value })}
                        style={{ flex: 2 }}
                      />
                      <input
                        type="number"
                        value={editingPreset.minutes}
                        onChange={e => setEditingPreset({ ...editingPreset, minutes: Number(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <span className="summary">分</span>
                      <button onClick={handleSaveEdit}>保存</button>
                      <button className="btn-sub" onClick={() => setEditingPreset(null)}>×</button>
                    </div>
                  ) : (
                    <div className="preset-row">
                      <button className="timer-btn" onClick={() => startTimer(preset)}>
                        <span className="preset-name">{preset.name}</span>
                        <span className="preset-minutes">{preset.minutes}分</span>
                      </button>
                      <button className="btn-sub" onClick={() => setEditingPreset({ ...preset })}>編集</button>
                      <button className="btn-danger" onClick={() => {
                        if (activeTimer?.presetId === preset.id) cancelTimer()
                        onRemovePreset(preset.id)
                      }}>削除</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="section-header" style={{ marginTop: 0 }}>
            <h3>レート設定</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="summary">10分 =</span>
            <input
              type="number"
              value={bonusRate}
              onChange={e => onSetBonusRate(Number(e.target.value))}
              min={0}
              step={100}
              style={{ width: '90px', flex: 'none' }}
            />
            <span className="summary">円</span>
          </div>
        </div>

        <div className="fab-row">
          <button className="fab" onClick={() => setAddModal(true)}>+</button>
        </div>
      </div>

      {addModal && (
        <div className="modal-overlay" onClick={() => setAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">タイマーを追加</div>
            <div className="form-row">
              <label>名前</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="例: 集中タイム"
                autoFocus
              />
            </div>
            <div className="form-row">
              <label>時間（分）</label>
              <input
                type="number"
                value={newMinutes || ''}
                onChange={e => setNewMinutes(Number(e.target.value))}
                placeholder="0"
                min={1}
              />
            </div>
            <div className="form-actions">
              <button className="btn-sub" onClick={() => setAddModal(false)}>キャンセル</button>
              <button onClick={handleAddPreset}>追加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
