export type Page = 'ledger' | 'savings' | 'plans' | 'analysis' | 'more'

interface PageTheme {
  label: string
  icon: string
  accent: string   // 文字・アクティブピルの色
  soft: string     // 上部タブバーの背景
}

/** ボトムナビの並び順と、タブごとのテーマ色（Figma準拠） */
export const PAGES: { id: Page; theme: PageTheme }[] = [
  { id: 'ledger',   theme: { label: '家計簿', icon: '🏠', accent: '#7c6bd0', soft: '#e2dcf7' } },
  { id: 'savings',  theme: { label: '貯金',   icon: '💰', accent: '#c47f0b', soft: '#fce6b0' } },
  { id: 'plans',    theme: { label: '予定',   icon: '📅', accent: '#cf4b8d', soft: '#fbd3e8' } },
  { id: 'analysis', theme: { label: '分析',   icon: '📈', accent: '#2f8f5b', soft: '#c8efd8' } },
  { id: 'more',     theme: { label: 'その他', icon: '⚙️', accent: '#2280b4', soft: '#c3e7f8' } },
]

export function themeOf(page: Page): PageTheme {
  return PAGES.find(p => p.id === page)!.theme
}
