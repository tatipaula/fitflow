import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

  // Verify Stripe signature (HMAC-SHA256)
  const valid = await verifyStripeSignature(body, signature, webhookSecret)
  if (!valid) return new Response('invalid signature', { status: 400 })

  const event = JSON.parse(body)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const trainerId      = session.client_reference_id as string
    const customerId     = session.customer as string
    const subscriptionId = session.subscription as string

    if (!trainerId) return new Response('ok', { status: 200 })

    await supabase
      .from('trainers')
      .update({ plan: 'pro', stripe_customer_id: customerId, stripe_subscription_id: subscriptionId })
      .eq('id', trainerId)

    // Fire purchase-confirmed email
    const { data: trainer } = await supabase
      .from('trainers')
      .select('name, email')
      .eq('id', trainerId)
      .single()

    if (trainer) {
      await supabase.functions.invoke('purchase-confirmed', {
        body: { trainer_name: trainer.name, trainer_email: trainer.email },
      })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object
    const customerId   = subscription.customer as string

    await supabase
      .from('trainers')
      .update({ plan: 'free', stripe_subscription_id: null })
      .eq('stripe_customer_id', customerId)
  }

  return new Response('ok', { status: 200 })
})

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts     = Object.fromEntries(header.split(',').map((p) => p.split('=')))
    const timestamp = parts['t']
    const sig       = parts['v1']
    if (!timestamp || !sig) return false

    const signed = `${timestamp}.${payload}`
    const key    = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const mac    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed))
    const hex    = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')
    return hex === sig
  } catch {
    return false
  }
}
