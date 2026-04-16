// ─── Enums ────────────────────────────────────────────────────────────────────

export type WorkoutStatus = 'pending' | 'transcribing' | 'parsing' | 'ready' | 'error'

export type UserPlan = 'free' | 'pro'

export type UserRole = 'trainer' | 'athlete'

// ─── Database entities ────────────────────────────────────────────────────────

export interface Trainer {
  id: string
  email: string
  name: string
  stripe_customer_id: string | null
  plan: UserPlan
  created_at: string
}

export interface Athlete {
  id: string
  trainer_id: string
  name: string
  email: string
  invite_token: string
  created_at: string
  auth_user_id: string | null
}

export interface Workout {
  id: string
  trainer_id: string
  athlete_id: string
  audio_url: string | null
  transcript: string | null
  raw_json: Exercise[] | null
  status: WorkoutStatus
  created_at: string
}

export interface Exercise {
  id: string
  workout_id: string
  name: string
  sets: number
  reps: number
  rest_seconds: number
  notes: string | null
  youtube_video_id: string | null
  order_index: number
}

export interface Session {
  id: string
  workout_id: string
  athlete_id: string
  started_at: string
  completed_at: string | null
  notes: string | null
}

export interface SetLog {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  reps_done: number
  weight_kg: number | null
  completed_at: string
  // soft-delete: nunca deletar set_logs, apenas marcar
  deleted: boolean
}

// ─── Histórico ────────────────────────────────────────────────────────────────

export interface SetLogWithExercise extends SetLog {
  exercises: Pick<Exercise, 'name'>
}

export interface SessionWithLogs extends Session {
  set_logs: SetLogWithExercise[]
}

// ─── API / request shapes ─────────────────────────────────────────────────────

export interface CreateWorkoutInput {
  athlete_id: string
  audio_url?: string
}

export interface LogSetInput {
  session_id: string
  exercise_id: string
  set_number: number
  reps_done: number
  weight_kg?: number
}

// ─── Auth state ───────────────────────────────────────────────────────────────

export interface AuthState {
  role: UserRole | null
  trainer: Trainer | null
  athlete: Athlete | null
  loading: boolean
}
