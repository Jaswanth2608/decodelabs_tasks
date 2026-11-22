import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { LiveProvider } from './context/LiveContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ProductStoreProvider } from './context/ProductStore.jsx'

import './index.css'

// Restore the saved motion preference before the first paint so a returning
// user never sees animations they had turned off.
try {
  const savedMotion = JSON.parse(localStorage.getItem('warranto.reduce-motion') || 'null')
  if (savedMotion?.enabled) document.documentElement.classList.add('reduce-motion')
} catch {
  // Unreadable preference — the default (animations on) is fine.
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <LiveProvider>
            <ProductStoreProvider>
              <App />
            </ProductStoreProvider>
          </LiveProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
