import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { audio_url } = await req.json()
    if (!audio_url) throw new Error('audio_url é obrigatório')

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new Error('OPENAI_API_KEY não configurada')

    // Buscar o arquivo de áudio do Supabase Storage
    const audioResponse = await fetch(audio_url)
    if (!audioResponse.ok) throw new Error(`Falha ao buscar áudio: ${audioResponse.status}`)

    const audioBlob = await audioResponse.blob()

    // Detectar extensão pela URL para nomear o arquivo corretamente
    const ext = audio_url.split('.').pop()?.split('?')[0] ?? 'webm'

    const formData = new FormData()
    formData.append('file', audioBlob, `audio.${ext}`)
    formData.append('model', 'whisper-1')
    formData.append('language', 'pt')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      throw new Error(`Whisper API: ${err}`)
    }

    const { text } = await whisperRes.json()
    if (!text) throw new Error('Transcrição vazia retornada pelo Whisper')

    return new Response(JSON.stringify({ transcript: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[transcribe-audio]', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
