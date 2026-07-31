import type { Genre, Tag } from '../types'

export function GenreSelect({ genres, value, onChange }: {
  genres: Genre[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">未設定</option>
      {genres.map(g => (
        <option key={g.id} value={g.id}>{g.icon} {g.name}</option>
      ))}
    </select>
  )
}

/** タグは複数選択。チップをタップでオン/オフ */
export function TagPicker({ tags, value, onChange }: {
  tags: Tag[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  if (tags.length === 0) {
    return <p className="summary">タグは「その他 &gt; タグ管理」で追加できます</p>
  }
  return (
    <div className="tag-picker">
      {tags.map(t => {
        const on = value.includes(t.id)
        return (
          <button
            key={t.id}
            className={`tag-chip${on ? ' on' : ''}`}
            style={on ? { background: t.color, borderColor: t.color } : { color: t.color, borderColor: t.color }}
            onClick={() => onChange(on ? value.filter(id => id !== t.id) : [...value, t.id])}
          >
            #{t.name}
          </button>
        )
      })}
    </div>
  )
}

/** 一覧に並べる読み取り専用のタグ表示 */
export function TagList({ tags, ids }: { tags: Tag[]; ids: string[] }) {
  if (ids.length === 0) return null
  return (
    <span className="tag-list">
      {ids.map(id => {
        const t = tags.find(x => x.id === id)
        if (!t) return null
        return <span key={id} className="tag-mini" style={{ color: t.color }}>#{t.name}</span>
      })}
    </span>
  )
}

/** ジャンル色の丸アイコン。項目一覧の左端に置く */
export function GenreDot({ genres, genreId, fallback = '📦', size = 34 }: {
  genres: Genre[]
  genreId: string
  fallback?: string
  size?: number
}) {
  const g = genres.find(x => x.id === genreId)
  return (
    <span
      className="genre-dot"
      style={{
        background: g ? `${g.color}33` : 'var(--code-bg)',
        width: size,
        height: size,
        fontSize: size * 0.5,
      }}
    >
      {g?.icon ?? fallback}
    </span>
  )
}
