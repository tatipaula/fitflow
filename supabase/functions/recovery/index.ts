import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { trainer_name, trainer_email, checkout_link } = await req.json()

    if (!trainer_email) {
      return new Response(JSON.stringify({ error: 'trainer_email required' }), { status: 400, headers: corsHeaders })
    }

    const name = trainer_name ?? 'Personal'
    const link = checkout_link ?? 'https://kinevia.com.br/planos'
    const supportEmail = 'suporte@kinevia.com.br'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kinevia <no-reply@kinevia.com.br>',
        to: trainer_email,
        subject: `Ainda pensando no plano, ${name}?`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0E0D0B;color:#F2EFE9;border-radius:12px;">

            <div style="font-size:13px;font-family:monospace;letter-spacing:0.1em;text-transform:uppercase;color:#C8A96E;margin-bottom:24px;">Kinevia</div>

            <div style="font-size:24px;font-weight:700;line-height:1.3;margin-bottom:16px;">
              Sua assinatura está esperando por você
            </div>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:16px;">
              Olá, <strong style="color:#F2EFE9">${name}</strong>,
            </p>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:16px;">
              Notei que você iniciou o processo de assinatura do Kinevia, mas não concluiu.
            </p>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:32px;">
              Sabemos que às vezes surge uma dúvida de última hora ou uma interrupção na rotina. Gostaria de saber se você encontrou alguma dificuldade ou se tem alguma dúvida sobre o App que podemos esclarecer para você.
            </p>

            <a href="${link}"
              style="display:inline-block;background:#C8A96E;color:#0A0909;font-weight:700;font-size:14px;padding:14px 32px;border-radius:999px;text-decoration:none;margin-bottom:32px;">
              Finalizar minha assinatura agora
            </a>

            <div style="background:#1F1D1A;border:1px solid #2A2823;border-radius:10px;padding:20px 24px;margin-bottom:32px;">
              <p style="color:#B8B2A3;font-size:14px;line-height:1.6;margin:0;">
                Tem alguma dúvida? Basta responder a este e-mail ou falar direto com a gente em
                <a href="mailto:${supportEmail}" style="color:#C8A96E;text-decoration:none;">${supportEmail}</a>.
                Teremos o prazer de te ajudar.
              </p>
            </div>

            <div style="margin-top:40px;padding-top:24px;border-top:1px solid #1F1D1A;">
              <p style="font-size:12px;color:#4A463C;margin:0;">Atenciosamente — Equipe Kinevia</p>
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
