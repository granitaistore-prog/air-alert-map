const CACHE_NAME = 'air-alert-pwa-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

const staticAssets = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Інсталяція
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(staticAssets);
            })
            .then(() => {
                console.log('Service Worker: Install completed');
                return self.skipWaiting();
            })
    );
});

// Активація
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activated');
            return self.clients.claim();
        })
    );
});

// Fetch стратегія: Network First для API, Cache First для решти
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // API запити - тільки мережа
    if (url.pathname.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return new Response(JSON.stringify({ error: 'Офлайн режим' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }
    
    // Для решти - Cache First з fallback до мережі
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Повертаємо з кешу, якщо є
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // Інакше робимо запит до мережі
                return fetch(event.request)
                    .then(networkResponse => {
                        // Кешуємо тільки успішні GET запити
                        if (event.request.method === 'GET' && 
                            networkResponse.status === 200 &&
                            !url.pathname.includes('/api/')) {
                            
                            const responseClone = networkResponse.clone();
                            caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    cache.put(event.request, responseClone);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Fallback для сторінки
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Офлайн режим');
                    });
            })
    );
});

// Пуш-сповіщення
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Повітряна тривога';
    const options = {
        body: data.body || 'Нова тривога в регіоні',
        icon: 'assets/icons/icon-192.png',
        badge: 'assets/icons/badge.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Клік по сповіщенню
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});

// Оновлення контенту
self.addEventListener('message', event => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
