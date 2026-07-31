import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // PORT が渡されればそれを使う（5173 が塞がっている時のプレビュー起動用）
  server: { port: Number(process.env.PORT) || 5173 },
})
