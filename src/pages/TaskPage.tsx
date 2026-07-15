import { useState } from 'react'
import type { Task } from '../types'
import ConfirmModal from '../components/ConfirmModal'

interface Props {
  tasks: Task[]
  bonusBalance: number
  onAddTask: (name: string, bonus: number) => void
  onCompleteTask: (id: string) => void
  onRemoveTask: (id: string) => void
}

export default function TaskPage({ tasks, bonusBalance, onAddTask, onCompleteTask, onRemoveTask }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [taskBonus, setTaskBonus] = useState<number>(0)
  const [editMode, setEditMode] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  function handleAdd() {
    if (!taskName.trim()) return
    onAddTask(taskName.trim(), taskBonus)
    setTaskName('')
    setTaskBonus(0)
    setModalOpen(false)
  }

  const pending = tasks.filter(t => !t.completed)
  const completed = tasks.filter(t => t.completed)

  return (
    <div className="page">
      <div className="page-scroll">
        <div className="card stat-card">
          <div className="stat-label">累計ボーナス残高</div>
          <div className="stat-number">{bonusBalance.toLocaleString()}円</div>
        </div>

        <div className="section-header">
          <h3>タスク一覧</h3>
          {tasks.length > 0 && (
            <button className="btn-sub" onClick={() => setEditMode(e => !e)}>
              {editMode ? '完了' : '編集'}
            </button>
          )}
        </div>

        {tasks.length === 0 ? (
          <p className="empty-hint">タスクがありません<br />+ボタンで追加できます</p>
        ) : (
          <>
            <ul className="item-list">
              {pending.map(task => (
                <li key={task.id} className="item-card">
                  <div className="task-card">
                    <div className="task-info">
                      <div className="task-name">📋 {task.name}</div>
                      <div className="task-bonus">+{task.bonusAmount.toLocaleString()}円</div>
                    </div>
                    <button onClick={() => onCompleteTask(task.id)}>達成！</button>
                    {editMode && (
                      <button className="btn-danger" onClick={() => setDeleteTarget({ id: task.id, name: task.name })}>削除</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {completed.length > 0 && (
              <>
                <div className="section-header">
                  <h3>達成済み</h3>
                </div>
                <ul className="item-list">
                  {completed.map(task => (
                    <li key={task.id} className="item-card">
                      <div className="task-card">
                        <div className="task-info">
                          <div className="task-name completed">🎉 {task.name}</div>
                          <div className="task-bonus">+{task.bonusAmount.toLocaleString()}円</div>
                        </div>
                        {editMode && (
                          <button className="btn-danger" onClick={() => setDeleteTarget({ id: task.id, name: task.name })}>削除</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <div className="fab-row">
          <button className="fab" onClick={() => setModalOpen(true)}>+</button>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">タスクを追加</div>
            <div className="form-row">
              <label>タスク名</label>
              <input
                value={taskName}
                onChange={e => setTaskName(e.target.value)}
                placeholder="例: 部屋の掃除"
                autoFocus
              />
            </div>
            <div className="form-row">
              <label>ボーナス額</label>
              <input
                type="number"
                value={taskBonus || ''}
                onChange={e => setTaskBonus(Number(e.target.value))}
                placeholder="0"
                min={0}
              />
            </div>
            <div className="form-actions">
              <button className="btn-sub" onClick={() => setModalOpen(false)}>キャンセル</button>
              <button onClick={handleAdd}>追加</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`「${deleteTarget.name}」を削除します。よろしいですか？`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onRemoveTask(deleteTarget.id); setDeleteTarget(null) }}
        />
      )}
    </div>
  )
}
