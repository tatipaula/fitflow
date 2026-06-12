import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
}

type Recipient = { email: string; name?: string }

function firstName(name?: string): string {
  const n = (name ?? '').trim().split(/\s+/)[0] || 'Personal'
  return n.charAt(0).toUpperCase() + n.slice(1)
}

function emailHtml(name: string): string {
  const cta = 'https://kinevia.com.br/trainer'
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0E0D0B;color:#F2EFE9;border-radius:12px;">
      <div style="font-size:13px;font-family:monospace;letter-spacing:0.1em;text-transform:uppercase;color:#C8A96E;margin-bottom:24px;">Kinevia</div>

      <div style="font-size:23px;font-weight:700;line-height:1.3;margin-bottom:20px;">
        Veja o Kinevia funcionando antes de cadastrar seu primeiro aluno
      </div>

      <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:16px;">
        Olá, <strong style="color:#F2EFE9">${name}</strong>,
      </p>

      <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:16px;">
        Sabemos que cadastrar o primeiro aluno dá um certo trabalho — e que dá vontade de ver a ferramenta rodando antes disso. Por isso criamos um jeito de você conhecer o Kinevia por dentro sem precisar de ninguém ainda.
      </p>

      <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:32px;">
        Com um clique, você cria um <strong style="color:#F2EFE9">aluno de demonstração</strong> já com um treino completo: exercícios, cargas, descanso e vídeos. Dá para navegar, editar e ver exatamente como seus alunos vão receber tudo.
      </p>

      <div style="background:#1F1D1A;border:1px solid #2A2823;border-radius:10px;padding:24px;margin-bottom:32px;">
        <div style="font-size:12px;font-family:monospace;letter-spacing:0.08em;text-transform:uppercase;color:#7A7567;margin-bottom:16px;">Como fazer</div>
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
          <span style="background:#C8A96E;color:#0A0909;font-weight:700;font-size:11px;font-family:monospace;padding:2px 8px;border-radius:999px;white-space:nowrap;">01</span>
          <span style="color:#F2EFE9;font-size:14px;line-height:1.5;">Acesse o seu painel</span>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
          <span style="background:#C8A96E;color:#0A0909;font-weight:700;font-size:11px;font-family:monospace;padding:2px 8px;border-radius:999px;white-space:nowrap;">02</span>
          <span style="color:#F2EFE9;font-size:14px;line-height:1.5;">Toque em "Criar aluno de teste"</span>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <span style="background:#C8A96E;color:#0A0909;font-weight:700;font-size:11px;font-family:monospace;padding:2px 8px;border-radius:999px;white-space:nowrap;">03</span>
          <span style="color:#F2EFE9;font-size:14px;line-height:1.5;">Explore o treino, edite e assista aos vídeos</span>
        </div>
      </div>

      <a href="${cta}"
        style="display:inline-block;background:#C8A96E;color:#0A0909;font-weight:700;font-size:14px;padding:14px 32px;border-radius:999px;text-decoration:none;margin-bottom:32px;">
        Criar meu aluno de teste
      </a>

      <p style="color:#B8B2A3;font-size:14px;line-height:1.6;margin-bottom:0;">
        Quando estiver pronto, é só remover o aluno de teste e cadastrar o real. Qualquer dúvida, responda a este e-mail.
      </p>

      <div style="margin-top:40px;padding-top:24px;border-top:1px solid #1F1D1A;">
        <p style="font-size:12px;color:#4A463C;margin:0;">Bons treinos — Equipe Kinevia</p>
      </div>
    </div>
  `
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Guarda: só dispara com o token dedicado (secret ANNOUNCE_TOKEN), passado em x-admin-token.
  const admin = req.headers.get('x-admin-token')
  if (!admin || admin !== Deno.env.get('ANNOUNCE_TOKEN')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
  }

  try {
    const { recipients } = await req.json() as { recipients: Recipient[] }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'recipients[] required' }), { status: 400, headers: corsHeaders })
    }

    const results: Array<{ email: string; ok: boolean; id?: string; error?: string }> = []
    for (const r of recipients) {
      if (!r?.email) { results.push({ email: String(r?.email), ok: false, error: 'no email' }); continue }
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Kinevia <no-reply@kinevia.com.br>',
          to: r.email,
          subject: 'Teste o Kinevia com um aluno de demonstração',
          html: emailHtml(firstName(r.name)),
        }),
      })
      const body = await res.json().catch(() => ({}))
      results.push({ email: r.email, ok: res.ok, id: body?.id, error: res.ok ? undefined : JSON.stringify(body) })
    }

    return new Response(JSON.stringify({ sent: results.filter((x) => x.ok).length, total: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})
