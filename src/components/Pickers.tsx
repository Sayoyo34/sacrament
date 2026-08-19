import { useState } from 'react'
import type { Genre, Tag } from '../types'
import QuickAddLabel from './QuickAddLabel'
import { GENRE_NAME_MAX, readableColor, TAG_NAME_MAX } from '../palette'

/** 一度に並べるタグ数の上限。選択中のものは超えていても必ず出す */
const TAG_FILTER_LIMIT = 8

/** ジャンル/タグをその場で新規作成した時に呼ぶ。作った項目の id を返す */
type CreateLabel = (draft: { name: string; icon: string; color: string }) => string

/**
 * 推しカラーを読みやすい濃さに揃える。
 * 原色そのままの文字色は白地で目が痛く、黄色系だとほぼ読めないため、
 * 淡い地色＋暗めの文字という組み合わせに正規化する（ジャンルの丸と同じ作法）。
 */
function tagTint(color: string) {
  return {
    background: `color-mix(in srgb, ${color} 16%, #fff)`,
    color: readableColor(color),
  }
}

export function GenreSelect({ genres, value, onChange, accent, onCreate }: {
  genres: Genre[]
  value: string
  onChange: (id: string) => void
  accent?: string
  /** 渡すと選択肢の末尾に「＋ 新しいジャンルを追加」が出て、その場で作れる */
  onCreate?: CreateLabel
}) {
  const [adding, setAdding] = useState(false)
  return (
    <>
      <select
        value={value}
        onChange={e => {
          if (e.target.value === '__new__') { setAdding(true); return }
          onChange(e.target.value)
        }}
      >
        <option value="">未設定</option>
        {genres.map(g => (
          <option key={g.id} value={g.id}>{g.icon} {g.name}</option>
        ))}
        {onCreate && <option value="__new__">＋ 新しいジャンルを追加</option>}
      </select>

      {adding && onCreate && (
        <QuickAddLabel
          kind="ジャンル"
          withIcon
          nameMax={GENRE_NAME_MAX}
          existingNames={genres.map(g => g.name)}
          accent={accent ?? '#8a5a3b'}
          onCancel={() => setAdding(false)}
          onCreate={draft => { onChange(onCreate(draft)); setAdding(false) }}
        />
      )}
    </>
  )
}

/** タグは複数選択。チップをタップでオン/オフ */
export function TagPicker({ tags, value, onChange, accent, onCreate }: {
  tags: Tag[]
  value: string[]
  onChange: (ids: string[]) => void
  accent?: string
  /** 渡すと「＋ 追加」チップが出て、その場で作って選択済みにできる */
  onCreate?: CreateLabel
}) {
  const [adding, setAdding] = useState(false)

  if (tags.length === 0 && !onCreate) {
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
            style={on ? { background: readableColor(t.color), borderColor: readableColor(t.color) } : tagTint(t.color)}
            onClick={() => onChange(on ? value.filter(id => id !== t.id) : [...value, t.id])}
          >
            #{t.name}
          </button>
        )
      })}
      {onCreate && (
        <button className="tag-chip tag-more" onClick={() => setAdding(true)}>＋ 追加</button>
      )}

      {adding && onCreate && (
        <QuickAddLabel
          kind="タグ"
          withIcon={false}
          nameMax={TAG_NAME_MAX}
          existingNames={tags.map(t => t.name)}
          accent={accent ?? '#8a5a3b'}
          onCancel={() => setAdding(false)}
          onCreate={draft => { onChange([...value, onCreate(draft)]); setAdding(false) }}
        />
      )}
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
              style={on ? { background: readableColor(t.color), borderColor: readableColor(t.color) } : tagTint(t.color)}
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
