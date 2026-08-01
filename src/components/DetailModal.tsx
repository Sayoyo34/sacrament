import type { ReactNode } from 'react'

interface Props {
  icon: string
  color: string       // ヘッダー背景（ジャンル色）
  name: string
  /** 省略すると名前は編集不可（引く/戻す専用シートなど） */
  onNameChange?: (v: string) => void
  namePlaceholder?: string
  onClose: () => void
  /** 省略すると保存ボタンを出さない */
  onSave?: () => void
  onDelete?: () => void
  /** 入力に不備がある時の説明。保存を押しても何も起きない状態を避ける */
  error?: string
  children: ReactNode
}

/**
 * 一覧の項目をタップして開く詳細・編集シート。
 * 家計簿 / 予定 / 貯金 で共通に使い、中身のフィールドだけ各ページが差し込む。
 */
export default function DetailModal({
  icon, color, name, onNameChange, namePlaceholder, onClose, onSave, onDelete, error, children,
}: Props) {
  return (
    <div className="modal-overlay detail-overlay" onClick={onClose}>
      <div className="detail-sheet" onClick={e => e.stopPropagation()}>
        <div className="detail-head" style={{ background: color }}>
          <div className="detail-head-bar">
            <button className="icon-btn" onClick={onClose} aria-label="閉じる">✕</button>
            <div className="detail-head-actions">
              {onDelete && (
                <button className="icon-btn" onClick={onDelete} aria-label="削除">🗑</button>
              )}
              {onSave && <button className="detail-save" onClick={onSave}>保存</button>}
            </div>
          </div>
          <div className="detail-title-row">
            <span className="detail-icon">{icon}</span>
            {onNameChange ? (
              <input
                className="detail-name"
                value={name}
                onChange={e => onNameChange(e.target.value)}
                placeholder={namePlaceholder ?? '名前'}
              />
            ) : (
              <span className="detail-name detail-name-static">{name}</span>
            )}
          </div>
        </div>

        <div className="detail-body">
          {error && <p className="form-error" role="alert">{error}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}

export function DetailRow({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="detail-row">
      <span className="detail-row-icon">{icon}</span>
      <span className="detail-row-label">{label}</span>
      <div className="detail-row-control">{children}</div>
    </div>
  )
}

/** ラベルを上に置き、下に自由な高さの中身を敷く行（メモ・タグなど） */
export function DetailBlock({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="detail-block">
      <div className="detail-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <span className="detail-row-icon">{icon}</span>
        <span className="detail-row-label">{label}</span>
      </div>
      <div className="detail-block-body">{children}</div>
    </div>
  )
}
