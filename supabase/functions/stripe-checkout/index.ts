import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[stripe-checkout] missing Authorization header')
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const stripeKey   = Deno.env.get('STRIPE_SECRET_KEY')
    const priceId     = Deno.env.get('STRIPE_PRICE_ID')

    if (!stripeKey) { console.error('[stripe-checkout] STRIPE_SECRET_KEY not set'); return new Response(JSON.stringify({ error: 'stripe key missing' }), { status: 500, headers: corsHeaders }) }
    if (!priceId)   { console.error('[stripe-checkout] STRIPE_PRICE_ID not set');   return new Response(JSON.stringify({ error: 'price id missing' }),  { status: 500, headers: corsHeaders }) }

    const supabase = createClient(supabaseUrl!, serviceKey!)
    const jwt = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) {
      console.error('[stripe-checkout] auth error', authErr)
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { data: trainer, error: tErr } = await supabase
      .from('trainers')
      .select('id, email, name, stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (tErr || !trainer) {
      console.error('[stripe-checkout] trainer not found', tErr)
      return new Response(JSON.stringify({ error: 'trainer not found' }), { status: 404, headers: corsHeaders })
    }

    const baseUrl = 'https://kinevia.com.br'

    // Criar ou reutilizar Stripe Customer
    let customerId: string = trainer.stripe_customer_id ?? ''
    if (!customerId) {
      console.log('[stripe-checkout] creating stripe customer for', trainer.email)
      const params = new URLSearchParams()
      params.append('email', trainer.email)
      params.append('name', trainer.name)
      params.append('metadata[trainer_id]', trainer.id)

      const cusRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })
      const customer = await cusRes.json()
      if (!cusRes.ok) {
        console.error('[stripe-checkout] customer creation failed', customer)
        return new Response(JSON.stringify({ error: customer.error?.message ?? 'stripe customer error' }), { status: 500, headers: corsHeaders })
      }
      customerId = customer.id
      await supabase.from('trainers').update({ stripe_customer_id: customerId }).eq('id', trainer.id)
    }

    // Criar Checkout Session
    console.log('[stripe-checkout] creating checkout session, customer:', customerId, 'price:', priceId)
    const sessionParams = new URLSearchParams()
    sessionParams.append('customer', customerId)
    sessionParams.append('mode', 'subscription')
    sessionParams.append('line_items[0][price]', priceId)
    sessionParams.append('line_items[0][quantity]', '1')
    sessionParams.append('client_reference_id', trainer.id)
    sessionParams.append('success_url', `${baseUrl}/trainer?payment=success`)
    sessionParams.append('cancel_url', `${baseUrl}/trainer`)
    sessionParams.append('subscription_data[metadata][trainer_id]', trainer.id)
    sessionParams.append('payment_method_types[0]', 'card')

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: sessionParams.toString(),
    })
    const session = await sessionRes.json()
    if (!sessionRes.ok) {
      console.error('[stripe-checkout] session creation failed', session)
      return new Response(JSON.stringify({ error: session.error?.message ?? 'stripe session error' }), { status: 500, headers: corsHeaders })
    }

    console.log('[stripe-checkout] session created', session.id)
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[stripe-checkout] unexpected error', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})
