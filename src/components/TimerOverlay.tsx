import { useEffect, useRef, useState } from 'react'

interface Props {
  taskName: string
  remaining: number
  totalSeconds: number
  paused: boolean
  accent: string
  soft: string
  onTogglePause: () => void
  onCancel: () => void
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/**
 * タイマー実行中は画面全体を占拠して表示する。上下のメニューを隠すことで
 * 一時停止・キャンセルの操作中に他のタブへ誤って移動しないようにする。
 */
export default function TimerOverlay({
  taskName, remaining, totalSeconds, paused, accent, soft, onTogglePause, onCancel,
}: Props) {
  const [exiting, setExiting] = useState(false)
  const closed = useRef(false)
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel

  function finish() {
    if (closed.current) return
    closed.current = true
    cancelRef.current()
  }

  // animationend が来ないまま取り残されないよう、時間切れでも必ず閉じる
  useEffect(() => {
    if (!exiting) return
    const id = setTimeout(finish, 400)
    return () => clearTimeout(id)
  }, [exiting])

  const size = 260
  const thickness = 14
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const ratio = totalSeconds > 0 ? Math.max(0, Math.min(1, remaining / totalSeconds)) : 0
  const dash = ratio * circ

  return (
    <div
      className={`timer-overlay${exiting ? ' exiting' : ''}`}
      style={{ background: soft }}
      onAnimationEnd={e => { if (e.target === e.currentTarget && exiting) finish() }}
    >
      <div className="timer-overlay-body">
        <div className="timer-overlay-name">{taskName}</div>

        <div className="timer-ring-wrap">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={thickness}
            />
            <circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={accent} strokeWidth={thickness} strokeLinecap="round"
              strokeDasharray={`${dash} ${circ - dash}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dasharray 0.3s linear' }}
            />
          </svg>
          <span className="timer-ring-time">{fmt(remaining)}</span>
        </div>

        <div className="timer-overlay-controls">
          <button style={{ background: accent }} onClick={onTogglePause}>
            {paused ? '再開する' : '一時停止'}
          </button>
          <button className="btn-sub" onClick={() => setExiting(true)}>タイマーをキャンセル</button>
        </div>
      </div>
    </div>
  )
}
