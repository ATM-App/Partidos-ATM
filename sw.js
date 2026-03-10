const CACHE_NAME = 'atleti-track-v1';
const urlsToCache = [
    './',
    './login.html',
    './index.html',
    './admin.html',
    './style.css',
    './app.js',
    './login.js',
    './admin.js',
    './firebase.js',
    './manifest.json'
];

// Instalar el Service Worker y guardar en caché
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Interceptar peticiones para cargar más rápido
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});