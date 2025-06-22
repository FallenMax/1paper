import Router from '@koa/router'
import send from 'koa-send'
import { generatePageId } from '../../common/lib/generate_id'
import { config } from '../config'

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

export const routes = () => {
  const router = new Router()

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
      await send(ctx, 'index.html', {
        root: config.staticDir,
      })
    })

  return router.routes()
}
