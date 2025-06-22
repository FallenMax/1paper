import { Storage } from '../util/storage'

export const metaStorage = new Storage<{
  recent: string[]
  theme: 'light' | 'dark' | 'system'
}>('_')
