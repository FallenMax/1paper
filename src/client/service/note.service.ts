import { ClientAPI, ServerAPI } from '../../common/api.type'
import { EventEmitter } from '../../common/event'
import { Patch } from '../../common/lib/diff3'
import { RpcClient } from '../lib/rpc_client'
import { metaStorage } from './meta.storage'

export class NoteService extends EventEmitter<{
  noteUpdate: { id: string; h: number; p: Patch }
  recentVisitedChanged: string[]
}> {
  constructor(private rpcClient: RpcClient<ServerAPI, ClientAPI>) {
    super()
    window.addEventListener('storage', (e) => {
      if (e.key === metaStorage.prefixed('recent')) {
        this.emit('recentVisitedChanged', metaStorage.get('recent') ?? [])
      }
    })
  }
  subscribe(id: string) {
    return this.rpcClient.call('subscribe', { id })
  }
  unsubscribe(id: string) {
    return this.rpcClient.call('unsubscribe', { id })
  }
  fetchNote(id: string) {
    return this.rpcClient.call('get', { id })
  }
  saveNote(id: string, patch: Patch, hash: number) {
    return this.rpcClient.call('save', { id, p: patch, h: hash })
  }

  //-------------- Recent --------------
  markVisited(id: string) {
    const visited = metaStorage.get('recent') ?? []
    const existIndex = visited.indexOf(id)
    if (existIndex !== -1) {
      visited.splice(existIndex, 1)
    }
    visited.unshift(id)
    metaStorage.set('recent', visited)
  }

  getRecentVisited(): string[] {
    return metaStorage.get('recent') ?? []
  }

  clearRecentVisited() {
    metaStorage.remove('recent')
  }
}
