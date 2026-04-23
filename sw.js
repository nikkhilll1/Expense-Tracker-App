self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('kd-tracker-store').then((cache) => cache.addAll([
      './',
      './index.html',
      './style.css',
      './app.js',
      './db.js',
      './logo.png.jpeg'
    ]))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
