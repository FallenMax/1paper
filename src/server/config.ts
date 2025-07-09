import * as path from 'path'

export const env = process.env

export const isDev = /dev/.test(env.NODE_ENV || '')
export const isTesting = /test/.test(env.NODE_ENV || '')

const root = process.cwd()
const staticDir = isDev ? path.resolve(root, './src/client') : path.resolve(root, './public')
export const config = {
  port: Number(env.PORT || 3333),
  mongodb: {
    url: env.MONGODB_URL || `mongodb://localhost:27017`,
    database: env.MONGODB_DATABASE || 'notepad_dev',
  },
  staticDir,
}
