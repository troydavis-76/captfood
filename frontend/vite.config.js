import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'CaptFood',
        short_name: 'CaptFood',
        description: "De ton placard à ton assiette, en une photo — zéro gaspillage.",
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#f6f4ef',
        theme_color: '#6B2D5C',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // L'app a besoin d'un vrai réseau pour les appels API (Claude) ;
        // on ne met en cache que les assets statiques du build, pas de mode hors-ligne complet.
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
  server: {
    port: 5173,
  },
})
