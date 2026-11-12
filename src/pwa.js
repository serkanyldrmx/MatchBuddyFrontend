import { API_BASE_URL, api, getToken } from './api/config';

/**
 * Telefona bildirim (Web Push) ve "ana ekrana ekle" — MatcBuddy/docs/push-api.md.
 * public/sw.js bildirimi gösterir; burada izin, abonelik ve sunucuya kayıt yapılır.
 * iPhone'da bildirim yalnızca site "Ana Ekrana Ekle" ile uygulama gibi açıldığında çalışır (iOS 16.4+).
 */

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

let registration = null;

/** Service worker'ı kaydeder (uygulama açılışında bir kez). */
export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  if (!registration) {
    registration = navigator.serviceWorker.register('/sw.js').catch(() => null);
  }
  return registration;
};

const urlBase64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const currentSubscription = async () => {
  const reg = await registerServiceWorker();
  return reg ? reg.pushManager.getSubscription() : null;
};

/** 'unsupported' | 'ios-install' (iPhone'da önce ana ekrana ekle) | 'denied' | 'on' | 'off' */
export const getPushState = async () => {
  if (!pushSupported()) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const sub = await currentSubscription().catch(() => null);
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
};

/** İzin ister, abone olur ve sunucuya kaydeder. Döner: yeni durum. */
export const enablePush = async () => {
  if (!pushSupported()) return getPushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const reg = await registerServiceWorker();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { data } = await api.get('/api/Push/PublicKey');
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }
  await api.post('/api/Push/Subscribe', sub.toJSON());
  return 'on';
};

/** Bu cihazın aboneliğini kaldırır. */
export const disablePush = async () => {
  const sub = await currentSubscription().catch(() => null);
  if (sub) {
    await api.post('/api/Push/Unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return 'off';
};

/** Abonelik açıksa sunucu kaydını tazeler (girişten sonra hesap değiştiyse abonelik yeni hesaba geçer). */
export const syncPushSubscription = async () => {
  if (!pushSupported() || Notification.permission !== 'granted' || !getToken()) return;
  const sub = await currentSubscription().catch(() => null);
  if (sub) api.post('/api/Push/Subscribe', sub.toJSON()).catch(() => {});
};

// Çıkışta bu cihaz hesabın bildirimlerini almasın (token henüz silinmeden, config.js logout'tan önce)
window.addEventListener('mb:before-logout', () => {
  const token = getToken();
  if (!token || !pushSupported()) return;
  currentSubscription()
    .then((sub) => sub && fetch(`${API_BASE_URL}/api/Push/Unsubscribe`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }))
    .catch(() => {});
});
