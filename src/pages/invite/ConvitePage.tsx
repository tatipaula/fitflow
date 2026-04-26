import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getInviteByToken, linkAthleteByInviteToken, saveParqResponse } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { KVLogo, KVButton } from '@/components/ui'
import type { InviteWithAthlete } from '@/types'

const PARQ_QUESTIONS = [
  'Algum médico já disse que você tem problema no coração?',
  'Você sente dor no peito ao praticar atividade física?',
  'No último mês, sentiu dor no peito sem estar praticando atividade física?',
  'Perde equilíbrio por tontura ou já perdeu a consciência?',
  'Tem problema ósseo ou articular que piora com exercício físico?',
  'Toma remédio para pressão arterial ou problema no coração?',
  'Tem alguma outra razão pela qual não deveria praticar atividade física?',
]

export default function ConvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { role } = useAuthStore()

  const [invite, setInvite] = useState<InviteWithAthlete | null>(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState<'notfound' | 'expired' | 'used' | null>(null)

  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const [parqAnswers, setParqAnswers] = useState<(boolean | null)[]>(Array(7).fill(null))
  const allParqAnswered = parqAnswers.every((a) => a !== null)
  const anyParqYes = parqAnswers.some((a) => a === true)

  useEffect(() => {
    if (role === 'athlete') navigate('/athlete', { replace: true })
    if (role === 'trainer') navigate('/trainer', { replace: true })
  }, [role])

  useEffect(() => {
    if (!token) { setInvalid('notfound'); setLoading(false); return }
    getInviteByToken(token).then((inv) => {
      if (!inv) { setInvalid('notfound'); setLoading(false); return }
      if (inv.used_at) { setInvalid('used'); setLoading(false); return }
      if (new Date(inv.expires_at) < new Date()) { setInvalid('expired'); setLoading(false); return }
      setInvite(inv)
      if (inv.athletes?.email) setEmail(inv.athletes.email)
      setLoading(false)
    })
  }, [token])

  function friendlyError(message: string): string {
    if (message.includes('Invalid login credentials')) return 'Email ou senha incorretos.'
    if (message.includes('User already registered')) return 'Este email já tem uma conta. Use a opção Entrar.'
    if (message.includes('Email not confirmed')) return 'Confirme seu email antes de entrar.'
    if (message.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.'
    return 'Algo deu errado. Tente novamente.'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !invite) return
    setError(null); setSubmitting(true)
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email, password,
        options: { data: { role: 'athlete' } },
      })
      if (signUpErr) { setError(friendlyError(signUpErr.message)); return }

      const athleteId = invite.athletes.id
      const answers = parqAnswers as boolean[]

      if (data.session) {
        await linkAthleteByInviteToken(token)
        await saveParqResponse(athleteId, answers)
      } else {
        localStorage.setItem('pending_convite_token', token)
        localStorage.setItem('pending_parq_athlete_id', athleteId)
        localStorage.setItem('pending_parq_answers', JSON.stringify(answers))
        setEmailSent(true)
      }
    } catch {
      setError('Verifique sua conexão e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', height: 42, padding: '0 14px',
    background: 'var(--ink-2)', border: '1px solid var(--ink-4)',
    borderRadius: 'var(--r-md)', fontSize: 14, color: 'var(--fg-1)', outline: 'none',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, color: 'var(--fg-3)',
    fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em',
    textTransform: 'uppercase', marginBottom: 6,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size="lg"/>
      </div>
    )
  }

  if (invalid) {
    const msgs = {
      notfound: { title: 'Link inválido', sub: 'Este link de convite não existe.' },
      expired: { title: 'Link expirado', sub: 'Este convite expirou após 7 dias. Peça um novo ao seu personal trainer.' },
      used: { title: 'Link já utilizado', sub: 'Este convite já foi usado para criar uma conta.' },
    }
    const { title, sub } = msgs[invalid]
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <KVLogo size={32} color="var(--fg-3)"/>
          <p style={{ marginTop: 20, color: 'var(--fg-2)', fontWeight: 500 }}>{title}</p>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--fg-3)' }}>{sub}</p>
        </div>
      </div>
    )
  }

  if (emailSent) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 360, padding: '0 24px', textAlign: 'center' }}>
          <KVLogo size={36}/>
          <div className="display" style={{ fontSize: 28, marginTop: 28, marginBottom: 12 }}>Verifique seu email</div>
          <p style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.6 }}>
            Enviamos um link de confirmação para <strong style={{ color: 'var(--fg-1)' }}>{email}</strong>. Após confirmar, seu acesso será ativado automaticamente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <KVLogo size={38}/>
        </div>

        <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-xl)', padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 40, right: 40, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.4 }}/>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {[1, 2].map((s) => (
              <div key={s} style={{ height: 3, flex: 1, borderRadius: 999, background: step >= s ? 'var(--accent)' : 'var(--ink-4)', transition: 'background 0.2s' }}/>
            ))}
          </div>

          {invite?.athletes?.name && (
            <p style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 20, lineHeight: 1.5 }}>
              Olá, <strong style={{ color: 'var(--fg-1)' }}>{invite.athletes.name}</strong>! Complete o cadastro para acessar seus treinos.
            </p>
          )}

          {/* Step 1: account */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="display" style={{ fontSize: 24, marginBottom: 4 }}>Crie sua senha</div>
              <div>
                <label style={lbl}>Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inp}/>
              </div>
              <div>
                <label style={lbl}>Senha</label>
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={inp}/>
              </div>
              {error && (
                <div style={{ padding: '10px 14px', background: 'color-mix(in oklch, var(--danger), black 70%)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--danger)' }}>
                  {error}
                </div>
              )}
              <button
                type="button"
                disabled={!email || password.length < 6}
                onClick={() => setStep(2)}
                style={{ height: 46, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (!email || password.length < 6) ? 0.5 : 1 }}>
                Continuar
              </button>
            </div>
          )}

          {/* Step 2: PAR-Q */}
          {step === 2 && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ marginBottom: 20 }}>
                <div className="display" style={{ fontSize: 24, marginBottom: 4 }}>PAR-Q</div>
                <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                  Questionário de pré-atividade física. Responda todas as perguntas para continuar.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {PARQ_QUESTIONS.map((q, i) => (
                  <div key={i} style={{ background: 'var(--ink-1)', border: `1px solid ${parqAnswers[i] === true ? 'var(--accent)' : parqAnswers[i] === false ? 'var(--ink-4)' : 'var(--ink-4)'}`, borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, color: 'var(--fg-1)', marginBottom: 10, lineHeight: 1.5 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--accent)', marginRight: 8 }}>{i + 1}</span>
                      {q}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[true, false].map((val) => (
                        <button
                          key={String(val)}
                          type="button"
                          onClick={() => setParqAnswers((p) => { const n = [...p]; n[i] = val; return n })}
                          style={{
                            flex: 1, height: 34, borderRadius: 999, fontSize: 13, fontWeight: 500,
                            background: parqAnswers[i] === val ? (val ? 'color-mix(in oklch, var(--danger), black 50%)' : 'var(--accent-soft)') : 'transparent',
                            color: parqAnswers[i] === val ? (val ? 'var(--danger)' : 'var(--accent)') : 'var(--fg-3)',
                            border: `1px solid ${parqAnswers[i] === val ? (val ? 'var(--danger)' : 'var(--accent)') : 'var(--ink-4)'}`,
                            cursor: 'pointer',
                          }}>
                          {val ? 'Sim' : 'Não'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {anyParqYes && (
                <div style={{ padding: '12px 14px', background: 'color-mix(in oklch, #f59e0b, black 70%)', borderRadius: 'var(--r-md)', fontSize: 13, color: '#f59e0b', marginBottom: 16, lineHeight: 1.5 }}>
                  ⚠ Uma ou mais respostas indicam que você pode se beneficiar de uma avaliação médica antes de iniciar atividades físicas. Consulte um médico se necessário. Você ainda pode concluir o cadastro.
                </div>
              )}

              {error && (
                <div style={{ padding: '10px 14px', background: 'color-mix(in oklch, var(--danger), black 70%)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setStep(1)} style={{ height: 46, padding: '0 18px', borderRadius: 999, background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--ink-4)', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>
                  Voltar
                </button>
                <KVButton type="submit" variant="primary" size="lg" disabled={!allParqAnswered || submitting} style={{ flex: 1, justifyContent: 'center' }}>
                  {submitting ? 'Aguarde...' : 'Concluir cadastro'}
                </KVButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
