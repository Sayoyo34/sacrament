import Sheet from './Sheet'
import { summarize, type AppData } from '../cloudSync'

interface Props {
  local: AppData
  cloud: AppData
  onKeepLocal: () => void
  onKeepCloud: () => void
  /** 選ばずに閉じた。同期は保留のまま */
  onLater: () => void
}

function Side({ title, data }: { title: string; data: AppData }) {
  const s = summarize(data)
  return (
    <div className="card" style={{ padding: '0.75rem', marginBottom: '0.5rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-h)', marginBottom: '0.25rem' }}>{title}</div>
      <p className="summary">
        出費履歴 {s.entries}件{s.latestEntryDate && `（最新 ${s.latestEntryDate}）`}
        ／口座 {s.wallets}件／予定 {s.planItems}件／タスク {s.tasks}件
      </p>
    </div>
  )
}

/** ログイン時にこの端末とクラウドの両方で別々の変更があったとき、どちらを残すか選んでもらう */
export default function SyncConflictModal({ local, cloud, onKeepLocal, onKeepCloud, onLater }: Props) {
  return (
    <Sheet onClose={onLater} sheetClassName="modal">
      <div className="modal-title">どちらのデータを残しますか？</div>
      <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-h)' }}>
        この端末とクラウドで内容が違います。選ばなかった方はこの端末に1件だけ控えを残して置き換えます。
      </p>
      <Side title="この端末" data={local} />
      <Side title="クラウド" data={cloud} />
      <div className="form-actions">
        <button className="btn-sub" onClick={onKeepCloud}>クラウドを残す</button>
        <button className="btn-sub" onClick={onKeepLocal}>この端末を残す</button>
      </div>
      <p className="summary" style={{ marginTop: '0.75rem' }}>
        閉じると同期は保留になります（「その他」からあとで選べます）
      </p>
    </Sheet>
  )
}
