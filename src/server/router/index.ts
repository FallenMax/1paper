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
    const ga = process.env.GOOGLE_ANALYTICS_ID
    const html = indexHtml
      .replace(
        '<!-- %script% -->',
        `<script>window.__note = ${JSON.stringify(note.note)}</script>`,
      )
      .replace(
        '<title>1paper</title>',
        `<title>${encodeHtml(noteId)}·1paper</title>`,
      )
      .replace(
        '<!-- %google-analytics% -->',
        ga
          ? `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config',${JSON.stringify(ga)});
</script>`
          : '',
      )

    return html
  }

  router

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

    // pages
    .get('/', async (ctx) => {
      await ctx.redirect(generatePageId())
    })
    .get('/:id*', async (ctx) => {
      const noteId = decodeURIComponent(ctx.path.slice(1))
      const html = await renderIndexHtml(noteId)
      ctx.body = html
      ctx.type = 'text/html'
    })

  return router.routes()
}
