import http from 'node:http';

// Only the app shell, its compiled assets, and the approved sample cross the tunnel.
const origin = new URL(process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:3001');
const allowedFiles = new Set([
  '/', '/phone-preview/living-room.jpg',
  '/vendor/pannellum/pannellum.js', '/vendor/pannellum/pannellum.css',
]);
http.createServer((request, response) => {
  const url = new URL(request.url || '/', origin);
  const allowed = allowedFiles.has(url.pathname) || url.pathname.startsWith('/_next/static/');
  if (!allowed || !['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(404); response.end('Not found'); return;
  }
  const upstream = http.request(new URL(url.pathname + url.search, origin), {
    method: request.method, headers: { accept: request.headers.accept || '*/*' },
  }, result => {
    response.writeHead(result.statusCode || 502, {
      ...result.headers,
      'x-robots-tag': 'noindex, nofollow',
      'permissions-policy': 'accelerometer=(self), gyroscope=(self), magnetometer=(self)',
    });
    result.pipe(response);
  });
  upstream.on('error', () => { response.writeHead(502); response.end('Preview temporarily unavailable'); });
  upstream.end();
}).listen(3002, '127.0.0.1', () => console.log('Phone preview gateway listening on 127.0.0.1:3002'));
