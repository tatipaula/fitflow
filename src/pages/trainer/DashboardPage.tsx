import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { KVWordmark, KVMeter, KVAvatar, KVIcon } from '@/components/ui'
import {
  getAthletes, getWorkouts, createAthleteWithInvite, createWorkout,
  processWorkoutAudio, processWorkoutText, getExercises,
  updateWorkoutName, deleteWorkout, updateExercise,
  assignWorkoutToAthletes, getParqResponse,
} from '@/lib/api'
import { getYouTubeEmbedUrl } from '@/lib/youtube'
import type { Athlete, Workout, Exercise, Invite, ParqResponse } from '@/types'

type TrainerView = 'home' | 'athletes' | 'workouts' | 'recording' | 'processing' | 'review' | 'sent' | 'athlete-detail'

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


function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-lg)', ...style }}>
      {children}
    </div>
  )
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
  const [newPhone, setNewPhone] = useState('')
  const [newWeight, setNewWeight] = useState('')
  const [addingAthlete, setAddingAthlete] = useState(false)
  const [athleteError, setAthleteError] = useState<string | null>(null)
  const [athleteSearch, setAthleteSearch] = useState('')
  const [justCreated, setJustCreated] = useState<{ athlete: Athlete; invite: Invite } | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  // Athlete detail
  const [selectedAthleteForDetail, setSelectedAthleteForDetail] = useState<Athlete | null>(null)
  const [athleteDetailMainWorkout, setAthleteDetailMainWorkout] = useState<Workout | null>(null)
  const [athleteDetailExercises, setAthleteDetailExercises] = useState<Exercise[]>([])
  const [athleteParq, setAthleteParq] = useState<ParqResponse | null | undefined>(undefined)
  const [loadingAthleteDetail, setLoadingAthleteDetail] = useState(false)

  // Assign workout modal
  const [assignModalWorkoutId, setAssignModalWorkoutId] = useState<string | null>(null)
  const [assignChecked, setAssignChecked] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [assignFeedback, setAssignFeedback] = useState<string | null>(null)

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
    e.preventDefault()
    setAthleteError(null)
    if (!newEmail.trim() && !newPhone.trim()) {
      setAthleteError('Informe ao menos e-mail ou telefone para enviar o convite.')
      return
    }
    setAddingAthlete(true)
    const result = await createAthleteWithInvite({
      name: newName.trim(),
      email: newEmail.trim() || undefined,
      phone: newPhone.trim() || undefined,
      weight_kg: newWeight ? parseFloat(newWeight) : undefined,
    })
    if (!result) { setAthleteError('Não foi possível adicionar.'); setAddingAthlete(false); return }
    setAthletes((p) => [result.athlete, ...p])
    setNewName(''); setNewEmail(''); setNewPhone(''); setNewWeight('')
    setShowAddAthlete(false)
    setJustCreated(result)
    setAddingAthlete(false)
  }

  async function handleViewAthleteDetail(athlete: Athlete) {
    setSelectedAthleteForDetail(athlete)
    setAthleteDetailExercises([])
    setAthleteParq(undefined)
    setView('athlete-detail')
    setLoadingAthleteDetail(true)
    const athleteWorkouts = workouts.filter((w) => w.athlete_id === athlete.id)
    const mainWorkout = athleteWorkouts.find((w) => w.status === 'ready') ?? athleteWorkouts[0] ?? null
    setAthleteDetailMainWorkout(mainWorkout)
    const [exs, parq] = await Promise.all([
      mainWorkout?.status === 'ready' ? getExercises(mainWorkout.id) : Promise.resolve([]),
      getParqResponse(athlete.id),
    ])
    setAthleteDetailExercises(exs)
    setAthleteParq(parq)
    setLoadingAthleteDetail(false)
  }

  async function handleSendInviteEmail(invite: Invite, athlete: Athlete) {
    if (!trainer || !athlete.email) return
    setSendingEmail(true)
    const inviteLink = `${window.location.origin}/convite/${invite.token}`
    await supabase.functions.invoke('send-invite', {
      body: { athlete_name: athlete.name, athlete_email: athlete.email, trainer_name: trainer.name, invite_link: inviteLink },
    })
    setSendingEmail(false)
  }

  function handleOpenWhatsApp(invite: Invite, athlete: Athlete) {
    if (!athlete.phone) return
    const inviteLink = `${window.location.origin}/convite/${invite.token}`
    const msg = encodeURIComponent(
      `Olá, ${athlete.name}! ${trainer?.name ?? 'Seu personal trainer'} te convidou para usar o Kinevia para acompanhar seus treinos. Clique para ativar seu acesso: ${inviteLink}`,
    )
    window.open(`https://wa.me/${athlete.phone.replace(/\D/g, '')}?text=${msg}`, '_blank')
  }

  async function handleAssignWorkout() {
    if (!assignModalWorkoutId || assignChecked.length === 0) return
    setAssigning(true); setAssignFeedback(null)
    const count = await assignWorkoutToAthletes(assignModalWorkoutId, assignChecked)
    if (trainer) { const updated = await getWorkouts(trainer.id); setWorkouts(updated) }
    setAssignFeedback(`Treino atribuído a ${count} aluno${count !== 1 ? 's' : ''}.`)
    setAssignChecked([])
    setAssigning(false)
    setTimeout(() => { setAssignModalWorkoutId(null); setAssignFeedback(null) }, 2500)
  }

  async function handleStartRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', '']
        .find((t) => t === '' || MediaRecorder.isTypeSupported(t)) ?? ''
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onerror = () => { setIsRecording(false); setProcessingError('Erro na gravação.') }
      mr.onstop = () => {
        const type = mr.mimeType || 'audio/webm'
        const ext  = type.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob(chunksRef.current, { type })
        setAudioFile(new File([blob], `gravacao-${Date.now()}.${ext}`, { type }))
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRecorderRef.current = mr
      mr.start(250)
      setIsRecording(true)
    } catch (err) {
      console.error('[recording] start error', err)
      setProcessingError('Não foi possível acessar o microfone.')
    }
  }

  function handleStopRecording() {
    setIsRecording(false)
    const mr = mediaRecorderRef.current
    if (!mr || mr.state === 'inactive') return
    try { mr.requestData() } catch (_) {}
    try { mr.stop() } catch (e) { console.error('[recording] stop error', e) }
  }

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
    setAudioFile(null); setWorkoutText(''); setWorkoutName(''); setProcessing(false)
    setView('review')
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
      const updated = {
        sets: parseInt(exerciseEdit.sets) || 1,
        reps: parseInt(exerciseEdit.reps) || 1,
        weight_kg: exerciseEdit.weight_kg ? parseFloat(exerciseEdit.weight_kg) : null,
        rest_seconds: parseInt(exerciseEdit.rest_seconds) || 60,
        notes: exerciseEdit.notes.trim() || null,
      }
      setExercises((prev) => ({
        ...prev,
        [workoutId]: (prev[workoutId] ?? []).map((e) => e.id === exId ? { ...e, ...updated } : e),
      }))
      setDetectedExercises((prev) => prev.map((e) => e.id === exId ? { ...e, ...updated } : e))
    }
    setEditingExerciseId(null)
  }

  async function handleConfirmWorkout() {
    if (!processingWorkout) return
    supabase.functions.invoke('notify-athlete', { body: { workout_id: processingWorkout.id } })
    setView('sent')
  }

  function copyInviteLink(a: Athlete) { navigator.clipboard.writeText(`${window.location.origin}/invite/${a.invite_token}`) }
  function copyConviteLink(token: string) { navigator.clipboard.writeText(`${window.location.origin}/convite/${token}`) }

  const recMin = String(Math.floor(recordingSeconds / 60)).padStart(2, '0')
  const recSec = String(recordingSeconds % 60).padStart(2, '0')
  const selectedAthlete = athletes.find((a) => a.id === selectedAthleteId)

  if (loadingData) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size="lg" message="Carregando..."/>
      </div>
    )
  }

  // ── Layout shell ──────────────────────────────────────────────────────────
  const inp: React.CSSProperties = { width: '100%', height: 44, padding: '0 14px', background: 'var(--ink-1)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', fontSize: 14, color: 'var(--fg-1)', outline: 'none' }

  // ── Sidebar (desktop) ─────────────────────────────────────────────────────
  const sidebar = !isMobile && (
    <div style={{ width: 220, minHeight: '100vh', background: 'var(--ink-1)', borderRight: '1px solid var(--ink-4)', padding: '24px 14px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '0 8px 28px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <KVWordmark size={15}/>
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
          {KVIcon.mic(16, 'var(--accent-ink)')} Novo Treino
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
      <KVWordmark size={14}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setView('recording')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {KVIcon.mic(14, 'var(--accent-ink)')} Novo Treino
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
          { icon: KVIcon.dumbbell, label: 'Alunos ativos', value: athletes.length },
          { icon: KVIcon.spark,    label: 'Treinos criados', value: workouts.length },
          { icon: KVIcon.flame,    label: 'Esta semana', value: workouts.filter((w) => (Date.now() - new Date(w.created_at).getTime()) < 7 * 86400000).length },
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
              Ver todos {KVIcon.chevR(10, 'var(--fg-3)')}
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
                  <KVAvatar name={a.name} size={36} tone="warm"/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{aw.length > 0 ? `${aw.length} treinos` : 'Sem sessões'}</div>
                    {aw.length > 0 && <div style={{ marginTop: 6 }}><KVMeter value={adh}/></div>}
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
            {KVIcon.mic(22, 'var(--accent)')}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>Criação por Áudio</div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.6 }}>Grave um áudio descrevendo o treino e a IA estrutura tudo automaticamente.</div>
          </div>
          <button onClick={() => setView('recording')}
            style={{ height: 46, padding: '0 24px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {KVIcon.mic(16, 'var(--accent-ink)')} Gravar Treino
          </button>
        </Card>
      </div>
    </div>
  )

  // ── ATHLETES VIEW ─────────────────────────────────────────────────────────
  const filteredAthletes = athletes.filter((a) => {
    const q = athleteSearch.toLowerCase()
    return a.name.toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q)
  })

  const athletesView = (
    <div style={contentStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div className="display" style={{ fontSize: isMobile ? 30 : 36 }}>Alunos</div>
        <button onClick={() => { setShowAddAthlete(true); setJustCreated(null) }}
          style={{ height: 42, padding: '0 18px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {KVIcon.plus(16, 'var(--accent-ink)')} Adicionar
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-3)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
        </div>
        <input value={athleteSearch} onChange={(e) => setAthleteSearch(e.target.value)} placeholder="Buscar aluno..." style={{ ...inp, paddingLeft: 42 }}/>
      </div>

      {/* New athlete form */}
      {showAddAthlete && (
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 16 }}>Novo atleta</div>
          <form onSubmit={handleAddAthlete} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo *" style={inp}/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="E-mail" style={inp}/>
              <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Telefone (WhatsApp)" style={inp}/>
            </div>
            <input type="number" min="0" step="0.1" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} placeholder="Peso atual (kg) — opcional" style={inp}/>
            <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: -4 }}>Informe e-mail ou telefone para enviar o convite.</div>
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

      {/* Post-creation invite options */}
      {justCreated && (
        <Card style={{ padding: 20, marginBottom: 20, border: '1px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
              Aluno adicionado! Envie o convite para <strong>{justCreated.athlete.name}</strong>.
            </div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--fg-3)', background: 'var(--ink-1)', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 14, wordBreak: 'break-all' }}>
            {window.location.origin}/convite/{justCreated.invite.token}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {justCreated.athlete.phone && (
              <button onClick={() => handleOpenWhatsApp(justCreated.invite, justCreated.athlete)}
                style={{ height: 38, padding: '0 16px', borderRadius: 999, background: '#25D366', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar via WhatsApp
              </button>
            )}
            {justCreated.athlete.email && (
              <button onClick={() => handleSendInviteEmail(justCreated.invite, justCreated.athlete)} disabled={sendingEmail}
                style={{ height: 38, padding: '0 16px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: sendingEmail ? 0.6 : 1 }}>
                {sendingEmail ? 'Enviando...' : 'Enviar por e-mail'}
              </button>
            )}
            <button onClick={() => copyConviteLink(justCreated.invite.token)}
              style={{ height: 38, padding: '0 14px', borderRadius: 999, background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--ink-4)', fontSize: 13, cursor: 'pointer' }}>
              Copiar link
            </button>
            <button onClick={() => setJustCreated(null)}
              style={{ height: 38, padding: '0 14px', borderRadius: 999, background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--ink-4)', fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}>
              Fechar
            </button>
          </div>
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
                <button onClick={() => handleViewAthleteDetail(a)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, width: '100%', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                  <KVAvatar name={a.name} size={44} tone="warm"/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      {KVIcon.chevR(14, 'var(--fg-4)')}
                    </div>
                    <div style={{ fontSize: 12, color: aw.length > 0 ? 'var(--accent)' : 'var(--fg-3)', marginTop: 2 }}>
                      {aw.length > 0 ? 'Ativo' : 'Pendente'}
                    </div>
                  </div>
                </button>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 10 }}>
                  Último treino:{' '}
                  <strong style={{ color: 'var(--fg-2)' }}>
                    {lastWorkout ? new Date(lastWorkout.created_at).toLocaleDateString('pt-BR', { weekday: 'long' }) : 'Sem sessões'}
                  </strong>
                </div>
                {aw.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}><KVMeter value={adh}/></div>
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
          {KVIcon.mic(14, 'var(--accent-ink)')} Novo
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
                  <KVAvatar name={athlete?.name ?? '?'} size={38}/>
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
                    {KVIcon.chevR(12, expanded ? 'var(--accent)' : 'var(--fg-4)')}
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
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button onClick={() => { setEditingWorkoutId(w.id); setEditingName(w.name ?? '') }}
                            style={{ height: 32, padding: '0 14px', borderRadius: 999, background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--ink-4)', fontSize: 12, cursor: 'pointer' }}>
                            Renomear
                          </button>
                          {w.status === 'ready' && (
                            <button onClick={() => { setAssignModalWorkoutId(w.id); setAssignChecked([]) }}
                              style={{ height: 32, padding: '0 14px', borderRadius: 999, background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--ink-4)', fontSize: 12, cursor: 'pointer' }}>
                              Atribuir
                            </button>
                          )}
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
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: isRecording ? 'var(--accent)' : 'var(--fg-4)', boxShadow: isRecording ? '0 0 10px var(--accent)' : 'none', ...(isRecording ? { animation: 'kv-pulse 1s ease-in-out infinite' } : {}) }}/>
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
                {isRecording ? KVIcon.stop(18, 'var(--accent-ink)') : KVIcon.mic(20, 'var(--accent-ink)')}
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
  const processingView = (
    <div style={{ ...contentStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        {processingError ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
            <div className="display" style={{ fontSize: 24, color: 'var(--danger)', marginBottom: 8 }}>Erro</div>
            <div style={{ fontSize: 14, color: 'var(--fg-3)', marginBottom: 20 }}>{processingError}</div>
            <button onClick={() => setView('recording')}
              style={{ height: 44, padding: '0 24px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', color: 'var(--fg-2)', fontSize: 14, cursor: 'pointer' }}>
              Tentar novamente
            </button>
          </>
        ) : (
          <>
            <LoadingSpinner size="lg"/>
            <div style={{ fontSize: 16, color: 'var(--fg-2)', marginTop: 20 }}>Processando...</div>
          </>
        )}
      </div>
    </div>
  )

  // ── REVIEW VIEW ───────────────────────────────────────────────────────────
  const reviewAthleteObj = athletes.find((a) => a.id === selectedAthleteId) ?? athletes.find((a) => a.id === processingWorkout?.athlete_id)

  const reviewView = (
    <div style={contentStyle}>
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Revisão do treino</div>
        <div className="display" style={{ fontSize: isMobile ? 28 : 36 }}>
          Para <span style={{ fontStyle: 'italic' }}>{reviewAthleteObj?.name ?? '—'}</span>
        </div>
        {processingWorkout?.name && (
          <div style={{ fontSize: 14, color: 'var(--fg-3)', marginTop: 4 }}>{processingWorkout.name}</div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {detectedExercises.map((ex, i) => (
          <div key={ex.id} style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="num" style={{ fontSize: 10, color: 'var(--accent)' }}>{i + 1}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{ex.name}</div>
                <div className="num" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                  {ex.sets}×{ex.reps}{ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''} · desc {ex.rest_seconds}s
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {ex.youtube_video_id && (
                  <button onClick={() => setExpandedVideoId(expandedVideoId === ex.id ? null : ex.id)}
                    style={{ height: 30, padding: '0 12px', borderRadius: 999, background: expandedVideoId === ex.id ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${expandedVideoId === ex.id ? 'var(--accent)' : 'var(--ink-4)'}`, color: expandedVideoId === ex.id ? 'var(--accent)' : 'var(--fg-3)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    Vídeo
                  </button>
                )}
                <button onClick={() => editingExerciseId === ex.id ? setEditingExerciseId(null) : startEditExercise(ex)}
                  style={{ height: 30, padding: '0 12px', borderRadius: 999, background: editingExerciseId === ex.id ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${editingExerciseId === ex.id ? 'var(--accent)' : 'var(--ink-4)'}`, color: editingExerciseId === ex.id ? 'var(--accent)' : 'var(--fg-3)', fontSize: 12, cursor: 'pointer' }}>
                  {editingExerciseId === ex.id ? 'Cancelar' : 'Editar'}
                </button>
              </div>
            </div>

            {/* YouTube embed */}
            {expandedVideoId === ex.id && ex.youtube_video_id && (
              <div style={{ padding: '0 16px 16px' }}>
                <div style={{ aspectRatio: '16/9', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                  <iframe src={getYouTubeEmbedUrl(ex.youtube_video_id)} title={ex.name}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen style={{ width: '100%', height: '100%', border: 'none' }}/>
                </div>
              </div>
            )}

            {/* Edit form */}
            {editingExerciseId === ex.id && processingWorkout && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--ink-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
                  {[
                    { label: 'Séries', key: 'sets' as const },
                    { label: 'Reps', key: 'reps' as const },
                    { label: 'Kg', key: 'weight_kg' as const },
                    { label: 'Desc (s)', key: 'rest_seconds' as const },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <div style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                      <input type="number" min="0" step={key === 'weight_kg' ? '0.5' : '1'}
                        value={exerciseEdit[key]}
                        onChange={(e) => setExerciseEdit((p) => ({ ...p, [key]: e.target.value }))}
                        style={{ width: '100%', height: 36, padding: '0 8px', background: 'var(--ink-1)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--fg-1)', outline: 'none', textAlign: 'center' }}/>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Notas</div>
                  <input type="text" value={exerciseEdit.notes}
                    onChange={(e) => setExerciseEdit((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Observações opcionais..."
                    style={{ width: '100%', height: 34, padding: '0 10px', background: 'var(--ink-1)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--fg-1)', outline: 'none' }}/>
                </div>
                <button onClick={() => handleSaveExercise(processingWorkout.id, ex.id)}
                  style={{ marginTop: 8, width: '100%', height: 34, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Salvar alterações
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirm button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleConfirmWorkout}
          style={{ height: 50, padding: '0 32px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          Confirmar e enviar
        </button>
      </div>
    </div>
  )

  // ── SENT VIEW ─────────────────────────────────────────────────────────────
  const sentView = (
    <div style={{ ...contentStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </div>
        <div className="display" style={{ fontSize: isMobile ? 28 : 36, marginBottom: 8 }}>Treino enviado</div>
        <div style={{ fontSize: 14, color: 'var(--fg-3)', marginBottom: 28 }}>
          {reviewAthleteObj?.name ?? 'O atleta'} já pode acessar o treino.
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setView('recording'); setDetectedExercises([]); setProcessingWorkout(null) }}
            style={{ height: 44, padding: '0 22px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {KVIcon.mic(16, 'var(--accent-ink)')} Novo treino
          </button>
          <button onClick={() => setView('workouts')}
            style={{ height: 44, padding: '0 22px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', color: 'var(--fg-2)', fontSize: 14, cursor: 'pointer' }}>
            Ver treinos
          </button>
        </div>
      </div>
    </div>
  )

  // ── ATHLETE DETAIL VIEW ───────────────────────────────────────────────────
  const PARQ_LABELS = [
    'Problema no coração',
    'Dor no peito ao exercitar',
    'Dor no peito em repouso (último mês)',
    'Tontura / perda de consciência',
    'Problema ósseo ou articular',
    'Medicação para pressão/coração',
    'Outra razão para não praticar',
  ]

  const athleteDetailView = selectedAthleteForDetail && (
    <div style={contentStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <button onClick={() => setView('athletes')}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--ink-2)', border: '1px solid var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-2)" strokeWidth="1.8" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <KVAvatar name={selectedAthleteForDetail.name} size={44} tone="warm"/>
        <div>
          <div className="display" style={{ fontSize: isMobile ? 24 : 30 }}>{selectedAthleteForDetail.name}</div>
          {(selectedAthleteForDetail.email || selectedAthleteForDetail.phone) && (
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
              {selectedAthleteForDetail.email ?? selectedAthleteForDetail.phone}
            </div>
          )}
        </div>
        <button onClick={() => { setSelectedAthleteId(selectedAthleteForDetail.id); setView('recording') }}
          style={{ marginLeft: 'auto', height: 38, padding: '0 16px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {KVIcon.mic(14, 'var(--accent-ink)')} Novo treino
        </button>
      </div>

      {loadingAthleteDetail ? (
        <LoadingSpinner size="md" message="Carregando..."/>
      ) : (
        <>
          {/* Current workout */}
          <div style={{ marginBottom: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Treino atual</div>
            {!athleteDetailMainWorkout ? (
              <Card style={{ padding: '28px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: 'var(--fg-3)', marginBottom: 16 }}>Nenhum treino criado para este aluno ainda.</div>
                <button onClick={() => { setSelectedAthleteId(selectedAthleteForDetail.id); setView('recording') }}
                  style={{ height: 42, padding: '0 20px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {KVIcon.mic(16, 'var(--accent-ink)')} Criar treino para este aluno
                </button>
              </Card>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderBottom: athleteDetailExercises.length > 0 ? '1px solid var(--ink-4)' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{athleteDetailMainWorkout.name ?? 'Treino sem nome'}</div>
                    <div className="num" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                      {new Date(athleteDetailMainWorkout.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: athleteDetailMainWorkout.status === 'ready' ? 'var(--success)' : 'var(--fg-4)' }}/>
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{athleteDetailMainWorkout.status === 'ready' ? 'Pronto' : athleteDetailMainWorkout.status}</span>
                  </div>
                </div>
                {athleteDetailExercises.length > 0 && (
                  <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {athleteDetailExercises.map((ex, i) => (
                      <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--ink-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--ink-4)' }}>
                        <span className="num" style={{ fontSize: 9, color: 'var(--accent)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{ex.name}</div>
                          <div className="num" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 1 }}>
                            {ex.sets}×{ex.reps}{ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''} · desc {ex.rest_seconds}s
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* PAR-Q */}
          {athleteParq !== undefined && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>PAR-Q — Questionário de saúde</div>
              {athleteParq === null ? (
                <Card style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>Não respondido ainda (preenchido durante o cadastro via convite).</div>
                </Card>
              ) : (
                <Card style={{ padding: '16px 18px' }}>
                  {athleteParq.has_any_yes && (
                    <div style={{ padding: '10px 12px', background: 'color-mix(in oklch, #f59e0b, black 70%)', borderRadius: 'var(--r-md)', fontSize: 12, color: '#f59e0b', marginBottom: 12 }}>
                      ⚠ Atleta respondeu "Sim" em pelo menos uma questão — avaliar antes de prescrever exercícios de alto impacto.
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {PARQ_LABELS.map((label, i) => {
                      const key = `q${i + 1}` as keyof typeof athleteParq
                      const val = athleteParq[key] as boolean
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: val ? 'var(--danger)' : 'var(--success)', flexShrink: 0 }}/>
                          <span style={{ fontSize: 12, color: 'var(--fg-2)', flex: 1 }}>{label}</span>
                          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: val ? 'var(--danger)' : 'var(--fg-3)' }}>{val ? 'Sim' : 'Não'}</span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )

  // ── ASSIGN MODAL ──────────────────────────────────────────────────────────
  const assignModal = assignModalWorkoutId && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-xl)', padding: '28px 24px', maxWidth: 400, width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Atribuir a alunos</div>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 20 }}>Uma cópia independente do treino será criada para cada aluno selecionado.</div>

        {athletes.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--fg-4)', padding: '16px 0' }}>Nenhum aluno cadastrado.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {athletes.map((a) => (
              <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--r-md)', background: assignChecked.includes(a.id) ? 'var(--accent-soft)' : 'var(--ink-1)', border: `1px solid ${assignChecked.includes(a.id) ? 'var(--accent)' : 'var(--ink-4)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                <input type="checkbox" checked={assignChecked.includes(a.id)}
                  onChange={(e) => setAssignChecked((p) => e.target.checked ? [...p, a.id] : p.filter((id) => id !== a.id))}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0 }}/>
                <KVAvatar name={a.name} size={32} tone="warm"/>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</span>
              </label>
            ))}
          </div>
        )}

        {assignFeedback && (
          <div style={{ padding: '10px 14px', background: 'color-mix(in oklch, var(--success, #22c55e), black 70%)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--success, #22c55e)', marginBottom: 12 }}>
            ✓ {assignFeedback}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleAssignWorkout} disabled={assignChecked.length === 0 || assigning}
            style={{ flex: 1, height: 42, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: assignChecked.length === 0 || assigning ? 0.5 : 1 }}>
            {assigning ? 'Atribuindo...' : `Confirmar${assignChecked.length > 0 ? ` (${assignChecked.length})` : ''}`}
          </button>
          <button onClick={() => { setAssignModalWorkoutId(null); setAssignChecked([]); setAssignFeedback(null) }}
            style={{ height: 42, padding: '0 16px', borderRadius: 999, background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--ink-4)', fontSize: 14, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--ink-0)' }}>
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {mobileHeader}
        {view === 'home'          && homeView}
        {view === 'athletes'      && athletesView}
        {view === 'athlete-detail' && athleteDetailView}
        {view === 'workouts'      && workoutsView}
        {view === 'recording'     && recordingView}
        {view === 'processing'    && processingView}
        {view === 'review'        && reviewView}
        {view === 'sent'          && sentView}
      </div>
      {mobileBottomNav}
      {assignModal}
    </div>
  )
}
