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
    const loginLink = 'https://kinevia.com.br/login'
    const faqLink = 'https://kinevia.com.br/ajuda'
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
        subject: 'Acesso confirmado! Bem-vindo ao time Kinevia Pro ✅',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0E0D0B;color:#F2EFE9;border-radius:12px;">

            <div style="font-size:13px;font-family:monospace;letter-spacing:0.1em;text-transform:uppercase;color:#C8A96E;margin-bottom:24px;">Kinevia Pro</div>

            <div style="font-size:24px;font-weight:700;line-height:1.3;margin-bottom:16px;">
              Sua assinatura foi confirmada 🎯
            </div>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:16px;">
              Olá, <strong style="color:#F2EFE9">${name}</strong>,
            </p>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:16px;">
              Obrigado por confiar no Kinevia para elevar o nível do seu trabalho! Sua assinatura foi confirmada com sucesso e você já tem <strong style="color:#F2EFE9">acesso total a todas as ferramentas premium</strong>.
            </p>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:32px;">
              A partir de agora, você terá muito mais agilidade na prescrição de treinos e controle total sobre o progresso dos seus alunos.
            </p>

            <div style="background:#1F1D1A;border:1px solid #2A2823;border-radius:10px;padding:24px;margin-bottom:32px;">
              <div style="font-size:12px;font-family:monospace;letter-spacing:0.08em;text-transform:uppercase;color:#7A7567;margin-bottom:16px;">Links úteis</div>

              <div style="margin-bottom:12px;">
                <a href="${loginLink}" style="color:#C8A96E;font-size:14px;text-decoration:none;">→ Acessar minha conta</a>
              </div>
              <div style="margin-bottom:12px;">
                <a href="${faqLink}" style="color:#C8A96E;font-size:14px;text-decoration:none;">→ Central de Ajuda / FAQ</a>
              </div>
              <div>
                <a href="mailto:${supportEmail}" style="color:#C8A96E;font-size:14px;text-decoration:none;">→ Falar com o suporte</a>
              </div>
            </div>

            <a href="${loginLink}"
              style="display:inline-block;background:#C8A96E;color:#0A0909;font-weight:700;font-size:14px;padding:14px 32px;border-radius:999px;text-decoration:none;margin-bottom:32px;">
              Acessar meu painel Pro
            </a>

            <p style="color:#B8B2A3;font-size:14px;line-height:1.6;margin-bottom:0;">
              Prepare-se para transformar a sua produtividade. Estamos juntos nessa jornada!
            </p>

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
