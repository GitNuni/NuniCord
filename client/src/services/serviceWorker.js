export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('SW registered:', registration.scope);
        },
        (err) => {
          console.log('SW registration failed:', err);
        }
      );
    });
  }
}

export async function subscribeToPush() {
  try {
    // iOS Safari requires PWA mode (Add to Home Screen) for push notifications
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) {
      console.info('Push notifications on iOS require adding the app to your Home Screen.');
      return null;
    }

    if (!('PushManager' in window)) return null;

    const registration = await navigator.serviceWorker.ready;
    const { data } = await import('./api').then(m => m.default.get('/notifications/vapid-key'));
    if (!data.public_key) return null;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.public_key),
    });

    const api = (await import('./api')).default;
    await api.post('/notifications/subscribe', subscription.toJSON());
    return subscription;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return null;
  }
}

export function isPushSupported() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isStandalone) return { supported: false, reason: 'ios-not-pwa' };
  if (!('PushManager' in window)) return { supported: false, reason: 'not-supported' };
  return { supported: true };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
