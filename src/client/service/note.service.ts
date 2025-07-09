import { ClientAPI, ServerAPI } from '../../common/api.type'
import { EventEmitter } from '../../common/event'
import { Patch } from '../../common/lib/diff3'
import { RpcClient } from '../lib/rpc_client'

export class NoteService extends EventEmitter<{
  noteUpdate: { id: string; h: number; p: Patch }
}> {
  constructor(private rpcClient: RpcClient<ServerAPI, ClientAPI>) {
    super()
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
  fetchDescendantNoteIds(id: string) {
    return this.rpcClient.call('getDescendantNoteIds', { id })
  }
  saveNote(id: string, patch: Patch, hash: number) {
    return this.rpcClient.call('save', { id, p: patch, h: hash })
  }
  deleteNote(id: string) {
    return this.rpcClient.call('delete', { id })
  }
  moveNote(id: string, newId: string) {
    return this.rpcClient.call('move', { id, newId })
  }
}
