import { useState } from 'react'
import type { BulletItem } from '../types'
import ConfirmModal from '../components/ConfirmModal'

interface Props {
  totalBalance: number
  bonusBalance: number
  availableBonus: number
  bonusUsed: number
  effectiveBonus: number
  bonusCap: number
  remainingBudget: number
  bulletItems: BulletItem[]
  totalDeducted: number
  totalPending: number
  onAddItem: (name: string, cost: number) => void
  onEditItem: (id: string, name: string, cost: number) => void
  onDeductFull: (id: string) => void
  onUndoDeduct: (id: string) => void
  onDeductPartial: (id: string, amount: number) => void
  onUndoPartial: (id: string, amount: number) => void
  onRemoveItem: (id: string) => void
  onUseBonusFull: () => void
  onUndoBonusUse: () => void
  onUseBonusPartial: (amount: number) => void
  onUndoBonusPartial: (amount: number) => void
}

export default function SimulatorPage({
  totalBalance, bonusBalance, availableBonus, bonusUsed, effectiveBonus, bonusCap, remainingBudget, bulletItems, totalDeducted, totalPending,
  onAddItem, onEditItem, onDeductFull, onUndoDeduct, onDeductPartial, onUndoPartial, onRemoveItem,
  onUseBonusFull, onUndoBonusUse, onUseBonusPartial, onUndoBonusPartial,
}: Props) {
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCost, setEditCost] = useState<number>(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [itemName, setItemName] = useState('')
  const [itemCost, setItemCost] = useState<number>(0)
  const [partialId, setPartialId] = useState<string | null>(null)
  const [partialAmt, setPartialAmt] = useState<number>(0)
  const [partialMode, setPartialMode] = useState<'deduct' | 'undo'>('deduct')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const [bonusPartialOpen, setBonusPartialOpen] = useState(false)
  const [bonusPartialAmt, setBonusPartialAmt] = useState<number>(0)
  const [bonusPartialMode, setBonusPartialMode] = useState<'use' | 'undo'>('use')

  function openBonusPartial(mode: 'use' | 'undo') {
    setBonusPartialOpen(true)
    setBonusPartialMode(mode)
    setBonusPartialAmt(0)
  }

  function handleBonusPartialConfirm(max: number) {
    if (bonusPartialAmt <= 0 || bonusPartialAmt > max) return
    if (bonusPartialMode === 'use') onUseBonusPartial(bonusPartialAmt)
    else onUndoBonusPartial(bonusPartialAmt)
    setBonusPartialOpen(false)
    setBonusPartialAmt(0)
  }

  function startEdit(item: BulletItem) {
    setEditingId(item.id)
    setEditName(item.name)
    setEditCost(item.estimatedCost)
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return
    onEditItem(editingId, editName.trim(), editCost)
    setEditingId(null)
  }

  function handleAdd() {
    if (!itemName.trim()) return
    onAddItem(itemName.trim(), itemCost)
    setItemName('')
    setItemCost(0)
    setModalOpen(false)
  }

  function handlePartialConfirm(id: string, max: number) {
    if (partialAmt <= 0 || partialAmt > max) return
    if (partialMode === 'deduct') {
      onDeductPartial(id, partialAmt)
    } else {
      onUndoPartial(id, partialAmt)
    }
    setPartialId(null)
    setPartialAmt(0)
  }

  function openPartial(id: string, mode: 'deduct' | 'undo') {
    setPartialId(id)
    setPartialMode(mode)
    setPartialAmt(0)
  }

  return (
    <div className="page">
      <div className="page-scroll">
        {/* 所持金 */}
        <div className="card stat-card">
          <div className="stat-label">所持金</div>
          <div className={`stat-number${totalBalance < 0 ? ' negative' : ''}`}>
            {totalBalance.toLocaleString()}円
          </div>
          {bonusBalance > 0 && (
            <div className="summary" style={{ marginTop: '0.25rem' }}>
              うちボーナス前借り {effectiveBonus.toLocaleString()}円
              {effectiveBonus < bonusBalance && ` （獲得済み ${bonusBalance.toLocaleString()}円`}
              {effectiveBonus < bonusBalance && bonusUsed > 0 && ` / 使用済み ${bonusUsed.toLocaleString()}円`}
              {effectiveBonus < bonusBalance && '）'}
            </div>
          )}
        </div>

        {bonusCap > 0 && (
          <div className="card" style={{ padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text)', marginBottom: '0.35rem' }}>
              <span>ボーナス前借り枠</span>
              <span>{effectiveBonus.toLocaleString()} / {bonusCap.toLocaleString()}円</span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: 'var(--code-bg)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (effectiveBonus / bonusCap) * 100)}%`,
                background: effectiveBonus >= bonusCap ? '#e53e3e' : 'var(--accent)',
                transition: 'width 0.2s',
              }} />
            </div>
          </div>
        )}

        {/* ボーナス前借り */}
        {bonusBalance > 0 && (
          <div className="card">
            <div className="section-header" style={{ marginTop: 0 }}>
              <h3>ボーナス前借り</h3>
            </div>
            <div className="summary" style={{ padding: '0.25rem 0' }}>
              使える {availableBonus.toLocaleString()}円
              {bonusUsed > 0 && ` ／ 使用済み ${bonusUsed.toLocaleString()}円`}
            </div>
            <div className="item-actions">
              {availableBonus > 0 && (
                <>
                  <button onClick={onUseBonusFull}>全額使う</button>
                  <button className="btn-sub" onClick={() => openBonusPartial('use')}>一部使う</button>
                </>
              )}
              {bonusUsed > 0 && (
                <>
                  <button className="btn-sub" onClick={() => openBonusPartial('undo')}>一部戻す</button>
                  <button className="btn-sub" onClick={onUndoBonusUse}>全額戻す</button>
                </>
              )}
            </div>
            {bonusPartialOpen && (
              <div className="item-partial-input">
                <input
                  type="number"
                  value={bonusPartialAmt || ''}
                  onChange={e => setBonusPartialAmt(Number(e.target.value))}
                  placeholder={bonusPartialMode === 'use' ? `最大 ${availableBonus.toLocaleString()}円` : `最大 ${bonusUsed.toLocaleString()}円`}
                  min={0}
                  max={bonusPartialMode === 'use' ? availableBonus : bonusUsed}
                  style={{ flex: 1 }}
                />
                <button onClick={() => handleBonusPartialConfirm(bonusPartialMode === 'use' ? availableBonus : bonusUsed)}>
                  確定
                </button>
                <button className="btn-sub" onClick={() => setBonusPartialOpen(false)}>×</button>
              </div>
            )}
          </div>
        )}

        {/* 欲しいものの一覧 */}
        <div className="section-header">
          <h3>欲しいものの一覧</h3>
          {bulletItems.length > 0 && (
            <button className="btn-sub" onClick={() => { setEditMode(e => !e); setEditingId(null) }}>
              {editMode ? '完了' : '編集'}
            </button>
          )}
        </div>

        {bulletItems.length === 0 ? (
          <p className="empty-hint">まだ予定がありません<br />+ボタンで追加できます</p>
        ) : (
          <ul className="item-list">
            {bulletItems.map(item => {
              const fullyDeducted = item.deductedAmount > 0 && item.deductedAmount >= item.estimatedCost
              const partiallyDeducted = item.deductedAmount > 0 && !fullyDeducted
              const remaining = item.estimatedCost - item.deductedAmount

              return (
                <li key={item.id} className="item-card">
                  <div className="item-card-top">
                    <span className={`item-name${fullyDeducted ? ' deducted' : partiallyDeducted ? ' partial' : ''}`}>
                      {fullyDeducted ? '✓ ' : partiallyDeducted ? '◐ ' : '• '}
                      {item.name}
                    </span>
                    <span className="item-amount">{item.estimatedCost.toLocaleString()}円</span>
                  </div>

                  {partiallyDeducted && (
                    <div className="summary" style={{ fontSize: '0.76rem', marginTop: '0.15rem' }}>
                      引済 {item.deductedAmount.toLocaleString()}円 / 残 {remaining.toLocaleString()}円
                    </div>
                  )}

                  {editMode && editingId === item.id ? (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="予定名"
                      />
                      <input
                        type="number"
                        value={editCost || ''}
                        onChange={e => setEditCost(Number(e.target.value))}
                        placeholder="金額"
                        min={0}
                      />
                      <div className="item-actions">
                        <button onClick={saveEdit}>保存</button>
                        <button className="btn-sub" onClick={() => setEditingId(null)}>キャンセル</button>
                        <button className="btn-danger" onClick={() => { setEditingId(null); setDeleteTarget({ id: item.id, name: item.name }) }}>削除</button>
                      </div>
                    </div>
                  ) : editMode ? (
                    <div className="item-actions">
                      <button className="btn-sub" onClick={() => startEdit(item)}>編集</button>
                      <button className="btn-danger" onClick={() => setDeleteTarget({ id: item.id, name: item.name })}>削除</button>
                    </div>
                  ) : fullyDeducted ? (
                    <div className="item-actions">
                      <button className="btn-sub" onClick={() => onUndoDeduct(item.id)}>全額戻す</button>
                    </div>
                  ) : (
                    <>
                      <div className="item-actions">
                        <button onClick={() => onDeductFull(item.id)}>全額引く</button>
                        <button className="btn-sub" onClick={() => openPartial(item.id, 'deduct')}>
                          一部引く
                        </button>
                        {partiallyDeducted && (
                          <>
                            <button className="btn-sub" onClick={() => openPartial(item.id, 'undo')}>
                              一部戻す
                            </button>
                            <button className="btn-sub" onClick={() => onUndoDeduct(item.id)}>全額戻す</button>
                          </>
                        )}
                      </div>
                      {partialId === item.id && (
                        <div className="item-partial-input">
                          <input
                            type="number"
                            value={partialAmt || ''}
                            onChange={e => setPartialAmt(Number(e.target.value))}
                            placeholder={partialMode === 'deduct' ? `最大 ${remaining.toLocaleString()}円` : `最大 ${item.deductedAmount.toLocaleString()}円`}
                            min={0}
                            max={partialMode === 'deduct' ? remaining : item.deductedAmount}
                            style={{ flex: 1 }}
                          />
                          <button onClick={() => handlePartialConfirm(item.id, partialMode === 'deduct' ? remaining : item.deductedAmount)}>
                            確定
                          </button>
                          <button className="btn-sub" onClick={() => setPartialId(null)}>×</button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="fab-row">
          <button className="fab" onClick={() => setModalOpen(true)}>+</button>
        </div>
      </div>

      {/* 計算結果パネル */}
      <div className="result-panel">
        <div className="result-panel-title">計算結果</div>
        <div className={`result-main${remainingBudget < 0 ? ' negative' : ' positive'}`}>
          残り使える金額　{remainingBudget.toLocaleString()}円
        </div>
        <div className="result-sub">
          <span>引き済み {totalDeducted.toLocaleString()}円</span>
          <span>未引き {totalPending.toLocaleString()}円</span>
        </div>
      </div>

      {/* 追加モーダル */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">予定を追加</div>
            <div className="form-row">
              <label>予定名</label>
              <input
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                placeholder="例: ライブ遠征費"
                autoFocus
              />
            </div>
            <div className="form-row">
              <label>予測金額</label>
              <input
                type="number"
                value={itemCost || ''}
                onChange={e => setItemCost(Number(e.target.value))}
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
          onConfirm={() => { onRemoveItem(deleteTarget.id); setDeleteTarget(null) }}
        />
      )}
    </div>
  )
}
