import { ICONS, PALETTE } from '../palette'

export function ColorSwatches({ value, onChange }: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <>
      <div className="swatch-grid">
        {PALETTE.map(c => (
          <button
            key={c}
            className={`color-swatch${value.toLowerCase() === c ? ' on' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={c}
          />
        ))}
      </div>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ marginTop: '0.5rem', height: '40px', padding: '0.2rem' }}
      />
    </>
  )
}

export function IconSwatches({ value, onChange, accent }: {
  value: string
  onChange: (icon: string) => void
  accent: string
}) {
  return (
    <>
      <div className="swatch-grid">
        {ICONS.map(ic => (
          <button
            key={ic}
            className={`icon-swatch${value === ic ? ' on' : ''}`}
            style={value === ic ? { borderColor: accent } : undefined}
            onClick={() => onChange(ic)}
          >
            {ic}
          </button>
        ))}
      </div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="好きな絵文字を直接入力"
        style={{ marginTop: '0.5rem' }}
      />
    </>
  )
}
