import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { FFWordmark, FFMeter, FFAvatar, FFIcon } from '@/components/ui'
import {
  getAthletes, getWorkouts, createAthlete, createWorkout,
  processWorkoutAudio, processWorkoutText, getExercises,
  updateWorkoutName, deleteWorkout, updateExercise,
} from '@/lib/api'
import { getYouTubeEmbedUrl } from '@/lib/youtube'
import type { Athlete, Workout, Exercise } from '@/types'

type TrainerView = 'home' | 'athletes' | 'workouts' | 'recording' | 'processing'

const NAV_ITEMS: { key: TrainerView; label: string; icon: (c?: string) => JSX.Element }[] = [
  { key: 'home',     label: 'Dashboard', icon: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { key: 'athletes', label: 'Alunos',    icon: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" strokeLinecap="round"/><path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87" strokeLinecap="round"/></svg> },
  { key: 'workouts', label: 'Treinos',   icon: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="9" width="3" height="6" rx="0.5"/><rect x="19" y="9" width="3" height="6" rx="0.5"/><rect x="5" y="10.5" width="2" height="3"/><rect x="17" y="10.5" width="2" height="3"/><path d="M7 12h10"/></svg> },
]

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return isMobile
}

const PIPELINE_STEPS = [
  { key: 'upload',  label: 'Áudio enviado' },
  { key: 'whisper', label: 'Whisper · pt-BR',          sub: 'transcrição do áudio' },
  { key: 'claude',  label: 'Claude Haiku · estruturação', sub: 'identificando exercícios' },
  { key: 'youtube', label: 'YouTube API · demonstrações', sub: 'buscando vídeos' },
  { key: 'compose', label: 'Compondo ficha final' },
]

function getStepState(status: string, stepKey: string): 'done' | 'active' | 'pending' {
  const order = ['upload', 'whisper', 'claude', 'youtube', 'compose']
  const idx = order.indexOf(stepKey)
  if (status === 'ready') return idx <= 4 ? 'done' : 'pending'
  if (status === 'transcribing') return idx === 0 ? 'done' : idx === 1 ? 'active' : 'pending'
  if (status === 'parsing')      return idx <= 1 ? 'done' : idx === 2 ? 'active' : 'pending'
  if (status === 'pending')      return idx === 0 ? 'active' : 'pending'
  return 'pending'
}

export default function DashboardPage() {
  const { trainer, clearAuth } = useAuthStore()
  const isMobile = useIsMobile()
  const [view, setView] = useState<TrainerView>('home')
  const [loadingData, setLoadingData] = useState(true)

  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [showAddAthlete, setShowAddAthlete] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [addingAthlete, setAddingAthlete] = useState(false)
  const [athleteError, setAthleteError] = useState<string | null>(null)
  const [athleteSearch, setAthleteSearch] = useState('')

  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [selectedAthleteId, setSelectedAthleteId] = useState('')
  const [workoutName, setWorkoutName] = useState('')
  const [inputMode, setInputMode] = useState<'audio' | 'text'>('audio')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [workoutText, setWorkoutText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [processingWorkout, setProcessingWorkout] = useState<Workout | null>(null)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const [waveformBars, setWaveformBars] = useState<number[]>(() =>
    Array.from({ length: 60 }, (_, i) => Math.max(0.1, Math.sin(i * 0.4) * 0.5 + 0.4))
  )
  const [detectedExercises, setDetectedExercises] = useState<Exercise[]>([])

  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null)
  const [exercises, setExercises] = useState<Record<string, Exercise[]>>({})
  const [loadingExercises, setLoadingExercises] = useState(false)
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null)

  type ExerciseEditState = { sets: string; reps: string; weight_kg: string; rest_seconds: string; notes: string }
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)
  const [exerciseEdit, setExerciseEdit] = useState<ExerciseEditState>({ sets: '', reps: '', weight_kg: '', rest_seconds: '', notes: '' })
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null)

  useEffect(() => {
    if (!trainer) { setLoadingData(false); return }
    Promise.all([getAthletes(trainer.id), getWorkouts(trainer.id)])
      .then(([a, w]) => { setAthletes(a); setWorkouts(w) })
      .catch(console.error)
      .finally(() => setLoadingData(false))
  }, [trainer])

  useEffect(() => {
    if (!isRecording) { setRecordingSeconds(0); return }
    const t = setInterval(() => setRecordingSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [isRecording])

  useEffect(() => {
    if (!isRecording) return
    const t = setInterval(() => {
      setWaveformBars((p) => { const n = [...p]; n.shift(); n.push(Math.max(0.1, Math.random() * 0.9 + 0.1)); return n })
    }, 80)
    return () => clearInterval(t)
  }, [isRecording])

  async function handleSignOut() { await supabase.auth.signOut(); clearAuth() }

  async function handleAddAthlete(e: React.FormEvent) {
    e.preventDefault(); setAthleteError(null); setAddingAthlete(true)
    const a = await createAthlete(newName, newEmail)
    if (!a) setAthleteError('Não foi possível adicionar.')
    else { setAthletes((p) => [a, ...p]); setNewName(''); setNewEmail(''); setShowAddAthlete(false) }
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
      mr.start(); mediaRecorderRef.current = mr; setIsRecording(true)
    } catch { setProcessingError('Não foi possível acessar o microfone.') }
  }

  function handleStopRecording() { mediaRecorderRef.current?.stop(); setIsRecording(false) }

  async function handleProcessWorkout() {
    if (!selectedAthleteId) return
    if (inputMode === 'audio' && !audioFile) return
    if (inputMode === 'text' && !workoutText.trim()) return
    setProcessing(true); setProcessingError(null); setDetectedExercises([])
    const workout = await createWorkout({ athlete_id: selectedAthleteId, name: workoutName.trim() || undefined })
    if (!workout) { setProcessingError('Não foi possível criar o treino.'); setProcessing(false); return }
    setProcessingWorkout(workout); setWorkouts((p) => [workout, ...p]); setView('processing')
    const result = inputMode === 'text'
      ? await processWorkoutText(workout.id, workoutText, selectedAthleteId)
      : await processWorkoutAudio(workout.id, audioFile!, selectedAthleteId)
    if (!result) { setProcessingError('Falha ao processar. Verifique as chaves de API.'); setProcessing(false); return }
    if (trainer) { const updated = await getWorkouts(trainer.id); setWorkouts(updated); setDetectedExercises(await getExercises(workout.id)) }
    supabase.functions.invoke('notify-athlete', { body: { workout_id: workout.id } })
    setAudioFile(null); setWorkoutText(''); setWorkoutName(''); setProcessing(false)
  }

  async function handleToggleWorkout(workout: Workout) {
    if (expandedWorkoutId === workout.id) { setExpandedWorkoutId(null); return }
    setExpandedWorkoutId(workout.id)
    if (workout.status === 'ready' && !exercises[workout.id]) {
      setLoadingExercises(true)
      const ex = await getExercises(workout.id)
      setExercises((p) => ({ ...p, [workout.id]: ex }))
      setLoadingExercises(false)
    }
  }

  async function handleSaveWorkoutName(id: string) {
    const ok = await updateWorkoutName(id, editingName.trim())
    if (ok) setWorkouts((p) => p.map((w) => w.id === id ? { ...w, name: editingName.trim() } : w))
    setEditingWorkoutId(null)
  }

  async function handleDeleteWorkout(id: string) {
    const ok = await deleteWorkout(id)
    if (ok) {
      setWorkouts((p) => p.filter((w) => w.id !== id))
      if (expandedWorkoutId === id) setExpandedWorkoutId(null)
    }
    setDeletingWorkoutId(null)
  }

  function startEditExercise(ex: Exercise) {
    setEditingExerciseId(ex.id)
    setExerciseEdit({
      sets: String(ex.sets),
      reps: String(ex.reps),
      weight_kg: ex.weight_kg != null ? String(ex.weight_kg) : '',
      rest_seconds: String(ex.rest_seconds),
      notes: ex.notes ?? '',
    })
  }

  async function handleSaveExercise(workoutId: string, exId: string) {
    const ok = await updateExercise(exId, {
      sets: parseInt(exerciseEdit.sets) || 1,
      reps: parseInt(exerciseEdit.reps) || 1,
      weight_kg: exerciseEdit.weight_kg ? parseFloat(exerciseEdit.weight_kg) : null,
      rest_seconds: parseInt(exerciseEdit.rest_seconds) || 60,
      notes: exerciseEdit.notes.trim() || null,
    })
    if (ok) {
      setExercises((prev) => ({
        ...prev,
        [workoutId]: (prev[workoutId] ?? []).map((e) =>
          e.id === exId ? {
            ...e,
            sets: parseInt(exerciseEdit.sets) || 1,
            reps: parseInt(exerciseEdit.reps) || 1,
            weight_kg: exerciseEdit.weight_kg ? parseFloat(exerciseEdit.weight_kg) : null,
            rest_seconds: parseInt(exerciseEdit.rest_seconds) || 60,
            notes: exerciseEdit.notes.trim() || null,
          } : e
        ),
      }))
    }
    setEditingExerciseId(null)
  }

  function copyInviteLink(a: Athlete) { navigator.clipboard.writeText(`${window.location.origin}/invite/${a.invite_token}`) }

  const recMin = String(Math.floor(recordingSeconds / 60)).padStart(2, '0')
  const recSec = String(recordingSeconds % 60).padStart(2, '0')
  const selectedAthlete = athletes.find((a) => a.id === selectedAthleteId)
  const processingStatus = processingWorkout ? (workouts.find((w) => w.id === processingWorkout.id)?.status ?? processingWorkout.status) : ''

  if (loadingData) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size="lg" message="Carregando..."/>
      </div>
    )
  }

  // ── Layout shell ──────────────────────────────────────────────────────────
  const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-lg)', ...style }}>
      {children}
    </div>
  )

  const inp: React.CSSProperties = { width: '100%', height: 44, padding: '0 14px', background: 'var(--ink-1)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', fontSize: 14, color: 'var(--fg-1)', outline: 'none' }

  // ── Sidebar (desktop) ─────────────────────────────────────────────────────
  const sidebar = !isMobile && (
    <div style={{ width: 220, minHeight: '100vh', background: 'var(--ink-1)', borderRight: '1px solid var(--ink-4)', padding: '24px 14px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '0 8px 28px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <FFWordmark size={15}/>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {NAV_ITEMS.map(({ key, label, icon }) => {
          const active = view === key || (key === 'workouts' && (view === 'recording' || view === 'processing'))
          return (
            <button key={key} onClick={() => setView(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--r-md)', background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent)' : 'var(--fg-2)', fontSize: 14, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              {icon(active ? 'var(--accent)' : 'var(--fg-2)')}
              {label}
            </button>
          )
        })}
      </div>
      <div style={{ padding: '16px 0 8px', borderTop: '1px solid var(--ink-4)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => setView('recording')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
          {FFIcon.mic(16, 'var(--accent-ink)')} Novo Treino
        </button>
        <button onClick={handleSignOut} style={{ fontSize: 12, color: 'var(--fg-1)', background: 'none', border: '1px solid var(--fg-2)', borderRadius: 999, cursor: 'pointer', padding: '6px 14px', fontFamily: "'JetBrains Mono', monospace', width: '100%'" }}>
          Sair
        </button>
      </div>
    </div>
  )

  // ── Mobile header ─────────────────────────────────────────────────────────
  const mobileHeader = isMobile && (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--ink-4)', background: 'var(--ink-1)', position: 'sticky', top: 0, zIndex: 40 }}>
      <FFWordmark size={14}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setView('recording')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {FFIcon.mic(14, 'var(--accent-ink)')} Novo Treino
        </button>
        <button onClick={handleSignOut}
          style={{ height: 38, padding: '0 12px', borderRadius: 999, background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--fg-2)', fontSize: 12, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>
          Sair
        </button>
      </div>
    </div>
  )

  // ── Mobile bottom nav ─────────────────────────────────────────────────────
  const mobileBottomNav = isMobile && (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ink-1)', borderTop: '1px solid var(--ink-4)', display: 'flex', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {NAV_ITEMS.map(({ key, label, icon }) => {
        const active = view === key || (key === 'workouts' && (view === 'recording' || view === 'processing'))
        return (
          <button key={key} onClick={() => setView(key)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 4px', background: 'none', border: 'none', color: active ? 'var(--accent)' : 'var(--fg-3)', fontSize: 10, cursor: 'pointer' }}>
            {icon(active ? 'var(--accent)' : 'var(--fg-3)')}
            {label}
          </button>
        )
      })}
    </div>
  )

  const contentPad = isMobile ? '20px 20px' : '32px 40px'
  const contentStyle: React.CSSProperties = { flex: 1, overflow: 'auto', padding: contentPad, paddingBottom: isMobile ? '90px' : '40px' }

  // ── HOME VIEW ─────────────────────────────────────────────────────────────
  const homeView = (
    <div style={contentStyle}>
      <div style={{ marginBottom: 28 }}>
        <div className="display" style={{ fontSize: isMobile ? 32 : 40 }}>Dashboard</div>
        <div style={{ fontSize: 14, color: 'var(--fg-3)', marginTop: 4 }}>Bem-vindo de volta, {trainer?.name?.split(' ')[0] ?? 'Coach'}</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { icon: FFIcon.dumbbell, label: 'Alunos ativos', value: athletes.length },
          { icon: FFIcon.spark,    label: 'Treinos criados', value: workouts.length },
          { icon: FFIcon.flame,    label: 'Esta semana', value: workouts.filter((w) => (Date.now() - new Date(w.created_at).getTime()) < 7 * 86400000).length },
        ].map((s, i) => (
          <Card key={i} style={{ padding: '18px 16px' }}>
            <div style={{ color: 'var(--accent)', marginBottom: 10 }}>{s.icon(14, 'var(--accent)')}</div>
            <div className="display" style={{ fontSize: 32 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Recent athletes */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--ink-4)' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)' }}>Alunos</div>
            <button onClick={() => setView('athletes')} style={{ fontSize: 12, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              Ver todos {FFIcon.chevR(10, 'var(--fg-3)')}
            </button>
          </div>
          {athletes.length === 0 ? (
            <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--fg-4)', textAlign: 'center' }}>Nenhum aluno ainda.</div>
          ) : (
            athletes.slice(0, 4).map((a, i) => {
              const aw = workouts.filter((w) => w.athlete_id === a.id)
              const adh = aw.length > 0 ? Math.min(1, aw.filter((w) => w.status === 'ready').length / Math.max(aw.length, 1)) : 0
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < Math.min(athletes.length, 4) - 1 ? '1px solid var(--ink-4)' : 'none' }}>
                  <FFAvatar name={a.name} size={36} tone="warm"/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{aw.length > 0 ? `${aw.length} treinos` : 'Sem sessões'}</div>
                    {aw.length > 0 && <div style={{ marginTop: 6 }}><FFMeter value={adh}/></div>}
                  </div>
                  <div className="num" style={{ fontSize: 12, color: 'var(--fg-2)', flexShrink: 0 }}>{Math.round(adh * 100)}%</div>
                </div>
              )
            })
          )}
        </Card>

        {/* Audio CTA */}
        <Card style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 40, right: 40, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.5 }}/>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {FFIcon.mic(22, 'var(--accent)')}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>Criação por Áudio</div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.6 }}>Grave um áudio descrevendo o treino e a IA estrutura tudo automaticamente.</div>
          </div>
          <button onClick={() => setView('recording')}
            style={{ height: 46, padding: '0 24px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {FFIcon.mic(16, 'var(--accent-ink)')} Gravar Treino
          </button>
        </Card>
      </div>
    </div>
  )

  // ── ATHLETES VIEW ─────────────────────────────────────────────────────────
  const filteredAthletes = athletes.filter((a) => a.name.toLowerCase().includes(athleteSearch.toLowerCase()) || a.email.toLowerCase().includes(athleteSearch.toLowerCase()))

  const athletesView = (
    <div style={contentStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div className="display" style={{ fontSize: isMobile ? 30 : 36 }}>Alunos</div>
        <button onClick={() => setShowAddAthlete(true)}
          style={{ height: 42, padding: '0 18px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {FFIcon.plus(16, 'var(--accent-ink)')} Adicionar
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-3)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
        </div>
        <input value={athleteSearch} onChange={(e) => setAthleteSearch(e.target.value)} placeholder="Buscar aluno..." style={{ ...inp, paddingLeft: 42 }}/>
      </div>

      {showAddAthlete && (
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 16 }}>Novo atleta</div>
          <form onSubmit={handleAddAthlete} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" style={inp}/>
            <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" style={inp}/>
            {athleteError && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{athleteError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={addingAthlete} style={{ flex: 1, height: 42, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {addingAthlete ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" onClick={() => { setShowAddAthlete(false); setAthleteError(null) }} style={{ flex: 1, height: 42, borderRadius: 999, background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--ink-4)', fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      )}

      {filteredAthletes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg-4)', fontSize: 14 }}>
          {athletes.length === 0 ? 'Nenhum atleta cadastrado ainda.' : 'Nenhum resultado.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filteredAthletes.map((a) => {
            const aw = workouts.filter((w) => w.athlete_id === a.id)
            const adh = aw.length > 0 ? Math.min(1, aw.filter((w) => w.status === 'ready').length / Math.max(aw.length, 1)) : 0
            const lastWorkout = aw[0]
            return (
              <Card key={a.id} style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <FFAvatar name={a.name} size={44} tone="warm"/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      {FFIcon.chevR(14, 'var(--fg-4)')}
                    </div>
                    <div style={{ fontSize: 12, color: aw.length > 0 ? 'var(--accent)' : 'var(--fg-3)', marginTop: 2 }}>
                      {aw.length > 0 ? 'Ativo' : 'Pendente'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 10 }}>
                  Último treino:{' '}
                  <strong style={{ color: 'var(--fg-2)' }}>
                    {lastWorkout ? new Date(lastWorkout.created_at).toLocaleDateString('pt-BR', { weekday: 'long' }) : 'Sem sessões'}
                  </strong>
                </div>
                {aw.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}><FFMeter value={adh}/></div>
                    <span className="num" style={{ fontSize: 12, color: 'var(--fg-2)', flexShrink: 0 }}>{Math.round(adh * 100)}%</span>
                  </div>
                )}
                <button onClick={() => copyInviteLink(a)} style={{ marginTop: 14, width: '100%', height: 36, borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer' }}>
                  Copiar link de convite
                </button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── WORKOUTS VIEW ─────────────────────────────────────────────────────────
  const statusColor: Record<string, string> = { ready: 'var(--success)', transcribing: 'var(--accent)', parsing: 'var(--accent)', error: 'var(--danger)', pending: 'var(--fg-4)' }
  const statusLabel: Record<string, string> = { ready: 'Pronto', transcribing: 'Transcrevendo', parsing: 'Analisando', error: 'Erro', pending: 'Pendente' }

  const workoutsView = (
    <div style={contentStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
        <div className="display" style={{ fontSize: isMobile ? 30 : 36 }}>Treinos</div>
        <button onClick={() => setView('recording')}
          style={{ height: 42, padding: '0 18px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {FFIcon.mic(14, 'var(--accent-ink)')} Novo
        </button>
      </div>

      {workouts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg-4)', fontSize: 14 }}>Nenhum treino criado ainda.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {workouts.map((w) => {
            const athlete = athletes.find((a) => a.id === w.athlete_id)
            const expanded = expandedWorkoutId === w.id
            return (
              <Card key={w.id} style={{ padding: 0, overflow: 'hidden' }}>
                {/* Confirm delete overlay */}
                {deletingWorkoutId === w.id && (
                  <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'color-mix(in oklch, var(--danger), black 70%)' }}>
                    <span style={{ fontSize: 13, color: 'var(--danger)' }}>Excluir este treino?</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleDeleteWorkout(w.id)} style={{ height: 34, padding: '0 16px', borderRadius: 999, background: 'var(--danger)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Excluir</button>
                      <button onClick={() => setDeletingWorkoutId(null)} style={{ height: 34, padding: '0 16px', borderRadius: 999, background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--ink-4)', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}
                <button onClick={() => handleToggleWorkout(w)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'none', border: 'none', color: 'var(--fg-1)', cursor: 'pointer', textAlign: 'left' }}>
                  <FFAvatar name={athlete?.name ?? '?'} size={38}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{athlete?.name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.name ?? 'Treino sem nome'}
                    </div>
                    <div className="num" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 1 }}>
                      {new Date(w.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor[w.status] ?? 'var(--fg-4)', flexShrink: 0 }}/>
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{statusLabel[w.status] ?? w.status}</span>
                    {FFIcon.chevR(12, expanded ? 'var(--accent)' : 'var(--fg-4)')}
                  </div>
                </button>
                {expanded && (
                  <div style={{ borderTop: '1px solid var(--ink-4)', padding: '14px 18px' }}>
                    {w.status === 'ready' && (
                      loadingExercises && !exercises[w.id]
                        ? <LoadingSpinner size="sm" message="Carregando..."/>
                        : (exercises[w.id] ?? []).length === 0
                          ? <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>Nenhum exercício.</div>
                          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {(exercises[w.id] ?? []).map((ex, i) => (
                                <div key={ex.id} style={{ background: 'var(--ink-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--ink-4)', overflow: 'hidden' }}>
                                  {/* Exercise header row */}
                                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px' }}>
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <span className="num" style={{ fontSize: 9, color: 'var(--accent)' }}>{i + 1}</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 500 }}>{ex.name}</div>
                                      <div className="num" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 1 }}>
                                        {ex.sets}×{ex.reps}{ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''} · desc {ex.rest_seconds}s
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                      {ex.youtube_video_id && (
                                        <button onClick={() => setExpandedVideoId(expandedVideoId === ex.id ? null : ex.id)}
                                          title="Ver vídeo"
                                          style={{ height: 28, padding: '0 10px', borderRadius: 999, background: expandedVideoId === ex.id ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${expandedVideoId === ex.id ? 'var(--accent)' : 'var(--ink-4)'}`, color: expandedVideoId === ex.id ? 'var(--accent)' : 'var(--fg-3)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                          Vídeo
                                        </button>
                                      )}
                                      <button onClick={() => editingExerciseId === ex.id ? setEditingExerciseId(null) : startEditExercise(ex)}
                                        style={{ height: 28, padding: '0 10px', borderRadius: 999, background: editingExerciseId === ex.id ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${editingExerciseId === ex.id ? 'var(--accent)' : 'var(--ink-4)'}`, color: editingExerciseId === ex.id ? 'var(--accent)' : 'var(--fg-3)', fontSize: 11, cursor: 'pointer' }}>
                                        {editingExerciseId === ex.id ? 'Cancelar' : 'Editar'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* YouTube embed */}
                                  {expandedVideoId === ex.id && ex.youtube_video_id && (
                                    <div style={{ padding: '0 12px 12px' }}>
                                      <div style={{ aspectRatio: '16/9', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                                        <iframe src={getYouTubeEmbedUrl(ex.youtube_video_id)} title={ex.name}
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                          allowFullScreen style={{ width: '100%', height: '100%', border: 'none' }}/>
                                      </div>
                                    </div>
                                  )}

                                  {/* Inline edit form */}
                                  {editingExerciseId === ex.id && (
                                    <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--ink-4)' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10 }}>
                                        {[
                                          { label: 'Séries', key: 'sets' as const, type: 'number' },
                                          { label: 'Reps', key: 'reps' as const, type: 'number' },
                                          { label: 'Kg', key: 'weight_kg' as const, type: 'number' },
                                          { label: 'Desc (s)', key: 'rest_seconds' as const, type: 'number' },
                                        ].map(({ label, key, type }) => (
                                          <div key={key}>
                                            <div style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                                            <input type={type} min="0" step={key === 'weight_kg' ? '0.5' : '1'}
                                              value={exerciseEdit[key]}
                                              onChange={(e) => setExerciseEdit((p) => ({ ...p, [key]: e.target.value }))}
                                              style={{ width: '100%', height: 36, padding: '0 8px', background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--fg-1)', outline: 'none', textAlign: 'center' }}/>
                                          </div>
                                        ))}
                                      </div>
                                      <div style={{ marginTop: 8 }}>
                                        <div style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Notas</div>
                                        <input type="text" value={exerciseEdit.notes}
                                          onChange={(e) => setExerciseEdit((p) => ({ ...p, notes: e.target.value }))}
                                          placeholder="Observações opcionais..."
                                          style={{ width: '100%', height: 34, padding: '0 10px', background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--fg-1)', outline: 'none' }}/>
                                      </div>
                                      <button onClick={() => handleSaveExercise(w.id, ex.id)}
                                        style={{ marginTop: 8, width: '100%', height: 34, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                        Salvar alterações
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                    )}
                    {w.status === 'error' && <div style={{ fontSize: 12, color: 'var(--danger)' }}>Falha ao processar.</div>}
                    {['transcribing', 'parsing', 'pending'].includes(w.status) && <LoadingSpinner size="sm" message={statusLabel[w.status]}/>}

                    {/* Edit name */}
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--ink-4)' }}>
                      {editingWorkoutId === w.id ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveWorkoutName(w.id); if (e.key === 'Escape') setEditingWorkoutId(null) }}
                            style={{ flex: 1, height: 36, padding: '0 12px', background: 'var(--ink-1)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--fg-1)', outline: 'none' }}/>
                          <button onClick={() => handleSaveWorkoutName(w.id)} style={{ height: 36, padding: '0 14px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
                          <button onClick={() => setEditingWorkoutId(null)} style={{ height: 36, padding: '0 12px', borderRadius: 999, background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--ink-4)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { setEditingWorkoutId(w.id); setEditingName(w.name ?? '') }}
                            style={{ height: 32, padding: '0 14px', borderRadius: 999, background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--ink-4)', fontSize: 12, cursor: 'pointer' }}>
                            Renomear
                          </button>
                          <button onClick={() => setDeletingWorkoutId(w.id)}
                            style={{ height: 32, padding: '0 14px', borderRadius: 999, background: 'transparent', color: 'var(--danger)', border: '1px solid color-mix(in oklch, var(--danger), black 40%)', fontSize: 12, cursor: 'pointer' }}>
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── RECORDING VIEW ────────────────────────────────────────────────────────
  const recordingView = (
    <div style={contentStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Novo treino · gravação</div>
          <div className="display" style={{ fontSize: isMobile ? 28 : 36 }}>
            Para <span style={{ fontStyle: 'italic' }}>{selectedAthlete?.name ?? 'selecione um atleta'}</span>
          </div>
        </div>
        <button onClick={() => { setView('workouts'); setAudioFile(null); setWorkoutText('') }}
          style={{ height: 38, padding: '0 16px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', color: 'var(--fg-2)', fontSize: 13, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>

      {/* Athlete + name + mode selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={selectedAthleteId} onChange={(e) => setSelectedAthleteId(e.target.value)}
          style={{ ...inp, flex: '1 1 180px', height: 44 }}>
          <option value="">Selecione o atleta</option>
          {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input value={workoutName} onChange={(e) => setWorkoutName(e.target.value)}
          placeholder="Nome do treino (ex: Pernas A)"
          style={{ ...inp, flex: '1 1 180px', height: 44 }}/>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--ink-2)', borderRadius: 999, border: '1px solid var(--ink-4)', alignSelf: 'center' }}>
          {(['audio', 'text'] as const).map((m) => (
            <button key={m} onClick={() => setInputMode(m)}
              style={{ height: 34, padding: '0 16px', borderRadius: 999, fontSize: 13, fontWeight: 500, background: inputMode === m ? 'var(--ink-3)' : 'transparent', color: inputMode === m ? 'var(--fg-1)' : 'var(--fg-3)', border: inputMode === m ? '1px solid var(--ink-4)' : '1px solid transparent', cursor: 'pointer' }}>
              {m === 'audio' ? 'Áudio' : 'Texto'}
            </button>
          ))}
        </div>
      </div>

      <Card style={{ padding: isMobile ? '28px 20px' : '40px 36px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 40, right: 40, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.5 }}/>

        {inputMode === 'audio' ? (
          <>
            {/* Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: isRecording ? 'var(--accent)' : 'var(--fg-4)', boxShadow: isRecording ? '0 0 10px var(--accent)' : 'none', ...(isRecording ? { animation: 'ff-pulse 1s ease-in-out infinite' } : {}) }}/>
              <div className="eyebrow" style={{ color: isRecording ? 'var(--accent)' : 'var(--fg-3)' }}>
                {isRecording ? `Gravando · ${recMin}:${recSec}` : audioFile ? `Pronto · ${audioFile.name}` : 'Aguardando'}
              </div>
            </div>
            {/* Waveform */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 100, marginBottom: 28 }}>
              {waveformBars.map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h * 100}%`, borderRadius: 2, background: i === waveformBars.length - 1 && isRecording ? 'var(--accent)' : isRecording ? 'var(--fg-1)' : 'var(--ink-4)', opacity: isRecording ? 1 : 0.3 }}/>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', paddingTop: 20, borderTop: '1px solid var(--ink-4)' }}>
              <button onClick={isRecording ? handleStopRecording : handleStartRecording}
                style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: isRecording ? '0 0 0 8px var(--accent-soft)' : 'none', flexShrink: 0 }}>
                {isRecording ? FFIcon.stop(18, 'var(--accent-ink)') : FFIcon.mic(20, 'var(--accent-ink)')}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: 'var(--fg-1)' }}>{isRecording ? 'Toque para parar' : 'Toque para gravar'}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 3 }}>Fale naturalmente — a IA estrutura tudo.</div>
              </div>
              <label style={{ cursor: 'pointer' }}>
                <span style={{ fontSize: 13, color: 'var(--fg-3)', textDecoration: 'underline' }}>ou enviar arquivo</span>
                <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}/>
              </label>
              <button onClick={handleProcessWorkout} disabled={!selectedAthleteId || processing || isRecording || !audioFile}
                style={{ height: 46, padding: '0 22px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (!selectedAthleteId || processing || isRecording || !audioFile) ? 0.5 : 1 }}>
                {processing ? 'Processando...' : 'Finalizar e processar'}
              </button>
            </div>
          </>
        ) : (
          <>
            <textarea value={workoutText} onChange={(e) => setWorkoutText(e.target.value)}
              placeholder="Descreva o treino... Ex: Agachamento 4×10 com 60kg, descanso 90s..."
              style={{ width: '100%', minHeight: 180, padding: '16px', background: 'var(--ink-1)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', fontSize: 15, color: 'var(--fg-1)', resize: 'vertical', outline: 'none', lineHeight: 1.6 }}/>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={handleProcessWorkout} disabled={!selectedAthleteId || processing || !workoutText.trim()}
                style={{ height: 46, padding: '0 24px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (!selectedAthleteId || processing || !workoutText.trim()) ? 0.5 : 1 }}>
                {processing ? 'Processando...' : 'Processar treino'}
              </button>
            </div>
          </>
        )}
        {processingError && <div style={{ marginTop: 14, padding: '10px 14px', background: 'color-mix(in oklch, var(--danger), black 70%)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--danger)' }}>{processingError}</div>}
      </Card>
    </div>
  )

  // ── PROCESSING VIEW ───────────────────────────────────────────────────────
  const processingAthleteObj = athletes.find((a) => a.id === selectedAthleteId)

  const processingView = (
    <div style={contentStyle}>
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Processamento</div>
        <div className="display" style={{ fontSize: isMobile ? 28 : 36 }}>A IA está montando a ficha<span style={{ fontStyle: 'italic' }}> —</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: 24 }}>
        {/* Pipeline */}
        <Card style={{ padding: '18px 20px' }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Pipeline</div>
          {PIPELINE_STEPS.map((step, i) => {
            const state = getStepState(processingStatus, step.key)
            const color = state === 'done' ? 'var(--accent)' : state === 'active' ? 'var(--fg-1)' : 'var(--fg-4)'
            return (
              <div key={step.key} style={{ display: 'flex', gap: 12, paddingBottom: i < PIPELINE_STEPS.length - 1 ? 14 : 0, position: 'relative' }}>
                {i < PIPELINE_STEPS.length - 1 && <div style={{ position: 'absolute', left: 7, top: 16, bottom: 0, width: 1, background: state === 'done' ? 'var(--accent)' : 'var(--ink-4)', opacity: 0.5 }}/>}
                <div style={{ width: 15, height: 15, borderRadius: '50%', border: `1px solid ${color}`, background: state === 'done' ? 'var(--accent)' : 'var(--ink-2)', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                  {state === 'done' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-ink)' }}/>}
                  {state === 'active' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fg-1)', animation: 'ff-pulse 1s ease-in-out infinite' }}/>}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: state === 'pending' ? 'var(--fg-4)' : 'var(--fg-1)' }}>{step.label}</div>
                  {step.sub && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{step.sub}</div>}
                </div>
              </div>
            )
          })}
          {processing && <div style={{ marginTop: 16 }}><LoadingSpinner size="sm"/></div>}
        </Card>

        {/* Detected exercises */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Exercícios identificados · {detectedExercises.length}</div>
          {processing && detectedExercises.length === 0 ? (
            <Card style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner size="md" message="Identificando..."/></Card>
          ) : detectedExercises.length === 0 ? (
            <Card style={{ padding: 32, textAlign: 'center', color: 'var(--fg-4)', fontSize: 13 }}>Os exercícios aparecem aqui após o processamento.</Card>
          ) : (
            <>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {detectedExercises.map((ex, i) => (
                  <div key={ex.id} style={{ display: 'flex', gap: 14, padding: '14px 18px', borderBottom: i < detectedExercises.length - 1 ? '1px solid var(--ink-4)' : 'none', alignItems: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="num" style={{ fontSize: 10, color: 'var(--accent)' }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14 }}>{ex.name}</div>
                      <div className="num" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{ex.sets} séries · {ex.reps} reps{ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''} · desc {ex.rest_seconds}s</div>
                    </div>
                  </div>
                ))}
              </Card>
              <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button onClick={() => setView('workouts')} style={{ height: 44, padding: '0 20px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', color: 'var(--fg-2)', fontSize: 14, cursor: 'pointer' }}>
                  Ver dashboard
                </button>
                <button onClick={() => setView('home')} style={{ height: 44, padding: '0 22px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Enviar para {processingAthleteObj?.name?.split(' ')[0] ?? 'atleta'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--ink-0)' }}>
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {mobileHeader}
        {view === 'home'       && homeView}
        {view === 'athletes'   && athletesView}
        {view === 'workouts'   && workoutsView}
        {view === 'recording'  && recordingView}
        {view === 'processing' && processingView}
      </div>
      {mobileBottomNav}
    </div>
  )
}
