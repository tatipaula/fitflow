import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `Você é um assistente especializado em treinos fitness.
Extraia os exercícios da transcrição fornecida e retorne APENAS um JSON válido.

Formato obrigatório:
{
  "exercises": [
    {
      "name": "nome do exercício em português",
      "sets": <número inteiro de séries>,
      "reps": <número inteiro de repetições por série>,
      "weight_kg": <peso em kg como número decimal, ou null se não mencionado>,
      "rest_seconds": <descanso em segundos, inteiro>,
      "notes": "<observações ou null>",
      "youtube_video_id": null
    }
  ]
}

Regras:
- Se um valor não for mencionado, use defaults: sets=3, reps=10, rest_seconds=60
- weight_kg deve ser null se o peso não for mencionado explicitamente
- notes deve ser null se não houver observação
- youtube_video_id sempre null (será preenchido depois)
- Retorne APENAS o JSON, sem texto antes ou depois`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { transcript } = await req.json()
    if (!transcript) throw new Error('transcript é obrigatório')

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: transcript }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      console.error('[parse-workout] Claude API status:', claudeRes.status, 'body:', err)
      throw new Error(`Claude API ${claudeRes.status}: ${err}`)
    }

    const claudeData = await claudeRes.json()
    const content: string = claudeData.content?.[0]?.text

    if (!content) throw new Error('Resposta vazia do Claude')

    // Extrair JSON da resposta (Claude pode retornar texto extra em alguns casos)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Claude não retornou JSON válido')

    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed.exercises)) throw new Error('Campo exercises ausente ou inválido')

    return new Response(JSON.stringify({ exercises: parsed.exercises }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[parse-workout]', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
