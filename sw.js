// ====================================================================
//  ВАЖНО !
//  --------------------------------------------------------------------
//  Меняй APP_VERSION КАЖДЫЙ РАЗ, когда ты меняешь:
//   - index.html
//   - любой файл в fixtures/
//   - fixtures/list.json
//   - любые CSS/JS, влияющие на работу приложения
//   - сам sw.js
//
//  Если НЕ изменить версию:
//    • СТАРЫЕ телефоны останутся на старой версии приложения
//    • НОВЫЕ телефоны тоже установят старую версию
//
//  Новая версия = перекачиваются ВСЕ файлы приложения (чистое обновление)
// ====================================================================
const APP_VERSION    = 'fv-2025-11-18_02';       // ← МЕНЯЙ ЭТУ СТРОКУ
const STATIC_CACHE   = 'fv-static-'   + APP_VERSION;
const FIXTURES_CACHE = 'fv-fixtures-' + APP_VERSION;

// Базовые файлы приложения (shell)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sw.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
];

// Помощник: кладём список URL в указанный кэш
async function cacheUrls(cacheName, urls) {
  const cache = await caches.open(cacheName);
  await cache.addAll(urls);
}

// Установка SW: кэшируем shell и ВСЕ fixtures из fixtures/list.json
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // 1) кэшируем статику (shell)
    try {
      await cacheUrls(STATIC_CACHE, STATIC_ASSETS);
    } catch (e) {
      console.warn('SW: cannot cache static assets:', e);
    }

    // 2) грузим fixtures/list.json и кэшируем все fixtures
    try {
      const res  = await fetch('./fixtures/list.json', { cache: 'no-store' });
      const list = await res.json();
      if (Array.isArray(list) && list.length) {
        const fixtureUrls = list.map(name => './fixtures/' + name);
        await cacheUrls(FIXTURES_CACHE, fixtureUrls);
      }
    } catch (e) {
      console.warn('SW: cannot precache fixtures:', e);
      // Если не получилось — приложение всё равно будет работать онлайн
    }

    // сразу активируем новый SW
    self.skipWaiting();
  })());
});

// Активация SW: чистим старые кэши
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.map(name => {
        if (name !== STATIC_CACHE && name !== FIXTURES_CACHE) {
          return caches.delete(name);
        }
      })
    );
    await self.clients.claim();
  })());
});

// cache-first helper
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (request.method === 'GET') {
    cache.put(request, response.clone());
  }
  return response;
}

// Обработка запросов
self.addEventListener('fetch', event => {
  const req = event.request;

  // Кэшируем только GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Работаем только в нашем scope /fixture-viewer/
  if (url.origin === location.origin) {
    // Файлы fixtures: cache-first из FIXTURES_CACHE
    if (url.pathname.startsWith('/fixture-viewer/fixtures/')) {
      event.respondWith(cacheFirst(req, FIXTURES_CACHE));
      return;
    }

    // Статика приложения: cache-first из STATIC_CACHE
    if (url.pathname.startsWith('/fixture-viewer/')) {
      event.respondWith(cacheFirst(req, STATIC_CACHE));
      return;
    }
  }

  // Всё остальное — напрямую из сети
});

