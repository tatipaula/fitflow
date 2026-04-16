import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { getAthleteWorkouts, getExercises, startSession, completeSession, logSet, getAthleteSessions } from '@/lib/api'
import { getYouTubeEmbedUrl } from '@/lib/youtube'
import type { Workout, Exercise, SessionWithLogs } from '@/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type SetState = {
  reps: string
  weight: string
  done: boolean
  saving: boolean
}

type RestTimer = {
  remaining: number
  total: number
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
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [tab, setTab] = useState<'treino' | 'historico'>('treino')
  const [sessions, setSessions] = useState<SessionWithLogs[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

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
            initial[`${e.id}-${s}`] = {
              reps: String(e.reps),
              weight: e.weight_kg ? String(e.weight_kg) : '',
              done: false,
              saving: false,
            }
          }
        })
        setSets(initial)
      }
      const s = await getAthleteSessions(athlete!.id)
      setSessions(s)
      setLoading(false)
    }
    load()
  }, [athlete])

  useEffect(() => {
    if (!restTimer || restTimer.remaining <= 0) {
      if (restTimer?.remaining === 0) setRestTimer(null)
      return
    }
    timerRef.current = setTimeout(() => {
      setRestTimer((t) => t ? { ...t, remaining: t.remaining - 1 } : null)
    }, 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [restTimer])

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

    if (result) {
      const exercise = exercises.find((e) => e.id === exerciseId)
      if (exercise && exercise.rest_seconds > 0) {
        setRestTimer({ remaining: exercise.rest_seconds, total: exercise.rest_seconds })
      }
    }
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

  // Último peso registrado por nome de exercício (para sugestão de peso)
  const lastWeightByName = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of sessions) {
      for (const log of s.set_logs) {
        if (!log.deleted && log.weight_kg !== null && !(log.exercises.name in map)) {
          map[log.exercises.name] = log.weight_kg
        }
      }
    }
    return map
  }, [sessions])

  // Agrupa set_logs por nome de exercício para os gráficos de evolução
  // DEVE ficar antes de qualquer early return para não violar Rules of Hooks
  const evolutionByExercise = useMemo(() => {
    const map: Record<string, { date: string; maxWeight: number | null; avgReps: number }[]> = {}
    ;[...sessions].reverse().forEach((s) => {
      const date = new Date(s.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      const byExercise: Record<string, { reps: number[]; weights: (number | null)[] }> = {}
      s.set_logs.filter((l) => !l.deleted).forEach((log) => {
        const name = log.exercises.name
        if (!byExercise[name]) byExercise[name] = { reps: [], weights: [] }
        byExercise[name].reps.push(log.reps_done)
        byExercise[name].weights.push(log.weight_kg)
      })
      Object.entries(byExercise).forEach(([name, { reps, weights }]) => {
        if (!map[name]) map[name] = []
        const validWeights = weights.filter((w): w is number => w !== null)
        map[name].push({
          date,
          maxWeight: validWeights.length > 0 ? Math.max(...validWeights) : null,
          avgReps: Math.round(reps.reduce((a, b) => a + b, 0) / reps.length),
        })
      })
    })
    return map
  }, [sessions])

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
          <p className="text-sm text-gray-500 mb-6">Ótimo trabalho, {athlete?.name}.</p>
          <button
            onClick={async () => {
              if (athlete) {
                const s = await getAthleteSessions(athlete.id)
                setSessions(s)
              }
              setCompleted(false)
              setStarted(false)
              setSessionId(null)
              setTab('historico')
            }}
            className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Ver meu histórico
          </button>
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

      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-lg mx-auto px-6 flex gap-6">
          {(['treino', 'historico'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {t === 'treino' ? 'Treino' : 'Histórico'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-6 py-8">
        {tab === 'historico' ? (
          sessions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 font-medium">Nenhuma sessão concluída ainda.</p>
              <p className="text-sm text-gray-400 mt-1">Complete seu primeiro treino para ver o histórico.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {sessions.map((s) => {
                  const isExpanded = expandedSession === s.id
                  const activeLogs = s.set_logs.filter((l) => !l.deleted)
                  return (
                    <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setExpandedSession(isExpanded ? null : s.id)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(s.started_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-sm text-gray-500">{activeLogs.length} série{activeLogs.length !== 1 ? 's' : ''} registrada{activeLogs.length !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && activeLogs.length > 0 && (() => {
                        const byExercise: Record<string, { sets: number; maxWeight: number | null }> = {}
                        activeLogs.forEach((log) => {
                          const name = log.exercises.name
                          if (!byExercise[name]) byExercise[name] = { sets: 0, maxWeight: null }
                          byExercise[name].sets += 1
                          if (log.weight_kg !== null) {
                            byExercise[name].maxWeight = byExercise[name].maxWeight === null
                              ? log.weight_kg
                              : Math.max(byExercise[name].maxWeight, log.weight_kg)
                          }
                        })
                        return (
                          <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2">
                            {Object.entries(byExercise).map(([name, { sets, maxWeight }]) => (
                              <div key={name} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700 font-medium">{name}</span>
                                <span className="text-gray-500">
                                  {sets} série{sets !== 1 ? 's' : ''}
                                  {maxWeight !== null ? ` · máx ${maxWeight} kg` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>

              {Object.keys(evolutionByExercise).length > 0 && (
                <div className="mt-8 space-y-6">
                  <h2 className="text-base font-semibold text-gray-900">Evolução por exercício</h2>
                  {Object.entries(evolutionByExercise).map(([name, data]) => (
                    <div key={name} className="bg-white rounded-2xl border border-gray-200 p-4">
                      <p className="text-sm font-medium text-gray-700 mb-3">{name}</p>
                      {data.some((d) => d.maxWeight !== null) && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-400 mb-1">Peso máximo (kg)</p>
                          <ResponsiveContainer width="100%" height={120}>
                            <LineChart data={data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} width={30} />
                              <Tooltip />
                              <Line type="monotone" dataKey="maxWeight" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="kg" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Média de reps</p>
                        <ResponsiveContainer width="100%" height={120}>
                          <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} width={30} />
                            <Tooltip />
                            <Line type="monotone" dataKey="avgReps" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="reps" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        ) : !workout ? (
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
                  {ex.youtube_video_id && (
                    <div className="mt-3 rounded-xl overflow-hidden aspect-video">
                      <iframe
                        src={getYouTubeEmbedUrl(ex.youtube_video_id)}
                        title={ex.name}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
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
                              placeholder={
                                lastWeightByName[ex.name]
                                  ? String(lastWeightByName[ex.name])
                                  : 'kg'
                              }
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

      {restTimer && (
        <div className="fixed bottom-0 inset-x-0 bg-gray-900 text-white px-6 py-4 flex items-center justify-between shadow-2xl">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Descanso</p>
            <p className="text-3xl font-bold tabular-nums">
              {String(Math.floor(restTimer.remaining / 60)).padStart(2, '0')}:
              {String(restTimer.remaining % 60).padStart(2, '0')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                style={{ width: `${(restTimer.remaining / restTimer.total) * 100}%` }}
              />
            </div>
            <button
              onClick={() => setRestTimer(null)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Pular
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
