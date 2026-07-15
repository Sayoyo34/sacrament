type Page = 'simulator' | 'ledger' | 'tasks' | 'timer'

interface Props {
  page: Page
  onChange: (page: Page) => void
}

const TABS: { id: Page; icon: string; label: string }[] = [
  { id: 'simulator', icon: '🏠', label: 'シミュレーター' },
  { id: 'ledger',    icon: '💰', label: '家計簿' },
  { id: 'tasks',     icon: '✅', label: 'タスク' },
  { id: 'timer',     icon: '⏱', label: 'タイマー' },
]

export default function BottomNav({ page, onChange }: Props) {
  return (
    <nav className="bottom-nav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`nav-item${page === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="nav-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
