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
