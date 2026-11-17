// オフラインでも開けるようにするための控え。いつも新しいものを先に取りに行き、だめなら控えを使う。
var CACHE = 'manabi-v1';
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: false }).then(function (r) { return r || caches.match('index.html'); }); })
  );
});
