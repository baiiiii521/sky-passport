// Sky Passport API for a plain Node host (Tencent Cloud etc.): serves POST /api/check with the same handler Vercel uses,
// and POST /api/shots (screenshot → flights, mainland only).
// Static files are served by Nginx; this process only answers /api/*. Zero dependencies (Node ≥ 18).
//   TYPESAFE_API_KEY=... ALLOWED_ORIGINS=https://your.domain PORT=3100 node server/server.js
'use strict';
const http = require('http');
const check = require('../api/check.js');
const shots = require('./shots.js');   // POST /api/shots: flights from a screenshot (Tencent Cloud OCR)
const PORT = +process.env.PORT || 3100;

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (url !== '/api/check' && url !== '/api/shots') { res.writeHead(404); return res.end(); }
  const run = url === '/api/shots' ? shots.handler : check, max = url === '/api/shots' ? 6e6 : 200e3;   // a screenshot is a few hundred KB of base64
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > max) { res.writeHead(413); res.end(); req.destroy(); } else chunks.push(c); });
  req.on('end', () => {
    if (res.writableEnded) return;
    try { req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null; } catch (e) { req.body = null; }
    // the small part of Vercel's response API the handler uses
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); return res; };
    Promise.resolve(run(req, res)).catch(() => { if (!res.writableEnded) res.status(500).json({ error: 'server' }); });
  });
}).listen(PORT, '127.0.0.1', () => console.log('sky-passport api on 127.0.0.1:' + PORT));
