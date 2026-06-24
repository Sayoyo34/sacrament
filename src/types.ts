export interface Wallet {
  id: string;
  name: string;       // "現金", "PayPay", "クレカ" など
  balance: number;    // 現在残高
}

export interface LedgerEntry {
  id: string;
  walletId: string;
  label: string;
  amount: number;     // 正=収入, 負=支出
}

export interface BulletItem {
  id: string;
  name: string;
  estimatedCost: number;
  deducted: boolean;
}

export interface TimerPreset {
  id: string;
  name: string;
  minutes: number;
}

export interface ActiveTimer {
  presetId: string;
  totalSeconds: number;
  remaining: number;   // seconds
}

export interface Task {
  id: string;
  name: string;
  bonusAmount: number;
  completed: boolean;
  bonusApplied: boolean;
}
