/*
 * ITECOM — service worker : l'application s'ouvre et les cours téléchargés se suivent sans connexion.
 *
 * - Application (index.html, scripts, styles) : mise en cache à l'installation à partir de precache.json
 *   (généré au build), puis servie depuis le cache ; nouvelle version à chaque déploiement.
 * - Données (lectures /api) : réseau d'abord, dernière version connue si le réseau ne répond pas ;
 *   un cache par utilisateur (tiré du jeton), pour qu'un autre compte du même appareil ne les voie pas.
 * - Vidéos et documents (/uploads) : servis depuis les cours téléchargés (avec lecture partielle « Range »
 *   pour avancer dans une vidéo), sinon depuis le réseau sans les stocker.
 */
const VERSION = '__BUILD_VERSION__';
const SHELL_CACHE = 'itecom-shell-' + VERSION;
const API_CACHE_PREFIX = 'itecom-api-';
const MEDIA_CACHE = 'itecom-offline';
const FONT_CACHE = 'itecom-fonts';

/** Lectures d'API jamais gardées : connexion, salle de visioconférence, appel en cours, fichiers générés. */
const NEVER_CACHED = [
  /^\/api\/auth\//,
  /\/jitsi-token$/,
  /\/roll-calls\//,
  /\/attendance\//,
  /\/recording$/,
  /\.(xlsx|pdf)$/,
  /\/(receipt|pdf)$/
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try {
      const res = await fetch('/precache.json', { cache: 'no-store' });
      const { files } = await res.json();
      // Par petits paquets : un fichier manquant ne bloque pas l'installation
      for (let i = 0; i < files.length; i += 8) {
        await Promise.all(files.slice(i, i + 8).map(f => cache.add(new Request(f, { cache: 'reload' })).catch(() => {})));
      }
    } catch (e) {
      await cache.addAll(['/', '/index.html']).catch(() => {});
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('itecom-shell-') && k !== SHELL_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  // Déconnexion volontaire : on efface les données de cours et les téléchargements de l'utilisateur
  if (event.data === 'clear-user-data') {
    event.waitUntil(caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith(API_CACHE_PREFIX) || k === MEDIA_CACHE).map(k => caches.delete(k)))));
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    // /uploads d'abord : un PDF affiché dans une iframe arrive aussi comme une « navigation »
    if (url.pathname.startsWith('/uploads/')) {
      event.respondWith(media(request, url));
    } else if (url.pathname.startsWith('/api/')) {
      if (NEVER_CACHED.some(r => r.test(url.pathname))) event.respondWith(fetch(request).catch(() => offlineJson()));
      else event.respondWith(networkFirstApi(request));
    } else if (request.mode === 'navigate') {
      event.respondWith(networkFirstPage(request));
    } else if (url.pathname !== '/sw.js' && url.pathname !== '/precache.json') {
      event.respondWith(cacheFirst(request));
    }
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
  }
});

async function networkFirstPage(request) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(SHELL_CACHE)).put('/index.html', res.clone());
    return res;
  } catch (e) {
    return (await caches.match('/index.html')) || (await caches.match('/')) || offlineJson();
  }
}

async function networkFirstApi(request) {
  const cacheName = API_CACHE_PREFIX + userKey(request);
  try {
    const res = await fetch(request);
    if (res.ok && (res.headers.get('Content-Type') || '').includes('json')) (await caches.open(cacheName)).put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await (await caches.open(cacheName)).match(request, { ignoreVary: true });
    return cached || offlineJson();
  }
}

/** Utilisateur de la requête (email du jeton), réduit à une empreinte courte pour nommer son cache. */
function userKey(request) {
  const auth = request.headers.get('Authorization') || '';
  let sub = 'public';
  try {
    const payload = auth.replace(/^Bearer\s+/, '').split('.')[1];
    if (payload) sub = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).sub || 'public';
  } catch (e) { /* jeton illisible : cache public */ }
  let h = 5381;
  for (const c of sub.toLowerCase()) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

async function media(request, url) {
  const cached = await caches.match(url.pathname, { cacheName: MEDIA_CACHE, ignoreVary: true, ignoreSearch: true });
  if (cached) return rangeResponse(request, cached);
  try {
    return await fetch(request);
  } catch (e) {
    return new Response('', { status: 504, statusText: 'Hors connexion' });
  }
}

/** Un lecteur vidéo demande des morceaux (« Range ») : on découpe la vidéo stockée. */
async function rangeResponse(request, cached) {
  const range = request.headers.get('range');
  if (!range) return cached;
  const blob = await cached.blob();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return cached;
  let start, end;
  if (m[1] === '') {                       // « bytes=-500 » : les 500 derniers octets
    start = Math.max(0, blob.size - Number(m[2]));
    end = blob.size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? blob.size - 1 : Math.min(Number(m[2]), blob.size - 1);
  }
  if (start >= blob.size) {
    return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${blob.size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(SHELL_CACHE)).put(request, res.clone());
    return res;
  } catch (e) {
    return new Response('', { status: 504, statusText: 'Hors connexion' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}

function offlineJson() {
  return new Response(JSON.stringify({ success: false, offline: true,
    message: 'Hors connexion : cette page n\'est pas disponible sans internet. Les cours téléchargés restent accessibles.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'X-Itecom-Offline': '1' }
  });
}
