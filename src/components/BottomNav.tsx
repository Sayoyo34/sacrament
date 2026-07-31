import { PAGES, type Page } from '../theme'

interface Props {
  page: Page
  onChange: (page: Page) => void
}

export default function BottomNav({ page, onChange }: Props) {
  return (
    <nav className="bottom-nav">
      {PAGES.map(({ id, theme }) => {
        const active = page === id
        return (
          <button
            key={id}
            className={`nav-item${active ? ' active' : ''}`}
            onClick={() => onChange(id)}
          >
            <span
              className="nav-icon"
              style={active ? { background: theme.soft } : undefined}
            >
              {theme.icon}
            </span>
            <span style={active ? { color: theme.accent } : undefined}>{theme.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
