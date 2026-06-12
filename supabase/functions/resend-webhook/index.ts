import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// Recebe webhooks do Resend (email.sent/delivered/opened/clicked/bounced/complained)
// e grava em email_events. Verifica a assinatura Svix se RESEND_WEBHOOK_SECRET estiver
// setado (formato whsec_<base64>). Deploy com --no-verify-jwt (o Resend não manda JWT).

const TYPE_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

async function verifySvix(secret: string, headers: Headers, body: string): Promise<boolean> {
  const id = headers.get('svix-id')
  const ts = headers.get('svix-timestamp')
  const sigHeader = headers.get('svix-signature')
  if (!id || !ts || !sigHeader) return false
  const keyB64 = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = `${id}.${ts}.${body}`
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
  // header: "v1,<sig> v1,<sig2>" — confere qualquer match
  return sigHeader.split(' ').some((p) => p.split(',')[1] === expected)
}

function campaignFromTags(tags: unknown): string | null {
  if (Array.isArray(tags)) {
    const t = tags.find((x) => x?.name === 'campaign')
    return t?.value ?? null
  }
  if (tags && typeof tags === 'object') {
    return (tags as Record<string, string>).campaign ?? null
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const body = await req.text()
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (secret) {
    const ok = await verifySvix(secret, req.headers, body)
    if (!ok) return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 401 })
  } else {
    console.warn('[resend-webhook] RESEND_WEBHOOK_SECRET não setado — aceitando sem verificar')
  }

  let evt: { type?: string; data?: { email_id?: string; to?: string[]; tags?: unknown; created_at?: string } }
  try { evt = JSON.parse(body) } catch { return new Response(JSON.stringify({ error: 'bad json' }), { status: 400 }) }

  const type = TYPE_MAP[evt.type ?? '']
  const recipient = Array.isArray(evt.data?.to) ? evt.data?.to[0] : undefined
  if (!type || !recipient) return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })

  const row = {
    resend_id: evt.data?.email_id ?? null,
    recipient,
    type,
    campaign: campaignFromTags(evt.data?.tags),
    created_at: evt.data?.created_at ?? new Date().toISOString(),
  }

  const SR = Deno.env.get('SR_KEY')
  const SUPA = Deno.env.get('SUPABASE_URL')
  const res = await fetch(`${SUPA}/rest/v1/email_events?on_conflict=resend_id,type`, {
    method: 'POST',
    headers: {
      'apikey': SR ?? '',
      'Authorization': `Bearer ${SR}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=ignore-duplicates',
    },
    body: JSON.stringify(row),
  })
  if (!res.ok && res.status !== 409) {
    const t = await res.text()
    return new Response(JSON.stringify({ error: 'insert failed', detail: t }), { status: 500 })
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
