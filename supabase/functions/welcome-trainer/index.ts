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
    const dashboardLink = 'https://kinevia.com.br/dashboard'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kinevia <no-reply@kinevia.com.br>',
        to: trainer_email,
        subject: 'Bem-vindo ao Kinevia! Vamos otimizar sua rotina?',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0E0D0B;color:#F2EFE9;border-radius:12px;">

            <div style="font-size:13px;font-family:monospace;letter-spacing:0.1em;text-transform:uppercase;color:#C8A96E;margin-bottom:24px;">Kinevia</div>

            <div style="font-size:24px;font-weight:700;line-height:1.3;margin-bottom:16px;">
              Bem-vindo ao Kinevia! 🎉
            </div>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:16px;">
              Olá, <strong style="color:#F2EFE9">${name}</strong>,
            </p>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:16px;">
              Parabéns por dar o primeiro passo para otimizar seu tempo na prescrição de treinos. Agora, você faz parte do time de profissionais que decidiu parar de perder horas montando planilhas e focar no que realmente importa: <strong style="color:#F2EFE9">o resultado dos seus alunos</strong>.
            </p>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:32px;">
              O Kinevia foi desenhado para ser o seu braço direito. Com ele, você consegue criar treinos completos em minutos, mantendo a organização e a qualidade que seus clientes esperam.
            </p>

            <div style="background:#1F1D1A;border:1px solid #2A2823;border-radius:10px;padding:24px;margin-bottom:32px;">
              <div style="font-size:12px;font-family:monospace;letter-spacing:0.08em;text-transform:uppercase;color:#7A7567;margin-bottom:16px;">Por onde começar</div>
              <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
                <span style="background:#C8A96E;color:#0A0909;font-weight:700;font-size:11px;font-family:monospace;padding:2px 8px;border-radius:999px;white-space:nowrap;">01</span>
                <span style="color:#F2EFE9;font-size:14px;line-height:1.5;">Acesse o painel e configure seu perfil</span>
              </div>
              <div style="display:flex;align-items:flex-start;gap:12px;">
                <span style="background:#C8A96E;color:#0A0909;font-weight:700;font-size:11px;font-family:monospace;padding:2px 8px;border-radius:999px;white-space:nowrap;">02</span>
                <span style="color:#F2EFE9;font-size:14px;line-height:1.5;">Adicione seu primeiro aluno e crie um treino por áudio</span>
              </div>
            </div>

            <a href="${dashboardLink}"
              style="display:inline-block;background:#C8A96E;color:#0A0909;font-weight:700;font-size:14px;padding:14px 32px;border-radius:999px;text-decoration:none;margin-bottom:32px;">
              Acessar meu painel
            </a>

            <p style="color:#B8B2A3;font-size:14px;line-height:1.6;margin-bottom:0;">
              Se tiver qualquer dúvida, é só responder a este e-mail. Estamos aqui para te apoiar.
            </p>

            <div style="margin-top:40px;padding-top:24px;border-top:1px solid #1F1D1A;">
              <p style="font-size:12px;color:#4A463C;margin:0;">Bons treinos — Equipe Kinevia</p>
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
