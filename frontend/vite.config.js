import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://sour-frogs-chew.loca.lt/',
        changeOrigin: true,
        secure: false,
        timeout: 600000,
        proxyTimeout: 600000,
        headers: {
          'Bypass-Tunnel-Reminder': 'true',
          'ngrok-skip-browser-warning': 'true'
        }
      },
      '/uploads': {
        target: 'https://sour-frogs-chew.loca.lt/',
        changeOrigin: true,
        secure: false,
        timeout: 600000,
        proxyTimeout: 600000,
        headers: {
          'Bypass-Tunnel-Reminder': 'true'
        }
      }
    }
  }
})
