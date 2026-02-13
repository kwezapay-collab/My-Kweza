const CACHE_NAME = 'my-kweza-v17';
const APP_SHELL = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/menu.html',
  '/settings.html',
  '/weekly-report.html',
  '/founder-weekly-reports.html',
  '/dev-operations.html',
  '/payouts-history.html',
  '/withdrawals-history.html',
  '/financial-withdrawals-history.html',
  '/complaints-history.html',
  '/report-complaint.html',
  '/notifications.html',
  '/compensation-management.html',
  '/super-admin.html',
  '/index.css',
  '/theme.js',
  '/auth.js',
  '/dashboard.js',
  '/settings.js',
  '/weekly-report.js',
  '/founder-weekly-reports.js',
  '/dev-operations.js',
  '/payouts-history.js',
  '/withdrawals-history.js',
  '/financial-withdrawals-history.js',
  '/complaints-history.js',
  '/report-complaint.js',
  '/notifications.js',
  '/compensation-management.js',
  '/super-admin.js',
  '/pwa.js',
  '/manifest.webmanifest',
  '/logo.png',
  '/icons/kweza-192.png',
  '/icons/kweza-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return caches.match('/index.html');
        })
    );
    return;
  }

  const requestPath = url.pathname.toLowerCase();
  const isFreshAsset = ['script', 'style'].includes(event.request.destination)
    || requestPath.endsWith('.js')
    || requestPath.endsWith('.css');

  if (isFreshAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          throw new Error('Network unavailable and no cached asset');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/notifications.html';

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const absoluteTarget = new URL(targetUrl, self.location.origin).href;

    for (const client of allClients) {
      if ('focus' in client && client.url === absoluteTarget) {
        await client.focus();
        return;
      }
    }

    if (allClients.length > 0 && 'focus' in allClients[0] && 'navigate' in allClients[0]) {
      await allClients[0].navigate(absoluteTarget);
      await allClients[0].focus();
      return;
    }

    if (clients.openWindow) {
      await clients.openWindow(absoluteTarget);
    }
  })());
});
