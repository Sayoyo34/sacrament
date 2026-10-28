import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // ホーム画面に追加して、圏外でも開けるようにする。
    // 新しい版は裏で取り込み、次に開いたときに切り替わる（入力中に勝手に再読み込みしない）
    VitePWA({
      // iOSアプリ（Capacitor）はアプリ本体に全ファイルが入っているので Service Worker は不要
      disable: mode === 'ios',
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'おふせ手帖',
        short_name: 'おふせ手帖',
        description: '推し活費用管理',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  // PORT が渡されればそれを使う（5173 が塞がっている時のプレビュー起動用）
  server: { port: Number(process.env.PORT) || 5173 },
}))
