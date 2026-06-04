import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { /* empty body = batch mode */ }

    // Batch mode: sem trainer_email no body → consulta DB e envia para todos expirando em D-3
    if (!body.trainer_email) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )

      const d3 = new Date()
      d3.setDate(d3.getDate() + 3)
      const dayStart = `${d3.toISOString().split('T')[0]}T00:00:00.000Z`
      const dayEnd   = `${d3.toISOString().split('T')[0]}T23:59:59.999Z`

      const { data: trainers, error } = await supabase
        .from('trainers')
        .select('name, email')
        .eq('plan', 'free')
        .not('trial_ends_at', 'is', null)
        .gte('trial_ends_at', dayStart)
        .lte('trial_ends_at', dayEnd)

      if (error) {
        console.error('[offer-plans] db error', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
      }

      let sent = 0
      const errors: string[] = []

      for (const t of trainers ?? []) {
        try {
          await sendOfferEmail(t.name, t.email)
          sent++
        } catch (e) {
          errors.push(`${t.email}: ${String(e)}`)
        }
      }

      console.log(`[offer-plans] batch done — sent: ${sent}, errors: ${errors.length}`)
      return new Response(JSON.stringify({ sent, errors }), { headers: corsHeaders })
    }

    // Single mode (teste manual)
    const { trainer_name, trainer_email } = body as { trainer_name?: string; trainer_email: string }
    if (!trainer_email) {
      return new Response(JSON.stringify({ error: 'trainer_email required' }), { status: 400, headers: corsHeaders })
    }
    await sendOfferEmail(trainer_name ?? 'Personal', trainer_email)
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (e) {
    console.error('[offer-plans] unexpected error', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})

async function sendOfferEmail(name: string, email: string): Promise<void> {
  const plansLink = 'https://kinevia.com.br/trainer'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Kinevia <no-reply@kinevia.com.br>',
      to: email,
      subject: `Seu trial acaba em 3 dias, ${name}!`,
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
            Seu período de trial acaba em <strong style="color:#F2EFE9">3 dias</strong>. Para continuar usando o Kinevia sem interrupções, garanta seu plano Pro agora.
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
            Assinar agora — R$49/mês
          </a>

          <p style="color:#B8B2A3;font-size:14px;line-height:1.6;margin-bottom:0;">
            Não deixe que o tempo limite seu crescimento.
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
    throw new Error(err)
  }
}
