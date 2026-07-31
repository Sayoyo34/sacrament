import { useState } from 'react'
import type { Genre, Tag } from '../types'
import ConfirmModal from '../components/ConfirmModal'
import LabelManager, { type LabelDraft } from '../components/LabelManager'
import { themeOf } from '../theme'

type Sheet = 'genres' | 'tags' | null

interface Props {
  genres: Genre[]
  tags: Tag[]
  onSaveGenre: (draft: LabelDraft) => void
  onRemoveGenre: (id: string) => void
  onSaveTag: (draft: LabelDraft) => void
  onRemoveTag: (id: string) => void
  onReset: () => void
}

export default function MorePage({
  genres, tags, onSaveGenre, onRemoveGenre, onSaveTag, onRemoveTag, onReset,
}: Props) {
  const theme = themeOf('more')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState('')

  return (
    <div className="page">
      <div className="top-tabs" style={{ background: theme.soft }}>
        <button className="top-tab" style={{ color: theme.accent, cursor: 'default' }}>その他</button>
      </div>

      <div className="page-scroll">
        <div className="card menu-card">
          <button className="menu-row" onClick={() => setSheet('genres')}>
            <span className="menu-dot" style={{ background: '#fbd0e0' }} />
            <span className="menu-label">ジャンル管理</span>
            <span className="menu-meta">{genres.length}件</span>
          </button>
          <button className="menu-row" onClick={() => setSheet('tags')}>
            <span className="menu-dot" style={{ background: '#fbd0e0' }} />
            <span className="menu-label">タグ管理</span>
            <span className="menu-meta">{tags.length}件</span>
          </button>
        </div>

        <div className="card menu-card">
          <button className="menu-row" onClick={() => setNotice('お問い合わせは次回の実装分です')}>
            <span className="menu-dot" style={{ background: '#d8d2f7' }} />
            <span className="menu-label">お問い合わせ</span>
          </button>
          <button className="menu-row" onClick={() => setConfirmReset(true)}>
            <span className="menu-dot" style={{ background: '#d8d2f7' }} />
            <span className="menu-label">リセット</span>
          </button>
        </div>

        {notice && (
          <p className="summary" style={{ textAlign: 'center', padding: '0.5rem 0' }}>{notice}</p>
        )}
      </div>

      {sheet === 'genres' && (
        <LabelManager
          title="ジャンル管理"
          hint="1つの項目に1つだけ付きます。ここで決めた色が一覧のアイコンと分析の円グラフに使われます。"
          items={genres}
          withIcon
          accent={theme.accent}
          soft={theme.soft}
          onSave={onSaveGenre}
          onRemove={onRemoveGenre}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'tags' && (
        <LabelManager
          title="タグ管理"
          hint="1つの項目に何個でも付けられます。#アイナナ のように推し別・現場別で絞り込むのに使います。"
          items={tags}
          withIcon={false}
          prefix="#"
          accent={theme.accent}
          soft={theme.soft}
          onSave={onSaveTag}
          onRemove={onRemoveTag}
          onClose={() => setSheet(null)}
        />
      )}

      {confirmReset && (
        <ConfirmModal
          message="すべてのデータを削除します。この操作は取り消せません。よろしいですか？"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => { setConfirmReset(false); onReset() }}
        />
      )}
    </div>
  )
}
