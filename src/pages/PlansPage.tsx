import { useState } from 'react'
import type { Genre, GoalRow, PlanItem, PlanKind, Tag, Wallet } from '../types'
import DetailModal, { DetailBlock, DetailRow } from '../components/DetailModal'
import ConfirmModal from '../components/ConfirmModal'
import { GenreDot, GenreSelect, TagList, TagPicker } from '../components/Pickers'
import TopTabs from '../components/TopTabs'
import { themeOf } from '../theme'
import { yen } from '../utils'
import { firstError, inRange, notNegative, required, withinAmount } from '../validation'

type Tab = 'list' | 'calc'

interface PlanDraft {
  id: string | null
  name: string
  kind: PlanKind
  estimatedCost: number
  dayOfMonth: number
  walletId: string
  genreId: string
  tagIds: string[]
  memo: string
}

interface Props {
  planItems: PlanItem[]
  wallets: Wallet[]
  genres: Genre[]
  tags: Tag[]
  totalBalance: number
  goalRows: GoalRow[]
  onSavePlan: (draft: PlanDraft) => void
  onRemovePlan: (id: string) => void
  onDeduct: (id: string, amount: number) => void
  onUndoDeduct: (id: string, amount: number) => void
  onWithdrawSavings: (goalId: string, amount: number) => void
  onUndoWithdrawSavings: (goalId: string, amount: number) => void
}

function Progress({ ratio, color }: { ratio: number; color: string }) {
  return (
    <span className="bar">
      <span className="bar-fill" style={{ width: `${Math.min(100, ratio * 100)}%`, background: color }} />
    </span>
  )
}

/** 引く/戻すの金額入力。全額・一部の両方をまとめて扱う */
function DeductControls({ remaining, done, accent, onDeduct, onUndo, confirmLabel }: {
  remaining: number
  done: number
  accent: string
  onDeduct: (amount: number) => void
  onUndo: (amount: number) => void
  confirmLabel?: (amount: number) => string
}) {
  const [partial, setPartial] = useState<{ mode: 'deduct' | 'undo'; amount: number } | null>(null)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [error, setError] = useState('')

  function requestDeduct(amount: number) {
    const e = withinAmount(amount, remaining)()
    if (e) { setError(e); return }
    setError('')
    if (confirmLabel) setConfirming(amount)
    else { onDeduct(amount); setPartial(null) }
  }

  function requestUndo(amount: number) {
    const e = withinAmount(amount, done)()
    if (e) { setError(e); return }
    setError('')
    onUndo(amount)
    setPartial(null)
  }

  function openPartial(mode: 'deduct' | 'undo') {
    setError('')
    setPartial({ mode, amount: 0 })
  }

  return (
    <>
      <div className="item-actions">
        {remaining > 0 && (
          <>
            <button style={{ background: accent }} onClick={() => requestDeduct(remaining)}>全額引く</button>
            <button className="btn-sub" onClick={() => openPartial('deduct')}>一部引く</button>
          </>
        )}
        {done > 0 && (
          <>
            <button className="btn-sub" onClick={() => openPartial('undo')}>一部戻す</button>
            <button className="btn-sub" onClick={() => { setError(''); onUndo(done) }}>全額戻す</button>
          </>
        )}
      </div>

      {partial && (
        <div className="item-partial-input">
          <input
            type="number"
            value={partial.amount || ''}
            onChange={e => setPartial({ ...partial, amount: Number(e.target.value) })}
            placeholder={`最大 ${(partial.mode === 'deduct' ? remaining : done).toLocaleString()}円`}
            min={0}
            autoFocus
          />
          <button
            style={{ background: accent }}
            onClick={() => partial.mode === 'deduct' ? requestDeduct(partial.amount) : requestUndo(partial.amount)}
          >
            確定
          </button>
          <button className="btn-sub" onClick={() => { setPartial(null); setError('') }}>×</button>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      {confirming !== null && confirmLabel && (
        <ConfirmModal
          message={confirmLabel(confirming)}
          confirmText="切り崩す"
          onCancel={() => setConfirming(null)}
          onConfirm={() => { onDeduct(confirming); setConfirming(null); setPartial(null) }}
        />
      )}
    </>
  )
}

export default function PlansPage({
  planItems, wallets, genres, tags, totalBalance, goalRows,
  onSavePlan, onRemovePlan, onDeduct, onUndoDeduct, onWithdrawSavings, onUndoWithdrawSavings,
}: Props) {
  const theme = themeOf('plans')
  const [tab, setTab] = useState<Tab>('list')
  const [editing, setEditing] = useState<PlanDraft | null>(null)   // 一覧タブ：内容の編集
  const [deducting, setDeducting] = useState<string | null>(null)  // 計算タブ：引く/戻す
  const [savingsGoalId, setSavingsGoalId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [breakdown, setBreakdown] = useState(false)
  const [editError, setEditError] = useState('')

  const sorted = planItems.slice().sort((a, b) => a.order - b.order)
  const once = sorted.filter(p => p.kind === 'once')
  const monthly = sorted.filter(p => p.kind === 'monthly')

  const deducted = once.reduce((s, p) => s + p.deductedAmount, 0)
  const monthlyTotal = monthly.reduce((s, p) => s + p.estimatedCost, 0)
  const savingsKept = goalRows.reduce((s, g) => s + g.kept, 0)
  const remaining = totalBalance - deducted - monthlyTotal - savingsKept

  const savingsTarget = savingsGoalId !== null ? goalRows.find(g => g.id === savingsGoalId) ?? null : null

  const target = deducting ? planItems.find(p => p.id === deducting) ?? null : null
  const editGenre = genres.find(g => g.id === editing?.genreId)
  const targetGenre = genres.find(g => g.id === target?.genreId)

  function openNew() {
    setEditError('')
    setEditing({
      id: null, name: '', kind: 'once', estimatedCost: 0, dayOfMonth: 0,
      walletId: wallets[0]?.id ?? '', genreId: '', tagIds: [], memo: '',
    })
  }

  function openEdit(p: PlanItem) {
    setEditError('')
    setEditing({
      id: p.id, name: p.name, kind: p.kind, estimatedCost: p.estimatedCost,
      dayOfMonth: p.dayOfMonth, walletId: p.walletId, genreId: p.genreId,
      tagIds: p.tagIds, memo: p.memo,
    })
  }

  function saveEdit() {
    if (!editing) return
    const error = firstError(
      required(editing.name, '予定名'),
      notNegative(editing.estimatedCost, '金額'),
      // 引き落とし日は任意。入れるなら 1〜31
      () => editing.kind === 'monthly' && editing.dayOfMonth !== 0
        ? inRange(editing.dayOfMonth, 1, 31, '引き落とし日')()
        : null,
    )
    if (error) { setEditError(error); return }
    onSavePlan({ ...editing, name: editing.name.trim() })
    setEditing(null)
    setEditError('')
  }

  function renderRow(p: PlanItem) {
    const showProgress = tab === 'calc' && p.kind === 'once'
    const done = p.kind === 'once' && p.estimatedCost > 0 && p.deductedAmount >= p.estimatedCost
    const genre = genres.find(g => g.id === p.genreId)
    return (
      <li key={p.id}>
        <button
          className={`row-card${done ? ' done' : ''}`}
          onClick={() => tab === 'list' ? openEdit(p) : setDeducting(p.id)}
        >
          <GenreDot genres={genres} genreId={p.genreId} fallback="🗒" />
          <span className="row-main">
            <span className={`row-title${done ? ' struck' : ''}`}>
              {p.kind === 'monthly' && p.dayOfMonth > 0 ? `毎月${p.dayOfMonth}日 ` : ''}{p.name}
            </span>
            {showProgress ? (
              <Progress
                ratio={p.estimatedCost > 0 ? p.deductedAmount / p.estimatedCost : 0}
                color={genre?.color ?? theme.accent}
              />
            ) : (
              <span className="row-sub"><TagList tags={tags} ids={p.tagIds} /></span>
            )}
          </span>
          <span className="row-right">
            {showProgress ? (
              <>
                <span className="row-note">
                  ¥{p.deductedAmount.toLocaleString()} / {p.estimatedCost.toLocaleString()}
                </span>
                <span className="row-amount" style={{ color: genre?.color ?? theme.accent }}>
                  {p.estimatedCost > 0 ? Math.round((p.deductedAmount / p.estimatedCost) * 100) : 0}%
                </span>
              </>
            ) : (
              <span className="row-amount">¥{p.estimatedCost.toLocaleString()}</span>
            )}
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="page">
      <TopTabs
        tabs={[{ id: 'list' as Tab, label: '出費予定' }, { id: 'calc' as Tab, label: '計算' }]}
        active={tab}
        onChange={t => { setTab(t); setEditing(null); setDeducting(null) }}
        accent={theme.accent}
        soft={theme.soft}
      />

      <div className="page-scroll">
        {tab === 'calc' && (
          <div className="hero-card">
            <div className="hero-label">残り使える金額</div>
            <div className="hero-number">¥{remaining.toLocaleString()}</div>
          </div>
        )}

        <div className="section-header"><h3>未定 ({once.length})</h3></div>
        {once.length === 0 ? (
          <p className="empty-hint">まだ予定がありません</p>
        ) : (
          <ul className="item-list">{once.map(renderRow)}</ul>
        )}

        <div className="section-header"><h3>毎月 ({monthly.length})</h3></div>
        {monthly.length === 0 ? (
          <p className="empty-hint">定期支出の登録がありません</p>
        ) : (
          <ul className="item-list">{monthly.map(renderRow)}</ul>
        )}

        {tab === 'calc' && (
          <>
            <div className="section-header"><h3>貯金 ({goalRows.length})</h3></div>
            {goalRows.length === 0 ? (
              <p className="empty-hint">つもり貯金がありません</p>
            ) : (
              <ul className="item-list">
                {goalRows.map(g => (
                  <li key={g.id || '__none'}>
                    <button className="row-card" onClick={() => setSavingsGoalId(g.id)}>
                      <span className="genre-dot" style={{ background: `${g.color}33`, width: 34, height: 34, fontSize: 17 }}>
                        {g.icon}
                      </span>
                      <span className="row-main">
                        <span className="row-title">{g.name}</span>
                        <Progress
                          ratio={g.earned > 0 ? g.withdrawn / g.earned : 0}
                          color={g.color}
                        />
                      </span>
                      <span className="row-right">
                        <span className="row-note">
                          切崩 ¥{g.withdrawn.toLocaleString()} / {g.earned.toLocaleString()}
                        </span>
                        <span className="row-amount" style={{ color: g.color }}>
                          残 ¥{g.kept.toLocaleString()}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0 0' }}>
              <button
                style={{ background: theme.accent, padding: '0.65rem 2rem', borderRadius: '999px', fontSize: '0.95rem' }}
                onClick={() => setBreakdown(true)}
              >
                計算する
              </button>
            </div>
          </>
        )}

        {tab === 'list' && (
          <div className="fab-row">
            <button
              className="fab"
              style={{ background: theme.accent, boxShadow: `0 4px 14px ${theme.accent}66` }}
              onClick={openNew}
            >
              +
            </button>
          </div>
        )}
      </div>

      {/* 一覧タブ：内容の編集のみ */}
      {editing && (
        <DetailModal
          icon={editGenre?.icon ?? '🗒'}
          color={editGenre ? `${editGenre.color}55` : theme.soft}
          name={editing.name}
          onNameChange={v => setEditing({ ...editing, name: v })}
          namePlaceholder="例: ライブ遠征費"
          onClose={() => { setEditing(null); setEditError('') }}
          onSave={saveEdit}
          error={editError}
          onDelete={editing.id ? () => setDeleteTarget({ id: editing.id!, name: editing.name }) : undefined}
        >
          <DetailRow icon="🔁" label="種類">
            <div className="type-toggle">
              <button
                className={editing.kind !== 'once' ? 'btn-sub' : ''}
                onClick={() => setEditing({ ...editing, kind: 'once' })}
              >未定</button>
              <button
                className={editing.kind !== 'monthly' ? 'btn-sub' : ''}
                onClick={() => setEditing({ ...editing, kind: 'monthly' })}
              >毎月</button>
            </div>
          </DetailRow>

          <DetailRow icon="💰" label={editing.kind === 'once' ? '予測金額' : '金額'}>
            <input
              type="number"
              value={editing.estimatedCost || ''}
              onChange={e => setEditing({ ...editing, estimatedCost: Number(e.target.value) })}
              placeholder="0"
              min={0}
            />
          </DetailRow>

          {editing.kind === 'monthly' && (
            <>
              <DetailRow icon="📅" label="引き落とし日">
                <input
                  type="number"
                  value={editing.dayOfMonth || ''}
                  onChange={e => setEditing({ ...editing, dayOfMonth: Number(e.target.value) })}
                  placeholder="毎月◯日（任意）"
                  min={1}
                  max={31}
                />
              </DetailRow>
              <DetailRow icon="💳" label="口座">
                <select value={editing.walletId} onChange={e => setEditing({ ...editing, walletId: e.target.value })}>
                  <option value="">未設定</option>
                  {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </DetailRow>
            </>
          )}

          <DetailRow icon="💙" label="ジャンル">
            <GenreSelect genres={genres} value={editing.genreId} onChange={v => setEditing({ ...editing, genreId: v })} />
          </DetailRow>

          <DetailBlock icon="🏷" label="タグ">
            <TagPicker tags={tags} value={editing.tagIds} onChange={ids => setEditing({ ...editing, tagIds: ids })} />
          </DetailBlock>

          <DetailBlock icon="📝" label="メモ">
            <textarea
              value={editing.memo}
              onChange={e => setEditing({ ...editing, memo: e.target.value })}
              placeholder="メモを追加..."
              rows={4}
            />
          </DetailBlock>

          {editing.id && editing.kind === 'once' && (
            <p className="summary" style={{ padding: '0 0.25rem' }}>
              引く・戻すの操作は「計算」タブから行えます
            </p>
          )}
        </DetailModal>
      )}

      {/* 計算タブ：引く/戻すのみ */}
      {target && (
        <DetailModal
          icon={targetGenre?.icon ?? '🗒'}
          color={targetGenre ? `${targetGenre.color}55` : theme.soft}
          name={target.name}
          onClose={() => setDeducting(null)}
        >
          {target.kind === 'once' ? (
            <>
              <DetailRow icon="💰" label="予測金額">
                <span className="detail-value">{yen(target.estimatedCost)}</span>
              </DetailRow>
              <DetailRow icon="✅" label="引き済み">
                <span className="detail-value">{yen(target.deductedAmount)}</span>
              </DetailRow>
              <DetailRow icon="🕗" label="残り">
                <span className="detail-value">{yen(target.estimatedCost - target.deductedAmount)}</span>
              </DetailRow>

              <DetailBlock icon="✂️" label="引く / 戻す">
                <DeductControls
                  remaining={target.estimatedCost - target.deductedAmount}
                  done={target.deductedAmount}
                  accent={theme.accent}
                  onDeduct={amount => onDeduct(target.id, amount)}
                  onUndo={amount => onUndoDeduct(target.id, amount)}
                />
              </DetailBlock>
            </>
          ) : (
            <>
              <DetailRow icon="💰" label="金額">
                <span className="detail-value">{yen(target.estimatedCost)}</span>
              </DetailRow>
              {target.dayOfMonth > 0 && (
                <DetailRow icon="📅" label="引き落とし日">
                  <span className="detail-value">毎月{target.dayOfMonth}日</span>
                </DetailRow>
              )}
              <p className="summary" style={{ padding: '0.5rem 0.25rem' }}>
                毎月の支出は常に全額が差し引かれます。内容の変更は「出費予定」タブから行えます。
              </p>
            </>
          )}
        </DetailModal>
      )}

      {/* 計算タブ：つもり貯金の切り崩し（貯金目標ごと） */}
      {savingsTarget && (
        <DetailModal
          icon={savingsTarget.icon}
          color={`${savingsTarget.color}55`}
          name={savingsTarget.name}
          onClose={() => setSavingsGoalId(null)}
        >
          <DetailRow icon="💰" label="貯めた額">
            <span className="detail-value">{yen(savingsTarget.earned)}</span>
          </DetailRow>
          <DetailRow icon="✂️" label="切り崩し済み">
            <span className="detail-value">{yen(savingsTarget.withdrawn)}</span>
          </DetailRow>
          <DetailRow icon="🐷" label="残り">
            <span className="detail-value">{yen(savingsTarget.kept)}</span>
          </DetailRow>
          {savingsTarget.targetAmount > 0 && (
            <DetailRow icon="🎯" label="目標額">
              <span className="detail-value">{yen(savingsTarget.targetAmount)}</span>
            </DetailRow>
          )}

          <DetailBlock icon="✂️" label="切り崩す / 戻す">
            <p className="summary" style={{ marginBottom: '0.6rem' }}>
              切り崩した分は取っておく額から外れ、その分だけ使える金額が増えます。
            </p>
            <DeductControls
              remaining={savingsTarget.kept}
              done={savingsTarget.withdrawn}
              accent={theme.accent}
              onDeduct={amount => onWithdrawSavings(savingsTarget.id, amount)}
              onUndo={amount => onUndoWithdrawSavings(savingsTarget.id, amount)}
              confirmLabel={amount =>
                `「${savingsTarget.name}」から ${yen(amount)} を切り崩します。取っておくはずだったお金です。本当によろしいですか？`}
            />
          </DetailBlock>
        </DetailModal>
      )}

      {breakdown && (
        <div className="modal-overlay" onClick={() => setBreakdown(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">計算結果</div>
            <div className="calc-row"><span>所持金</span><span>¥{totalBalance.toLocaleString()}</span></div>
            <div className="calc-row"><span>− 未定（引き済み）</span><span>¥{deducted.toLocaleString()}</span></div>
            <div className="calc-row"><span>− 毎月</span><span>¥{monthlyTotal.toLocaleString()}</span></div>
            <div className="calc-row"><span>− つもり貯金</span><span>¥{savingsKept.toLocaleString()}</span></div>
            <hr className="divider" />
            <div className={`calc-total${remaining < 0 ? ' negative' : ''}`}>
              <span>残り使える金額</span>
              <span>¥{remaining.toLocaleString()}</span>
            </div>
            <div className="form-actions">
              <button onClick={() => setBreakdown(false)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`「${deleteTarget.name}」を削除します。よろしいですか？`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onRemovePlan(deleteTarget.id); setDeleteTarget(null); setEditing(null) }}
        />
      )}
    </div>
  )
}

export type { PlanDraft }
