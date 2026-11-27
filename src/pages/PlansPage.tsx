import { useState, type ReactNode } from 'react'
import { PiArrowsClockwise, PiCalendarBlank, PiCheck, PiCoins, PiNotepad, PiPiggyBank, PiWallet } from 'react-icons/pi'
import type { Genre, GoalRow, PlanItem, Wallet } from '../types'
import DetailModal, { DetailRow } from '../components/DetailModal'
import CalcSummary, { type CalcSegment, type CalcSimItem } from '../components/CalcSummary'
import InlineDeduct from '../components/InlineDeduct'
import { GenreDot } from '../components/Pickers'
import { readableColor } from '../palette'
import { themeOf } from '../theme'
import { paymentLabel, shortDateText } from '../plans'
import { yen } from '../utils'

interface Props {
  planItems: PlanItem[]
  wallets: Wallet[]
  genres: Genre[]
  totalBalance: number
  goalRows: GoalRow[]
  onWithdrawSavings: (goalId: string, amount: number, label?: string) => void
}

function Progress({ ratio, color }: { ratio: number; color: string }) {
  return (
    <span className="bar">
      <span className="bar-fill" style={{ width: `${Math.min(100, ratio * 100)}%`, background: color }} />
    </span>
  )
}

/** 予定タブ：残高から定期支出とつもり貯金を引いた「使える金額」の計算。定期支出の登録・編集は「その他」から */
export default function PlansPage({
  planItems, wallets, genres, totalBalance, goalRows, onWithdrawSavings,
}: Props) {
  const theme = themeOf('plans')
  const [openId, setOpenId] = useState<string | null>(null)     // 貯金目標の取り崩しパネル（goal:〜）
  const [showBreakdown, setShowBreakdown] = useState(false)     // サマリーの内訳
  const [openSubs, setOpenSubs] = useState(false)
  const [openSavings, setOpenSavings] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)   // 確定前の増減
  const [infoId, setInfoId] = useState<string | null>(null)     // 出費予定の情報シート
  const [picked, setPicked] = useState<Set<string>>(new Set())  // 「もし叶えたら」で選んだウィッシュ。保存しない

  const sorted = planItems.slice().sort((a, b) => a.order - b.order)
  const subs = sorted.filter(p => p.category === 'subscription')

  const subsTotal = subs.reduce((s, p) => s + p.estimatedCost, 0)
  const savingsKept = goalRows.reduce((s, g) => s + g.kept, 0)
  const remaining = totalBalance - subsTotal - savingsKept

  // 差し引きの内訳。色はテーマ色の濃淡で揃え、画面全体の色数を増やさない
  const segments: CalcSegment[] = [
    { label: '定期支出', amount: subsTotal, color: theme.accent },
    { label: 'つもり貯金', amount: savingsKept, color: `color-mix(in srgb, ${theme.accent} 30%, #fff)`, releasable: true },
  ]
  // ── もし買ったら（ウィッシュのお試し計算。実データは動かさない） ──
  // 金額未定のウィッシュは計算できないので並べない
  const wishes = goalRows.filter(g => g.id && g.targetAmount > 0)
  const hiddenWishCount = goalRows.filter(g => g.id && g.targetAmount === 0).length
  /** 買ったときに使える金額から減る分。積んだつもり貯金はもう引かれているので、その分は二重に引かない */
  const wishCost = (g: GoalRow) => Math.max(0, g.targetAmount - g.kept)
  const simItems: CalcSimItem[] = wishes.filter(g => picked.has(g.id)).map(g => ({
    id: g.id,
    label: `${g.icon} ${g.name}`,
    amount: wishCost(g),
    note: g.kept > 0 ? `${yen(g.targetAmount)} − 貯めた分 ${yen(Math.min(g.kept, g.targetAmount))}` : '',
  }))

  function togglePick(id: string) {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const groupTint = `color-mix(in srgb, ${theme.accent} 15%, #fff)`

  const info = infoId ? planItems.find(p => p.id === infoId) ?? null : null
  const infoGenre = genres.find(g => g.id === info?.genreId)

  function openRow(key: string) {
    setOpenId(prev => prev === key ? null : key)
    setPreview(null)
  }

  // ── 計算タブ ───────────────────────────
  /** 取り崩しを行の下に開く貯金の行 */
  function renderGoalRow(g: GoalRow) {
    const key = `goal:${g.id || '__none'}`
    const open = openId === key

    return (
      <li key={g.id || '__none'}>
        <button
          className={`row-card${open ? ' expanded' : ''}`}
          style={open ? { borderColor: theme.accent } : undefined}
          onClick={() => openRow(key)}
        >
          <span className="genre-dot" style={{ background: `${g.color}33`, width: 34, height: 34, fontSize: 17 }}>
            {g.icon}
          </span>
          <span className="row-main">
            <span className="row-title">{g.name}</span>
            {g.targetAmount > 0 && <Progress ratio={g.kept / g.targetAmount} color={g.color} />}
          </span>
          <span className="row-right">
            {g.targetAmount > 0 && <span className="row-note">金額 {g.targetAmount.toLocaleString()}円</span>}
            <span className="row-amount" style={{ color: readableColor(g.color) }}>{g.kept.toLocaleString()}円</span>
          </span>
          <span className="row-chevron">{open ? '⌃' : '⌄'}</span>
        </button>

        {open && (
          <InlineDeduct
            remaining={g.kept}
            accent={theme.accent}
            budgetSign={1}
            verb="取り崩す"
            info={
              <>
                <p className="summary">
                  いま貯まっている額 {yen(g.kept)}
                  {g.targetAmount > 0 && `　金額（目安） ${yen(g.targetAmount)}`}
                </p>
                <p className="summary">取り崩した分は取っておく額から外れ、その分だけ使える金額が増えます。</p>
              </>
            }
            // ウィッシュ詳細からの取り崩し（既定の「取り崩し」）と履歴で見分けられるようにする
            onDeduct={amount => onWithdrawSavings(g.id, amount, '計算タブから取り崩し')}
            onPreview={setPreview}
            onClose={() => setOpenId(null)}
            confirmLabel={amount =>
              `「${g.name}」から ${yen(amount)} を取り崩します。このあと使える金額は ${yen(remaining + amount)} になります。取っておくはずだったお金です。本当によろしいですか？`}
          />
        )}
      </li>
    )
  }

  /** 触らなくても自動で引かれているものを畳んでおくカード */
  function groupCard(
    icon: ReactNode, title: string, sub: string, amount: number,
    open: boolean, onToggle: () => void, children: ReactNode,
  ) {
    return (
      <li>
        <button className={`row-card${open ? ' group-open' : ''}`} onClick={onToggle}>
          <span className="genre-dot" style={{ background: groupTint, width: 34, height: 34, fontSize: 17 }}>
            {icon}
          </span>
          <span className="row-main">
            <span className="row-title">{title}</span>
            <span className="row-sub">{sub}</span>
          </span>
          <span className="row-amount">−{amount.toLocaleString()}円</span>
          <span className="row-chevron">{open ? '⌃' : '⌄'}</span>
        </button>
        {open && <ul className="item-list sub-list">{children}</ul>}
      </li>
    )
  }

  function planGroupRow(p: PlanItem) {
    return (
      <li key={p.id}>
        <button className="row-card" onClick={() => setInfoId(p.id)}>
          <GenreDot genres={genres} genreId={p.genreId} fallback={<PiArrowsClockwise />} />
          <span className="row-main">
            <span className="row-title">{p.name}</span>
            <span className="row-sub">
              {paymentLabel(p)}
              ・{wallets.find(w => w.id === p.walletId)?.name ?? '口座未設定'}
            </span>
          </span>
          <span className="row-amount">{p.estimatedCost.toLocaleString()}円</span>
        </button>
      </li>
    )
  }

  return (
    <div className="page">
      <div className="top-tabs" style={{ background: theme.soft }}>
        <button className="top-tab" style={{ color: theme.accent, cursor: 'default' }}>計算</button>
      </div>

      <div className="page-scroll">
        <CalcSummary
          totalBalance={totalBalance}
          remaining={remaining}
          segments={segments}
          unspent={0}
          simItems={simItems}
          preview={preview}
          open={showBreakdown}
          onToggle={() => setShowBreakdown(v => !v)}
        />

        <div className="section-header">
          <h3>もし叶えたら</h3>
          {picked.size > 0 ? (
            <button className="link-btn section-hint" onClick={() => setPicked(new Set())}>選択をクリア</button>
          ) : (
            <span className="section-hint">タップで試算</span>
          )}
        </div>
        {wishes.length === 0 ? (
          <p className="empty-hint">
            「貯金」タブのウィッシュに金額を入れて登録すると、<br />叶えたら残りがいくらになるかをここで試せます
          </p>
        ) : (
          <>
            <div className="sort-list">
              {wishes.map(g => {
                const on = picked.has(g.id)
                const cost = wishCost(g)
                return (
                  <button
                    key={g.id}
                    className={`sort-row${on ? ' on' : ''}`}
                    style={on ? { borderColor: theme.accent } : undefined}
                    onClick={() => togglePick(g.id)}
                    aria-pressed={on}
                  >
                    <span
                      className={`sort-check${on ? ' on' : ''}`}
                      style={on ? { background: theme.accent, borderColor: theme.accent } : undefined}
                    >
                      {on ? <PiCheck /> : ''}
                    </span>
                    <span className="sort-main">
                      <span className="sort-name">{g.icon} {g.name}</span>
                      <span className="sort-date">
                        {yen(g.targetAmount)}{g.kept > 0 && ` − 貯めた分 ${yen(Math.min(g.kept, g.targetAmount))}`}
                      </span>
                    </span>
                    <span className="sort-amount">{cost > 0 ? `−${cost.toLocaleString()}円` : '貯金で足りる'}</span>
                  </button>
                )
              })}
            </div>
            <p className="summary" style={{ padding: '0.4rem 0.25rem 0', lineHeight: 1.7 }}>
              試算だけで、記録やつもり貯金は変わりません。
              {hiddenWishCount > 0 && `金額が未定のウィッシュ（${hiddenWishCount}件）は表示していません。`}
            </p>
          </>
        )}

        {planItems.length === 0 && (
          <p className="summary" style={{ padding: '0.75rem 0.25rem 0', lineHeight: 1.7 }}>
            毎月のサブスクなどは「その他」の「定期支出」で登録すると、ここで自動的に差し引かれます。
          </p>
        )}

        {(planItems.length > 0 || goalRows.length > 0) && (
          <>
            <div className="section-header">
              <h3>自動で引かれているもの</h3>
              <span className="section-hint">タップで内訳</span>
            </div>
            <ul className="item-list">
              {subs.length > 0 && groupCard(
                <PiArrowsClockwise />,
                `定期支出  ${subs.length}件`,
                '常に全額が引かれます',
                subsTotal,
                openSubs,
                () => setOpenSubs(v => !v),
                subs.map(planGroupRow),
              )}

              {goalRows.length > 0 && groupCard(
                <PiPiggyBank />,
                `つもり貯金  ${goalRows.length}件`,
                '取り崩すと使える金額が増えます',
                savingsKept,
                openSavings,
                () => setOpenSavings(v => !v),
                goalRows.map(renderGoalRow),
              )}
            </ul>
          </>
        )}
      </div>

      {/* 計算タブ：出費予定の詳細（金額は変えられない） */}
      {info && (
        <DetailModal
          icon={infoGenre?.icon ?? <PiNotepad />}
          color={infoGenre ? `${infoGenre.color}55` : theme.soft}
          name={info.name}
          onClose={() => setInfoId(null)}
        >
          <DetailRow icon={<PiCoins />} label="金額">
            <span className="detail-value">{yen(info.estimatedCost)}</span>
          </DetailRow>
          {(info.dayOfMonth > 0 || info.month > 0) && (
            <DetailRow icon={<PiCalendarBlank />} label="支払い日">
              <span className="detail-value">{shortDateText(info)}</span>
            </DetailRow>
          )}
          {info.walletId && (
            <DetailRow icon={<PiWallet />} label="口座">
              <span className="detail-value">{wallets.find(w => w.id === info.walletId)?.name ?? '未設定'}</span>
            </DetailRow>
          )}
          <p className="summary" style={{ padding: '0.5rem 0.25rem' }}>
            定期支出は常に全額が差し引かれます。内容の変更は「その他」の「定期支出」から行えます。
          </p>
        </DetailModal>
      )}
    </div>
  )
}
