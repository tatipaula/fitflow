import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function registerPush(): Promise<void> {
  if (!VAPID_PUBLIC_KEY) return
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    await saveToDB(subscription)
  } catch (err) {
    console.error('[push] registration error', err)
  }
}

async function saveToDB(subscription: PushSubscription): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return

  const json = subscription.toJSON()
  const keys = json.keys as { p256dh: string; auth: string } | undefined
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) return

  const role = session.user.user_metadata?.role === 'athlete' ? 'athlete' : 'trainer'

  await supabase.from('push_subscriptions').upsert(
    { user_id: session.user.id, role, endpoint: json.endpoint, p256dh: keys.p256dh, auth: keys.auth },
    { onConflict: 'user_id,endpoint' },
  )
}
