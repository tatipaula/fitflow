import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: 'https://kinevia.com.br/reset-password' },
    })

    // Retorna ok mesmo se o email não existir para evitar enumeração de contas
    if (error || !data?.properties?.action_link) {
      console.log('[send-password-reset] generateLink skipped:', error?.message ?? 'no link')
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    const resetLink = data.properties.action_link

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kinevia <no-reply@kinevia.com.br>',
        to: email,
        subject: 'Redefinir senha — Kinevia',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0E0D0B;color:#F2EFE9;border-radius:12px;">

            <div style="font-size:13px;font-family:monospace;letter-spacing:0.1em;text-transform:uppercase;color:#C8A96E;margin-bottom:24px;">Kinevia</div>

            <div style="font-size:24px;font-weight:700;line-height:1.3;margin-bottom:16px;">
              Redefinir sua senha
            </div>

            <p style="color:#B8B2A3;font-size:15px;line-height:1.7;margin-bottom:32px;">
              Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.
            </p>

            <a href="${resetLink}"
              style="display:inline-block;background:#C8A96E;color:#0A0909;font-weight:700;font-size:14px;padding:14px 32px;border-radius:999px;text-decoration:none;margin-bottom:32px;">
              Redefinir minha senha
            </a>

            <div style="background:#1F1D1A;border:1px solid #2A2823;border-radius:10px;padding:20px 24px;margin-bottom:32px;">
              <p style="color:#B8B2A3;font-size:13px;line-height:1.6;margin:0;">
                Se você não solicitou a redefinição de senha, pode ignorar este email com segurança. Sua senha permanece a mesma.
              </p>
            </div>

            <p style="color:#7A7567;font-size:12px;line-height:1.6;margin-bottom:0;">
              Este link expira em 1 hora por questões de segurança.
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
      console.error('[send-password-reset] resend error:', err)
      return new Response(JSON.stringify({ error: err }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (e) {
    console.error('[send-password-reset] unexpected error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})
