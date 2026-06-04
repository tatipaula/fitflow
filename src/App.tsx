import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { linkAthleteAccount, linkAthleteByInviteToken, saveParqResponse, updateAthleteProfile, hasActiveAccess, getTrainer } from '@/lib/api'
import { registerPush } from '@/lib/push'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import LoginPage from '@/pages/auth/LoginPage'
import InvitePage from '@/pages/invite/InvitePage'
import ConvitePage from '@/pages/invite/ConvitePage'
import DashboardPage from '@/pages/trainer/DashboardPage'
import PaywallPage from '@/pages/trainer/PaywallPage'
import WorkoutPage from '@/pages/athlete/WorkoutPage'

function TrainerRoute() {
  const trainer    = useAuthStore((s) => s.trainer)
  const setTrainer = useAuthStore((s) => s.setTrainer)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('payment_pending') !== '1') return
    if (!trainer) return
    setPolling(true)
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      const fresh = await getTrainer(trainer.id)
      if ((fresh && fresh.plan === 'pro') || attempts >= 10) {
        sessionStorage.removeItem('payment_pending')
        if (fresh) setTrainer(fresh)
        setPolling(false)
        clearInterval(interval)
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [trainer?.id])

  if (polling) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 28, height: 28, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <div style={{ fontSize: 14, color: 'var(--fg-2)' }}>Confirmando pagamento...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (trainer && !hasActiveAccess(trainer)) return <PaywallPage />
  return <DashboardPage />
}

export default function App() {
  const { role, loading, initAuth, clearAuth } = useAuthStore()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // setTimeout evita deadlock: o JWT precisa ser commitado antes de queries ao banco
        setTimeout(async () => {
          // Se há um invite token pendente (confirmação de email de atleta), vincula primeiro
          const pendingToken = localStorage.getItem('pending_invite_token')
          if (pendingToken) {
            await linkAthleteAccount(pendingToken)
            localStorage.removeItem('pending_invite_token')
          }

          const pendingConviteToken = localStorage.getItem('pending_convite_token')
          if (pendingConviteToken) {
            await linkAthleteByInviteToken(pendingConviteToken)
            localStorage.removeItem('pending_convite_token')
          }

          const pendingParqAnswers = localStorage.getItem('pending_parq_answers')
          const pendingParqAthleteId = localStorage.getItem('pending_parq_athlete_id')
          if (pendingParqAnswers && pendingParqAthleteId) {
            await saveParqResponse(pendingParqAthleteId, JSON.parse(pendingParqAnswers))
            localStorage.removeItem('pending_parq_answers')
            localStorage.removeItem('pending_parq_athlete_id')
          }

          const pendingPhysical = localStorage.getItem('pending_parq_physical')
          if (pendingPhysical && pendingParqAthleteId) {
            await updateAthleteProfile(pendingParqAthleteId, JSON.parse(pendingPhysical))
            localStorage.removeItem('pending_parq_physical')
          }

          // Se voltou do Stripe, ativa polling para aguardar webhook
          const params = new URLSearchParams(window.location.search)
          if (params.get('payment') === 'success') {
            sessionStorage.setItem('payment_pending', '1')
            window.history.replaceState({}, '', '/trainer')
          }

          initAuth(session.user.id)
          registerPush()
        }, 0)
      } else {
        clearAuth()
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" message="Carregando..." />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/convite/:token" element={<ConvitePage />} />
        <Route
          path="/trainer"
          element={role === 'trainer' ? <TrainerRoute /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/athlete"
          element={role === 'athlete' ? <WorkoutPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="*"
          element={<Navigate to={role ? `/${role}` : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}
