interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ message, onConfirm, onCancel }: Props) {
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
            削除する
          </button>
        </div>
      </div>
    </div>
  )
}
