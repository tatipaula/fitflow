/**
 * Wrapper para Claude API (claude-haiku-4-5).
 * REGRA: toda função deve ter try/catch e retornar null em caso de erro,
 * permitindo ao chamador exibir fallback visível ao usuário.
 * Chamadas ao Claude são feitas via Supabase Edge Functions — nunca expor
 * ANTHROPIC_API_KEY no frontend.
 */

import type { Exercise } from '@/types'
import { supabase } from './supabase'

export interface ParseWorkoutResult {
  exercises: Omit<Exercise, 'id' | 'workout_id' | 'order_index'>[]
  rawJson: string
}

/**
 * Envia a transcrição para a Edge Function que chama o Claude e retorna
 * os exercícios como JSON estruturado.
 * Retorna null se o parsing falhar — o chamador deve exibir mensagem de erro.
 */
export async function parseWorkoutFromTranscript(
  transcript: string,
  workoutId: string,
): Promise<ParseWorkoutResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('parse-workout', {
      body: { transcript, workout_id: workoutId },
    })

    if (error) throw error
    if (!data?.exercises) throw new Error('Resposta inválida da IA')

    return {
      exercises: data.exercises as ParseWorkoutResult['exercises'],
      rawJson: JSON.stringify(data.exercises),
    }
  } catch (err) {
    console.error('[claude] Erro ao parsear treino:', err)
    return null
  }
}
