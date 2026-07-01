import { supabase } from './supabase'

export type PageEventName =
  // landing /trial
  | 'page_view'
  | 'section_view'
  | 'cta_click'
  | 'scroll_depth'
  | 'session_end'
  // funil de ativação in-app (trainer logado)
  | 'app_onboarding_view'
  | 'create_athlete_opened'
  | 'athlete_created'
  | 'invite_generated'
  | 'invite_copied'
  | 'workout_started'
  | 'workout_created'
  | 'activation_checklist_click'
  // funil de ativação in-app (aluno logado)
  | 'athlete_app_opened'
  | 'athlete_no_workout'
  | 'workout_opened'
  | 'workout_session_started'
  | 'first_set_logged'
  | 'workout_session_completed'

function getSessionId(): string {
  const key = 'kv_trial_sid'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

export async function track(
  event: PageEventName,
  data: Record<string, unknown> = {},
  userId?: string | null,
): Promise<void> {
  try {
    await supabase.from('page_events').insert({
      session_id: getSessionId(),
      event,
      data,
      page: window.location.pathname,
      referrer: document.referrer || null,
      ua: navigator.userAgent,
      // Eventos in-app carregam o trainer logado; landing fica null.
      user_id: userId ?? null,
    })
  } catch {
    // tracking nunca pode quebrar a página
  }
}

// Wrapper para o funil do aluno: usa o auth_user_id como user_id (não colide
// com trainers.id, então as queries separam por join ou por data.role) e
// EXCLUI alunos demo na origem — mesma regra dos KPIs de ativação.
export function trackAthlete(
  event: PageEventName,
  athlete: { id: string; auth_user_id?: string | null; is_demo?: boolean | null },
  data: Record<string, unknown> = {},
): void {
  if (athlete.is_demo) return
  void track(event, { ...data, role: 'athlete', athlete_id: athlete.id }, athlete.auth_user_id ?? null)
}
