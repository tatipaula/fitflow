import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  getAthletes,
  getWorkouts,
  createAthlete,
  createWorkout,
  processWorkoutAudio,
  getExercises,
} from '@/lib/api'
import type { Athlete, Workout, Exercise } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  transcribing: 'Transcrevendo...',
  parsing: 'Analisando...',
  ready: 'Pronto',
  error: 'Erro',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  transcribing: 'bg-blue-100 text-blue-700',
  parsing: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

export default function DashboardPage() {
  const { trainer, clearAuth } = useAuthStore()
  const [tab, setTab] = useState<'workouts' | 'athletes'>('workouts')
  const [loadingData, setLoadingData] = useState(true)

  // Athletes
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [showAddAthlete, setShowAddAthlete] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [addingAthlete, setAddingAthlete] = useState(false)
  const [athleteError, setAthleteError] = useState<string | null>(null)

  // Workouts
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [selectedAthleteId, setSelectedAthleteId] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [processingError, setProcessingError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  // Workout detail
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null)
  const [exercises, setExercises] = useState<Record<string, Exercise[]>>({})
  const [loadingExercises, setLoadingExercises] = useState(false)

  useEffect(() => {
    if (!trainer) {
      setLoadingData(false)
      return
    }
    Promise.all([getAthletes(trainer.id), getWorkouts(trainer.id)])
      .then(([a, w]) => {
        setAthletes(a)
        setWorkouts(w)
      })
      .catch(console.error)
      .finally(() => setLoadingData(false))
  }, [trainer])

  async function handleSignOut() {
    await supabase.auth.signOut()
    clearAuth()
  }

  async function handleAddAthlete(e: React.FormEvent) {
    e.preventDefault()
    setAthleteError(null)
    setAddingAthlete(true)
    const athlete = await createAthlete(newName, newEmail)
    if (!athlete) {
      setAthleteError('Não foi possível adicionar. Verifique se o email já está cadastrado.')
    } else {
      setAthletes((prev) => [athlete, ...prev])
      setNewName('')
      setNewEmail('')
      setShowAddAthlete(false)
    }
    setAddingAthlete(false)
  }

  async function handleStartRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioFile(new File([blob], `gravacao-${Date.now()}.webm`, { type: 'audio/webm' }))
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start()
      mediaRecorderRef.current = mr
      setIsRecording(true)
    } catch {
      setProcessingError('Não foi possível acessar o microfone.')
    }
  }

  function handleStopRecording() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  async function handleProcessWorkout(e: React.FormEvent) {
    e.preventDefault()
    if (!audioFile || !selectedAthleteId) return
    setProcessing(true)
    setProcessingError(null)
    setProcessingStatus('Criando treino...')

    const workout = await createWorkout({ athlete_id: selectedAthleteId })
    if (!workout) {
      setProcessingError('Não foi possível criar o treino. Tente novamente.')
      setProcessing(false)
      return
    }

    setWorkouts((prev) => [workout, ...prev])
    setProcessingStatus('Transcrevendo áudio (pode levar alguns segundos)...')

    const result = await processWorkoutAudio(workout.id, audioFile)

    if (!result) {
      setProcessingError('Falha ao processar o áudio. Verifique as chaves de API e tente novamente.')
    } else {
      setAudioFile(null)
      setSelectedAthleteId('')
      if (trainer) {
        const updated = await getWorkouts(trainer.id)
        setWorkouts(updated)
      }
    }

    setProcessing(false)
    setProcessingStatus('')
  }

  async function handleToggleWorkout(workout: Workout) {
    if (expandedWorkoutId === workout.id) {
      setExpandedWorkoutId(null)
      return
    }
    setExpandedWorkoutId(workout.id)
    if (workout.status === 'ready' && !exercises[workout.id]) {
      setLoadingExercises(true)
      const ex = await getExercises(workout.id)
      setExercises((prev) => ({ ...prev, [workout.id]: ex }))
      setLoadingExercises(false)
    }
  }

  function copyInviteLink(athlete: Athlete) {
    const link = `${window.location.origin}/invite/${athlete.invite_token}`
    navigator.clipboard.writeText(link)
  }

  if (loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" message="Carregando..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">FitFlow</h1>
          <p className="text-sm text-gray-500">{trainer?.name}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sair
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('workouts')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'workouts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Treinos
          </button>
          <button
            onClick={() => setTab('athletes')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'athletes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Atletas ({athletes.length})
          </button>
        </div>

        {/* ── Workouts Tab ── */}
        {tab === 'workouts' && (
          <div className="space-y-6">
            {/* Create workout */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Novo treino</h2>
              {athletes.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Adicione um atleta na aba <strong>Atletas</strong> antes de criar treinos.
                </p>
              ) : (
                <form onSubmit={handleProcessWorkout} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Atleta</label>
                    <select
                      required
                      value={selectedAthleteId}
                      onChange={(e) => setSelectedAthleteId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Selecione um atleta</option>
                      {athletes.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Áudio do treino</label>
                    <div className="flex flex-wrap gap-2 items-center">
                      {!isRecording ? (
                        <button
                          type="button"
                          onClick={handleStartRecording}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                          Gravar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStopRecording}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-300 text-sm text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                          Parar gravação
                        </button>
                      )}
                      <span className="text-gray-400 text-sm">ou</span>
                      <label className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                        Enviar arquivo
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>
                    {audioFile && (
                      <p className="mt-2 text-sm text-green-600">✓ {audioFile.name}</p>
                    )}
                  </div>

                  {processingError && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{processingError}</p>
                  )}

                  {processing && processingStatus && (
                    <p className="text-sm text-blue-600">{processingStatus}</p>
                  )}

                  <button
                    type="submit"
                    disabled={!audioFile || !selectedAthleteId || processing || isRecording}
                    className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {processing ? 'Processando...' : 'Processar treino'}
                  </button>
                </form>
              )}
            </div>

            {/* Workouts list */}
            <div className="space-y-2">
              {workouts.length === 0 && !processing && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum treino criado ainda.</p>
              )}
              {workouts.map((w) => {
                const athlete = athletes.find((a) => a.id === w.athlete_id)
                const isExpanded = expandedWorkoutId === w.id
                return (
                  <div key={w.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => handleToggleWorkout(w)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{athlete?.name ?? '—'}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(w.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[w.status]}`}>
                          {STATUS_LABEL[w.status]}
                        </span>
                        <span className="text-gray-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3">
                        {w.status === 'ready' && (
                          loadingExercises && !exercises[w.id] ? (
                            <LoadingSpinner size="sm" message="Carregando exercícios..." />
                          ) : (exercises[w.id] ?? []).length === 0 ? (
                            <p className="text-sm text-gray-400">Nenhum exercício encontrado.</p>
                          ) : (
                            <ul className="space-y-2">
                              {(exercises[w.id] ?? []).map((ex, i) => (
                                <li key={ex.id} className="text-sm">
                                  <span className="font-medium text-gray-800">{i + 1}. {ex.name}</span>
                                  <span className="text-gray-500 ml-2">
                                    {ex.sets} séries × {ex.reps} reps — {ex.rest_seconds}s descanso
                                  </span>
                                  {ex.notes && (
                                    <p className="text-xs text-gray-400 mt-0.5 ml-4">{ex.notes}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )
                        )}
                        {w.status === 'error' && (
                          <p className="text-sm text-red-500">Falha ao processar o treino.</p>
                        )}
                        {(w.status === 'transcribing' || w.status === 'parsing') && (
                          <LoadingSpinner size="sm" message={STATUS_LABEL[w.status]} />
                        )}
                        {w.status === 'pending' && (
                          <p className="text-sm text-gray-400">Aguardando processamento.</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Athletes Tab ── */}
        {tab === 'athletes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Seus atletas</h2>
              <button
                onClick={() => { setShowAddAthlete(true); setAthleteError(null) }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + Adicionar
              </button>
            </div>

            {showAddAthlete && (
              <form onSubmit={handleAddAthlete} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Novo atleta</h3>
                <input
                  type="text"
                  required
                  placeholder="Nome"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {athleteError && <p className="text-sm text-red-600">{athleteError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={addingAthlete}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingAthlete ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddAthlete(false); setAthleteError(null) }}
                    className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {athletes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum atleta cadastrado.</p>
            ) : (
              <ul className="space-y-2">
                {athletes.map((a) => (
                  <li
                    key={a.id}
                    className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </div>
                    <button
                      onClick={() => copyInviteLink(a)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Copiar link
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
