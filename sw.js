// ArchBrief Service Worker v4
// Handles: app shell caching, offline fallback, push notifications, scheduled reminders

const CACHE_NAME = 'archbrief-v5';
const CACHE_FILES = [
  './',
  './index.html',
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/tutor.css',
  './js/vendors.js',
  './js/data.js',
  './js/core.js',
  './js/panels/morning.js',
  './js/panels/digest.js',
  './js/panels/explorer.js',
  './js/panels/compare.js',
  './js/panels/aps.js',
  './js/panels/chat.js',
  './js/panels/quiz.js',
  './js/panels/path.js',
  './js/panels/scenarios.js',
  './js/panels/glossary.js',
  './js/panels/progress.js',
  './js/panels/projects.js',
  './js/panels/recap.js',
  './js/panels/saved.js',
  './js/tutor/explainer.js',
  './js/tutor/spaced-rep.js',
  './js/tutor/certifications.js',
  './data/daily.json',
  './manifest.json',
];
const OFFLINE_URL = './index.html';

// App shell assets to cache on install
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── INSTALL ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Non-fatal — some assets may not exist yet during first deploy
        return cache.add('./index.html');
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network-first, cache fallback ─────────
self.addEventListener('fetch', event => {
  // Skip cross-origin requests (API calls, fonts, CDN)
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip POST / non-GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for app shell files
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback — return cached version or offline page
        return caches.match(event.request)
          .then(cached => cached || caches.match(OFFLINE_URL));
      })
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────────
self.addEventListener('push', event => {
  let data = {
    title: 'ArchBrief',
    body: 'Your daily IT brief is ready. Tap to open.',
    icon: './icons/icon-192.png',
    badge: './icons/icon-96.png',
    tag: 'archbrief-daily',
    url: './index.html'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    renotify: true,
    requireInteraction: false,
    silent: false,
    data: { url: data.url },
    actions: [
      { action: 'open_digest', title: '📰 Open Digest' },
      { action: 'open_aps',    title: '🇦🇺 APS Radar' },
      { action: 'dismiss',     title: 'Later' }
    ],
    vibrate: [100, 50, 100]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── NOTIFICATION CLICK ────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  let targetUrl = './index.html';
  if (event.action === 'open_digest') targetUrl = './index.html#digest';
  else if (event.action === 'open_aps') targetUrl = './index.html#aps';
  else if (event.action === 'dismiss') return;
  else if (event.notification.data?.url) targetUrl = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes('index.html') && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── BACKGROUND SYNC: Scheduled reminder check ────
// Used as a fallback when push server isn't configured
self.addEventListener('sync', event => {
  if (event.tag === 'archbrief-reminder') {
    event.waitUntil(checkAndNotify());
  }
});

// ── PERIODIC BACKGROUND SYNC ─────────────────────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'archbrief-daily') {
    event.waitUntil(checkAndNotify());
  }
});

async function checkAndNotify() {
  try {
    // Read reminder settings from IndexedDB via message
    const allClients = await clients.matchAll();
    if (allClients.length > 0) return; // App is open, no need to notify

    const permission = await self.registration.pushManager.permissionState(
      { userVisibleOnly: true }
    );
    if (permission !== 'granted') return;

    await self.registration.showNotification('ArchBrief', {
      body: 'Your daily multi-vendor IT brief is ready to generate.',
      icon: './icons/icon-192.png',
      badge: './icons/icon-96.png',
      tag: 'archbrief-daily',
      data: { url: './index.html#digest' },
      actions: [
        { action: 'open_digest', title: '📰 Open Digest' },
        { action: 'dismiss', title: 'Later' }
      ]
    });
  } catch (e) {
    // Silently fail — notification is non-critical
  }
}

// ── MESSAGE HANDLER ───────────────────────────────
// Receives messages from the main app (e.g. schedule reminder)
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, url } = event.data;
    self.registration.showNotification(title || 'ArchBrief', {
      body: body || 'Your daily brief is ready.',
      icon: './icons/icon-192.png',
      badge: './icons/icon-96.png',
      tag: 'archbrief-daily',
      data: { url: url || './index.html' },
      actions: [
        { action: 'open_digest', title: '📰 Open Digest' },
        { action: 'open_aps', title: '🇦🇺 APS Radar' }
      ]
    });
  }
});
