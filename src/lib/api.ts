/**
 * Camada central de acesso a dados.
 * REGRA: componentes NUNCA fazem fetch direto — importam daqui.
 * Este arquivo importa os wrappers de /src/lib e o cliente Supabase.
 */

import type {
  Athlete,
  CreateWorkoutInput,
  Exercise,
  LogSetInput,
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
    .select('id, trainer_id, name, email, invite_token, created_at')
    .single()
  if (error) { console.error('[createAthlete]', error); return null }
  return data as Athlete
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
    .insert({ trainer_id: user.id, athlete_id: input.athlete_id, status: 'pending' })
    .select()
    .single()
  if (error) return null
  return data as Workout
}

/**
 * Fluxo completo: áudio → transcrição → parsing Claude → salva exercícios.
 * Retorna os exercícios ou null se qualquer etapa falhar.
 */
export async function processWorkoutAudio(
  workoutId: string,
  audioFile: File,
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

  // 3. Buscar vídeos do YouTube para cada exercício (best-effort — não bloqueia o fluxo)
  const videoIds = await Promise.all(
    parseResult.exercises.map(async (ex) => {
      const videos = await searchExerciseVideo(ex.name)
      return videos[0]?.id ?? null
    })
  )

  // 4. Salvar exercícios e marcar como pronto
  const exercises = parseResult.exercises.map((ex, i) => ({
    ...ex,
    workout_id: workoutId,
    order_index: i,
    youtube_video_id: videoIds[i] ?? null,
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
