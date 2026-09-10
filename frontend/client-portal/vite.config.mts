/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/frontend/client-portal',
  base: '/',
  // host: true (all interfaces, not just loopback) — the dev nginx.conf
  // reverse-proxies here from inside a Docker container via
  // host.docker.internal, which can't reach a server bound to localhost
  // only.
  server: {
    port: 4201,
    host: true,
  },
  preview: {
    port: 4201,
    host: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      base: '/',
      manifest: {
        id: '/',
        name: 'ВелоксДеск — Клиентский портал',
        short_name: 'ВелоксДеск',
        description: 'Клиентский портал службы поддержки ВелоксДеск',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F4EFE8',
        theme_color: '#0D9488',
        lang: 'ru',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/socket.io/'),
            handler: 'NetworkOnly',
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
