export interface User {
  uid: string;
  email: string;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
  creditHistory: CreditTransaction[];
}

export interface CreditTransaction {
  timestamp: Date;
  action: 'deduct' | 'add' | 'initial';
  amount: number;
  description: string;
  remainingCredits: number;
}

export const DEFAULT_CREDITS = 10;
