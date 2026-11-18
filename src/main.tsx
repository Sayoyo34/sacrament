import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import './index.css'
import App from './App.tsx'
import { migrate } from './storage'

migrate()

// Vercel Web Analytics（Web版のみ。iOSアプリでは /_vercel/insights が無いので読み込まない）
if (import.meta.env.MODE !== 'ios') {
  inject()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
