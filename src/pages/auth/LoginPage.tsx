import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

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
      // Se sucesso: onAuthStateChange em App.tsx detecta e redireciona automaticamente
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
        email,
        password,
        options: { data: { name } },
      })
      if (error) {
        setError(friendlyError(error.message))
        return
      }
      // Sem sessão = email de confirmação enviado
      if (!data.session) {
        setEmailSent(true)
      }
      // Se session existe: onAuthStateChange detecta e redireciona automaticamente
    } catch {
      setError('Verifique sua conexão e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">FitFlow</h1>
          <p className="text-gray-700 font-medium">Verifique seu email</p>
          <p className="mt-2 text-sm text-gray-500">
            Enviamos um link de confirmação para <strong>{email}</strong>. Clique no link para ativar
            sua conta e entrar.
          </p>
          <button
            onClick={() => { setEmailSent(false); setMode('login') }}
            className="mt-6 text-sm text-blue-600 hover:underline"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">FitFlow</h1>

        {/* Tabs */}
        <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null) }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null) }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
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
              ? mode === 'login' ? 'Entrando...' : 'Criando conta...'
              : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  )
}
