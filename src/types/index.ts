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
  pix_key: string | null
  created_at: string
}

export interface Athlete {
  id: string
  trainer_id: string
  name: string
  email: string | null
  phone: string | null
  weight_kg: number | null
  invite_token: string
  created_at: string
  auth_user_id: string | null
  sessions_total: number
  billing_day: number | null
  billing_amount: number | null
  last_paid_at: string | null
}

export interface ClassCheckin {
  id: string
  trainer_id: string
  athlete_id: string
  checked_at: string
  notes: string | null
  created_at: string
}

export interface Invite {
  id: string
  trainer_id: string
  athlete_id: string
  token: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export interface InviteWithAthlete extends Invite {
  athletes: Pick<Athlete, 'id' | 'name' | 'email' | 'phone'>
}

export interface Workout {
  id: string
  trainer_id: string
  athlete_id: string
  name: string | null
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
  weight_kg: number | null
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
  deleted: boolean
}

export interface ParqResponse {
  id: string
  athlete_id: string
  q1: boolean; q2: boolean; q3: boolean; q4: boolean
  q5: boolean; q6: boolean; q7: boolean
  has_any_yes: boolean
  created_at: string
}

// ─── Histórico ────────────────────────────────────────────────────────────────

export interface SetLogWithExercise extends SetLog {
  exercises: Pick<Exercise, 'name'>
}

export interface SessionWithLogs extends Session {
  set_logs: SetLogWithExercise[]
}

// ─── API / request shapes ─────────────────────────────────────────────────────

export interface CreateAthleteInput {
  name: string
  email?: string
  phone?: string
  weight_kg?: number
}

export interface CreateWorkoutInput {
  athlete_id: string
  name?: string
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
