import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

// Bypass localtunnel warning page for all API requests
axios.defaults.headers.common['Bypass-Tunnel-Reminder'] = 'true'
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
