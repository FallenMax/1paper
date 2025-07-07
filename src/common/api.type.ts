import { Patch } from './lib/diff3'

export type Client = {
  id: string
}
export type ServerAPI = {
  subscribe(params: { id: string }): void
  unsubscribe(params: { id: string }): void
  get(params: { id: string }): { note: string }
  getTreeNoteIds(params: { id: string }): string[]
  save(params: { id: string; p: Patch; h: number }): void
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
