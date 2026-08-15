export interface CalcSegment {
  label: string
  amount: number
  color: string   // バーとレジェンドの色。テーマ色の濃淡で揃える
}

interface Props {
  totalBalance: number
  remaining: number
  /** 所持金から差し引いているもの。順番がそのままバーの並び */
  segments: CalcSegment[]
  /** 未定のまだ引いていない合計。内訳を開いた時だけ注記に出す */
  unspent: number
  /** プレビュー中の増減額（使える金額に対する符号つき）。null なら通常表示 */
  preview: number | null
  open: boolean
  onToggle: () => void
}

/**
 * 計算タブの上に出しっぱなしにする結果カード。
 * 内訳はモーダルではなくこのカードの中で開く。
 */
export default function CalcSummary({
  totalBalance, remaining, segments, unspent, preview, open, onToggle,
}: Props) {
  const shown = remaining + (preview ?? 0)
  const spent = segments.reduce((s, x) => s + x.amount, 0)
  // 所持金より引く額が多い時もバーが破綻しないよう、大きい方を分母にする
  const total = Math.max(1, totalBalance, spent)
  const rest = Math.max(0, total - spent)
  const visible = segments.filter(s => s.amount > 0)

  return (
    <div className="hero-card">
      <div className="hero-top">
        <span className="hero-label">このあと使える金額</span>
        {preview !== null && preview !== 0 && (
          <span className="hero-delta">{preview > 0 ? '+' : '−'}¥{Math.abs(preview).toLocaleString()}</span>
        )}
        <button className="hero-toggle" onClick={onToggle} aria-expanded={open}>
          内訳 {open ? '⌃' : '⌄'}
        </button>
      </div>

      <div className={`hero-number${shown < 0 ? ' hero-negative' : ''}`}>
        ¥{shown.toLocaleString()}
      </div>

      <div className="hero-bar">
        {visible.map(s => (
          <span key={s.label} className="hero-bar-seg" style={{ flex: `${s.amount} 1 0`, background: s.color }} />
        ))}
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
          </div>
          <p className="hero-note">所持金 ¥{totalBalance.toLocaleString()} から自動で差し引いています</p>
        </>
      )}
    </div>
  )
}
