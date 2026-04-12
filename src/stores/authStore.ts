import { create } from 'zustand'
import type { AuthState, Athlete, Trainer } from '@/types'
import { getTrainer, getAthleteByAuthId } from '@/lib/api'

interface AuthStore extends AuthState {
  setTrainer: (trainer: Trainer) => void
  setAthlete: (athlete: Athlete) => void
  clearAuth: () => void
  initAuth: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  role: null,
  trainer: null,
  athlete: null,
  loading: true,

  setTrainer: (trainer) => set({ trainer, role: 'trainer', athlete: null }),
  setAthlete: (athlete) => set({ athlete, role: 'athlete', trainer: null }),
  clearAuth: () => set({ role: null, trainer: null, athlete: null, loading: false }),

  initAuth: async (userId: string) => {
    // Atleta tem prioridade: verificar antes de trainer
    // (o trigger cria linha em trainers para todo novo usuário, inclusive atletas)
    const athlete = await getAthleteByAuthId(userId)
    if (athlete) {
      set({ athlete, role: 'athlete', trainer: null, loading: false })
      return
    }
    const trainer = await getTrainer(userId)
    if (trainer) {
      set({ trainer, role: 'trainer', athlete: null, loading: false })
      return
    }
    set({ role: null, trainer: null, athlete: null, loading: false })
  },
}))
