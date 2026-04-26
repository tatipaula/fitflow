import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Capturado no nível de módulo — o evento pode disparar antes do React montar
let _deferred: BeforeInstallPromptEvent | null = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  _deferred = e as BeforeInstallPromptEvent
})

const DISMISSED_KEY = 'kv-pwa-dismissed'

function isInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream
}

export function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isInstalled()) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    if (isIOS()) {
      setIos(true)
      setVisible(true)
      return
    }

    // Usar evento já capturado ou aguardar disparo tardio
    if (_deferred) {
      setPrompt(_deferred)
      setVisible(true)
    } else {
      const handler = (e: Event) => {
        _deferred = e as BeforeInstallPromptEvent
        setPrompt(_deferred)
        setVisible(true)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    localStorage.setItem(DISMISSED_KEY, '1')
    if (outcome === 'accepted') setVisible(false)
    setPrompt(null)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: 'var(--ink-2)',
      borderTop: '1px solid color-mix(in oklch, var(--accent), transparent 55%)',
      padding: '14px 20px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
    }}>
      {/* Ícone */}
      <img
        src="/icons/pwa-64x64.png"
        alt="Kinevia"
        width={44} height={44}
        style={{ borderRadius: 10, flexShrink: 0 }}
      />

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 3 }}>
          Instale o Kinevia
        </div>
        {ios ? (
          <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5 }}>
            Toque em{' '}
            <ShareIcon />
            {' '}e depois em{' '}
            <strong style={{ color: 'var(--fg-2)', fontWeight: 500 }}>
              "Adicionar à Tela de Início"
            </strong>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            Acesse seus treinos direto do celular, sem abrir o browser
          </div>
        )}
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
        {!ios && (
          <button
            onClick={install}
            style={{
              height: 34, paddingInline: 16,
              borderRadius: 999,
              background: 'var(--accent)', color: 'var(--accent-ink)',
              border: 'none', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Fechar"
          style={{
            width: 30, height: 30, borderRadius: 999, flexShrink: 0,
            background: 'transparent', border: '1px solid var(--ink-4)',
            color: 'var(--fg-3)', fontSize: 18, lineHeight: 1,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

function ShareIcon() {
  return (
    <svg
      width={12} height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--fg-2)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline', verticalAlign: 'middle', margin: '0 1px' }}
    >
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}
