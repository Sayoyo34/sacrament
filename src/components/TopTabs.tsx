interface Props<T extends string> {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
  accent: string
  soft: string
}

/** 各ページ上部の2択タブ（家計簿/財布、出費予定/計算 など） */
export default function TopTabs<T extends string>({ tabs, active, onChange, accent, soft }: Props<T>) {
  return (
    <div className="top-tabs" style={{ background: soft }}>
      {tabs.map(tab => {
        const on = tab.id === active
        return (
          <button
            key={tab.id}
            className={`top-tab${on ? ' active' : ''}`}
            style={on ? { background: accent } : { color: accent }}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
