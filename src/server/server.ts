import cors from '@koa/cors'
import * as http from 'http'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import compress from 'koa-compress'
import logger from 'koa-logger'
import { ClientAPI, ServerAPI } from '../common/api.type'
import { Disposable } from '../common/disposable'
import { config } from './config'
import { DbConnection } from './lib/database'
import { RpcServer } from './lib/rpc_server'
import { error } from './middleware/error_handler'
import { routes } from './router'
import { NoteService } from './service/note.service'

export class Server extends Disposable {
  private connection: DbConnection
  private noteService!: NoteService
  private httpServer!: http.Server
  private rpcServer!: RpcServer<ServerAPI, ClientAPI>
  private logger = console

  constructor() {
    super()
    this.connection = this.register(new DbConnection())
  }
  async start() {
    this.logger.info('server start')
    // db
    this.logger.info('connecting to database...')
    await this.connection.connect()

    // service
    this.logger.info('initializing note service...')
    this.noteService = this.register(new NoteService(this.connection))

    // http server
    this.logger.info('initializing http server...')
    const app = new Koa()
    app.use(error())
    app.use(logger())
    app.use(compress())
    app.use(bodyParser())
    app.use(
      // TODO should we?
      cors({
        origin: (ctx) => {
          const origin = ctx.request.headers.origin
          return origin
        },
        credentials: false,
      }),
    )

    app.use(routes(this.noteService))
    this.httpServer = new http.Server(app.callback())

    // rpc server
    this.rpcServer = this.register(
      new RpcServer<ServerAPI, ClientAPI>(this.httpServer, {
        subscribe: ({ id }, client) => {
          this.rpcServer.joinRoom(client.id, id)
        },
        unsubscribe: ({ id }, client) => {
          this.rpcServer.leaveRoom(client.id, id)
        },
        get: async ({ id }) => {
          return await this.noteService.getNote(id)
        },
        getTreeNoteIds: async ({ id }) => {
          return await this.noteService.getTreeNoteIds(id)
        },
        getDescendantNoteIds: async ({ id }) => {
          return await this.noteService.getDescendantNoteIds(id)
        },
        save: async ({ id, p, h }, client) => {
          console.info(`saving note for: ${id}`)
          // FIXME queue
          await this.noteService.patchNote({
            id,
            patch: p,
            hash: h,
            source: client.id,
          })
          this.rpcServer.callClient(
            'noteUpdate',
            { id, h, p },
            {
              rooms: [id],
              exclude: client.id,
            },
          )
        },
        delete: async ({ id }, client) => {
          console.info(`deleting note: ${id}`)
          const result = await this.noteService.deleteNote(id, client.id)

          // Notify clients about all deleted notes
          for (const deletedNote of result.deletedNotes) {
            this.rpcServer.callClient(
              'noteUpdate',
              { id: deletedNote.id, h: deletedNote.hash, p: deletedNote.patch },
              {
                rooms: [deletedNote.id],
              },
            )
          }

          return result
        },
        move: async ({ id, newId }, client) => {
          console.info(`moving note from ${id} to ${newId}`)
          const results = await this.noteService.moveNote(id, newId, client.id)

          // Notify clients about both operations
          for (const result of results) {
            this.rpcServer.callClient(
              'noteUpdate',
              { id: result.id, h: result.hash, p: result.patch },
              {
                rooms: [result.id],
              },
            )
          }

          return results
        },
      }),
    )

    // listen
    const port = config.port
    await new Promise<void>((resolve) => {
      this.httpServer.listen(port, resolve)
      this.register(() => this.httpServer.close())
    })

    this.logger.info('Listening on', port)

    this.register(() => {
      this.logger.info('server shutdown')
    })
  }
}
