import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'myndir/*'],
      manifest: {
        name: 'BOX800',
        short_name: 'BOX800',
        description: 'Bókanir, æfingar og mæting hjá BOX800 á Selfossi',
        lang: 'is',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#090b0d',
        theme_color: '#090b0d',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Prófunarútgáfan (PGlite) er stór og er bara sótt þegar hún er notuð
        globIgnores: ['**/postgres*', '**/*.wasm', '**/*.data', '**/demo-*.js', 'demo/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
})
