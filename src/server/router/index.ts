import Router from '@koa/router'
import { readFileSync } from 'fs'
import send from 'koa-send'
import path from 'path'
import { generatePageId } from '../../common/lib/generate_id'
import { config } from '../config'
import { NoteService } from '../service/note.service'

let indexHtml = readFileSync(path.join(config.staticDir, 'index.html'), 'utf-8')

function encodeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;')
}
function escapeScript(str: string): string {
  return str.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/-->/g, '--\\u003e')
}

function makeManifest(path?: string | undefined) {
  const manifest = {
    name: path ? `${path}·1paper` : '1paper',
    short_name: path ? path : '1paper',
    start_url: path ? `/${path}` : '.',
    categories: ['productivity', 'utilities'],
    scope: `/`,
    display: 'standalone',
    description: 'A paper in the cloud',
    icons: [
      {
        src: '/assets/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
  }
  return manifest
}

export const routes = (noteService: NoteService) => {
  const router = new Router()

  async function renderIndexHtml(noteId: string) {
    const note = await noteService.getNote(noteId)
    const analyticScript = process.env.ANALYTICS_SCRIPT
    const safeNoteId = encodeHtml(noteId)
    const html = indexHtml
      .replace('<title>1paper</title>', `<title>${safeNoteId}·1paper</title>`)
      .replace('<!-- %analytics% -->', analyticScript ? analyticScript : '')
      .replace('<!-- %title% -->', `${safeNoteId}`)
      .replace('<!-- %script% -->', `<script>window.__note = ${escapeScript(JSON.stringify(note.note))}</script>`)

    return html
  }

  router

    //-------------- REST API Routes --------------
    .get('/api/note/:id', async (ctx) => {
      const noteId = decodeURIComponent(ctx.params.id)
      const { note } = await noteService.getNote(noteId)
      const content = note

      // Check if client wants JSON response
      const acceptJson = ctx.get('Accept')?.includes('application/json')

      if (acceptJson) {
        try {
          const parsedContent = JSON.parse(content)
          ctx.body = parsedContent
          ctx.type = 'application/json'
          ctx.status = 200
        } catch (error) {
          ctx.body = content
          ctx.type = 'text/plain; charset=utf-8'
          ctx.status = 406
        }
      } else {
        ctx.body = content
        ctx.type = 'text/plain; charset=utf-8'
        ctx.status = 200
      }
    })

    .get('/api/tree/:id', async (ctx) => {
      const noteId = decodeURIComponent(ctx.params.id)
      const tree = await noteService.getTreeNoteIds(noteId)
      ctx.body = tree
      ctx.status = 200
    })

    .put('/api/note/:id', async (ctx) => {
      const noteId = decodeURIComponent(ctx.params.id)

      // Get content based on Content-Type
      let content = ''
      const contentType = ctx.get('Content-Type') || ''

      if (contentType.includes('application/json')) {
        // Handle JSON input
        const body = ctx.request.body
        if (typeof body === 'object' && body !== null) {
          content = JSON.stringify(body)
        } else if (typeof body === 'string') {
          content = body
        }
      } else {
        // Handle plain text input (existing logic)
        if (ctx.request.body && typeof ctx.request.body === 'string') {
          content = ctx.request.body
        } else if (ctx.request.rawBody) {
          content = ctx.request.rawBody.toString()
        }
      }

      await noteService.setNote({
        id: noteId,
        text: content,
        byClient: undefined, // REST API requests are not associated with a specific client
      })

      ctx.status = 200
    })

    // manifest
    .get('/assets/manifest.webmanifest', async (ctx) => {
      const noteUrl = ctx.headers.referer
      try {
        if (noteUrl) {
          const url = new URL(noteUrl!)
          const path = url.pathname.slice(1)
          ctx.body = makeManifest(path)
          ctx.type = 'application/json'
        } else {
          ctx.body = makeManifest()
          ctx.type = 'application/json'
        }
      } catch (error) {
        ctx.body = makeManifest()
        ctx.type = 'application/json'
      }
    })

    // service worker
    .get('/assets/sw.js', async (ctx) => {
      await send(ctx, 'assets/sw.js', {
        root: config.staticDir,
        maxAge: 0,
        setHeaders: (res, path, stats) => {
          res.setHeader('Service-Worker-Allowed', '/')
        },
      })
    })

    // static resources
    .get('/assets/:file*', async (ctx) => {
      try {
        const filePath = ctx.path.slice(1)
        await send(ctx, filePath, {
          root: config.staticDir,
          maxAge: 1000 * 60 * 60 * 24 * 365,
          immutable: true,
        })
      } catch (err) {
        if ((err as any).status !== 404) {
          throw err
        }
      }
    })

    // robots.txt - disallow all
    .get('/robots.txt', async (ctx) => {
      ctx.body = 'User-agent: *\nDisallow: /'
      ctx.type = 'text/plain'
    })

    // .well-known/* - return 404 for all requests
    .get('/.well-known/:path*', async (ctx) => {
      ctx.status = 404
    })

    // pages
    .get('/', async (ctx) => {
      await ctx.redirect(generatePageId())
    })
    .get('/:id*', async (ctx) => {
      const path = ctx.path
      const trimmed = path.replace(/\/+$/, '')
      if (trimmed !== path) {
        ctx.redirect(trimmed)
        return
      }

      const noteId = decodeURIComponent(path.slice(1))
      const html = await renderIndexHtml(noteId)
      ctx.body = html
      ctx.type = 'text/html'
      ctx.header['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    })

  return router.routes()
}
