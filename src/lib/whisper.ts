/**
 * Wrapper para OpenAI Whisper API.
 * A chave OPENAI_API_KEY nunca é exposta no frontend — a transcrição
 * é feita via Supabase Edge Function.
 */

import { supabase } from './supabase'

export interface TranscribeResult {
  transcript: string
  audioUrl: string
}

/**
 * Faz upload do áudio e dispara a transcrição via Edge Function.
 * Retorna null em caso de falha.
 */
export async function transcribeAudio(
  audioFile: File,
  workoutId: string,
): Promise<TranscribeResult | null> {
  try {
    // 1. Upload do áudio para o Supabase Storage
    const filePath = `workouts/${workoutId}/${audioFile.name}`
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filePath, audioFile)

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from('audio').getPublicUrl(filePath)
    const audioUrl = urlData.publicUrl

    // 2. Chamar Edge Function para transcrever
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: { audio_url: audioUrl, workout_id: workoutId },
    })

    if (error) throw error
    if (!data?.transcript) throw new Error('Transcrição vazia')

    return { transcript: data.transcript as string, audioUrl }
  } catch (err) {
    console.error('[whisper] Erro ao transcrever áudio:', err)
    return null
  }
}
