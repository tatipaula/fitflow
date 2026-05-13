/**
 * Camada central de acesso a dados.
 * REGRA: componentes NUNCA fazem fetch direto — importam daqui.
 * Este arquivo importa os wrappers de /src/lib e o cliente Supabase.
 */

import type {
  Athlete,
  ClassCheckin,
  CreateAthleteInput,
  CreateWorkoutInput,
  Exercise,
  Invite,
  InviteWithAthlete,
  LogSetInput,
  ParqResponse,
  Session,
  SessionWithLogs,
  SetLog,
  Trainer,
  Workout,
} from '@/types'
import { parseWorkoutFromTranscript } from './claude'
import { supabase } from './supabase'
import { transcribeAudio } from './whisper'
import { searchExerciseVideo } from './youtube'

// ─── Trainers ─────────────────────────────────────────────────────────────────

export async function getTrainer(id: string): Promise<Trainer | null> {
  const { data, error } = await supabase.from('trainers').select('*').eq('id', id).maybeSingle()
  if (error) return null
  return data as Trainer
}

// ─── Athletes ─────────────────────────────────────────────────────────────────

export async function getAthletes(trainerId: string): Promise<Athlete[]> {
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data as Athlete[]
}

export async function createAthlete(name: string, email: string): Promise<Athlete | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const { data, error } = await supabase
    .from('athletes')
    .insert({ trainer_id: session.user.id, name, email })
    .select('*')
    .single()
  if (error) { console.error('[createAthlete]', error); return null }
  return data as Athlete
}

export async function createAthleteWithInvite(
  input: CreateAthleteInput,
): Promise<{ athlete: Athlete; invite: Invite } | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const { data: athleteData, error: athleteErr } = await supabase
    .from('athletes')
    .insert({
      trainer_id: session.user.id,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      weight_kg: input.weight_kg ?? null,
    })
    .select('*')
    .single()
  if (athleteErr || !athleteData) { console.error('[createAthleteWithInvite]', athleteErr); return null }

  const { data: inviteData, error: inviteErr } = await supabase
    .from('invites')
    .insert({ trainer_id: session.user.id, athlete_id: athleteData.id })
    .select('*')
    .single()
  if (inviteErr || !inviteData) { console.error('[createAthleteWithInvite invite]', inviteErr); return null }

  return { athlete: athleteData as Athlete, invite: inviteData as Invite }
}

export async function getInviteByToken(token: string): Promise<InviteWithAthlete | null> {
  const { data, error } = await supabase
    .from('invites')
    .select('*, athletes(id, name, email, phone)')
    .eq('token', token)
    .maybeSingle()
  if (error) return null
  return data as unknown as InviteWithAthlete
}

export async function linkAthleteByInviteToken(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('link_athlete_by_invite_token', { p_invite_token: token })
  if (error) return false
  return data as boolean
}

export async function saveParqResponse(athleteId: string, answers: boolean[]): Promise<boolean> {
  const [q1, q2, q3, q4, q5, q6, q7] = answers
  const { error } = await supabase
    .from('parq_responses')
    .insert({ athlete_id: athleteId, q1, q2, q3, q4, q5, q6, q7 })
  return !error
}

export async function getParqResponse(athleteId: string): Promise<ParqResponse | null> {
  const { data, error } = await supabase
    .from('parq_responses')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data as ParqResponse | null
}

export async function assignWorkoutToAthletes(
  sourceWorkoutId: string,
  athleteIds: string[],
): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user || athleteIds.length === 0) return 0

  const [sourceExercises, workoutRes] = await Promise.all([
    getExercises(sourceWorkoutId),
    supabase.from('workouts').select('name').eq('id', sourceWorkoutId).single(),
  ])
  const workoutName = workoutRes.data?.name ?? null

  let count = 0
  for (const athleteId of athleteIds) {
    const { data: newWorkout, error } = await supabase
      .from('workouts')
      .insert({
        trainer_id: session.user.id,
        athlete_id: athleteId,
        name: workoutName,
        status: 'ready',
      })
      .select()
      .single()
    if (error || !newWorkout) continue

    if (sourceExercises.length > 0) {
      await supabase.from('exercises').insert(
        sourceExercises.map((ex, i) => ({
          workout_id: newWorkout.id,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight_kg: ex.weight_kg,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes,
          youtube_video_id: ex.youtube_video_id,
          order_index: i,
        })),
      )
    }
    count++
  }
  return count
}

export async function getAthleteById(id: string): Promise<Athlete | null> {
  const { data, error } = await supabase.from('athletes').select('*').eq('id', id).maybeSingle()
  if (error) return null
  return data as Athlete
}

export async function getAthleteByAuthId(authUserId: string): Promise<Athlete | null> {
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (error) return null
  return data as Athlete
}

export async function linkAthleteAccount(inviteToken: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('link_athlete_account', { p_invite_token: inviteToken })
  if (error) return false
  return data as boolean
}

export async function getAthleteWorkouts(athleteId: string): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data as Workout[]
}

export async function getAthleteByInviteToken(token: string): Promise<Athlete | null> {
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('invite_token', token)
    .maybeSingle()
  if (error) return null
  return data as Athlete
}

// ─── Workouts ─────────────────────────────────────────────────────────────────

export async function getWorkouts(trainerId: string): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data as Workout[]
}

export async function createWorkout(input: CreateWorkoutInput): Promise<Workout | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const user = session.user

  const { data, error } = await supabase
    .from('workouts')
    .insert({ trainer_id: user.id, athlete_id: input.athlete_id, name: input.name ?? null, status: 'pending' })
    .select()
    .single()
  if (error) return null
  return data as Workout
}

export async function updateWorkoutName(id: string, name: string): Promise<boolean> {
  const { error } = await supabase.from('workouts').update({ name }).eq('id', id)
  return !error
}

export async function deleteWorkout(id: string): Promise<boolean> {
  const { error } = await supabase.from('workouts').delete().eq('id', id)
  return !error
}

/**
 * Fluxo de texto: texto livre → parsing Claude → salva exercícios.
 * Alternativa ao áudio — o trainer digita ou cola a descrição do treino.
 */
export async function processWorkoutText(
  workoutId: string,
  text: string,
  athleteId?: string,
): Promise<Exercise[] | null> {
  await supabase.from('workouts').update({ status: 'parsing', transcript: text }).eq('id', workoutId)

  const parseResult = await parseWorkoutFromTranscript(text, workoutId)
  if (!parseResult) {
    await supabase.from('workouts').update({ status: 'error' }).eq('id', workoutId)
    return null
  }

  const [videoIds, historyWeights] = await Promise.all([
    Promise.all(parseResult.exercises.map(async (ex) => {
      const videos = await searchExerciseVideo(ex.name)
      return videos[0]?.id ?? null
    })),
    athleteId ? getLastWeightsByAthlete(athleteId) : Promise.resolve({} as Record<string, number>),
  ])

  const exercises = parseResult.exercises.map((ex, i) => ({
    ...ex,
    workout_id: workoutId,
    order_index: i,
    youtube_video_id: videoIds[i] ?? null,
    weight_kg: ex.weight_kg ?? historyWeights[ex.name.toLowerCase().trim()] ?? null,
  }))

  const { error: insertError } = await supabase.from('exercises').insert(exercises)
  if (insertError) {
    await supabase.from('workouts').update({ status: 'error' }).eq('id', workoutId)
    return null
  }

  await supabase
    .from('workouts')
    .update({ status: 'ready', raw_json: parseResult.exercises })
    .eq('id', workoutId)

  return exercises as unknown as Exercise[]
}

/**
 * Fluxo completo: áudio → transcrição → parsing Claude → salva exercícios.
 * Retorna os exercícios ou null se qualquer etapa falhar.
 */
export async function processWorkoutAudio(
  workoutId: string,
  audioFile: File,
  athleteId?: string,
): Promise<Exercise[] | null> {
  // 1. Transcrever
  await supabase.from('workouts').update({ status: 'transcribing' }).eq('id', workoutId)
  const transcribeResult = await transcribeAudio(audioFile, workoutId)
  if (!transcribeResult) {
    await supabase.from('workouts').update({ status: 'error' }).eq('id', workoutId)
    return null
  }

  // 2. Parsear com Claude
  await supabase
    .from('workouts')
    .update({ status: 'parsing', transcript: transcribeResult.transcript, audio_url: transcribeResult.audioUrl })
    .eq('id', workoutId)

  const parseResult = await parseWorkoutFromTranscript(transcribeResult.transcript, workoutId)
  if (!parseResult) {
    await supabase.from('workouts').update({ status: 'error' }).eq('id', workoutId)
    return null
  }

  // 3. Vídeos + histórico de cargas em paralelo
  const [videoIds, historyWeights] = await Promise.all([
    Promise.all(parseResult.exercises.map(async (ex) => {
      const videos = await searchExerciseVideo(ex.name)
      return videos[0]?.id ?? null
    })),
    athleteId ? getLastWeightsByAthlete(athleteId) : Promise.resolve({} as Record<string, number>),
  ])

  // 4. Salvar exercícios — weight_kg: IA > histórico > null
  const exercises = parseResult.exercises.map((ex, i) => ({
    ...ex,
    workout_id: workoutId,
    order_index: i,
    youtube_video_id: videoIds[i] ?? null,
    weight_kg: ex.weight_kg ?? historyWeights[ex.name.toLowerCase().trim()] ?? null,
  }))

  const { error: insertError } = await supabase.from('exercises').insert(exercises)
  if (insertError) {
    await supabase.from('workouts').update({ status: 'error' }).eq('id', workoutId)
    return null
  }

  await supabase
    .from('workouts')
    .update({ status: 'ready', raw_json: parseResult.exercises })
    .eq('id', workoutId)

  return exercises as unknown as Exercise[]
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export interface UpdateExerciseInput {
  sets?: number
  reps?: number
  weight_kg?: number | null
  rest_seconds?: number
  notes?: string | null
}

export async function updateExercise(id: string, input: UpdateExerciseInput): Promise<boolean> {
  const { error } = await supabase.from('exercises').update(input).eq('id', id)
  return !error
}

/**
 * Retorna a última carga usada por exercício para um atleta.
 * Chave: nome do exercício normalizado (lowercase trim).
 * Percorre set_logs do mais recente para o mais antigo e pega a primeira
 * ocorrência de cada nome — garantindo que é a carga mais recente.
 */
export async function getLastWeightsByAthlete(athleteId: string): Promise<Record<string, number>> {
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id')
    .eq('athlete_id', athleteId)

  if (sessErr || !sessions || sessions.length === 0) return {}

  const sessionIds = sessions.map((s: { id: string }) => s.id)

  const { data: logs, error: logsErr } = await supabase
    .from('set_logs')
    .select('weight_kg, completed_at, exercises(name)')
    .in('session_id', sessionIds)
    .eq('deleted', false)
    .not('weight_kg', 'is', null)
    .order('completed_at', { ascending: false })

  if (logsErr || !logs) return {}

  const map: Record<string, number> = {}
  for (const row of logs as unknown as { weight_kg: number; exercises: { name: string } }[]) {
    const key = row.exercises?.name?.toLowerCase().trim()
    if (key && !(key in map)) {
      map[key] = row.weight_kg
    }
  }
  return map
}

export async function getExercises(workoutId: string): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('workout_id', workoutId)
    .order('order_index')
  if (error) return []
  return data as Exercise[]
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function startSession(workoutId: string, athleteId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ workout_id: workoutId, athlete_id: athleteId, started_at: new Date().toISOString() })
    .select()
    .single()
  if (error) return null
  return data as Session
}

export async function getAthleteSessions(athleteId: string): Promise<SessionWithLogs[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, set_logs(*, exercises(name))')
    .eq('athlete_id', athleteId)
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: false })
  if (error) return []
  return data as unknown as SessionWithLogs[]
}

export async function completeSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sessions')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', sessionId)
  return !error
}

// ─── Set logs ─────────────────────────────────────────────────────────────────

/**
 * Registra uma série completada pelo aluno.
 * set_logs são dados críticos — nunca deletar, apenas marcar deleted=true.
 */
export async function logSet(input: LogSetInput): Promise<SetLog | null> {
  const { data, error } = await supabase
    .from('set_logs')
    .insert({
      session_id: input.session_id,
      exercise_id: input.exercise_id,
      set_number: input.set_number,
      reps_done: input.reps_done,
      weight_kg: input.weight_kg ?? null,
      completed_at: new Date().toISOString(),
      deleted: false,
    })
    .select()
    .single()
  if (error) return null
  return data as SetLog
}

export async function getSetLogs(sessionId: string): Promise<SetLog[]> {
  const { data, error } = await supabase
    .from('set_logs')
    .select('*')
    .eq('session_id', sessionId)
    .eq('deleted', false)
    .order('completed_at')
  if (error) return []
  return data as SetLog[]
}

// ─── Class check-ins ──────────────────────────────────────────────────────────

export async function checkInAthlete(athleteId: string): Promise<ClassCheckin | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const { data, error } = await supabase
    .from('class_checkins')
    .insert({ trainer_id: session.user.id, athlete_id: athleteId })
    .select()
    .single()
  if (error) { console.error('[checkInAthlete]', error); return null }
  return data as ClassCheckin
}

export async function getAthleteCheckins(athleteId: string): Promise<ClassCheckin[]> {
  const { data, error } = await supabase
    .from('class_checkins')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('checked_at', { ascending: false })
  if (error) return []
  return data as ClassCheckin[]
}

export async function getCheckinCountsByTrainer(trainerId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('class_checkins')
    .select('athlete_id')
    .eq('trainer_id', trainerId)
  if (error || !data) return {}
  const counts: Record<string, number> = {}
  for (const row of data as { athlete_id: string }[]) {
    counts[row.athlete_id] = (counts[row.athlete_id] ?? 0) + 1
  }
  return counts
}

export async function updateAthleteSessionPackage(athleteId: string, sessionsTotal: number): Promise<boolean> {
  const { error } = await supabase
    .from('athletes')
    .update({ sessions_total: sessionsTotal })
    .eq('id', athleteId)
  return !error
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export function isBillingDue(athlete: Athlete): boolean {
  if (!athlete.billing_day || !athlete.billing_amount) return false
  const today = new Date()
  if (today.getDate() < athlete.billing_day) return false
  if (!athlete.last_paid_at) return true
  const [paidYear, paidMonth] = athlete.last_paid_at.split('-').map(Number)
  return paidYear < today.getFullYear() || paidMonth < today.getMonth() + 1
}

export async function confirmPayment(athleteId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase
    .from('athletes')
    .update({ last_paid_at: today })
    .eq('id', athleteId)
  return !error
}

export async function updateAthleteBilling(
  athleteId: string,
  billingDay: number | null,
  billingAmount: number | null,
): Promise<boolean> {
  const { error } = await supabase
    .from('athletes')
    .update({ billing_day: billingDay, billing_amount: billingAmount })
    .eq('id', athleteId)
  return !error
}

export async function updateTrainerPixKey(pixKey: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return false
  const { error } = await supabase
    .from('trainers')
    .update({ pix_key: pixKey || null })
    .eq('id', session.user.id)
  return !error
}
