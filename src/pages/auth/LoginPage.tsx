import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { FFLogo, FFButton } from '@/components/ui'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const navigate = useNavigate()
  const { role } = useAuthStore()

  useEffect(() => {
    if (role) navigate(`/${role}`, { replace: true })
  }, [role])

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function friendlyError(message: string): string {
    if (message.includes('Invalid login credentials')) return 'Email ou senha incorretos.'
    if (message.includes('User already registered')) return 'Este email já está cadastrado.'
    if (message.includes('Email not confirmed')) return 'Confirme seu email antes de entrar.'
    if (message.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.'
    return 'Algo deu errado. Verifique sua conexão e tente novamente.'
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(friendlyError(error.message))
    } catch {
      setError('Verifique sua conexão e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name } },
      })
      if (error) { setError(friendlyError(error.message)); return }
      if (!data.session) setEmailSent(true)
    } catch {
      setError('Verifique sua conexão e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

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

  if (emailSent) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 360, padding: '0 24px', textAlign: 'center' }}>
          <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'center' }}>
            <FFLogo size={36}/>
          </div>
          <div className="display" style={{ fontSize: 28, marginBottom: 12 }}>Verifique seu email</div>
          <p style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.6 }}>
            Enviamos um link de confirmação para <strong style={{ color: 'var(--fg-1)' }}>{email}</strong>. Clique no link para ativar sua conta.
          </p>
          <button
            onClick={() => { setEmailSent(false); setMode('login') }}
            style={{ marginTop: 24, fontSize: 12, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Voltar para o login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <FFLogo size={40}/>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-xl)', padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
          {/* hairline */}
          <div style={{ position: 'absolute', top: 0, left: 40, right: 40, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.4 }}/>

          <div className="display" style={{ fontSize: 30, marginBottom: 6 }}>
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </div>
          <p style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 28 }}>
            {mode === 'login' ? 'Entre com seu email e senha.' : 'Comece a usar o FitFlow.'}
          </p>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--ink-1)', borderRadius: 999, marginBottom: 24 }}>
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                style={{
                  flex: 1, height: 32, borderRadius: 999, fontSize: 12, fontWeight: 500, letterSpacing: 0.02,
                  background: mode === m ? 'var(--ink-3)' : 'transparent',
                  color: mode === m ? 'var(--fg-1)' : 'var(--fg-3)',
                  border: mode === m ? '1px solid var(--ink-4)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'signup' && (
              <div>
                <label style={labelStyle}>Nome</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" style={inputStyle}/>
              </div>
            )}
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle}/>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'color-mix(in oklch, var(--danger), black 70%)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            <FFButton type="submit" variant="primary" size="lg" disabled={submitting} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
              {submitting
                ? (mode === 'login' ? 'Entrando...' : 'Criando conta...')
                : (mode === 'login' ? 'Entrar' : 'Criar conta')}
            </FFButton>
          </form>
        </div>
      </div>
    </div>
  )
}
