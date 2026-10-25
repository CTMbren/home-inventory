import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// base './' keeps every asset path relative, so the same build works on
// GitHub Pages (https://<user>.github.io/<repo>/), a custom domain, or localhost.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Home Inventory',
        short_name: 'Inventory',
        description: 'Scan and track what we have at home, and where it is.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f4ef',
        theme_color: '#2f5d50',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Never cache Supabase or product-database calls; always go to the network.
        navigateFallbackDenylist: [/^\/functions/],
        runtimeCaching: [],
      },
    }),
  ],
})
