import { join } from 'path'
import { defineConfig } from 'vitest/config'

/**
 * Dev-only middleware: rewrite `/` to `/landing.html` so the landing page is
 * previewable at the vite dev server root. In prod the koa server handles `/`
 * directly. Without this, vite would serve `index.html` and the SPA fallback
 * in `app.ts` would redirect to a random note id.
 */
const serveLandingAtRoot = {
  name: 'serve-landing-at-root',
  configureServer(server: any) {
    server.middlewares.use((req: any, _res: any, next: any) => {
      const url: string = req.url ?? ''
      if (url === '/' || url.startsWith('/?')) {
        req.url = '/landing.html' + url.slice(1)
      }
      next()
    })
  },
}

export default defineConfig({
  plugins: [serveLandingAtRoot],

  build: {
    outDir: join(__dirname, 'public'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: join(__dirname, 'src/client/index.html'),
        landing: join(__dirname, 'src/client/landing.html'),
      },
      output: {
        assetFileNames: (assetInfo) => {
          const fileName = assetInfo.originalFileNames?.[0]
          if (fileName && fileName.startsWith('assets/')) {
            return 'assets/[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },

  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },

  server: {
    host: '0.0.0.0',
    cors: true,
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3333',
        ws: true,
        rewriteWsOrigin: true,
      },
      '/assets/manifest.webmanifest': {
        target: 'http://localhost:3333',
      },
      '/assets/sw.js': {
        target: 'http://localhost:3333',
      },
    },
  },
})
