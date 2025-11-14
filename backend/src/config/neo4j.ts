import neo4j, { Driver } from 'neo4j-driver';

let driver: Driver | null = null;

export const initNeo4j = (): Driver => {
  if (driver) {
    return driver;
  }

  const uri = process.env.NEO4J_URI || '';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || '';

  if (!uri || !password) {
    throw new Error('Neo4j credentials are not configured. Please check NEO4J_URI and NEO4J_PASSWORD in .env');
  }

  driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

  return driver;
};

export const getNeo4jDriver = (): Driver => {
  if (!driver) {
    return initNeo4j();
  }
  return driver;
};

export const closeNeo4j = async (): Promise<void> => {
  if (driver) {
    await driver.close();
    driver = null;
  }
};

