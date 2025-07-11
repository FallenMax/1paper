import { Patch } from './lib/diff3'

export type RpcAPI = {
  [key: string]: (params: any) => any
}

export type RpcMethod<T extends RpcAPI> = keyof T

export type ClientAPI = {
  noteUpdate(params: { id: string; h: number; p: Patch }): void
  treeUpdate(params: { rootId: string }): void
}

export type ServerAPI = {
  subscribe(params: { id: string }): void
  unsubscribe(params: { id: string }): void
  subscribeTree(params: { id: string }): void
  unsubscribeTree(params: { id: string }): void
  get(params: { id: string }): { note: string }
  getTreeNoteIds(params: { id: string }): string[]
  getDescendantNoteIds(params: { id: string }): string[]
  save(params: { id: string; p: Patch; h: number }): void
  delete(params: { id: string }): void
  move(params: { id: string; newId: string }): void
}

export type ServerAPIHandlers<T extends RpcAPI> = {
  [K in keyof T]: (params: Parameters<T[K]>[0], client: Client) => ReturnType<T[K]> | Promise<ReturnType<T[K]>>
}

export interface Client {
  id: string
}
