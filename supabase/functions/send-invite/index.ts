import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { athlete_name, athlete_email, trainer_name, invite_link } = await req.json()

    if (!athlete_email || !invite_link) {
      return new Response(JSON.stringify({ error: 'athlete_email and invite_link required' }), { status: 400, headers: corsHeaders })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kinevia <onboarding@resend.dev>',
        to: athlete_email,
        subject: `${trainer_name ?? 'Seu personal trainer'} te convidou para o Kinevia`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0E0D0B;color:#F2EFE9;border-radius:12px;">
            <div style="font-size:22px;font-weight:600;margin-bottom:8px;">Você foi convidado 🏋️</div>
            <p style="color:#B8B2A3;font-size:15px;line-height:1.6;margin-bottom:24px;">
              Olá${athlete_name ? `, <strong style="color:#F2EFE9">${athlete_name}</strong>` : ''}!<br>
              <strong style="color:#F2EFE9">${trainer_name ?? 'Seu personal trainer'}</strong> te convidou para acompanhar seus treinos no Kinevia.
            </p>
            <div style="background:#1F1D1A;border:1px solid #2A2823;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
              <div style="font-size:13px;color:#7A7567;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;font-family:monospace;">Seu link de acesso</div>
              <div style="font-size:13px;color:#d4a017;word-break:break-all;">${invite_link}</div>
            </div>
            <a href="${invite_link}"
              style="display:inline-block;background:#d4a017;color:#0A0A08;font-weight:700;font-size:14px;padding:12px 28px;border-radius:999px;text-decoration:none;">
              Ativar meu acesso
            </a>
            <p style="margin-top:32px;font-size:12px;color:#4A463C;">Este link expira em 7 dias. Kinevia · App de acompanhamento de treinos.</p>
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
