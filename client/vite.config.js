import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // Use Docker service name when running in container, fall back to localhost for local dev
        target: process.env.VITE_API_BASE || 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
})
