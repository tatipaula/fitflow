import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { workout_id } = await req.json()
    if (!workout_id) return new Response(JSON.stringify({ error: 'workout_id required' }), { status: 400, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Busca workout + atleta + trainer
    const { data: workout } = await supabase
      .from('workouts')
      .select('name, created_at, athlete_id, trainer_id')
      .eq('id', workout_id)
      .single()

    if (!workout) return new Response(JSON.stringify({ error: 'workout not found' }), { status: 404, headers: corsHeaders })

    const { data: athlete } = await supabase
      .from('athletes')
      .select('name, email')
      .eq('id', workout.athlete_id)
      .single()

    const { data: trainer } = await supabase
      .from('trainers')
      .select('name')
      .eq('id', workout.trainer_id)
      .single()

    if (!athlete) return new Response(JSON.stringify({ error: 'athlete not found' }), { status: 404, headers: corsHeaders })

    const workoutName = workout.name ?? 'Treino sem nome'
    const trainerName = trainer?.name ?? 'Seu personal trainer'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kinevia <no-reply@kinevia.com.br>',
        to: athlete.email,
        subject: `Novo treino disponível: ${workoutName}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0E0D0B;color:#F2EFE9;border-radius:12px;">
            <div style="font-size:22px;font-weight:600;margin-bottom:8px;">Novo treino disponível 💪</div>
            <p style="color:#B8B2A3;font-size:15px;line-height:1.6;margin-bottom:24px;">
              Olá, <strong style="color:#F2EFE9">${athlete.name}</strong>!<br>
              <strong style="color:#F2EFE9">${trainerName}</strong> criou uma nova ficha para você:
            </p>
            <div style="background:#1F1D1A;border:1px solid #2A2823;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
              <div style="font-size:18px;font-weight:600;color:#F2EFE9;">${workoutName}</div>
              <div style="font-size:13px;color:#7A7567;margin-top:4px;">
                ${new Date(workout.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <a href="https://kinevia.com.br/athlete"
              style="display:inline-block;background:#C8A96E;color:#0A0909;font-weight:700;font-size:14px;padding:12px 28px;border-radius:999px;text-decoration:none;">
              Ver meu treino
            </a>
            <p style="margin-top:32px;font-size:12px;color:#4A463C;">Kinevia · Você recebeu este email porque tem um treino ativo.</p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(JSON.stringify({ error: err }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})
