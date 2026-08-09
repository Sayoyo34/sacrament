import { useState } from 'react'
import type { Genre, Tag } from '../types'
import ConfirmModal from '../components/ConfirmModal'
import LabelListPage, { type LabelDraft } from '../components/LabelListPage'
import SubPage from '../components/SubPage'
import { themeOf } from '../theme'
import { CONTACT_FORM_URL } from '../config'

type View = 'menu' | 'genres' | 'tags'

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
  const [view, setView] = useState<View>('menu')
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState('')

  /** Googleフォームを別タブで開く。URL未設定のうちは案内だけ出す */
  function openContact() {
    if (!CONTACT_FORM_URL) {
      setNotice('お問い合わせ先は準備中です')
      return
    }
    setNotice('')
    window.open(CONTACT_FORM_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="page">
      <div className="top-tabs" style={{ background: theme.soft }}>
        <button className="top-tab" style={{ color: theme.accent, cursor: 'default' }}>その他</button>
      </div>

      <div className="page-scroll">
        <div className="card menu-card">
          <button className="menu-row" onClick={() => setView('genres')}>
            <span className="menu-dot" style={{ background: '#fbd0e0' }} />
            <span className="menu-label">ジャンル管理</span>
            <span className="menu-meta">{genres.length}件</span>
            <span className="menu-chevron">›</span>
          </button>
          <button className="menu-row" onClick={() => setView('tags')}>
            <span className="menu-dot" style={{ background: '#fbd0e0' }} />
            <span className="menu-label">タグ管理</span>
            <span className="menu-meta">{tags.length}件</span>
            <span className="menu-chevron">›</span>
          </button>
        </div>

        <div className="card menu-card">
          <button className="menu-row" onClick={openContact}>
            <span className="menu-dot" style={{ background: '#d8d2f7' }} />
            <span className="menu-label">お問い合わせ</span>
            <span className="menu-chevron">›</span>
          </button>
          <button className="menu-row" onClick={() => setConfirmReset(true)}>
            <span className="menu-dot" style={{ background: '#d8d2f7' }} />
            <span className="menu-label">リセット</span>
            <span className="menu-chevron">›</span>
          </button>
        </div>

        {notice && (
          <p className="summary" style={{ textAlign: 'center', padding: '0.5rem 0' }}>{notice}</p>
        )}
      </div>

      {view === 'genres' && (
        <SubPage title="ジャンル管理" accent={theme.accent} soft={theme.soft} onClose={() => setView('menu')}>
          <LabelListPage
            kind="ジャンル"
            hint="1つの項目に1つだけ付きます。ここで決めた色が一覧のアイコンと分析の円グラフに使われます。"
            items={genres}
            withIcon
            accent={theme.accent}
            onSave={onSaveGenre}
            onRemove={onRemoveGenre}
          />
        </SubPage>
      )}

      {view === 'tags' && (
        <SubPage title="タグ管理" accent={theme.accent} soft={theme.soft} onClose={() => setView('menu')}>
          <LabelListPage
            kind="タグ"
            hint="1つの項目に何個でも付けられます。#アイナナ のように推し別・現場別で絞り込むのに使います。"
            items={tags}
            withIcon={false}
            prefix="#"
            accent={theme.accent}
            onSave={onSaveTag}
            onRemove={onRemoveTag}
          />
        </SubPage>
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
