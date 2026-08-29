import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages 프로젝트 사이트는 /저장소이름/ 아래로 서비스된다.
// 배포 워크플로가 BASE_PATH를 넣어 주고, 로컬 개발과 루트 배포는 '/'를 쓴다.
// 본문·시편 JSON은 이미 import.meta.env.BASE_URL을 기준으로 불러오므로
// 여기만 맞춰 주면 하위 경로에서도 그대로 동작한다.
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg'],
      manifest: {
        name: '성무일과',
        short_name: '성무일과',
        description: '대한성공회 기도서 기준 아침·낮·저녁·밤기도',
        lang: 'ko',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#faf8f4',
        theme_color: '#4a5d4e',
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // 앱 껍데기와 예식문·성서정과·시편·축일 데이터(약 0.7MB)만 미리 받아 둔다.
        // 성서 본문 1,329장(약 9MB)까지 프리캐시하면 첫 방문이 너무 무거워지므로
        // 읽은 장부터 차곡차곡 캐시하고, 설정에서 한꺼번에 받아 둘 수도 있게 한다.
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'data/*.json'],
        globIgnores: ['**/data/bible/**'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/bible/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'bible-chapters',
              expiration: { maxEntries: 1400, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
