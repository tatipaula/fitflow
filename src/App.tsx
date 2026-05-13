import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { linkAthleteAccount, linkAthleteByInviteToken, saveParqResponse } from '@/lib/api'
import { registerPush } from '@/lib/push'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import LoginPage from '@/pages/auth/LoginPage'
import InvitePage from '@/pages/invite/InvitePage'
import ConvitePage from '@/pages/invite/ConvitePage'
import DashboardPage from '@/pages/trainer/DashboardPage'
import WorkoutPage from '@/pages/athlete/WorkoutPage'

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
          element={role === 'trainer' ? <DashboardPage /> : <Navigate to="/login" replace />}
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
