import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'

interface Props {
  /** アニメーションが終わってから呼ばれる */
  onClose: () => void
  /** .modal / .detail-sheet など、シート本体に付けるクラス */
  sheetClassName: string
  overlayClassName?: string
  showHandle?: boolean
  /** この中から始まったドラッグはスワイプで閉じない（独自スクロールを持つ領域など） */
  dragExcludeSelector?: string
  children: ReactNode | ((requestClose: () => void) => ReactNode)
}

const DRAG_CLOSE = 80 // px 引き下げたら閉じる
const FLICK_VELOCITY = 0.5 // px/ms。短い距離でも素早く引けば閉じる

function shouldSkipDrag(target: EventTarget | null, excludeSelector?: string) {
  if (!(target instanceof Element)) return false
  if (target.closest('input, select, textarea, button, a, label')) return true
  return !!excludeSelector && !!target.closest(excludeSelector)
}

/** 下から出てくるシート共通の土台。開閉アニメーションと下スワイプ／フリックでの閉じ操作を持つ */
export default function Sheet({
  onClose, sheetClassName, overlayClassName, showHandle = true, dragExcludeSelector, children,
}: Props) {
  const [shown, setShown] = useState(false)
  const [dragY, setDragY] = useState<number | null>(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startTime = useRef(0)
  const closed = useRef(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function finish() {
    if (closed.current) return
    closed.current = true
    closeRef.current()
  }

  function requestClose() {
    if (closed.current) return
    setDragY(null)
    setShown(false)
  }

  // transitionend が来ないまま取り残されないよう、時間切れでも必ず閉じる
  useEffect(() => {
    if (shown) return
    const id = setTimeout(finish, 320)
    return () => clearTimeout(id)
  }, [shown])

  function onTouchStart(e: ReactTouchEvent) {
    if (shouldSkipDrag(e.target, dragExcludeSelector)) return
    dragging.current = true
    startY.current = e.touches[0].clientY
    startTime.current = e.timeStamp
  }

  function onTouchMove(e: ReactTouchEvent) {
    if (!dragging.current) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0) setDragY(dy)
  }

  function onTouchEnd(e: ReactTouchEvent) {
    if (!dragging.current) return
    dragging.current = false
    const dy = dragY ?? 0
    const elapsed = e.timeStamp - startTime.current
    const velocity = elapsed > 0 ? dy / elapsed : 0
    if (dy > DRAG_CLOSE || (dy > 24 && velocity > FLICK_VELOCITY)) requestClose()
    else setDragY(null)
  }

  const style: CSSProperties | undefined = dragY != null
    ? { transform: `translateY(${dragY}px)`, transition: 'none' }
    : undefined

  return (
    <div
      className={`modal-overlay${overlayClassName ? ` ${overlayClassName}` : ''}${shown ? ' shown' : ''}`}
      onClick={requestClose}
    >
      <div
        className={`${sheetClassName}${shown ? ' shown' : ''}`}
        style={style}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTransitionEnd={e => { if (e.target === e.currentTarget && !shown) finish() }}
      >
        {showHandle && <div className="modal-handle" />}
        {typeof children === 'function' ? children(requestClose) : children}
      </div>
    </div>
  )
}
