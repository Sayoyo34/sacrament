import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
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
  onRemoveGenres: (ids: string[]) => void
  onApplyGenreEdit: (orderedIds: string[], removedIds: string[]) => void
  onSaveTag: (draft: LabelDraft) => void
  onRemoveTags: (ids: string[]) => void
  onApplyTagEdit: (orderedIds: string[], removedIds: string[]) => void
  onReset: () => void
  hasSupabase: boolean
  session: Session | null
  onSignIn: (email: string) => Promise<string | null>
  onSignOut: () => void
}

export default function MorePage({
  genres, tags, onSaveGenre, onRemoveGenres, onApplyGenreEdit,
  onSaveTag, onRemoveTags, onApplyTagEdit, onReset,
  hasSupabase, session, onSignIn, onSignOut,
}: Props) {
  const theme = themeOf('more')
  const [view, setView] = useState<View>('menu')
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState('')
  const [email, setEmail] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMsg, setAuthMsg] = useState('')

  async function handleSignIn() {
    const target = email.trim()
    if (!target) return
    setAuthBusy(true)
    const error = await onSignIn(target)
    setAuthBusy(false)
    setAuthMsg(error ? `送信に失敗しました（${error}）` : `${target} にログイン用のリンクを送りました。メールを確認してください。`)
  }

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

        {hasSupabase && (
          <div className="card menu-card">
            <div className="menu-section-title">アカウント</div>
            {session ? (
              <div className="menu-account-body">
                <p className="summary">{session.user.email} でログイン中</p>
                <button className="btn-sub" onClick={onSignOut}>ログアウト</button>
              </div>
            ) : (
              <div className="menu-account-body">
                <p className="summary">ログインすると他の端末とデータを同期できます</p>
                <div className="form-row">
                  <input
                    type="email"
                    placeholder="メールアドレス"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <button className="btn-sub" onClick={handleSignIn} disabled={authBusy || !email.trim()}>
                  ログインリンクを送る
                </button>
                {authMsg && <p className="summary">{authMsg}</p>}
              </div>
            )}
          </div>
        )}

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
        <SubPage
          title="ジャンル管理"
          accent={theme.accent}
          soft={theme.soft}
          onClose={() => setView('menu')}
          onSwipeLeft={() => setView('tags')}
        >
          <LabelListPage
            kind="ジャンル"
            hint="1つの項目に1つだけ付きます。ここで決めた色が一覧のアイコンと分析の円グラフに使われます。"
            items={genres}
            withIcon
            accent={theme.accent}
            onSave={onSaveGenre}
            onRemove={onRemoveGenres}
            onApplyEdit={onApplyGenreEdit}
          />
        </SubPage>
      )}

      {view === 'tags' && (
        <SubPage
          title="タグ管理"
          accent={theme.accent}
          soft={theme.soft}
          onClose={() => setView('menu')}
          onSwipeRight={() => setView('genres')}
        >
          <LabelListPage
            kind="タグ"
            hint="1つの項目に何個でも付けられます。#推しの名前 など、推し別・現場別で絞り込むのに使います。"
            items={tags}
            withIcon={false}
            prefix="#"
            accent={theme.accent}
            onSave={onSaveTag}
            onRemove={onRemoveTags}
            onApplyEdit={onApplyTagEdit}
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
