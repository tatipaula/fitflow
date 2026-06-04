import { useState } from 'react'
import { KVWordmark } from '@/components/ui'
import { createCheckoutSession } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

const FEATURES = [
  'Criação de treinos por áudio com IA',
  'Transcrição e extração automática de exercícios',
  'Alunos ilimitados',
  'Programas e periodização',
  'Dashboard de evolução por atleta',
  'Ranking mensal de alunos',
  'Notificações e cobranças integradas',
  'Biblioteca de +200 exercícios com vídeo',
]

export default function PaywallPage() {
  const { clearAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)
    const result = await createCheckoutSession()
    if (result?.url) {
      window.location.href = result.url
    } else {
      setError('Não foi possível abrir o checkout. Tente novamente.')
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    clearAuth()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <KVWordmark size={16} />
      </div>

      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '5px 14px', borderRadius: 999 }}>
            Período gratuito encerrado
          </span>
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg-1)', lineHeight: 1.25, marginBottom: 12 }}>
            Continue transformando<br />treinos com IA
          </div>
          <div style={{ fontSize: 15, color: 'var(--fg-2)', lineHeight: 1.6 }}>
            Assine o Kinevia Pro e tenha acesso<br />completo a todas as ferramentas.
          </div>
        </div>

        {/* Price card */}
        <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-lg)', padding: '28px 24px', marginBottom: 16 }}>

          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>R$</span>
            <span style={{ fontSize: 42, fontWeight: 700, color: 'var(--fg-1)', lineHeight: 1 }}>49</span>
            <span style={{ fontSize: 14, color: 'var(--fg-3)' }}>/mês</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', marginBottom: 24 }}>
            Preço Early Adopter — cancele quando quiser
          </div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {FEATURES.map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--accent)', fontSize: 14, flexShrink: 0 }}>✦</span>
                <span style={{ fontSize: 14, color: 'var(--fg-2)' }}>{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleSubscribe}
            disabled={loading}
            style={{ width: '100%', height: 50, borderRadius: 999, background: loading ? 'var(--ink-4)' : 'var(--accent)', color: loading ? 'var(--fg-3)' : 'var(--accent-ink)', border: 'none', fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.15s' }}
          >
            {loading ? (
              <>
                <span style={{ width: 16, height: 16, border: '2px solid var(--fg-3)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                Abrindo checkout...
              </>
            ) : 'Assinar agora — R$49/mês'}
          </button>

          {error && (
            <div style={{ marginTop: 12, fontSize: 13, color: '#E07070', textAlign: 'center' }}>{error}</div>
          )}
        </div>

        {/* Logout link */}
        <div style={{ textAlign: 'center' }}>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--fg-4)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            Sair da conta
          </button>
        </div>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
