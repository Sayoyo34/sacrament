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
  onVerifyCode: (email: string, code: string) => Promise<string | null>
  onSignOut: () => void
  /** この端末とクラウドのどちらを残すか未選択で、同期を止めている */
  syncPending: boolean
  onOpenSyncConflict: () => void
}

export default function MorePage({
  genres, tags, onSaveGenre, onRemoveGenres, onApplyGenreEdit,
  onSaveTag, onRemoveTags, onApplyTagEdit, onReset,
  hasSupabase, session, onSignIn, onVerifyCode, onSignOut, syncPending, onOpenSyncConflict,
}: Props) {
  const theme = themeOf('more')
  const [view, setView] = useState<View>('menu')
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState('')
  const [email, setEmail] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMsg, setAuthMsg] = useState('')
  /** ログインメールを送った宛先。入っている間はコード入力欄を出す */
  const [codeSentTo, setCodeSentTo] = useState('')
  const [code, setCode] = useState('')

  async function handleSignIn() {
    const target = email.trim()
    if (!target) return
    setAuthBusy(true)
    const error = await onSignIn(target)
    setAuthBusy(false)
    if (error) {
      setAuthMsg(`送信に失敗しました（${error}）`)
      return
    }
    setCodeSentTo(target)
    setCode('')
    setAuthMsg(`${target} にログイン用のメールを送りました。メールに書かれたコードを入力するか、リンクを開いてください。`)
  }

  async function handleVerifyCode() {
    const token = code.replace(/\D/g, '')
    if (!codeSentTo || !token) return
    setAuthBusy(true)
    const error = await onVerifyCode(codeSentTo, token)
    setAuthBusy(false)
    if (error) setAuthMsg(`コードでログインできませんでした（${error}）`)
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
                {syncPending && (
                  <>
                    <p className="summary remaining-negative">この端末とクラウドの内容が違うため、同期を保留しています</p>
                    <button className="btn-sub" onClick={onOpenSyncConflict}>どちらを残すか選ぶ</button>
                  </>
                )}
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
                  ログインメールを送る
                </button>
                {authMsg && <p className="summary">{authMsg}</p>}
                {codeSentTo && (
                  <>
                    <div className="form-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="メールに書かれたコード"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                      />
                    </div>
                    <button className="btn-sub" onClick={handleVerifyCode} disabled={authBusy || !code.trim()}>
                      コードでログイン
                    </button>
                  </>
                )}
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
        <SubPage title="ジャンル管理" accent={theme.accent} soft={theme.soft} onClose={() => setView('menu')}>
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
        <SubPage title="タグ管理" accent={theme.accent} soft={theme.soft} onClose={() => setView('menu')}>
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
