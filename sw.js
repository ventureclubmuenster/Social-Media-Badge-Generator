/* Service Worker — used by the download demo (variant 7).
   Intercepts /__download/<filename> requests and responds with
   the demo image plus Content-Disposition: attachment to force a
   real file download in browsers that ignore the `download` attribute. */

const DEMO_IMAGE = 'assets/foreground%20v3.png';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.includes('/__download/')) return;

  const filename = decodeURIComponent(url.pathname.split('/__download/')[1] || 'download.png');

  event.respondWith(
    fetch(DEMO_IMAGE)
      .then((res) => res.blob())
      .then((blob) => new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': 'attachment; filename="' + filename + '"',
          'Content-Length': String(blob.size)
        }
      }))
  );
});
