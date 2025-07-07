import { ClientAPI, ServerAPI } from '../../common/api.type'
import { EventEmitter } from '../../common/event'
import { Patch } from '../../common/lib/diff3'
import { RpcClient } from '../lib/rpc_client'

export class NoteService extends EventEmitter<{
  noteUpdate: { id: string; h: number; p: Patch }
}> {
  constructor(private rpcClient: RpcClient<ServerAPI, ClientAPI>) {
    super()
    window.addEventListener('storage', (e) => {})
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
  fetchTreeNoteIds(id: string) {
    return this.rpcClient.call('getTreeNoteIds', { id })
  }
  saveNote(id: string, patch: Patch, hash: number) {
    return this.rpcClient.call('save', { id, p: patch, h: hash })
  }
}
