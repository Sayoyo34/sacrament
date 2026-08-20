import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSwipeNav } from '../useSwipeNav'

interface Props {
  title: string
  accent: string
  soft: string
  /** 退出アニメーションが終わってから呼ばれる */
  onClose: () => void
  /** 隣接する下位ページへの横スワイプ（例: ジャンル管理 ⇄ タグ管理） */
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  children: ReactNode
}

/**
 * タブの中を横にスライドして開く下位ページ。
 * ボトムナビはそのまま残り、左上の「‹」で元の一覧へ戻る。
 */
export default function SubPage({ title, accent, soft, onClose, onSwipeLeft, onSwipeRight, children }: Props) {
  const swipe = useSwipeNav({ onSwipeLeft, onSwipeRight })
  const [exiting, setExiting] = useState(false)
  const closed = useRef(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  function finish() {
    if (closed.current) return
    closed.current = true
    closeRef.current()
  }

  // animationend が来ないまま取り残されないよう、時間切れでも必ず閉じる
  useEffect(() => {
    if (!exiting) return
    const id = setTimeout(finish, 400)
    return () => clearTimeout(id)
  }, [exiting])

  return (
    <div
      className={`subpage${exiting ? ' exiting' : ''}`}
      onAnimationEnd={e => {
        // 中身のアニメーションが混ざらないよう、この要素自身の時だけ扱う
        if (e.target === e.currentTarget && exiting) finish()
      }}
    >
      <div className="subpage-head" style={{ background: soft }}>
        <button
          className="subpage-back"
          style={{ color: accent }}
          onClick={() => setExiting(true)}
          aria-label="戻る"
        >
          ‹
        </button>
        <span className="subpage-title">{title}</span>
        <span />
      </div>

      <div className="page-scroll" {...swipe}>{children}</div>
    </div>
  )
}
