interface Props {
  message: string
  /** 実行ボタンの文言。既定は「削除する」 */
  confirmText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ message, confirmText = '削除する', onConfirm, onCancel }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">確認</div>
        <p style={{ fontSize: '0.9rem', marginBottom: '1.25rem', color: 'var(--text-h)' }}>
          {message}
        </p>
        <div className="form-actions">
          <button className="btn-sub" onClick={onCancel}>キャンセル</button>
          <button className="btn-danger" style={{ background: '#e53e3e', color: '#fff', border: 'none' }} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
