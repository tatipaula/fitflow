import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
// @ts-ignore — npm compat
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@kinevia.com.br'
const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY')

// Dia atual e amanhã em horário de Brasília (UTC-3)
function brasilDays(): { today: number; tomorrow: number } {
  const now = new Date()
  const brasilia = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const tomorrow = new Date(brasilia.getTime() + 24 * 60 * 60 * 1000)
  return { today: brasilia.getDate(), tomorrow: tomorrow.getDate() }
}

async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  title: string,
  body: string,
  url: string,
): Promise<void> {
  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify({ title, body, url }),
    )
  } catch (err) {
    console.error('[push] send error', err)
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Kinevia <onboarding@resend.dev>', to, subject, html }),
    })
  } catch (err) {
    console.error('[email] send error', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), { status: 500, headers: corsHeaders })
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { today, tomorrow } = brasilDays()

    // Busca atletas com vencimento hoje ou amanhã
    const { data: athletes, error } = await supabase
      .from('athletes')
      .select('id, name, billing_day, billing_amount, auth_user_id, trainer_id')
      .in('billing_day', [today, tomorrow])

    if (error) throw error
    if (!athletes || athletes.length === 0) {
      return new Response(JSON.stringify({ ok: true, notified: 0 }), { headers: corsHeaders })
    }

    // Agrupa por trainer
    const byTrainer: Record<string, typeof athletes> = {}
    for (const a of athletes) {
      if (!byTrainer[a.trainer_id]) byTrainer[a.trainer_id] = []
      byTrainer[a.trainer_id].push(a)
    }

    const trainerIds = Object.keys(byTrainer)

    // Busca dados dos trainers
    const { data: trainers } = await supabase
      .from('trainers')
      .select('id, name, email, pix_key')
      .in('id', trainerIds)

    // Busca push subscriptions de trainers
    const { data: trainerSubs } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', trainerIds)
      .eq('role', 'trainer')

    // Busca push subscriptions de atletas com auth_user_id
    const athleteAuthIds = athletes.map((a) => a.auth_user_id).filter(Boolean)
    const { data: athleteSubs } = athleteAuthIds.length > 0
      ? await supabase
          .from('push_subscriptions')
          .select('user_id, endpoint, p256dh, auth')
          .in('user_id', athleteAuthIds)
          .eq('role', 'athlete')
      : { data: [] }

    let notified = 0

    for (const trainerId of trainerIds) {
      const dueAthletes = byTrainer[trainerId]
      const trainer = trainers?.find((t) => t.id === trainerId)
      if (!trainer) continue

      const trainerSubList = (trainerSubs ?? []).filter((s) => s.user_id === trainerId)

      // Monta lista para o personal
      const lines = dueAthletes.map((a) => {
        const label = a.billing_day === today ? 'hoje' : 'amanhã'
        const value = a.billing_amount
          ? ` · R$ ${Number(a.billing_amount).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
          : ''
        return `${a.name}${value} — vence ${label}`
      })

      const pushBody = lines.join('\n')
      const pushTitle = dueAthletes.length === 1
        ? `Cobrança: ${dueAthletes[0].name}`
        : `${dueAthletes.length} cobranças para hoje/amanhã`

      // Push para trainer
      for (const sub of trainerSubList) {
        await sendPush(sub.endpoint, sub.p256dh, sub.auth, pushTitle, pushBody, '/trainer')
        notified++
      }

      // Email para trainer
      if (trainer.email) {
        const rows = dueAthletes.map((a) => {
          const label = a.billing_day === today ? '<strong style="color:#C8A96E">Hoje</strong>' : 'Amanhã'
          const value = a.billing_amount
            ? `R$ ${Number(a.billing_amount).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
            : '—'
          return `<tr>
            <td style="padding:10px 12px;border-bottom:1px solid #2A2823;font-size:14px;color:#F2EFE9">${a.name}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #2A2823;font-size:14px;color:#C8A96E;font-family:'Courier New',monospace">${value}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #2A2823;font-size:13px">${label}</td>
          </tr>`
        }).join('')

        await sendEmail(
          trainer.email,
          `💰 Cobranças do dia — ${dueAthletes.length} aluno${dueAthletes.length > 1 ? 's' : ''}`,
          `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0E0D0B;color:#F2EFE9;border-radius:12px">
            <div style="font-size:20px;font-weight:600;margin-bottom:4px">Cobranças do dia 💰</div>
            <div style="font-size:13px;color:#7A7567;margin-bottom:24px">Olá, ${trainer.name} — lembrete automático do Kinevia</div>
            <table style="width:100%;border-collapse:collapse;background:#1F1D1A;border-radius:8px;overflow:hidden">
              <thead><tr style="background:#2A2823">
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#7A7567;text-transform:uppercase;letter-spacing:.06em">Aluno</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#7A7567;text-transform:uppercase;letter-spacing:.06em">Valor</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#7A7567;text-transform:uppercase;letter-spacing:.06em">Vence</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
            ${trainer.pix_key ? `<div style="margin-top:20px;padding:14px 16px;background:#1F1D1A;border-radius:8px;font-size:13px;color:#B8B2A3">Chave Pix: <strong style="color:#F2EFE9;font-family:'Courier New',monospace">${trainer.pix_key}</strong></div>` : ''}
            <a href="https://kinevia.com.br/trainer" style="display:inline-block;margin-top:24px;background:#C8A96E;color:#0A0909;font-weight:700;font-size:13px;padding:10px 22px;border-radius:999px;text-decoration:none">Abrir Kinevia</a>
            <p style="margin-top:28px;font-size:11px;color:#4A463C">Kinevia · Notificação automática de cobranças</p>
          </div>`,
        )
        notified++
      }

      // Push individual para cada atleta
      for (const athlete of dueAthletes) {
        if (!athlete.auth_user_id) continue
        const athSubs = (athleteSubs ?? []).filter((s) => s.user_id === athlete.auth_user_id)
        const isToday = athlete.billing_day === today
        const value = athlete.billing_amount
          ? `R$ ${Number(athlete.billing_amount).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
          : null
        const bodyLines = [
          value ? `Valor: ${value}` : null,
          trainer.pix_key ? `Pix: ${trainer.pix_key}` : null,
        ].filter(Boolean).join(' · ')

        for (const sub of athSubs) {
          await sendPush(
            sub.endpoint, sub.p256dh, sub.auth,
            isToday ? 'Mensalidade vence hoje' : 'Mensalidade vence amanhã',
            bodyLines || 'Entre em contato com seu personal.',
            '/athlete',
          )
          notified++
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, notified }), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})
