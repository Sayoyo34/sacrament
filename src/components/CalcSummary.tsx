export interface CalcSegment {
  label: string
  amount: number
  color: string   // バーとレジェンドの色。テーマ色の濃淡で揃える
  /** true なら取り崩しのプレビュー分だけバー上で縮める（つもり貯金） */
  releasable?: boolean
}

/** 「もし叶えたら」で選んだウィッシュ。内訳の下に追加で並べ、バーにも試算分として出す */
export interface CalcSimItem {
  id: string
  label: string
  amount: number   // 使える金額から減る分（金額 − 貯めた分）
  note: string     // 「15,000円 − 貯めた分 8,000円」のような計算の補足。不要なら ''
}

interface Props {
  totalBalance: number
  remaining: number
  /** 所持金から差し引いているもの。順番がそのままバーの並び */
  segments: CalcSegment[]
  /** 未定のまだ引いていない合計。内訳を開いた時だけ注記に出す */
  unspent: number
  /** 試算で選んだウィッシュ。空なら内訳に何も足さない */
  simItems?: CalcSimItem[]
  /** 取り崩しなど、確定前の操作による増減額（使える金額に対する符号つき）。null なら通常表示 */
  preview: number | null
  open: boolean
  onToggle: () => void
}

/**
 * 計算タブの上に出しっぱなしにする結果カード。
 * 内訳はモーダルではなくこのカードの中で開く。
 */
export default function CalcSummary({
  totalBalance, remaining, segments, unspent, simItems = [], preview, open, onToggle,
}: Props) {
  const simTotal = simItems.reduce((s, x) => s + x.amount, 0)
  const afterSim = remaining - simTotal
  const delta = (preview ?? 0) - simTotal
  const shown = remaining + delta

  // バーは大きい数字（shown）と同じ状態を描く。
  // 取り崩しのプレビュー分は releasable な区分から外し、マイナスの増減と試算分は斜線の区分として足す
  let release = Math.max(0, preview ?? 0)
  const barSegments = segments.map(s => {
    if (!s.releasable || release === 0) return s
    const cut = Math.min(release, s.amount)
    release -= cut
    return { ...s, amount: s.amount - cut }
  })
  const pending = simTotal + Math.max(0, -(preview ?? 0))
  const spent = barSegments.reduce((s, x) => s + x.amount, 0) + pending
  // 所持金より引く額が多い時もバーが破綻しないよう、大きい方を分母にする
  const total = Math.max(1, totalBalance, spent)
  const rest = Math.max(0, total - spent)
  const visible = segments.filter(s => s.amount > 0)
  const visibleBar = barSegments.filter(s => s.amount > 0)

  return (
    <div className="hero-card">
      <div className="hero-top">
        <span className="hero-label">このあと使える金額</span>
        {delta !== 0 && (
          <span className="hero-delta">{delta > 0 ? '+' : '−'}¥{Math.abs(delta).toLocaleString()}</span>
        )}
        <button className="hero-toggle" onClick={onToggle} aria-expanded={open}>
          内訳 {open ? '⌃' : '⌄'}
        </button>
      </div>

      <div className={`hero-number${shown < 0 ? ' hero-negative' : ''}`}>
        ¥{shown.toLocaleString()}
      </div>

      <div className="hero-bar">
        {visibleBar.map(s => (
          <span key={s.label} className="hero-bar-seg" style={{ flex: `${s.amount} 1 0`, background: s.color }} />
        ))}
        {pending > 0 && <span className="hero-bar-seg hero-bar-pending" style={{ flex: `${pending} 1 0` }} />}
        {rest > 0 && <span className="hero-bar-seg hero-bar-rest" style={{ flex: `${rest} 1 0` }} />}
      </div>

      {open ? (
        <div className="hero-breakdown">
          <div className="hero-calc"><span>所持金</span><span>¥{totalBalance.toLocaleString()}</span></div>
          {segments.map(s => (
            <div className="hero-calc" key={s.label}>
              <span><i className="hero-dot" style={{ background: s.color }} />− {s.label}</span>
              <span>¥{s.amount.toLocaleString()}</span>
            </div>
          ))}
          <div className="hero-rule" />
          <div className="hero-calc hero-calc-total">
            <span>= このあと使える金額</span>
            <span>¥{remaining.toLocaleString()}</span>
          </div>
          {simItems.length > 0 && (
            <>
              {simItems.map(x => (
                <div className="hero-calc hero-calc-sim" key={x.id}>
                  <span>
                    − {x.label}
                    {x.note && <small className="hero-calc-note">{x.note}</small>}
                  </span>
                  <span>¥{x.amount.toLocaleString()}</span>
                </div>
              ))}
              <div className="hero-rule" />
              <div className={`hero-calc hero-calc-total${afterSim < 0 ? ' hero-negative' : ''}`}>
                <span>= もし叶えたら残る金額</span>
                <span>¥{afterSim.toLocaleString()}</span>
              </div>
            </>
          )}
          {unspent > 0 && (
            <p className="hero-note">
              ※「未定」のまだ引いていない ¥{unspent.toLocaleString()} は、使える金額から引かれていません
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="hero-legend">
            {visible.map(s => (
              <span className="hero-legend-item" key={s.label}>
                <i className="hero-dot" style={{ background: s.color }} />
                {s.label} ¥{s.amount.toLocaleString()}
              </span>
            ))}
            {simTotal > 0 && (
              <span className="hero-legend-item">
                <i className="hero-dot hero-bar-pending" />
                叶えたら ¥{simTotal.toLocaleString()}
              </span>
            )}
          </div>
          <p className="hero-note">所持金 ¥{totalBalance.toLocaleString()} から自動で差し引いています</p>
        </>
      )}
    </div>
  )
}
