import { Server } from './server'

async function start() {
  await new Server().start()
}

start().catch(console.error)
