/* Estim·clim Pro — service worker hors-ligne.
   Stratégie : shell en cache-first (mise à jour en arrière-plan), navigation en
   network-first (repli sur le shell hors-ligne). Les services réseau de la
   tournée (tuiles OSM, Nominatim, OSRM) ne sont PAS mis en cache → dégradation
   propre déjà gérée par l'app. Incrémenter CACHE à chaque déploiement. */
var CACHE = 'estimclim-v1';
var SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.json', './icon-192.png', './icon-512.png'];
// CDN (libs) mis en cache à la première visite via le handler fetch.
var CDN_HOSTS = ['cdn.jsdelivr.net'];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }).catch(function(){}));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){ return Promise.all(keys.map(function(k){ if(k!==CACHE) return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url;
  try{ url = new URL(req.url); }catch(_){ return; }

  // Navigation : réseau d'abord, repli sur le shell en cache (hors-ligne).
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).catch(function(){ return caches.match('./index.html').then(function(r){ return r || caches.match('./'); }); })
    );
    return;
  }

  var sameOrigin = (url.origin === self.location.origin);
  var isCdn = CDN_HOSTS.indexOf(url.host) >= 0;
  if(sameOrigin || isCdn){
    // cache-first + rafraîchissement en arrière-plan
    e.respondWith(
      caches.match(req).then(function(cached){
        var net = fetch(req).then(function(res){
          if(res && (res.status === 200 || res.type === 'opaque')){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); }); }
          return res;
        }).catch(function(){ return cached; });
        return cached || net;
      })
    );
    return;
  }
  // Autres (tuiles/géocodage/itinéraire) : laisser passer au réseau, sans cache.
});
