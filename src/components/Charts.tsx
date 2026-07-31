export interface Slice {
  id: string
  name: string
  icon: string
  value: number
  color: string
}

/** ドーナツグラフ。外部ライブラリを使わず SVG の円弧で描く */
export function Donut({ slices, total, caption, size = 190, thickness = 34 }: {
  slices: Slice[]
  total: number
  caption: string
  size?: number
  thickness?: number
}) {
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  let acc = 0

  return (
    <svg className="donut" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--border)" strokeWidth={thickness}
      />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {slices.map(s => {
          const len = total > 0 ? (s.value / total) * circ : 0
          const el = (
            <circle
              key={s.id}
              cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-acc}
            />
          )
          acc += len
          return el
        })}
      </g>
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" className="donut-total">
        ¥{total.toLocaleString()}
      </text>
      <text x={size / 2} y={size / 2 + 18} textAnchor="middle" className="donut-caption">
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
