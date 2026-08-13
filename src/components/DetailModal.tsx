import { createContext, useContext, useState, type ReactNode } from 'react'

type Mode = 'view' | 'edit'

const DetailMode = createContext<Mode>('edit')

interface Props {
  icon: string
  color: string       // ヘッダー背景（ジャンル色）
  name: string
  /** 新規作成など、最初から編集状態で開きたい場合 */
  startInEdit?: boolean
  /** 省略すると名前は編集不可（引く/戻す専用シートなど） */
  onNameChange?: (v: string) => void
  namePlaceholder?: string
  onClose: () => void
  /**
   * 省略すると編集できないシートになる（閲覧のみ）。
   * true を返すと閲覧モードに戻る。入力に不備があった時や、
   * 新規作成でシートを閉じる時は false を返す。
   */
  onSave?: () => boolean | void
  onDelete?: () => void
  /** 入力に不備がある時の説明。保存を押しても何も起きない状態を避ける */
  error?: string
  children: ReactNode
}

/**
 * 一覧の項目をタップして開く詳細シート。
 * まず閲覧モードで開き、「編集」を押して初めて書き換えられる。
 */
export default function DetailModal({
  icon, color, name, startInEdit, onNameChange, namePlaceholder,
  onClose, onSave, onDelete, error, children,
}: Props) {
  const [mode, setMode] = useState<Mode>(startInEdit ? 'edit' : 'view')
  const editing = mode === 'edit'

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
              {onSave && (
                editing
                  ? (
                    <button
                      className="detail-save"
                      onClick={() => { if (onSave() === true) setMode('view') }}
                    >
                      保存
                    </button>
                  )
                  : <button className="detail-save" onClick={() => setMode('edit')}>編集</button>
              )}
            </div>
          </div>
          <div className="detail-title-row">
            <span className="detail-icon">{icon}</span>
            {editing && onNameChange ? (
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
          {editing && error && <p className="form-error" role="alert">{error}</p>}
          <DetailMode.Provider value={mode}>{children}</DetailMode.Provider>
        </div>
      </div>
    </div>
  )
}

/**
 * 詳細シートの1行。
 * value を渡すと閲覧モードではそれを、編集モードでは children を出す。
 * value={null} なら閲覧モードでは行ごと出さない（編集専用の行）。
 */
export function DetailRow({ icon, label, value, children }: {
  icon: string
  label: string
  value?: ReactNode
  children?: ReactNode
}) {
  const mode = useContext(DetailMode)
  if (mode === 'view' && value === null) return null
  const body = mode === 'view' && value !== undefined ? value : children
  return (
    <div className="detail-row">
      <span className="detail-row-icon">{icon}</span>
      <span className="detail-row-label">{label}</span>
      <div className="detail-row-control">{body}</div>
    </div>
  )
}

/** ラベルを上に置き、下に自由な高さの中身を敷く行（メモ・タグなど） */
export function DetailBlock({ icon, label, value, children }: {
  icon: string
  label: string
  value?: ReactNode
  children?: ReactNode
}) {
  const mode = useContext(DetailMode)
  if (mode === 'view' && value === null) return null
  const body = mode === 'view' && value !== undefined ? value : children
  return (
    <div className="detail-block">
      <div className="detail-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <span className="detail-row-icon">{icon}</span>
        <span className="detail-row-label">{label}</span>
      </div>
      <div className="detail-block-body">{body}</div>
    </div>
  )
}

/** 閲覧モードで値を出すときの共通表示 */
export function ReadValue({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span className="detail-value" style={muted ? { color: 'var(--text)', fontFamily: 'inherit' } : undefined}>
      {children}
    </span>
  )
}
