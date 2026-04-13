import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './i18n'; // Kendi çeviri ayarlarımız

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
