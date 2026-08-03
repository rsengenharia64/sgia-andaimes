/* SGIA — Service Worker (offline-first do app shell)
   Estratégia: network-first para conteúdo do app e CDNs (mantém sempre a versão
   mais nova quando online) e cache como fallback quando offline. NÃO intercepta
   chamadas ao Supabase (POST/API) — os dados dinâmicos passam direto, e a fila de
   sincronização do app cuida das gravações feitas sem conexão. */
const CACHE = 'sgia-cache-v1';
const APP_SHELL = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // Supabase writes/rpc passam direto

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Só faz cache do próprio app e dos CDNs de bibliotecas. Supabase e demais hosts
  // passam direto (sem cache), evitando servir dado dinâmico velho.
  const cacheavel =
    url.origin === self.location.origin ||
    /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(url.host);
  if (!cacheavel) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then((m) => m || caches.match('./index.html'))
      )
  );
});
