import * as SocketIO from 'socket.io-client'
import { ClientAPIHandlers } from '../../common/api.type'
import { UserError } from '../../common/error'
import { EventEmitter } from '../../common/event'

type AnyFunction = (...args: any[]) => any
export type APIMap = { [K: string]: AnyFunction }

export class RpcClient<ServerAPI extends APIMap, ClientAPI extends APIMap> extends EventEmitter<{
  connected: undefined
  disconnected: undefined
}> {
  private socket: SocketIO.Socket

  constructor(clientMethods: ClientAPIHandlers<ClientAPI>) {
    super()
    this.socket = SocketIO.io(location.origin, {
      transports: ['websocket'], // Skip polling, use WebSocket directly
    })
    this.register(() => {
      this.socket.close()
    })

    Object.entries(clientMethods).forEach(([method, handler]) => {
      this.socket.on(method as string, async (params) => {
        try {
          await handler(params)
        } catch (error) {
          console.error('[APIClient] failed to handle event:', event, error)
        }
      })
    })

    this.socket.on('connect', () => this.emit('connected', undefined))
    this.socket.on('connect_error', () => this.emit('disconnected', undefined))
    this.socket.on('disconnect', () => this.emit('disconnected', undefined))
  }

  call<T extends keyof ServerAPI>(method: T, params: Parameters<ServerAPI[T]>[0]): Promise<ReturnType<ServerAPI[T]>> {
    return new Promise((resolve, reject) => {
      try {
        this.socket.emit(method as string, params, (response) => {
          if (response?.errcode) {
            reject(new UserError(response.errcode))
          } else {
            resolve(response)
          }
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  ready(): Promise<void> {
    if (this.socket.connected) {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.socket.io.once('open', resolve)
    })
  }
}
