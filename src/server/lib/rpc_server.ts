import * as http from 'http'
import * as SocketIO from 'socket.io'
import { Client, RpcAPI, ServerAPIHandlers } from '../../common/api.type'
import { assert } from '../../common/assert'
import { Disposable } from '../../common/disposable'
import { ErrorCode, UserError } from '../../common/error'

export type CallClientOptions = {
  rooms?: string[]
  exclude?: string
}

export class RpcServer<ServerAPI extends RpcAPI, ClientAPI extends RpcAPI> extends Disposable {
  private io: SocketIO.Server

  constructor(httpServer: http.Server, serverMethods: ServerAPIHandlers<ServerAPI>) {
    super()
    this.io = new SocketIO.Server(httpServer, {
      transports: ['websocket'], // Skip polling, use WebSocket directly
      cors: {
        origin: '*',
      },
    })
    this.register(() => {
      this.io.close()
    })
    this.io.on('connection', (socket: SocketIO.Socket) => {
      const client: Client = { id: socket.id }
      Object.entries(serverMethods).forEach(([method, handler]) => {
        socket.on(method, async (params, reply) => {
          try {
            const result = await handler(params, client)
            reply(result)
          } catch (error) {
            const errcode = error instanceof UserError ? error.errcode : ErrorCode.UNKNOWN
            console.warn('[RpcServer] Error handling: ', method, errcode)
            console.error(error)
            reply({ errcode })
          }
        })
      })
    })
  }

  joinRoom(clientId: string, room: string): void {
    const socket = this.io.sockets.sockets.get(clientId)
    assert(socket, `Invalid client ID: ${clientId}`)
    socket.join(room)
  }

  leaveRoom(clientId: string, room: string): void {
    const socket = this.io.sockets.sockets.get(clientId)
    assert(socket, `Invalid client ID: ${clientId}`)
    socket.leave(room)
  }

  callClient<T extends keyof ClientAPI>(
    method: T,
    params: Parameters<ClientAPI[T]>[0],
    { rooms = [], exclude }: CallClientOptions = {},
  ): void {
    let target = exclude ? this.io.sockets.sockets.get(exclude) : this.io.sockets

    if (!target) {
      throw new Error(`[RpcServer] Target not found: ${String(method)}`)
    }

    target.to(rooms).emit(String(method), params)
  }
}
