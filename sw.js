// Service Worker для PWA додатку
const CACHE_NAME = 'air-alert-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/ui/main.js',
  '/src/map/mapInit.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  '/manifest.json'
];

// Встановлення Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Кеш відкрито');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Активізація та очищення старого кешу
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Видаляємо старий кеш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Обробка запитів
self.addEventListener('fetch', event => {
  // Пропускаємо запити до API
  if (event.request.url.includes('api.') || 
      event.request.url.includes('localhost') ||
      event.request.url.includes('127.0.0.1')) {
    return fetch(event.request);
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Повертаємо з кешу або робимо запит
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(response => {
          // Не кешуємо невдалі запити
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Кешуємо нові запити
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
            
          return response;
        });
      })
      .catch(() => {
        // Fallback для офлайн режиму
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

// Оновлення у фоновому режимі
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
