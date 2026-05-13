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
  checkInAthlete, getAthleteCheckins, getCheckinCountsByTrainer, updateAthleteSessionPackage,
  updateAthleteBilling, updateTrainerPixKey, updateTrainerProfile, uploadTrainerAvatar, isBillingDue,
  getAthleteRankingStats, getBadgesByTrainer, createBadge, deleteBadge,
} from '@/lib/api'
import { getYouTubeEmbedUrl } from '@/lib/youtube'
import { EXERCISE_LIBRARY } from '@/lib/exerciseLibrary'
import type { Athlete, AthleteRankingStats, Badge, Workout, Exercise, Invite, ParqResponse, ClassCheckin } from '@/types'

type TrainerView = 'home' | 'athletes' | 'workouts' | 'recording' | 'processing' | 'review' | 'sent' | 'athlete-detail' | 'ranking' | 'trainer-perfil'

const NAV_ITEMS: { key: TrainerView; label: string; icon: (c?: string) => JSX.Element }[] = [
  { key: 'home',          label: 'Dashboard', icon: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { key: 'athletes',      label: 'Alunos',    icon: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" strokeLinecap="round"/><path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87" strokeLinecap="round"/></svg> },
  { key: 'workouts',      label: 'Treinos',   icon: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="9" width="3" height="6" rx="0.5"/><rect x="19" y="9" width="3" height="6" rx="0.5"/><rect x="5" y="10.5" width="2" height="3"/><rect x="17" y="10.5" width="2" height="3"/><path d="M7 12h10"/></svg> },
  { key: 'ranking',       label: 'Ranking',   icon: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round"><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg> },
  { key: 'trainer-perfil', label: 'Perfil',   icon: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/></svg> },
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

  // Check-in
  const [checkinCounts, setCheckinCounts] = useState<Record<string, number>>({})
  const [checkingInId, setCheckingInId] = useState<string | null>(null)
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null)
  const [athleteCheckins, setAthleteCheckins] = useState<ClassCheckin[]>([])
  const [packageEditId, setPackageEditId] = useState<string | null>(null)
  const [packageEditValue, setPackageEditValue] = useState('')

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

  // Billing per athlete
  const [billingEditId, setBillingEditId] = useState<string | null>(null)
  const [billingDay, setBillingDay] = useState('')
  const [billingAmount, setBillingAmount] = useState('')

  // Trainer Pix key
  const [pixKeyEdit, setPixKeyEdit] = useState(false)
  const [pixKeyValue, setPixKeyValue] = useState('')
  const [trainerPixKey, setTrainerPixKey] = useState<string | null>(null)

  // Ranking
  type RankingCategory = 'sessions' | 'totalLoad' | 'cardioExercises' | 'checkins'
  const [rankingStats, setRankingStats] = useState<AthleteRankingStats[]>([])
  const [rankingCategory, setRankingCategory] = useState<RankingCategory>('sessions')
  const [loadingRanking, setLoadingRanking] = useState(false)

  // Trainer profile
  const [trainerAvatarUrl, setTrainerAvatarUrl] = useState<string | null>(null)
  const [trainerProfileData, setTrainerProfileData] = useState<{ name: string; phone: string; bio: string }>({ name: '', phone: '', bio: '' })
  const [trainerProfileEditing, setTrainerProfileEditing] = useState(false)
  const [savingTrainerProfile, setSavingTrainerProfile] = useState(false)
  const [trainerProfileSaved, setTrainerProfileSaved] = useState(false)
  const [uploadingTrainerAvatar, setUploadingTrainerAvatar] = useState(false)

  // Badges
  const [trainerBadges, setTrainerBadges] = useState<Badge[]>([])
  const [showBadgeModal, setShowBadgeModal] = useState<string | null>(null) // athleteId
  const [badgeIcon, setBadgeIcon] = useState('🏆')
  const [badgeTitle, setBadgeTitle] = useState('')
  const [creatingBadge, setCreatingBadge] = useState(false)
  const [confirmDeleteBadgeId, setConfirmDeleteBadgeId] = useState<string | null>(null)

  // Exercise library
  const [showLibrary, setShowLibrary] = useState(false)
  const [libraryGroup, setLibraryGroup] = useState('cardio')

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
    setTrainerPixKey(trainer.pix_key ?? null)
    setTrainerAvatarUrl(trainer.avatar_url ?? null)
    setTrainerProfileData({ name: trainer.name ?? '', phone: trainer.phone ?? '', bio: trainer.bio ?? '' })
    Promise.all([getAthletes(trainer.id), getWorkouts(trainer.id), getCheckinCountsByTrainer(trainer.id), getBadgesByTrainer(trainer.id)])
      .then(([a, w, counts, badges]) => { setAthletes(a); setWorkouts(w); setCheckinCounts(counts); setTrainerBadges(badges) })
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
    const [exs, parq, checkins] = await Promise.all([
      mainWorkout?.status === 'ready' ? getExercises(mainWorkout.id) : Promise.resolve([]),
      getParqResponse(athlete.id),
      getAthleteCheckins(athlete.id),
    ])
    setAthleteDetailExercises(exs)
    setAthleteParq(parq)
    setAthleteCheckins(checkins)
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

  function handleAddFromLibrary(name: string, sets: number, reps: number, rest: number, timed: boolean) {
    const repsStr = timed ? `${reps}s` : String(reps)
    const line = `${name} ${sets}×${repsStr} descanso ${rest}s`
    setWorkoutText((p) => p.trim() ? `${p.trim()}\n${line}` : line)
  }

  function copyInviteLink(a: Athlete) { navigator.clipboard.writeText(`${window.location.origin}/invite/${a.invite_token}`) }
  function copyConviteLink(token: string) { navigator.clipboard.writeText(`${window.location.origin}/convite/${token}`) }

  async function handleCheckIn(athleteId: string) {
    setCheckingInId(athleteId)
    const checkin = await checkInAthlete(athleteId)
    if (checkin) {
      setCheckinCounts((p) => ({ ...p, [athleteId]: (p[athleteId] ?? 0) + 1 }))
      if (selectedAthleteForDetail?.id === athleteId) {
        setAthleteCheckins((p) => [checkin, ...p])
      }
      setCheckInSuccess(athleteId)
      setTimeout(() => setCheckInSuccess(null), 2000)
    }
    setCheckingInId(null)
  }

  async function handleSaveBilling(athleteId: string) {
    const day = parseInt(billingDay) || null
    const amount = parseFloat(billingAmount) || null
    const ok = await updateAthleteBilling(athleteId, day, amount)
    if (ok) {
      setAthletes((p) => p.map((a) => a.id === athleteId ? { ...a, billing_day: day, billing_amount: amount } : a))
      setSelectedAthleteForDetail((p) => p ? (p.id === athleteId ? { ...p, billing_day: day, billing_amount: amount } : p) : null)
    }
    setBillingEditId(null)
  }

  async function handleSavePixKey() {
    const ok = await updateTrainerPixKey(pixKeyValue.trim())
    if (ok) setTrainerPixKey(pixKeyValue.trim() || null)
    setPixKeyEdit(false)
  }

  async function handleSaveTrainerProfile() {
    setSavingTrainerProfile(true)
    const ok = await updateTrainerProfile({
      name: trainerProfileData.name.trim() || undefined,
      phone: trainerProfileData.phone.trim() || undefined,
      bio: trainerProfileData.bio.trim() || undefined,
    })
    if (ok) { setTrainerProfileSaved(true); setTrainerProfileEditing(false); setTimeout(() => setTrainerProfileSaved(false), 2500) }
    setSavingTrainerProfile(false)
  }

  async function handleTrainerAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !trainer) return
    setUploadingTrainerAvatar(true)
    const url = await uploadTrainerAvatar(trainer.id, file)
    if (url) setTrainerAvatarUrl(url)
    setUploadingTrainerAvatar(false)
  }

  async function handleLoadRanking() {
    if (!trainer) return
    setLoadingRanking(true)
    const stats = await getAthleteRankingStats(trainer.id)
    setRankingStats(stats)
    setLoadingRanking(false)
  }

  async function handleCreateBadge(athleteId: string) {
    if (!trainer || !badgeTitle.trim()) return
    setCreatingBadge(true)
    const badge = await createBadge(trainer.id, athleteId, badgeIcon, badgeTitle.trim())
    if (badge) setTrainerBadges((p) => [badge, ...p])
    setBadgeTitle('')
    setBadgeIcon('🏆')
    setShowBadgeModal(null)
    setCreatingBadge(false)
  }

  async function handleDeleteBadge(badgeId: string) {
    const ok = await deleteBadge(badgeId)
    if (ok) setTrainerBadges((p) => p.filter((b) => b.id !== badgeId))
    setConfirmDeleteBadgeId(null)
  }

  async function handleSavePackage(athleteId: string) {
    const total = parseInt(packageEditValue) || 0
    const ok = await updateAthleteSessionPackage(athleteId, total)
    if (ok) {
      setAthletes((p) => p.map((a) => a.id === athleteId ? { ...a, sessions_total: total } : a))
      setSelectedAthleteForDetail((p) => p ? (p.id === athleteId ? { ...p, sessions_total: total } : p) : null)
    }
    setPackageEditId(null)
  }

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

  const pendingBillingCount = athletes.filter(isBillingDue).length

  // ── Sidebar (desktop) ─────────────────────────────────────────────────────
  const sidebar = !isMobile && (
    <div style={{ width: 220, minHeight: '100vh', background: 'var(--ink-1)', borderRight: '1px solid var(--ink-4)', padding: '24px 14px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '0 8px 28px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <KVWordmark size={15}/>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {NAV_ITEMS.map(({ key, label, icon }) => {
          const active = view === key || (key === 'workouts' && (view === 'recording' || view === 'processing')) || (key === 'athletes' && view === 'athlete-detail')
          return (
            <button key={key} onClick={() => { setView(key); if (key === 'ranking' && rankingStats.length === 0) setTimeout(handleLoadRanking, 0) }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--r-md)', background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent)' : 'var(--fg-2)', fontSize: 14, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              {icon(active ? 'var(--accent)' : 'var(--fg-2)')}
              {label}
            </button>
          )
        })}
      </div>
      <div style={{ padding: '16px 0 8px', borderTop: '1px solid var(--ink-4)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => setView('athletes')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'transparent', border: 'none', cursor: 'pointer', color: pendingBillingCount > 0 ? 'var(--accent)' : 'var(--fg-3)', fontSize: 13, width: '100%', textAlign: 'left' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            {pendingBillingCount > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 15, height: 15, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {pendingBillingCount}
              </span>
            )}
          </div>
          Cobranças{pendingBillingCount > 0 ? ` (${pendingBillingCount})` : ''}
        </button>
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
  const bellButton = (
    <button onClick={() => setView('athletes')} style={{ position: 'relative', width: 38, height: 38, borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-2)" strokeWidth="1.5" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
      {pendingBillingCount > 0 && (
        <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontFamily: "'JetBrains Mono', monospace" }}>
          {pendingBillingCount}
        </span>
      )}
    </button>
  )

  const mobileHeader = isMobile && (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--ink-4)', background: 'var(--ink-1)', position: 'sticky', top: 0, zIndex: 40 }}>
      <KVWordmark size={14}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {bellButton}
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
        const active = view === key || (key === 'workouts' && (view === 'recording' || view === 'processing')) || (key === 'athletes' && view === 'athlete-detail')
        return (
          <button key={key} onClick={() => { setView(key); if (key === 'ranking' && rankingStats.length === 0) setTimeout(handleLoadRanking, 0) }}
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
                  <KVAvatar name={a.name} size={36} tone="warm" src={a.avatar_url}/>
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

      {/* Pix key */}
      <Card style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Chave Pix para cobranças</div>
            {pixKeyEdit ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input autoFocus value={pixKeyValue} onChange={(e) => setPixKeyValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSavePixKey(); if (e.key === 'Escape') setPixKeyEdit(false) }}
                  placeholder="CPF, telefone, e-mail ou chave aleatória"
                  style={{ flex: 1, height: 36, padding: '0 12px', background: 'var(--ink-1)', border: '1px solid var(--accent)', borderRadius: 'var(--r-md)', fontSize: 14, color: 'var(--fg-1)', outline: 'none' }}/>
                <button onClick={handleSavePixKey} style={{ height: 36, padding: '0 14px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
                <button onClick={() => setPixKeyEdit(false)} style={{ height: 36, padding: '0 10px', borderRadius: 999, background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--ink-4)', fontSize: 12, cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, color: trainerPixKey ? 'var(--fg-1)' : 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {trainerPixKey ?? 'Não configurada — alunos não receberão a chave nas notificações'}
                </span>
                <button onClick={() => { setPixKeyEdit(true); setPixKeyValue(trainerPixKey ?? '') }}
                  style={{ height: 30, padding: '0 12px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                  {trainerPixKey ? 'Editar' : 'Configurar'}
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>
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
                  <KVAvatar name={a.name} size={44} tone="warm" src={a.avatar_url}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {trainerBadges.filter((b) => b.athlete_id === a.id).slice(0, 3).map((b) => (
                          <span key={b.id} title={b.title} style={{ fontSize: 14 }}>{b.icon}</span>
                        ))}
                        {KVIcon.chevR(14, 'var(--fg-4)')}
                      </div>
                    </div>
                    {a.objective ? (
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.objective}</div>
                    ) : (
                      <div style={{ fontSize: 12, color: aw.length > 0 ? 'var(--accent)' : 'var(--fg-3)', marginTop: 2 }}>
                        {aw.length > 0 ? 'Ativo' : 'Pendente'}
                      </div>
                    )}
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
                {a.billing_day && a.billing_amount ? (() => {
                  const due = isBillingDue(a)
                  const paidThisMonth = !due && a.last_paid_at && (() => {
                    const today = new Date()
                    const [y, m] = a.last_paid_at!.split('-').map(Number)
                    return y === today.getFullYear() && m === today.getMonth() + 1
                  })()
                  if (!due && !paidThisMonth) return null
                  return (
                    <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 'var(--r-md)', background: due ? 'color-mix(in oklch, #f59e0b, black 75%)' : 'color-mix(in oklch, var(--success), black 70%)', border: `1px solid ${due ? 'color-mix(in oklch, #f59e0b, black 45%)' : 'color-mix(in oklch, var(--success), black 45%)'}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ color: due ? '#f59e0b' : 'var(--success)', fontSize: 8 }}>●</span>
                      <span style={{ color: 'var(--fg-2)', flex: 1 }}>
                        {due ? 'Mensalidade pendente' : `Pago em ${a.last_paid_at!.split('-').slice(1).reverse().join('/')}`}
                      </span>
                      <span className="num" style={{ color: due ? '#f59e0b' : 'var(--success)', flexShrink: 0 }}>
                        R$ {Number(a.billing_amount).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  )
                })() : null}
                {(() => {
                  const used = checkinCounts[a.id] ?? 0
                  const total = a.sessions_total ?? 0
                  const remaining = total > 0 ? Math.max(0, total - used) : null
                  const urgency = remaining === null ? null : remaining === 0 ? 'danger' : remaining <= 2 ? 'warn' : 'ok'
                  const urgencyColor = urgency === 'danger' ? 'var(--danger)' : urgency === 'warn' ? '#f59e0b' : 'var(--accent)'
                  const urgencyBg = urgency === 'danger' ? 'color-mix(in oklch, var(--danger), black 75%)' : urgency === 'warn' ? 'color-mix(in oklch, #f59e0b, black 75%)' : 'var(--ink-1)'
                  const urgencyBorder = urgency === 'danger' ? 'color-mix(in oklch, var(--danger), black 40%)' : urgency === 'warn' ? 'color-mix(in oklch, #f59e0b, black 40%)' : 'var(--ink-4)'
                  return (
                    <>
                      {remaining !== null && (
                        <div style={{ margin: '12px 0', padding: '12px 14px', background: urgencyBg, borderRadius: 'var(--r-md)', border: `1px solid ${urgencyBorder}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className="num" style={{ fontSize: 32, color: urgencyColor, lineHeight: 1, flexShrink: 0 }}>{remaining}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>aulas restantes</div>
                            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{used} de {total} realizadas</div>
                          </div>
                        </div>
                      )}
                      <div style={{ marginTop: remaining !== null ? 0 : 12, display: 'flex', gap: 8 }}>
                        <button onClick={(e) => { e.stopPropagation(); handleCheckIn(a.id) }}
                          disabled={checkingInId === a.id}
                          style={{ flex: 1, height: 36, borderRadius: 999, background: checkInSuccess === a.id ? 'var(--success)' : 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: checkingInId === a.id ? 0.6 : 1, transition: 'background 0.3s' }}>
                          {checkingInId === a.id ? '...' : checkInSuccess === a.id ? '✓ Registrado!' : '✓ Check-in'}
                        </button>
                        <button onClick={() => copyInviteLink(a)}
                          style={{ height: 36, padding: '0 12px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer' }}>
                          Convite
                        </button>
                      </div>
                    </>
                  )
                })()}
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
                  <KVAvatar name={athlete?.name ?? '?'} size={38} src={athlete?.avatar_url}/>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button onClick={() => setShowLibrary(true)}
                style={{ height: 36, padding: '0 16px', borderRadius: 999, background: 'var(--ink-1)', border: '1px solid var(--ink-4)', color: 'var(--fg-2)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>
                Biblioteca de exercícios
              </button>
            </div>
            <textarea value={workoutText} onChange={(e) => setWorkoutText(e.target.value)}
              placeholder="Descreva o treino ou use a biblioteca acima para montar..."
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
        <KVAvatar name={selectedAthleteForDetail.name} size={52} tone="warm" src={selectedAthleteForDetail.avatar_url}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="display" style={{ fontSize: isMobile ? 24 : 30 }}>{selectedAthleteForDetail.name}</div>
          {selectedAthleteForDetail.objective && (
            <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4, fontStyle: 'italic' }}>{selectedAthleteForDetail.objective}</div>
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

          {/* Perfil do atleta */}
          {(selectedAthleteForDetail.height_cm || selectedAthleteForDetail.weight_kg || selectedAthleteForDetail.birth_date) && (
            <div style={{ marginBottom: 24 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Dados pessoais</div>
              <Card style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {selectedAthleteForDetail.birth_date && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>Nascimento</div>
                      <div className="num" style={{ fontSize: 15 }}>{new Date(selectedAthleteForDetail.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                    </div>
                  )}
                  {selectedAthleteForDetail.height_cm && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>Altura</div>
                      <div className="num" style={{ fontSize: 15 }}>{selectedAthleteForDetail.height_cm} cm</div>
                    </div>
                  )}
                  {selectedAthleteForDetail.weight_kg && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>Peso</div>
                      <div className="num" style={{ fontSize: 15 }}>{selectedAthleteForDetail.weight_kg} kg</div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Badges */}
          {(() => {
            const athleteBadges = trainerBadges.filter((b) => b.athlete_id === selectedAthleteForDetail.id)
            return (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div className="eyebrow">Badges</div>
                  <button onClick={() => { setShowBadgeModal(selectedAthleteForDetail.id); setBadgeTitle(''); setBadgeIcon('🏆') }}
                    style={{ height: 30, padding: '0 12px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    + Atribuir Badge
                  </button>
                </div>
                <Card style={{ padding: '14px 16px' }}>
                  {athleteBadges.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>Nenhum badge atribuído ainda.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {athleteBadges.map((b) => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--ink-1)', border: '1px solid var(--ink-4)', borderRadius: 999, fontSize: 13 }}>
                          <span style={{ fontSize: 16 }}>{b.icon}</span>
                          <span style={{ color: 'var(--fg-1)' }}>{b.title}</span>
                          {confirmDeleteBadgeId === b.id ? (
                            <>
                              <button onClick={() => handleDeleteBadge(b.id)} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Remover</button>
                              <button onClick={() => setConfirmDeleteBadgeId(null)} style={{ fontSize: 11, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmDeleteBadgeId(b.id)} style={{ fontSize: 11, color: 'var(--fg-4)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>×</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )
          })()}

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

          {/* Cobrança */}
          <div style={{ marginTop: 24, marginBottom: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Cobrança mensal</div>
            <Card style={{ padding: '16px 18px' }}>
              {billingEditId === selectedAthleteForDetail.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Dia de vencimento</div>
                      <input type="number" min="1" max="31" value={billingDay}
                        onChange={(e) => setBillingDay(e.target.value)}
                        placeholder="Ex: 5"
                        style={{ ...inp, height: 40 }}/>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Valor (R$)</div>
                      <input type="number" min="0" step="0.01" value={billingAmount}
                        onChange={(e) => setBillingAmount(e.target.value)}
                        placeholder="Ex: 150"
                        style={{ ...inp, height: 40 }}/>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleSaveBilling(selectedAthleteForDetail.id)}
                      style={{ flex: 1, height: 38, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
                    <button onClick={() => setBillingEditId(null)}
                      style={{ height: 38, padding: '0 14px', borderRadius: 999, background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--ink-4)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>Vencimento</div>
                      <div className="num" style={{ fontSize: 20, color: selectedAthleteForDetail.billing_day ? 'var(--fg-1)' : 'var(--fg-4)' }}>
                        {selectedAthleteForDetail.billing_day ? `Dia ${selectedAthleteForDetail.billing_day}` : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>Valor</div>
                      <div className="num" style={{ fontSize: 20, color: selectedAthleteForDetail.billing_amount ? 'var(--accent)' : 'var(--fg-4)' }}>
                        {selectedAthleteForDetail.billing_amount
                          ? `R$ ${Number(selectedAthleteForDetail.billing_amount).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                          : '—'}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => {
                    setBillingEditId(selectedAthleteForDetail.id)
                    setBillingDay(String(selectedAthleteForDetail.billing_day ?? ''))
                    setBillingAmount(String(selectedAthleteForDetail.billing_amount ?? ''))
                  }}
                    style={{ height: 32, padding: '0 14px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                    {selectedAthleteForDetail.billing_day ? 'Editar' : 'Configurar'}
                  </button>
                </div>
              )}
            </Card>
          </div>

          {/* Histórico de aulas */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="eyebrow">Histórico de aulas</div>
              <button onClick={() => handleCheckIn(selectedAthleteForDetail.id)}
                disabled={checkingInId === selectedAthleteForDetail.id}
                style={{ height: 34, padding: '0 14px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: checkingInId === selectedAthleteForDetail.id ? 0.6 : 1 }}>
                {checkingInId === selectedAthleteForDetail.id ? '...' : '✓ Check-in agora'}
              </button>
            </div>

            <Card style={{ padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Pacote de aulas</div>
                  {packageEditId === selectedAthleteForDetail.id ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" min="0" value={packageEditValue} onChange={(e) => setPackageEditValue(e.target.value)}
                        style={{ width: 80, height: 34, padding: '0 10px', background: 'var(--ink-1)', border: '1px solid var(--accent)', borderRadius: 'var(--r-md)', fontSize: 14, color: 'var(--fg-1)', outline: 'none', textAlign: 'center' }}/>
                      <button onClick={() => handleSavePackage(selectedAthleteForDetail.id)}
                        style={{ height: 34, padding: '0 14px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
                      <button onClick={() => setPackageEditId(null)}
                        style={{ height: 34, padding: '0 10px', borderRadius: 999, background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--ink-4)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      {selectedAthleteForDetail.sessions_total > 0 && (() => {
                        const used = checkinCounts[selectedAthleteForDetail.id] ?? 0
                        const remaining = Math.max(0, selectedAthleteForDetail.sessions_total - used)
                        const color = remaining === 0 ? 'var(--danger)' : remaining <= 2 ? '#f59e0b' : 'var(--accent)'
                        return (
                          <div>
                            <span className="num" style={{ fontSize: 36, color, lineHeight: 1 }}>{remaining}</span>
                            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>restantes</div>
                          </div>
                        )
                      })()}
                      <div>
                        <span className="num" style={{ fontSize: 36, color: 'var(--fg-2)', lineHeight: 1 }}>
                          {checkinCounts[selectedAthleteForDetail.id] ?? 0}
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                          {selectedAthleteForDetail.sessions_total > 0
                            ? `de ${selectedAthleteForDetail.sessions_total} realizadas`
                            : 'aulas realizadas'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {packageEditId !== selectedAthleteForDetail.id && (
                  <button onClick={() => { setPackageEditId(selectedAthleteForDetail.id); setPackageEditValue(String(selectedAthleteForDetail.sessions_total)) }}
                    style={{ height: 32, padding: '0 12px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                    {selectedAthleteForDetail.sessions_total > 0 ? 'Editar' : 'Definir pacote'}
                  </button>
                )}
              </div>
            </Card>

            {athleteCheckins.length === 0 ? (
              <Card style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>Nenhuma aula registrada ainda.</div>
              </Card>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {athleteCheckins.map((c, i) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < athleteCheckins.length - 1 ? '1px solid var(--ink-4)' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {new Date(c.checked_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </div>
                      {c.notes && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{c.notes}</div>}
                    </div>
                    <span className="num" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                      {new Date(c.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </div>
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
                <KVAvatar name={a.name} size={32} tone="warm" src={a.avatar_url}/>
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

  // ── BADGE MODAL ───────────────────────────────────────────────────────────
  const BADGE_ICONS = ['🏆', '⭐', '🔥', '💪', '🎯', '🏅', '👑', '⚡', '🌟', '🥇', '🎖️', '💎', '🦁', '🚀', '❤️']

  const badgeModal = showBadgeModal && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-xl)', padding: '28px 24px', maxWidth: 360, width: '100%' }}>
        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 20 }}>Atribuir Badge</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Ícone</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {BADGE_ICONS.map((icon) => (
              <button key={icon} onClick={() => setBadgeIcon(icon)}
                style={{ height: 44, borderRadius: 'var(--r-md)', fontSize: 22, background: badgeIcon === icon ? 'var(--accent-soft)' : 'var(--ink-1)', border: `1px solid ${badgeIcon === icon ? 'var(--accent)' : 'var(--ink-4)'}`, cursor: 'pointer' }}>
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Título</div>
          <input autoFocus value={badgeTitle} onChange={(e) => setBadgeTitle(e.target.value)}
            placeholder="Ex: Aluno do Mês, Rei do Cardio..."
            style={{ width: '100%', height: 44, padding: '0 14px', background: 'var(--ink-1)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', fontSize: 14, color: 'var(--fg-1)', outline: 'none', boxSizing: 'border-box' }}/>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => handleCreateBadge(showBadgeModal)} disabled={!badgeTitle.trim() || creatingBadge}
            style={{ flex: 1, height: 44, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !badgeTitle.trim() || creatingBadge ? 0.5 : 1 }}>
            {creatingBadge ? 'Salvando...' : `${badgeIcon} Atribuir`}
          </button>
          <button onClick={() => setShowBadgeModal(null)}
            style={{ height: 44, padding: '0 16px', borderRadius: 999, background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--ink-4)', fontSize: 14, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )

  // ── TRAINER PERFIL VIEW ───────────────────────────────────────────────────
  const inpStyle: React.CSSProperties = { width: '100%', height: 44, padding: '0 14px', background: 'var(--ink-1)', border: '1px solid var(--ink-4)', borderRadius: 12, fontSize: 14, color: 'var(--fg-1)', outline: 'none', boxSizing: 'border-box' }

  const trainerPerfilView = (
    <div style={contentStyle}>
      <div style={{ marginBottom: 24 }}>
        <div className="display" style={{ fontSize: isMobile ? 30 : 36 }}>Meu Perfil</div>
      </div>

      {/* PIX KEY — destaque */}
      <Card style={{ padding: 20, marginBottom: 16, borderColor: 'var(--accent)' }}>
        <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 10 }}>Chave PIX para cobranças</div>
        {pixKeyEdit ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input autoFocus value={pixKeyValue} onChange={(e) => setPixKeyValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePixKey(); if (e.key === 'Escape') setPixKeyEdit(false) }}
              placeholder="Chave PIX (CPF, e-mail, telefone ou chave aleatória)"
              style={{ ...inpStyle, flex: 1 }}/>
            <button onClick={handleSavePixKey} style={{ height: 44, padding: '0 16px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
            <button onClick={() => setPixKeyEdit(false)} style={{ height: 44, padding: '0 12px', borderRadius: 999, background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--ink-4)', fontSize: 13, cursor: 'pointer' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: trainerPixKey ? 'var(--fg-1)' : 'var(--fg-4)', wordBreak: 'break-all' }}>
              {trainerPixKey ?? 'Não configurada — alunos não receberão a chave nas notificações'}
            </div>
            <button onClick={() => { setPixKeyEdit(true); setPixKeyValue(trainerPixKey ?? '') }}
              style={{ height: 36, padding: '0 14px', borderRadius: 999, background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
              {trainerPixKey ? 'Editar' : 'Configurar'}
            </button>
          </div>
        )}
      </Card>

      {/* PROFILE CARD */}
      <Card style={{ padding: 20 }}>
        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid var(--ink-4)' }}>
          <label style={{ cursor: 'pointer', position: 'relative' }}>
            <KVAvatar name={trainerProfileData.name || trainer?.name || 'T'} size={88} tone="accent" src={trainerAvatarUrl}/>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {uploadingTrainerAvatar
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2"><circle cx="12" cy="12" r="9"/></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              }
            </div>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleTrainerAvatarChange} disabled={uploadingTrainerAvatar}/>
          </label>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{trainerProfileData.name || trainer?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{trainer?.email}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>{uploadingTrainerAvatar ? 'Enviando foto...' : 'Toque na foto para alterar'}</div>
          </div>
        </div>

        {/* Editable fields */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}>Dados do personal</div>
          {!trainerProfileEditing && (
            <button onClick={() => setTrainerProfileEditing(true)}
              style={{ height: 30, padding: '0 12px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer' }}>
              Editar
            </button>
          )}
        </div>

        {trainerProfileEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Nome</div>
              <input type="text" value={trainerProfileData.name} onChange={(e) => setTrainerProfileData((p) => ({ ...p, name: e.target.value }))} placeholder={trainer?.name} style={inpStyle}/>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Telefone / WhatsApp</div>
              <input type="tel" value={trainerProfileData.phone} onChange={(e) => setTrainerProfileData((p) => ({ ...p, phone: e.target.value }))} placeholder="(11) 99999-9999" style={inpStyle}/>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Bio / Apresentação</div>
              <textarea value={trainerProfileData.bio} onChange={(e) => setTrainerProfileData((p) => ({ ...p, bio: e.target.value }))} placeholder="Ex: Personal trainer especializado em hipertrofia e emagrecimento..." rows={4}
                style={{ ...inpStyle, height: 'auto', padding: '12px 14px', resize: 'none', lineHeight: 1.5 }}/>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={handleSaveTrainerProfile} disabled={savingTrainerProfile}
                style={{ flex: 1, height: 44, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: savingTrainerProfile ? 0.6 : 1 }}>
                {savingTrainerProfile ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setTrainerProfileEditing(false)}
                style={{ height: 44, padding: '0 16px', borderRadius: 999, background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--ink-4)', fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
            {trainerProfileSaved && <div style={{ fontSize: 12, color: 'var(--success)', textAlign: 'center' }}>✓ Dados salvos!</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'E-mail', value: trainer?.email },
              { label: 'Telefone', value: trainerProfileData.phone || null },
              { label: 'Bio', value: trainerProfileData.bio || null },
            ].map(({ label, value }) => value ? (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--fg-3)', flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 13, color: 'var(--fg-1)', textAlign: 'right', maxWidth: '65%', lineHeight: 1.5 }}>{value}</span>
              </div>
            ) : null)}
            {!trainerProfileData.phone && !trainerProfileData.bio && (
              <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>Nenhum dado preenchido. Toque em Editar.</div>
            )}
          </div>
        )}
      </Card>
    </div>
  )

  // ── RANKING VIEW ──────────────────────────────────────────────────────────
  const RANKING_CATEGORIES: { key: 'sessions' | 'totalLoad' | 'cardioExercises' | 'checkins'; label: string; unit: string }[] = [
    { key: 'sessions',        label: 'Treinos',      unit: 'treinos' },
    { key: 'totalLoad',       label: 'Carga Total',  unit: 'kg' },
    { key: 'cardioExercises', label: 'Cardio',       unit: 'exerc.' },
    { key: 'checkins',        label: 'Check-ins',    unit: 'aulas' },
  ]

  const sortedRanking = [...rankingStats].sort((a, b) => b[rankingCategory] - a[rankingCategory])
  const podium = sortedRanking.slice(0, 3)
  const catInfo = RANKING_CATEGORIES.find((c) => c.key === rankingCategory)!

  const rankingView = (
    <div style={contentStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
        <div className="display" style={{ fontSize: isMobile ? 30 : 36 }}>Ranking</div>
        <button onClick={handleLoadRanking} disabled={loadingRanking}
          style={{ height: 38, padding: '0 16px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-4)', color: 'var(--fg-2)', fontSize: 13, cursor: 'pointer', opacity: loadingRanking ? 0.6 : 1 }}>
          {loadingRanking ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {/* Category selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
        {RANKING_CATEGORIES.map((cat) => (
          <button key={cat.key} onClick={() => setRankingCategory(cat.key)}
            style={{ height: 34, padding: '0 16px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: rankingCategory === cat.key ? 'var(--accent)' : 'var(--ink-2)', color: rankingCategory === cat.key ? 'var(--accent-ink)' : 'var(--fg-2)', border: rankingCategory === cat.key ? 'none' : '1px solid var(--ink-4)' }}>
            {cat.label}
          </button>
        ))}
      </div>

      {loadingRanking ? (
        <LoadingSpinner size="lg" message="Calculando ranking..."/>
      ) : rankingStats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 14, color: 'var(--fg-4)', marginBottom: 16 }}>Sem dados para exibir. Clique em Atualizar para carregar.</div>
          <button onClick={handleLoadRanking}
            style={{ height: 42, padding: '0 24px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Carregar ranking
          </button>
        </div>
      ) : (
        <>
          {/* Podium */}
          {podium.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: isMobile ? 8 : 16 }}>
                {[1, 0, 2].map((podiumIdx) => {
                  const entry = podium[podiumIdx]
                  if (!entry) return <div key={podiumIdx} style={{ flex: 1, maxWidth: isMobile ? 90 : 120 }}/>
                  const heights = [96, 128, 76]
                  const medalColors = ['#C0C0C0', '#FFD700', '#CD7F32']
                  const medals = ['🥈', '🥇', '🥉']
                  return (
                    <div key={entry.athlete.id} style={{ flex: 1, maxWidth: isMobile ? 90 : 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <KVAvatar name={entry.athlete.name} size={podiumIdx === 0 ? 56 : 44} tone="warm" src={entry.athlete.avatar_url}/>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? 80 : 110 }}>{entry.athlete.name.split(' ')[0]}</div>
                        <div className="num" style={{ fontSize: 13, color: 'var(--accent)', marginTop: 2 }}>{entry[rankingCategory]} {catInfo.unit}</div>
                      </div>
                      <div style={{ width: '100%', height: heights[podiumIdx], background: 'var(--ink-2)', border: `1px solid ${medalColors[podiumIdx]}`, borderBottom: 'none', borderRadius: 'var(--r-md) var(--r-md) 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10 }}>
                        <span style={{ fontSize: 20 }}>{medals[podiumIdx]}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ height: 2, background: 'var(--ink-4)', borderRadius: 1 }}/>
            </div>
          )}

          {/* Full list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sortedRanking.map((entry, i) => (
              <Card key={entry.athlete.id} style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="num" style={{ fontSize: 13, color: 'var(--fg-3)', width: 20, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                  <KVAvatar name={entry.athlete.name} size={36} tone="warm" src={entry.athlete.avatar_url}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.athlete.name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
                    <span className="num" style={{ fontSize: 18, color: i < 3 ? 'var(--accent)' : 'var(--fg-1)' }}>{entry[rankingCategory]}</span>
                    <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{catInfo.unit}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )

  // ── LIBRARY MODAL ─────────────────────────────────────────────────────────
  const activeGroup = EXERCISE_LIBRARY.find((g) => g.key === libraryGroup) ?? EXERCISE_LIBRARY[0]

  const libraryModal = showLibrary && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Biblioteca de exercícios</div>
            <button onClick={() => setShowLibrary(false)}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--ink-3)', border: '1px solid var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg-2)', fontSize: 18, lineHeight: 1 }}>
              ×
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 16 }}>
            Toque em um exercício para adicioná-lo ao treino.
            {workoutText.trim() && (
              <span style={{ color: 'var(--accent)', marginLeft: 6 }}>
                {workoutText.trim().split('\n').filter(Boolean).length} adicionado(s)
              </span>
            )}
          </div>

          {/* Group tabs — horizontal scroll */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 16, scrollbarWidth: 'none' }}>
            {EXERCISE_LIBRARY.map((g) => (
              <button key={g.key} onClick={() => setLibraryGroup(g.key)}
                style={{ height: 32, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer', background: libraryGroup === g.key ? 'var(--accent)' : 'var(--ink-1)', color: libraryGroup === g.key ? 'var(--accent-ink)' : 'var(--fg-3)', border: libraryGroup === g.key ? 'none' : '1px solid var(--ink-4)' }}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Exercise list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeGroup.exercises.map((ex) => {
              const repsStr = ex.timed ? `${ex.reps}s` : `${ex.reps} reps`
              return (
                <button key={ex.name} onClick={() => handleAddFromLibrary(ex.name, ex.sets, ex.reps, ex.rest, ex.timed)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--ink-1)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--ink-4)')}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-1)' }}>{ex.name}</div>
                    <div className="num" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                      {ex.sets} séries × {repsStr} · descanso {ex.rest}s
                    </div>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--ink-4)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowLibrary(false)}
            style={{ height: 40, padding: '0 24px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Pronto
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
        {view === 'ranking'       && rankingView}
        {view === 'trainer-perfil' && trainerPerfilView}
      </div>
      {mobileBottomNav}
      {assignModal}
      {libraryModal}
      {badgeModal}
    </div>
  )
}
