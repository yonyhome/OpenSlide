import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Timeout extendido para PDF/PPTX (puppeteer puede tardar varios minutos en proyectos grandes)
        timeout: 300000,
        proxyTimeout: 300000,
      },
      '/slides': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
