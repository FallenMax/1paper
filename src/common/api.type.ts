import { Patch } from './lib/diff3'

export type Client = {
  id: string
}

export type DeleteResult = {
  deletedNotes: Array<{ id: string; hash: number; patch: Patch }>
  affectedCount: number
}

export type MoveResult = Array<{ id: string; hash: number; patch: Patch }>

export type ServerAPI = {
  subscribe(params: { id: string }): void
  unsubscribe(params: { id: string }): void
  get(params: { id: string }): { note: string }
  getTreeNoteIds(params: { id: string }): string[]
  getDescendantNoteIds(params: { id: string }): string[]
  save(params: { id: string; p: Patch; h: number }): void
  delete(params: { id: string }): DeleteResult
  move(params: { id: string; newId: string }): MoveResult
}

export type ServerAPIHandlers<T extends RpcAPI> = {
  [K in keyof T]: (params: Parameters<T[K]>[0], client: Client) => ReturnType<T[K]> | Promise<ReturnType<T[K]>>
}
export type ClientAPIHandlers<T extends RpcAPI> = {
  [K in keyof T]: (params: Parameters<T[K]>[0]) => ReturnType<T[K]> | Promise<ReturnType<T[K]>>
}

export type ClientAPI = {
  noteUpdate(params: { id: string; h: number; p: Patch }): void
}

type AnyFunction = (...args: any[]) => any
export type RpcAPI = { [K: string]: AnyFunction }
