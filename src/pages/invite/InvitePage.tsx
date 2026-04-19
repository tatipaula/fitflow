import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getAthleteByInviteToken, linkAthleteAccount } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { FFLogo, FFButton } from '@/components/ui'
import type { Athlete } from '@/types'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { role } = useAuthStore()

  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [loadingAthlete, setLoadingAthlete] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    if (role === 'athlete') navigate('/athlete', { replace: true })
    if (role === 'trainer') navigate('/trainer', { replace: true })
  }, [role])

  useEffect(() => {
    if (!token) { setNotFound(true); setLoadingAthlete(false); return }
    getAthleteByInviteToken(token).then((a) => {
      if (!a) setNotFound(true)
      else { setAthlete(a); setEmail(a.email) }
      setLoadingAthlete(false)
    })
  }, [token])

  function friendlyError(message: string): string {
    if (message.includes('Invalid login credentials')) return 'Email ou senha incorretos.'
    if (message.includes('User already registered')) return 'Este email já tem uma conta. Use a opção Entrar.'
    if (message.includes('Email not confirmed')) return 'Confirme seu email antes de entrar.'
    if (message.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.'
    return 'Algo deu errado. Verifique sua conexão e tente novamente.'
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null); setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { role: 'athlete' } },
      })
      if (error) { setError(friendlyError(error.message)); return }
      if (data.session) {
        const linked = await linkAthleteAccount(token)
        if (!linked) setError('Não foi possível vincular sua conta. Tente novamente.')
      } else {
        localStorage.setItem('pending_invite_token', token)
        setEmailSent(true)
      }
    } catch {
      setError('Verifique sua conexão e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null); setSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(friendlyError(error.message)); return }
      await linkAthleteAccount(token)
    } catch {
      setError('Verifique sua conexão e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 42, padding: '0 14px',
    background: 'var(--ink-2)', border: '1px solid var(--ink-4)',
    borderRadius: 'var(--r-md)', fontSize: 14, color: 'var(--fg-1)', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, color: 'var(--fg-3)',
    fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em',
    textTransform: 'uppercase', marginBottom: 6,
  }

  if (loadingAthlete) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size="lg"/>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <FFLogo size={32} color="var(--fg-3)"/>
          <p style={{ marginTop: 20, color: 'var(--fg-2)', fontWeight: 500 }}>Link de convite inválido ou expirado.</p>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--fg-3)' }}>Peça um novo link ao seu personal trainer.</p>
        </div>
      </div>
    )
  }

  if (emailSent) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 360, padding: '0 24px', textAlign: 'center' }}>
          <FFLogo size={36}/>
          <div className="display" style={{ fontSize: 28, marginTop: 28, marginBottom: 12 }}>Verifique seu email</div>
          <p style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.6 }}>
            Enviamos um link de confirmação para <strong style={{ color: 'var(--fg-1)' }}>{email}</strong>. Após confirmar, seu acesso será ativado.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <FFLogo size={38}/>
        </div>

        <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-xl)', padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 40, right: 40, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.4 }}/>

          <div className="display" style={{ fontSize: 28, marginBottom: 4 }}>Bem-vindo</div>
          {athlete && (
            <p style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 24, lineHeight: 1.5 }}>
              Olá, <strong style={{ color: 'var(--fg-1)' }}>{athlete.name}</strong>! Configure seu acesso abaixo.
            </p>
          )}

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--ink-1)', borderRadius: 999, marginBottom: 24 }}>
            {(['signup', 'login'] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null) }}
                style={{
                  flex: 1, height: 32, borderRadius: 999, fontSize: 12, fontWeight: 500,
                  background: mode === m ? 'var(--ink-3)' : 'transparent',
                  color: mode === m ? 'var(--fg-1)' : 'var(--fg-3)',
                  border: mode === m ? '1px solid var(--ink-4)' : '1px solid transparent',
                  cursor: 'pointer',
                }}>
                {m === 'signup' ? 'Criar senha' : 'Já tenho conta'}
              </button>
            ))}
          </div>

          <form onSubmit={mode === 'signup' ? handleSignup : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle}/>
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
              {submitting ? 'Aguarde...' : (mode === 'signup' ? 'Ativar acesso' : 'Entrar')}
            </FFButton>
          </form>
        </div>
      </div>
    </div>
  )
}
