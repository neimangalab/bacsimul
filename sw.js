/* ═══════════════════════════════════════════════════════════════════
   BacSimul — Service Worker
   ───────────────────────────────────────────────────────────────────
   ⚠️  RÈGLE DE MISE À JOUR : quand tu publies une nouvelle version,
       change UNIQUEMENT la ligne APP_VERSION ci-dessous.
       Ex : '1.0.0' → '1.1.0'
       Le téléphone de l'élève détectera automatiquement le changement
       et affichera une notification de mise à jour dans l'app.
═══════════════════════════════════════════════════════════════════ */

const APP_VERSION = '1.0.0';
const CACHE_NAME  = `bacsimul-v${APP_VERSION}`;

const CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
];

/* ─────────────────────────────────────────────────────────────────
   INSTALL — mise en cache de tous les fichiers dès l'installation
   NB : on n'appelle PAS skipWaiting() ici intentionnellement.
   Le nouveau SW attend sagement que l'app envoie 'SKIP_WAITING'
   (après que l'élève ait cliqué "Mettre à jour" dans la bannière).
───────────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  console.log(`[SW ${APP_VERSION}] Installation — cache : ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_ASSETS))
      .then(() => {
        console.log(`[SW ${APP_VERSION}] Tous les fichiers mis en cache ✓`);
        // NE PAS appeler skipWaiting ici → on attend la confirmation de l'élève
      })
  );
});

/* ─────────────────────────────────────────────────────────────────
   ACTIVATE — supprimer tous les anciens caches (autres versions)
───────────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  console.log(`[SW ${APP_VERSION}] Activation`);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('bacsimul-') && key !== CACHE_NAME)
          .map(key => {
            console.log(`[SW] Suppression ancien cache : ${key}`);
            return caches.delete(key);
          })
      ))
      .then(() => {
        // Prendre le contrôle immédiat de tous les onglets ouverts
        return self.clients.claim();
      })
      .then(() => {
        // Notifier tous les onglets que la nouvelle version est active
        return self.clients.matchAll({ type: 'window' });
      })
      .then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'SW_ACTIVATED', version: APP_VERSION })
        );
      })
  );
});

/* ─────────────────────────────────────────────────────────────────
   FETCH — stratégie Cache First avec revalidation en arrière-plan
   → Réponse immédiate depuis le cache (offline OK)
   → En parallèle, vérifie si une version plus récente existe
───────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {

        // Tentative réseau en parallèle (pour rafraîchir silencieusement)
        const networkFetch = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null); // pas de réseau → on ne plante pas

        // Retourner le cache immédiatement si disponible, sinon attendre le réseau
        return cached || networkFetch.then(r => r || caches.match('./index.html'));
      })
    )
  );
});

/* ─────────────────────────────────────────────────────────────────
   MESSAGE — communication avec l'app principale
   L'app envoie 'SKIP_WAITING' quand l'élève clique "Mettre à jour"
───────────────────────────────────────────────────────────────── */
self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    console.log(`[SW ${APP_VERSION}] skipWaiting() — installation de la mise à jour`);
    self.skipWaiting();
  }

  // L'app demande la version actuelle du SW
  if (event.data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'SW_VERSION', version: APP_VERSION });
  }
});
