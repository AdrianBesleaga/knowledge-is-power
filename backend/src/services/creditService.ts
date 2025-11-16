import { getMongoDB } from '../config/mongodb';
import { User, CreditTransaction, UnlockedContent, DEFAULT_CREDITS } from '../models/User';

const USERS_COLLECTION = 'users';

export class InsufficientCreditsError extends Error {
  constructor(required: number, available: number) {
    super(`Insufficient credits. Required: ${required}, Available: ${available}`);
    this.name = 'InsufficientCreditsError';
  }
}

export const creditService = {
  /**
   * Get or create a user in the database
   */
  async getOrCreateUser(uid: string, email: string): Promise<User> {
    const db = await getMongoDB();
    const users = db.collection<User>(USERS_COLLECTION);

    let user = await users.findOne({ uid });

    if (!user) {
      // Create new user with default credits
      const newUser: User = {
        uid,
        email,
        credits: DEFAULT_CREDITS,
        createdAt: new Date(),
        updatedAt: new Date(),
        creditHistory: [
          {
            timestamp: new Date(),
            action: 'initial',
            amount: DEFAULT_CREDITS,
            description: 'Initial credits',
            remainingCredits: DEFAULT_CREDITS,
          },
        ],
      };

      await users.insertOne(newUser as any);
      user = newUser;
    }

    return user;
  },

  /**
   * Get user's current credit balance
   */
  async getCredits(uid: string): Promise<number> {
    const db = await getMongoDB();
    const users = db.collection<User>(USERS_COLLECTION);

    const user = await users.findOne({ uid });
    return user?.credits ?? 0;
  },

  /**
   * Check if user has enough credits
   */
  async hasCredits(uid: string, amount: number): Promise<boolean> {
    const credits = await this.getCredits(uid);
    return credits >= amount;
  },

  /**
   * Deduct credits from user's account
   * @throws InsufficientCreditsError if user doesn't have enough credits
   */
  async deductCredits(
    uid: string,
    amount: number,
    description: string
  ): Promise<number> {
    const db = await getMongoDB();
    const users = db.collection<User>(USERS_COLLECTION);

    const user = await users.findOne({ uid });
    if (!user) {
      throw new Error('User not found');
    }

    if (user.credits < amount) {
      throw new InsufficientCreditsError(amount, user.credits);
    }

    const newCredits = user.credits - amount;
    const transaction: CreditTransaction = {
      timestamp: new Date(),
      action: 'deduct',
      amount,
      description,
      remainingCredits: newCredits,
    };

    await users.updateOne(
      { uid },
      {
        $set: {
          credits: newCredits,
          updatedAt: new Date(),
        },
        $push: {
          creditHistory: transaction,
        },
      }
    );

    return newCredits;
  },

  /**
   * Add credits to user's account
   */
  async addCredits(
    uid: string,
    amount: number,
    description: string
  ): Promise<number> {
    const db = await getMongoDB();
    const users = db.collection<User>(USERS_COLLECTION);

    const user = await users.findOne({ uid });
    if (!user) {
      throw new Error('User not found');
    }

    const newCredits = user.credits + amount;
    const transaction: CreditTransaction = {
      timestamp: new Date(),
      action: 'add',
      amount,
      description,
      remainingCredits: newCredits,
    };

    await users.updateOne(
      { uid },
      {
        $set: {
          credits: newCredits,
          updatedAt: new Date(),
        },
        $push: {
          creditHistory: transaction,
        },
      }
    );

    return newCredits;
  },

  /**
   * Get user's credit history
   */
  async getCreditHistory(uid: string, limit: number = 50): Promise<CreditTransaction[]> {
    const db = await getMongoDB();
    const users = db.collection<User>(USERS_COLLECTION);

    const user = await users.findOne({ uid });
    if (!user) {
      return [];
    }

    // Return last N transactions
    return user.creditHistory.slice(-limit).reverse();
  },

  /**
   * Check if user has already unlocked specific content
   */
  async hasUnlockedContent(uid: string, contentType: 'graph' | 'timeline', slug: string): Promise<boolean> {
    const db = await getMongoDB();
    const users = db.collection<User>(USERS_COLLECTION);

    const user = await users.findOne({
      uid,
      'unlockedContent.type': contentType,
      'unlockedContent.slug': slug
    });

    return !!user;
  },

  /**
   * Record unlocked content for user (prevents duplicate payments)
   */
  async recordUnlockedContent(
    uid: string,
    contentType: 'graph' | 'timeline',
    slug: string,
    creditsSpent: number = 1
  ): Promise<void> {
    const db = await getMongoDB();
    const users = db.collection<User>(USERS_COLLECTION);

    const unlockedContent: UnlockedContent = {
      type: contentType,
      slug,
      unlockedAt: new Date(),
      creditsSpent,
    };

    await users.updateOne(
      { uid },
      {
        $push: {
          unlockedContent,
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );
  },
};
