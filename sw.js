const CACHE_NAME = 'partidos-atm-v2';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Le dice al instalador que siga su curso sin quedarse colgado
    event.respondWith(fetch(event.request).catch(() => {
        return new Response("App Offline");
    }));
});