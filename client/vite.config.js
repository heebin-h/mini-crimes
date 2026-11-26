import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 정적 사이트 (GitHub Pages). 서버 프록시 없음 — 팀 수사는 P2P(PeerJS)
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
