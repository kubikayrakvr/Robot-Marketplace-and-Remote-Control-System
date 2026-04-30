import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ros': {
        target: 'http://app:8000',   // docker network içi isim
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: 'http://app:8000',
        changeOrigin: true,
      },
    },
  },
})
