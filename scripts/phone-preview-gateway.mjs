import http from 'node:http';

// Only app assets, the approved sample, and explicit AI routes cross the tunnel.
// Production AI authorization is enforced by the app, including the demo access code.
const origin = new URL(process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:3000');
const allowedFiles = new Set([
  '/', '/phone-preview/living-room.jpg', '/api/ai/config',
  '/vendor/pannellum/pannellum.js', '/vendor/pannellum/pannellum.css',
]);
const aiRoutes = new Set(['/api/associations', '/api/memory-image']);
http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', origin);
  const isAi = aiRoutes.has(url.pathname) && request.method === 'POST';
  const isFile = (allowedFiles.has(url.pathname) || url.pathname.startsWith('/_next/static/')) && ['GET', 'HEAD'].includes(request.method || '');
  if (!isAi && !isFile) {
    response.writeHead(404); response.end('Not found'); return;
  }
  const chunks = [];
  if (isAi) {
    let bytes = 0;
    try {
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 8192) { response.writeHead(413); response.end('Request too large'); return; }
        chunks.push(chunk);
      }
    } catch { response.writeHead(400); response.end('Invalid request'); return; }
  }
  const headers = { accept: request.headers.accept || '*/*', host: request.headers.host || origin.host };
  for (const name of ['content-type', 'origin', 'x-demo-access-code']) {
    if (typeof request.headers[name] === 'string') headers[name] = request.headers[name];
  }
  const upstream = http.request(new URL(url.pathname + url.search, origin), {
    method: request.method, headers,
  }, result => {
    response.writeHead(result.statusCode || 502, {
      ...result.headers,
      'x-robots-tag': 'noindex, nofollow',
      'permissions-policy': 'accelerometer=(self), gyroscope=(self), magnetometer=(self)',
    });
    result.pipe(response);
  });
  upstream.on('error', () => { response.writeHead(502); response.end('Preview temporarily unavailable'); });
  upstream.setTimeout(180_000, () => upstream.destroy());
  upstream.end(isAi ? Buffer.concat(chunks) : undefined);
}).listen(3002, '127.0.0.1', () => console.log('Phone preview gateway listening on 127.0.0.1:3002'));
