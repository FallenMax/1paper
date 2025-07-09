import { isTesting } from './config'
import { Server } from './server'
import { cleanTestDatabase, verifyTestEnvironment } from './test-helper'

async function start() {
  if (isTesting) {
    verifyTestEnvironment()
    await cleanTestDatabase()
  }

  await new Server().start()
}

start().catch(console.error)
