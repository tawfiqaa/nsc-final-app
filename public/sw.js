const CACHE_NAME = 'teacher-tracker-v1';

// We ONLY cache the absolute minimum required for PWA installability.
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    // Delete old caches to ensure we don't end up with stale assets.
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // SAFE MODE: Bypass service worker for ALL API requests, Firebase, external domains.
    // We ONLY want to handle same-origin navigation/static requests.
    if (
        url.hostname !== self.location.hostname ||
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/__/')
    ) {
        return; // Let the browser handle it natively.
    }

    // Use a strictly NETWORK-FIRST strategy to guarantee live updates are always fetched.
    event.respondWith(
        fetch(event.request)
            .catch(() => {
                // If the network fails (offline), gracefully fallback to the cache.
                // This satisfies the PWA install requirement for having an offline 200 response on start_url.
                return caches.match(event.request);
            })
    );
});
