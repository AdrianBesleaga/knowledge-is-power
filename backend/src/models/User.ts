export interface User {
  _id?: any; // MongoDB ObjectId
  uid: string;
  email: string;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
  creditHistory: CreditTransaction[];
  unlockedContent?: UnlockedContent[];
}

export interface CreditTransaction {
  timestamp: Date;
  action: 'deduct' | 'add' | 'initial';
  amount: number;
  description: string;
  remainingCredits: number;
}

export interface UnlockedContent {
  type: 'graph' | 'timeline';
  slug: string;
  unlockedAt: Date;
  creditsSpent: number;
}

export const DEFAULT_CREDITS = 10;
