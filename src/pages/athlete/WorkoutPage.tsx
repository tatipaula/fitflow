import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { getAthleteWorkouts, getExercises, startSession, completeSession, logSet } from '@/lib/api'
import type { Workout, Exercise } from '@/types'

type SetState = {
  reps: string
  weight: string
  done: boolean
  saving: boolean
}

export default function WorkoutPage() {
  const { athlete, clearAuth } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [sets, setSets] = useState<Record<string, SetState>>({})

  useEffect(() => {
    if (!athlete) { setLoading(false); return }
    async function load() {
      const workouts = await getAthleteWorkouts(athlete!.id)
      const latest = workouts.find((w) => w.status === 'ready') ?? null
      setWorkout(latest)
      if (latest) {
        const ex = await getExercises(latest.id)
        setExercises(ex)
        const initial: Record<string, SetState> = {}
        ex.forEach((e) => {
          for (let s = 1; s <= e.sets; s++) {
            initial[`${e.id}-${s}`] = { reps: String(e.reps), weight: '', done: false, saving: false }
          }
        })
        setSets(initial)
      }
      setLoading(false)
    }
    load()
  }, [athlete])

  async function handleStart() {
    if (!workout || !athlete) return
    setStarting(true)
    setStartError(null)
    const session = await startSession(workout.id, athlete.id)
    if (!session) {
      setStartError('Não foi possível iniciar o treino. Tente novamente.')
      setStarting(false)
      return
    }
    setSessionId(session.id)
    setStarted(true)
    setStarting(false)
  }

  async function handleLogSet(exerciseId: string, setNumber: number) {
    if (!sessionId) return
    const key = `${exerciseId}-${setNumber}`
    const s = sets[key]
    if (!s || s.done || s.saving) return

    setSets((prev) => ({ ...prev, [key]: { ...prev[key], saving: true } }))

    const result = await logSet({
      session_id: sessionId,
      exercise_id: exerciseId,
      set_number: setNumber,
      reps_done: parseInt(s.reps) || 0,
      weight_kg: s.weight ? parseFloat(s.weight) : undefined,
    })

    setSets((prev) => ({
      ...prev,
      [key]: { ...prev[key], done: !!result, saving: false },
    }))
  }

  async function handleComplete() {
    if (!sessionId) return
    setCompleting(true)
    await completeSession(sessionId)
    setCompleted(true)
    setCompleting(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    clearAuth()
  }

  const allSetsDone =
    exercises.length > 0 &&
    exercises.every((e) =>
      Array.from({ length: e.sets }, (_, i) => i + 1).every((s) => sets[`${e.id}-${s}`]?.done)
    )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" message="Carregando..." />
      </div>
    )
  }

  if (completed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-4xl mb-4">✓</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Treino concluído!</h2>
          <p className="text-sm text-gray-500">Ótimo trabalho, {athlete?.name}.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">FitFlow</h1>
          <p className="text-sm text-gray-500">{athlete?.name}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sair
        </button>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        {!workout ? (
          <div className="text-center py-16">
            <p className="text-gray-500 font-medium">Nenhum treino disponível.</p>
            <p className="text-sm text-gray-400 mt-1">
              Aguarde seu personal trainer criar um treino para você.
            </p>
          </div>
        ) : !started ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-400 mb-1">
              {new Date(workout.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Seu treino está pronto</h2>
            <p className="text-sm text-gray-500 mb-6">
              {exercises.length} exercício{exercises.length !== 1 ? 's' : ''}
            </p>
            {startError && (
              <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{startError}</p>
            )}
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {starting ? 'Iniciando...' : 'Iniciar treino'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {exercises.map((ex, exIdx) => (
              <div key={ex.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="mb-3">
                  <h3 className="font-semibold text-gray-900">
                    {exIdx + 1}. {ex.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {ex.sets} séries × {ex.reps} reps — {ex.rest_seconds}s descanso
                  </p>
                  {ex.notes && (
                    <p className="text-xs text-gray-400 mt-0.5">{ex.notes}</p>
                  )}
                </div>

                <div className="space-y-2">
                  {Array.from({ length: ex.sets }, (_, i) => i + 1).map((setNum) => {
                    const key = `${ex.id}-${setNum}`
                    const s = sets[key]
                    if (!s) return null
                    return (
                      <div
                        key={setNum}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition-colors ${
                          s.done
                            ? 'border-green-200 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <span
                          className={`text-sm font-medium w-14 shrink-0 ${
                            s.done ? 'text-green-600' : 'text-gray-500'
                          }`}
                        >
                          Série {setNum}
                        </span>

                        {s.done ? (
                          <span className="flex-1 text-sm text-green-600 font-medium">
                            {s.reps} reps{s.weight ? ` · ${s.weight} kg` : ''}
                          </span>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="0"
                              value={s.reps}
                              onChange={(e) =>
                                setSets((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], reps: e.target.value },
                                }))
                              }
                              className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center outline-none focus:border-blue-500"
                              placeholder="Reps"
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={s.weight}
                              onChange={(e) =>
                                setSets((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], weight: e.target.value },
                                }))
                              }
                              className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center outline-none focus:border-blue-500"
                              placeholder="kg"
                            />
                            <button
                              onClick={() => handleLogSet(ex.id, setNum)}
                              disabled={s.saving || !s.reps}
                              className="ml-auto px-3 py-1 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {s.saving ? '...' : 'Feito'}
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {allSetsDone && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {completing ? 'Salvando...' : 'Concluir treino'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
