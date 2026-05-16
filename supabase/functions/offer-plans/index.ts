import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { trainer_name, trainer_email } = await req.json()

    if (!trainer_email) {
      return new Response(JSON.stringify({ error: 'trainer_email required' }), { status: 400, headers: corsHeaders })
    }

    const name = trainer_name ?? 'Personal'
    const plansLink = 'https://kinevia.com.br/planos'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kinevia <no-reply@kinevia.com.br>',
        to: trainer_email,
        subject: `Chega de perder tempo montando Treinos, ${name}!`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0E0D0B;color:#F2EFE9;border-radius:12px;">

            <div style="font-size:13px;font-family:monospace;letter-spacing:0.1em;text-transform:uppercase;color:#C8A96E;margin-bottom:24px;">Kinevia</div>

            <div style="font-size:24px;font-weight:700;line-height:1.3;margin-bottom:16px;">
              Escale sua consultoria sem escalar seu tempo
            </div>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:16px;">
              Olá, <strong style="color:#F2EFE9">${name}</strong>,
            </p>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:32px;">
              Sabemos que a vida de um personal é corrida. Atender alunos, ajustar agenda e, no final do dia, ainda dedicar horas para montar fichas de treino pode ser exaustivo.
            </p>

            <div style="background:#1F1D1A;border:1px solid #2A2823;border-radius:10px;padding:24px;margin-bottom:32px;">
              <div style="font-size:12px;font-family:monospace;letter-spacing:0.08em;text-transform:uppercase;color:#7A7567;margin-bottom:16px;">O que você desbloqueia no Pro</div>

              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <span style="color:#C8A96E;font-size:16px;">✦</span>
                <span style="color:#F2EFE9;font-size:14px;line-height:1.5;">Criação de treinos por áudio com IA</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <span style="color:#C8A96E;font-size:16px;">✦</span>
                <span style="color:#F2EFE9;font-size:14px;line-height:1.5;">Gestão ilimitada de alunos</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <span style="color:#C8A96E;font-size:16px;">✦</span>
                <span style="color:#F2EFE9;font-size:14px;line-height:1.5;">Modelos personalizados de treinos</span>
              </div>
            </div>

            <a href="${plansLink}"
              style="display:inline-block;background:#C8A96E;color:#0A0909;font-weight:700;font-size:14px;padding:14px 32px;border-radius:999px;text-decoration:none;margin-bottom:32px;">
              Escolha seu plano e otimize seu tempo
            </a>

            <p style="color:#B8B2A3;font-size:14px;line-height:1.6;margin-bottom:0;">
              Não deixe que o tempo limite seu crescimento. Dê um upgrade na sua carreira hoje mesmo.
            </p>

            <div style="margin-top:40px;padding-top:24px;border-top:1px solid #1F1D1A;">
              <p style="font-size:12px;color:#4A463C;margin:0;">Abraços — Equipe Kinevia</p>
            </div>
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
