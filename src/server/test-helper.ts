import { MongoClient } from 'mongodb'
import { config, isTesting } from './config'

/**
 * Ensure we're in test environment and clean test database
 */
export async function cleanTestDatabase() {
  if (!isTesting) {
    throw new Error('cleanTestDatabase can only be called in test environment')
  }

  if (!config.mongodb.database.includes('test')) {
    throw new Error('Database name must contain "test" for safety')
  }

  const client = new MongoClient(config.mongodb.url)
  try {
    await client.connect()
    const db = client.db(config.mongodb.database)

    // Drop all collections
    const collections = await db.listCollections().toArray()
    for (const collection of collections) {
      await db.collection(collection.name).deleteMany({})
    }

    console.log(`Test database ${config.mongodb.database} cleaned`)
  } finally {
    await client.close()
  }
}

/**
 * Verify test environment
 */
export function verifyTestEnvironment() {
  if (!isTesting) {
    throw new Error('Tests can only run in test environment. Set NODE_ENV=test')
  }

  if (!config.mongodb.database.includes('test')) {
    throw new Error('Database name must contain "test" for safety')
  }
}
