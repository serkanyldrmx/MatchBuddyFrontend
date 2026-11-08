/* MatchBuddy service worker: telefona bildirim (Web Push) ve "ana ekrana ekle".
   Önbellekleme yapmaz; uygulama her zaman ağdan güncel yüklenir. Bkz. src/pwa.js, MatchBuddy/docs/push-api.md */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Sunucudan gelen bildirim: { title, body, url, tag }
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'MatchBuddy', {
      body: data.body || '',
      icon: '/logo192.png',
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || '/home' },
    })
  );
});

// Bildirime dokununca: açık bir pencere varsa onu ilgili sayfaya götür, yoksa yeni pencere aç
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/home', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => w.url.startsWith(self.location.origin));
      if (win) return win.focus().then(() => win.navigate(url)).catch(() => self.clients.openWindow(url));
      return self.clients.openWindow(url);
    })
  );
});
