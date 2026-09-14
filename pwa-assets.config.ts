import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// public/pwa-icon.svg からホーム画面用のPNGアイコン一式を作る（npm run generate-pwa-assets）
// 元画像が全面塗りなので、余白は付けない
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/pwa-icon.svg'],
})
