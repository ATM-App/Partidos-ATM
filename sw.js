const CACHE_NAME = 'partidos-atm-v1';

// Instalación silenciosa
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activación
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Interceptor básico (requerido por navegadores para PWA)
self.addEventListener('fetch', (event) => {
    // No cacheamos nada agresivamente para no romper tu base de datos en tiempo real.
    // Solo dejamos pasar la conexión.
});