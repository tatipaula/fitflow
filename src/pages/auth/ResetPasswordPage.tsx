import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { KVLogo, KVButton } from '@/components/ui'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 42, padding: '0 14px',
    background: 'var(--ink-2)', border: '1px solid var(--ink-4)',
    borderRadius: 'var(--r-md)', fontSize: 14, color: 'var(--fg-1)',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, color: 'var(--fg-3)',
    fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em',
    textTransform: 'uppercase', marginBottom: 6,
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setError(null)
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError('Link inválido ou expirado. Solicite um novo link de recuperação.')
      } else {
        setDone(true)
        setTimeout(async () => {
          await supabase.auth.signOut()
          navigate('/login')
        }, 2500)
      }
    } catch {
      setError('Verifique sua conexão e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 360, padding: '0 24px', textAlign: 'center' }}>
          <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'center' }}>
            <KVLogo size={36}/>
          </div>
          <div className="display" style={{ fontSize: 28, marginBottom: 12 }}>Senha redefinida!</div>
          <p style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.6 }}>
            Sua senha foi atualizada com sucesso. Redirecionando para o login...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <KVLogo size={40}/>
        </div>

        <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-xl)', padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 40, right: 40, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.4 }}/>

          <div className="display" style={{ fontSize: 30, marginBottom: 6 }}>Nova senha</div>
          <p style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 28 }}>
            Escolha uma nova senha para sua conta.
          </p>

          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nova senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirmar senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'color-mix(in oklch, var(--danger), black 70%)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            <KVButton type="submit" variant="primary" size="lg" disabled={submitting} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
              {submitting ? 'Salvando...' : 'Salvar nova senha'}
            </KVButton>
          </form>
        </div>
      </div>
    </div>
  )
}
