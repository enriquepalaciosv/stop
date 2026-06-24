import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // En desarrollo, /api lo sirve el servidor Express local (dev/server.ts).
      '/api': 'http://localhost:3001',
    },
  },
})
