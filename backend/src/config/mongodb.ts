import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export const initMongoDB = async (): Promise<Db> => {
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI || '';

  if (!uri) {
    throw new Error('MongoDB URI is not configured. Please check MONGODB_URI in .env');
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(); // Use default database from URI, or specify: client.db('knowledge-is-power')
    
    console.log('✅ MongoDB connected successfully');
    return db;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
};

export const getMongoDB = async (): Promise<Db> => {
  if (!db) {
    return await initMongoDB();
  }
  return db;
};

export const closeMongoDB = async (): Promise<void> => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('✅ MongoDB connection closed');
  }
};

