import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getAthleteByInviteToken, linkAthleteAccount } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
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

  // Redireciona se já autenticado como atleta
  useEffect(() => {
    if (role === 'athlete') navigate('/athlete', { replace: true })
    if (role === 'trainer') navigate('/trainer', { replace: true })
  }, [role])

  // Busca atleta pelo token
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
    setError(null)
    setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: 'athlete' } },
      })
      if (error) { setError(friendlyError(error.message)); return }

      if (data.session) {
        // Sessão imediata (confirmação de email desativada)
        const linked = await linkAthleteAccount(token)
        if (!linked) setError('Não foi possível vincular sua conta. Tente novamente.')
        // onAuthStateChange + initAuth cuidam do redirect
      } else {
        // Email de confirmação enviado — salva token para vincular após confirmação
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
    setError(null)
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(friendlyError(error.message)); return }
      // Tenta vincular caso ainda não esteja vinculado
      await linkAthleteAccount(token)
      // onAuthStateChange + initAuth cuidam do redirect
    } catch {
      setError('Verifique sua conexão e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingAthlete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 font-medium">Link de convite inválido ou expirado.</p>
          <p className="text-sm text-gray-400 mt-1">Peça um novo link ao seu personal trainer.</p>
        </div>
      </div>
    )
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">FitFlow</h1>
          <p className="text-gray-700 font-medium">Verifique seu email</p>
          <p className="mt-2 text-sm text-gray-500">
            Enviamos um link de confirmação para <strong>{email}</strong>.
            Após confirmar, seu acesso será ativado automaticamente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">FitFlow</h1>
        {athlete && (
          <p className="mb-6 text-sm text-gray-500">
            Olá, <strong>{athlete.name}</strong>! Configure seu acesso abaixo.
          </p>
        )}

        {/* Tabs */}
        <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null) }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Criar senha
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null) }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Já tenho conta
          </button>
        </div>

        <form onSubmit={mode === 'signup' ? handleSignup : handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting
              ? 'Aguarde...'
              : mode === 'signup' ? 'Ativar acesso' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
