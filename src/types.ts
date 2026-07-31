export interface Wallet {
  id: string;
  name: string;       // "現金", "PayPay", "クレカ" など
  balance: number;    // 現在残高
}

/** 項目の分類。1項目に1つだけ付き、色を持つ。分析の円グラフはこの軸で集計する */
export interface Genre {
  id: string;
  name: string;
  color: string;      // #rrggbb
  icon: string;       // 絵文字
}

/** 横断フィルタ用のラベル。1項目に複数付く（#推し活 #アイナナ など） */
export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface LedgerEntry {
  id: string;
  walletId: string;
  label: string;
  amount: number;     // 正=収入, 負=支出
  date: string;       // YYYY-MM-DD
  genreId: string;    // '' = 未設定
  tagIds: string[];
  memo: string;
}

/** 'once' = 未定（いつ買うか未定の欲しいもの）, 'monthly' = 毎月（定期支出） */
export type PlanKind = 'once' | 'monthly';

export interface PlanItem {
  id: string;
  name: string;
  kind: PlanKind;
  estimatedCost: number;
  deductedAmount: number;   // 既に引いた金額（once のみ使用）
  dayOfMonth: number;       // monthly の引き落とし日 1-31, 0 = 未設定
  walletId: string;         // monthly の引き落とし口座, '' = 未設定
  genreId: string;
  tagIds: string[];
  memo: string;
  order: number;
}

/** 'once' = 一度きりのタスク, 'daily' = 毎日繰り返すデイリーミッション */
export type TaskRepeat = 'once' | 'daily';

export interface Task {
  id: string;
  name: string;
  bonusAmount: number;      // 達成するたびに貯まる「つもり貯金」の額
  repeat: TaskRepeat;
  timerMinutes: number;     // 0 = タイマーなし。1以上なら達成に計測が必要
  completedDates: string[]; // YYYY-MM-DD の達成履歴。連続日数と分析の材料
  genreId: string;
  order: number;
}

/** つもり貯金の発生ログ。分析>貯金履歴の月別棒グラフはこれを集計する */
export interface SavingsEvent {
  id: string;
  date: string;       // YYYY-MM-DD
  amount: number;
  taskId: string;     // '' = 移行分・手動追加
  label: string;
}

export interface ActiveTimer {
  taskId: string;
  totalSeconds: number;
  remaining: number;  // seconds
}
