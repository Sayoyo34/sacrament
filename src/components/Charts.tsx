export interface Slice {
  id: string
  name: string
  icon: string
  value: number
  color: string
}

/** 中心 (cx,cy) 半径 r・角度 angle（12時方向を0、時計回り）の円周上の点 */
function pointOnCircle(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) }
}

/** ドーナツグラフ。外部ライブラリを使わず SVG の円弧で描く */
export function Donut({ slices, total, caption, size = 190, thickness = 34 }: {
  slices: Slice[]
  total: number
  caption: string
  size?: number
  thickness?: number
}) {
  const cx = size / 2
  const cy = size / 2
  const r = (size - thickness) / 2
  const full = total > 0 && slices.length === 1
  let acc = 0

  return (
    <svg className="donut" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke="var(--border)" strokeWidth={thickness}
      />
      {full ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={slices[0].color} strokeWidth={thickness} />
      ) : (
        slices.map(s => {
          if (total <= 0 || s.value <= 0) return null
          const startAngle = (acc / total) * 2 * Math.PI
          acc += s.value
          const endAngle = (acc / total) * 2 * Math.PI
          const start = pointOnCircle(cx, cy, r, startAngle)
          const end = pointOnCircle(cx, cy, r, endAngle)
          const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
          return (
            <path
              key={s.id}
              d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`}
              fill="none" stroke={s.color} strokeWidth={thickness} strokeLinecap="butt"
            />
          )
        })
      )}
      <text x={cx} y={cy - 2} textAnchor="middle" className="donut-total">
        ¥{total.toLocaleString()}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" className="donut-caption">
        {caption}
      </text>
    </svg>
  )
}

/** 月別などの棒グラフ */
export function Bars({ data, color, highlight }: {
  data: { key: string; label: string; value: number }[]
  color: string
  highlight?: string
}) {
  const max = Math.max(1, ...data.map(d => d.value))

  return (
    <div className="bar-chart">
      {data.map(d => (
        <div key={d.key} className="bar-col">
          <span className="bar-value">{d.value > 0 ? d.value.toLocaleString() : ''}</span>
          <span className="bar-stack">
            <span
              className="bar-bar"
              style={{
                height: `${(d.value / max) * 100}%`,
                background: color,
                opacity: highlight && highlight !== d.key ? 0.45 : 1,
              }}
            />
          </span>
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
