// sw.js — Service Worker Kanva v1.0
const CACHE_NAME = 'kanva-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/editor.html',
  '/style.css',
  '/js/canvas.js',
  '/js/toolbar.js',
  '/js/layersPanel.js',
  '/js/fontPicker.js',
  '/js/common.js',
  '/js/home.js',
  '/js/editorInit.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE)));
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
