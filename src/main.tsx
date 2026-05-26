import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })

  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) return

    const skipIfWaiting = (sw: ServiceWorker) => {
      sw.addEventListener('statechange', (e) => {
        const state = (e.target as ServiceWorker).state
        if (state === 'installed') sw.postMessage({ type: 'SKIP_WAITING' })
        if (state === 'activated') window.location.reload()
      })
      if (sw.state === 'installed') sw.postMessage({ type: 'SKIP_WAITING' })
    }

    if (reg.waiting) skipIfWaiting(reg.waiting)
    reg.addEventListener('updatefound', () => {
      if (reg.installing) skipIfWaiting(reg.installing)
    })

    // iOS PWA não verifica atualizações de SW automaticamente ao abrir pelo ícone
    reg.update()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update()
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
