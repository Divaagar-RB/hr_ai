import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://clever-forks-sip.loca.lt/',
        changeOrigin: true,
        secure: false,
        headers: {
          'Bypass-Tunnel-Reminder': 'true',
          'ngrok-skip-browser-warning': 'true'
        }
      },
      '/uploads': {
        target: 'https://clever-forks-sip.loca.lt/',
        changeOrigin: true,
        secure: false,
        headers: {
          'Bypass-Tunnel-Reminder': 'true'
        }
      }
    }
  }
})
