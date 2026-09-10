/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/frontend/operator-app',
  // Served under /staff/ behind nginx in every mode (no domain for
  // subdomains — client-portal takes the root, this is the internal tool),
  // dev included: the dev nginx.conf reverse-proxies /staff/ straight to
  // this dev server (see infra/nginx/nginx.conf), and that only resolves
  // assets correctly if this base matches. A plain `nx serve` without
  // nginx in front now needs http://localhost:4200/staff/, not the bare
  // root — see HANDOFF.md.
  base: '/staff/',
  // host: true (all interfaces, not just loopback) — the dev nginx.conf
  // reverse-proxies here from inside a Docker container via
  // host.docker.internal, which can't reach a server bound to localhost
  // only.
  server: {
    port: 4200,
    host: true,
  },
  preview: {
    port: 4200,
    host: true,
  },
  plugins: [
    react(),
    VitePWA({
      // registerType 'prompt' (not 'autoUpdate') — operators mid-shift
      // shouldn't have the app silently swap code under them; App.tsx
      // surfaces a toast via useRegisterSW and lets them pick when to reload.
      registerType: 'prompt',
      // scope/base must track the '/staff/' base — the manifest and
      // generated service-worker are meaningless served from anywhere else
      // once nginx routes real traffic.
      base: '/staff/',
      manifest: {
        id: '/staff/',
        name: 'ВелоксДеск — Операторская',
        short_name: 'ВелоксДеск',
        description: 'Рабочее место оператора поддержки ВелоксДеск',
        start_url: '/staff/',
        scope: '/staff/',
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
        // Precache only the built app shell (JS/CSS/HTML/icons) — Workbox's
        // default glob already excludes API responses since those were
        // never build output to begin with.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Everything under /api/ and the Socket.IO handshake must always
        // hit the network. This is a live support tool: a cached ticket
        // list or a cached chat handshake response is actively wrong, not
        // just stale. NetworkOnly means "don't intercept" in effect, but
        // being explicit here documents the decision instead of relying on
        // Workbox's precache-miss fallthrough.
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
        // SPA fallback for client-side routes (/staff/tickets/:id etc.) —
        // must exclude /api/ and /socket.io/ or a network hiccup would
        // resolve those requests to index.html instead of failing loudly.
        navigateFallback: '/staff/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
      },
      devOptions: {
        // Service workers are disabled in dev by default in this plugin;
        // keep it that way so `nx serve` iteration isn't fighting a stale
        // cached bundle.
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
