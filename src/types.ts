export interface BulletItem {
  id: string;
  name: string;
  estimatedCost: number;
  deducted: boolean;
}

export interface Task {
  id: string;
  name: string;
  bonusAmount: number;
  completed: boolean;
  bonusApplied: boolean;
}

export interface AppState {
  monthlyIncome: number;
  savingsAmount: number;
  hobbyBudget: number;
  remainingBudget: number;
  bulletItems: BulletItem[];
  tasks: Task[];
  bonusBalance: number;
}
