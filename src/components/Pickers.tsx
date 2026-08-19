import { useState } from 'react'
import type { Genre, Tag } from '../types'

/** 一度に並べるタグ数の上限。選択中のものは超えていても必ず出す */
const TAG_FILTER_LIMIT = 8

/**
 * 推しカラーを読みやすい濃さに揃える。
 * 原色そのままの文字色は白地で目が痛く、黄色系だとほぼ読めないため、
 * 淡い地色＋暗めの文字という組み合わせに正規化する（ジャンルの丸と同じ作法）。
 */
function tagTint(color: string) {
  return {
    background: `color-mix(in srgb, ${color} 16%, #fff)`,
    // 52% は色味を残しつつ、パレット中いちばん明るい黄でもコントラスト比 5:1 を確保できる下限
    color: `color-mix(in srgb, ${color} 52%, #000)`,
  }
}

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
            style={on ? { background: t.color, borderColor: t.color } : tagTint(t.color)}
            onClick={() => onChange(on ? value.filter(id => id !== t.id) : [...value, t.id])}
          >
            #{t.name}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 一覧を絞り込むためのタグ選択。
 * 複数選ぶと AND 条件（#推しの名前 かつ #遠征）で絞り込む。
 */
export function TagFilter({ tags, selected, onChange }: {
  tags: Tag[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (tags.length === 0) return null

  // タグが増えても一覧が埋まらないよう、先頭 TAG_FILTER_LIMIT 件＋選択中のものだけ出す
  const firstN = tags.slice(0, TAG_FILTER_LIMIT)
  const extraSelected = tags.slice(TAG_FILTER_LIMIT).filter(t => selected.includes(t.id))
  const visible = expanded ? tags : [...firstN, ...extraSelected]
  const hiddenCount = tags.length - visible.length

  return (
    <div className="tag-filter">
      <div className="tag-picker">
        {visible.map(t => {
          const on = selected.includes(t.id)
          return (
            <button
              key={t.id}
              className={`tag-chip${on ? ' on' : ''}`}
              style={on ? { background: t.color, borderColor: t.color } : tagTint(t.color)}
              onClick={() => onChange(on ? selected.filter(id => id !== t.id) : [...selected, t.id])}
            >
              #{t.name}
            </button>
          )
        })}
        {hiddenCount > 0 && (
          <button className="tag-chip tag-more" onClick={() => setExpanded(true)}>+{hiddenCount}件</button>
        )}
        {expanded && tags.length > TAG_FILTER_LIMIT && (
          <button className="tag-chip tag-more" onClick={() => setExpanded(false)}>たたむ</button>
        )}
        {selected.length > 0 && (
          <button className="tag-chip tag-clear" onClick={() => onChange([])}>クリア</button>
        )}
      </div>
      {selected.length > 1 && (
        <p className="summary" style={{ marginTop: '0.4rem', fontSize: '0.72rem' }}>
          選んだタグをすべて含むものだけ表示しています
        </p>
      )}
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
        return <span key={id} className="tag-mini" style={tagTint(t.color)}>#{t.name}</span>
      })}
    </span>
  )
}

/**
 * ジャンルの丸アイコン。項目一覧の左端に置く。
 * 一覧では絵文字だけで見分けられるので、地色は無彩色にしてある。
 * ジャンル色を色として使うのは、それが凡例＝データになる分析画面だけ。
 * 一覧で色を持つのはタグ（推しカラー）だけ、という住み分け。
 */
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
      style={{ background: 'var(--code-bg)', width: size, height: size, fontSize: size * 0.5 }}
    >
      {g?.icon ?? fallback}
    </span>
  )
}
