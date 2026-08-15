export type Page = 'ledger' | 'savings' | 'plans' | 'analysis' | 'more'

interface PageTheme {
  label: string
  icon: string
  accent: string   // 文字・アクティブピルの色
  soft: string     // 上部タブバーの背景
}

/**
 * アプリのテーマ色。ページごとに変えず全画面で1色に統一する。
 * 色は「区別のための情報」なので、同時に見える色数を絞るほど読みやすくなる。
 * このアプリで色に意味を持たせるのはジャンルだけにして、そちらを目立たせる。
 * 変えるならここ1箇所でよい（index.css の --accent も揃えること）。
 */
export const ACCENT = '#7c6bd0'
export const ACCENT_SOFT = '#e2dcf7'

/** ボトムナビの並び順。現在地は色ではなくアイコンとラベルで示す */
export const PAGES: { id: Page; theme: PageTheme }[] = [
  { id: 'ledger',   label: '家計簿', icon: '🏠' },
  { id: 'savings',  label: '貯金',   icon: '💰' },
  { id: 'plans',    label: '予定',   icon: '📅' },
  { id: 'analysis', label: '分析',   icon: '📈' },
  { id: 'more',     label: 'その他', icon: '⚙️' },
].map(({ id, label, icon }) => ({
  id: id as Page,
  theme: { label, icon, accent: ACCENT, soft: ACCENT_SOFT },
}))

export function themeOf(page: Page): PageTheme {
  return PAGES.find(p => p.id === page)!.theme
}
