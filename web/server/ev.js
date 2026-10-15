// Anonymous usage counts: POST /api/ev {e: event, s: 'web'|'en'|'mp'} → +1 for that event today. Nothing about the
// traveller is sent or kept: no flights, no names, no ids. Visitors per day are counted from a salted hash of
// IP + user agent that lives only in memory and is dropped at midnight (the files hold numbers only).
//   node server/ev.js report [days]     (on the server: a table of the last days)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DIR = process.env.STATS_DIR || path.join(__dirname, '..', 'stats');
const EVENTS = new Set(['visit', 'import_file', 'import_shots', 'import_manual', 'import_demo', 'shots_none', 'preview_play', 'export_ok', 'export_fail',
  'video_req', 'video_ok', 'video_fail', 'video_save', 'video_send', 'poster', 'xhs_cards', 'medal_card', 'share_card', 'intro_play', 'countdown', 'restore_last']);
const SRC = new Set(['web', 'en', 'mp']);
let day = '', counts = {}, seen = new Map(), salt = '', dirty = false; const hits = new Map();
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);   // days in China time
const file = d => path.join(DIR, d + '.json');
function roll() { const d = today(); if (d === day) return; flush(); day = d; salt = crypto.randomBytes(16).toString('hex'); seen = new Map(); hits.clear();
  try { counts = JSON.parse(fs.readFileSync(file(d), 'utf8')); } catch (e) { counts = {}; } }
function flush() { if (!dirty || !day) return; try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(file(day), JSON.stringify(counts)); dirty = false; } catch (e) { console.error('ev flush', e.message); } }
setInterval(flush, 60e3).unref(); process.on('SIGTERM', () => { flush(); process.exit(0); });
function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  roll(); let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  const e = b && String(b.e || ''), s = b && String(b.s || ''); if (!EVENTS.has(e) || !SRC.has(s)) return res.status(400).json({ error: 'bad_input' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(), n = (hits.get(ip) || 0) + 1; hits.set(ip, n); if (n > 400) return res.status(429).json({ error: 'too_many' });
  const k = s + ':' + e; counts[k] = (counts[k] || 0) + 1;
  const v = crypto.createHash('sha256').update(salt + ip + (req.headers['user-agent'] || '')).digest('hex').slice(0, 16), set = seen.get(s) || new Set(); if (!set.has(v)) { set.add(v); seen.set(s, set); counts[s + ':visitors'] = set.size; }
  dirty = true; return res.status(204).end ? (res.statusCode = 204, res.end()) : res.status(204).json({});
}
function report(days = 7) {
  const ds = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().slice(-days) : [], rows = ds.map(f => [f.slice(5, 10), JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))]);
  const keys = [...new Set(rows.flatMap(([, c]) => Object.keys(c)))].sort(); if (!rows.length) return console.log('no data yet');
  console.log(['event'.padEnd(22), ...rows.map(([d]) => d.padStart(6))].join(' ')); for (const k of keys) console.log([k.padEnd(22), ...rows.map(([, c]) => String(c[k] || '').padStart(6))].join(' '));
}
if (require.main === module && process.argv[2] === 'report') report(+process.argv[3] || 7);
module.exports = { handler, EVENTS };
