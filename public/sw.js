// QIT notifications — shows alerts and opens the page when one is tapped.
// No caching, so the website always loads fresh.
// v157: office alerts; v179: teacher phone notifications (Web Push).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'QIT';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || undefined,
      renotify: Boolean(d.tag),
      vibrate: [180, 80, 180],
      timestamp: Date.now(),
      data: { url: d.url || '/teacher' },
    }).then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((list) => list.forEach((c) => c.postMessage({ type: 'qit-alert' }))),
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/admin/portal';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // v188: an open QIT window goes to the page; if it cannot, a new one opens
      for (const c of list) {
        if ('focus' in c) {
          return c.focus().then((w) => (w && 'navigate' in w ? w.navigate(url) : null)).catch(() => self.clients.openWindow(url));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
