import { join } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    outDir: join(__dirname, 'public'),
    emptyOutDir: true,
    rollupOptions: {
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
