import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'AuraStream',
        short_name: 'AuraStream',
        description: 'Search and stream lossless audio from torrents using Debrid services.',
        theme_color: '#7c3aed',
        background_color: '#181028',
        display: 'standalone',
        display_override: ['fullscreen', 'standalone', 'minimal-ui', 'browser'],
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true
      },
      devOptions: {
        enabled: true
      },
    })
  ],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  }
})
