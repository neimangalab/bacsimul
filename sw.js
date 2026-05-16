/* ═══════════════════════════════════════════════════════════════
   BacSimul — Service Worker v1
   Stratégie : Cache First pour les assets, Network First pour les MAJ
   → L'app fonctionne 100% hors ligne après le premier chargement
═══════════════════════════════════════════════════════════════ */

const CACHE_NAME   = 'bacsimul-v1';
const CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
];

/* ── Installation : mise en cache immédiate de tous les assets ── */
self.addEventListener('install', event => {
  console.log('[SW] Installation…');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Mise en cache des fichiers statiques');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => self.skipWaiting())  // activer immédiatement sans attendre
  );
});

/* ── Activation : supprimer les anciens caches ── */
self.addEventListener('activate', event => {
  console.log('[SW] Activation');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache :', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Interception des requêtes : Cache First ── */
self.addEventListener('fetch', event => {
  // Ne traiter que les requêtes GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Réponse depuis le cache — instantané, hors ligne
        return cached;
      }
      // Pas en cache → tenter le réseau
      return fetch(event.request)
        .then(networkResponse => {
          // Mettre en cache la nouvelle ressource dynamiquement
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Hors ligne et pas en cache → page de fallback si HTML
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

/* ── Message depuis l'app : forcer la mise à jour ── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
