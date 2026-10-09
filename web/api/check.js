// Sky Passport · spreadsheet check with TypeSafe Jev (System One).
// The browser sends only the cells that need a judgment plus code-generated candidates; every question is
// written here, never taken from the client, so this endpoint cannot be used as a general Jev proxy.
// The key lives in the TYPESAFE_API_KEY environment variable (Vercel project settings), never in the page.
'use strict';

const API = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-1.13.0'; // pinned: the UI's confidence thresholds were checked against this version
const ORIGINS = [/^https:\/\/sky-passport(-[a-z0-9-]+)?\.vercel\.app$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const LIMIT = { airports: 40, candidates: 16, statuses: 20, rows: 20, columns: 30, preview: 8 };

const str = (v, n = 60) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '').replace(/\s+/g, ' ').trim().slice(0, n);
const list = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
const COL = /^[A-Z]{1,2}$/, IATA = /^[A-Z]{3}$/;
const NONE_AP = 'None of the listed airports: the text names a different airport, is not an airport at all, or is too vague to tell which airport.';

// best-effort per-instance throttle; put a Vercel Firewall rate-limit rule in front for real protection
const hits = new Map();
function throttled(ip) {
  const now = Date.now(), w = hits.get(ip) || { n: 0, t: now };
  if (now - w.t > 10 * 60e3) { w.n = 0; w.t = now; }
  w.n++; hits.set(ip, w);
  if (hits.size > 5000) hits.clear();
  return w.n > 30;
}

function buildQuestions(body) {
  const Q = {}, ids = { airports: [], statuses: [], rows: [], columns: [] };
  for (const a of list(body.airports, LIMIT.airports)) {
    const id = str(a.id, 8), text = str(a.text, 60);
    if (!id || !text) continue;
    const criteria = {};
    for (const c of list(a.candidates, LIMIT.candidates)) {
      const code = str(c && c.code, 3);
      if (IATA.test(code) && !criteria[code]) criteria[code] = str(c.desc, 140) || code;
    }
    if (!Object.keys(criteria).length) continue;
    criteria.none = NONE_AP;
    const column = { from: 'departure (origin)', to: 'arrival (destination)' }[a.role] || 'departure or arrival';
    Q['ap_' + id] = {
      type: 'choice',
      instructions: {
        spreadsheet_cell: text,
        column: column + ' airport',
        rows_using_this_cell: list(a.context, 3).map(r => ({ flight_number: str(r && r.fn, 12), date: str(r && r.date, 16), other_airport_in_row: str(r && r.other, 60) })),
        question: 'A traveller\'s flight-history spreadsheet has the text `spreadsheet_cell` in its `column` column. Which airport did the traveller write? Match the written text first: it may be a city, an airport name or nickname, an IATA code, Chinese or English, and may contain a typo or a same-sounding wrong character (for example 浦栋 means 浦东 Pudong, 红桥 means 虹桥 Hongqiao). Use `rows_using_this_cell` only to choose between airports that the text fits equally well, such as two airports of the same city.',
      },
      criteria,
    };
    ids.airports.push(id);
  }
  for (const s of list(body.statuses, LIMIT.statuses)) {
    const id = str(s.id, 8), text = str(s.text, 40);
    if (!id || !text) continue;
    Q['st_' + id] = {
      type: 'choice',
      instructions: { status_text: text, question: 'In an airline-ticket or flight-history export, a ticket\'s status column says `status_text`. What does this status mean for the flight on that ticket?' },
      criteria: {
        flown: 'The flight was taken: the ticket was used, the trip is completed, the passenger boarded or flew.',
        upcoming: 'The ticket is still valid for a flight that has not happened yet: unused, issued, booked, awaiting travel.',
        void: 'This ticket will not be flown: refunded, cancelled, voided, exchanged, rebooked onto another ticket, or a no-show.',
        unclear: 'The status does not say whether the flight happened.',
      },
    };
    ids.statuses.push(id);
  }
  for (const r of list(body.rows, LIMIT.rows)) {
    const id = str(r.id, 8);
    if (!id) continue;
    Q['row_' + id] = {
      type: 'choice',
      instructions: {
        row: { number: str(r.fn, 16), from: str(r.from, 60), to: str(r.to, 60), date: str(r.date, 16), carrier: str(r.al, 40) },
        question: 'This `row` comes from a spreadsheet that is supposed to list a traveller\'s flights. Is `row` an airplane flight, or another kind of trip or record that got mixed in?',
      },
      criteria: {
        flight: 'An airplane flight: an airline flight number (two-character airline code + digits, e.g. MU5101, CA1519, NH924, Z2123) between airports or cities.',
        train: 'A train or high-speed-rail trip: train numbers such as G1234, D301, K5 or Z19, or railway stations (names ending in 站, "railway station").',
        other: 'Something else: bus, ferry, car, hotel, a total or summary line, a note, or an empty/garbage line.',
      },
    };
    ids.rows.push(id);
  }
  const C = body.columns;
  if (C && typeof C === 'object') {
    const cols = list(C.columns, LIMIT.columns).filter(c => c && COL.test(str(c.col, 2)));
    if (cols.length) {
      const colCrit = {};
      for (const c of cols) colCrit[str(c.col, 2)] = 'Column ' + str(c.col, 2) + ': ' + list(c.values, 8).map(v => '"' + str(v, 30) + '"').join(', ');
      colCrit.none = 'No column holds this information.';
      const ROLES = {
        date: 'the date of each flight (the day it departs)',
        from: 'where each flight departs from (origin airport or city)',
        to: 'where each flight arrives (destination airport or city)',
        fn: 'the flight number (e.g. MU5101)',
        al: 'the airline name',
        dt: 'the departure time of day',
        at: 'the arrival time of day',
        st: 'the ticket or trip status (used, unused, refunded…)',
        km: 'the flight distance or mileage',
      };
      for (const [role, what] of Object.entries(ROLES)) {
        Q['col_' + role] = { type: 'choice', instructions: 'The spreadsheet in `rows` lists a traveller\'s flights; each option shows one column\'s first cells (the first may be a title). Which column holds ' + what + '?', criteria: colCrit };
        ids.columns.push(role);
      }
      const rowCrit = {};
      list(C.rows, LIMIT.preview).forEach((r, i) => { rowCrit['r' + (i + 1)] = 'Row ' + (i + 1) + ': ' + list(r, 12).map(v => '"' + str(v, 24) + '"').join(', '); });
      rowCrit.none = 'There is no title row; the first row is already a flight.';
      Q.header_row = { type: 'choice', instructions: 'Which row of `rows` holds the column titles (headers such as date, flight, from, to), with the flight records below it?', criteria: rowCrit };
    }
  }
  return { Q, ids };
}

function stateFor(body) {
  const C = body.columns && typeof body.columns === 'object' ? body.columns : null;
  const s = { document: 'A traveller\'s flight-history spreadsheet, exported from an airline or travel app or typed by hand, often in Chinese.' };
  if (C) s.rows = list(C.rows, LIMIT.preview).map(r => list(r, 20).map(v => str(v, 30)));
  return s;
}

function pack(a) {
  if (!a) return null;
  if (a.type === 'noul') return { noul: a.noul };
  const top = Object.entries(a.probabilities || {}).sort((x, y) => y[1] - x[1]).slice(0, 4);
  return { choice: a.choice, confidence: a.confidence, top };
}

async function callJev(payload, key) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(API, { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctl.signal });
      if ((r.status === 429 || r.status === 529) && attempt < 2) { await new Promise(res => setTimeout(res, 700 * (attempt + 1))); continue; }
      const j = await r.json().catch(() => ({}));
      return { status: r.status, json: j };
    } finally { clearTimeout(timer); }
  }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (origin && !ORIGINS.some(re => re.test(origin)) && !(process.env.ALLOWED_ORIGINS || '').split(',').includes(origin)) return res.status(403).json({ error: 'origin' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (throttled(ip)) return res.status(429).json({ error: 'too_many' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'body' });

  const { Q, ids } = buildQuestions(body);
  if (!Object.keys(Q).length) return res.status(200).json({ model: null, answers: {}, ids });
  try {
    const out = await callJev({ model: MODEL, state: stateFor(body), questions: Q }, key);
    if (out.status !== 200) return res.status(out.status === 401 ? 502 : out.status >= 500 ? 502 : out.status).json({ error: 'upstream', status: out.status });
    const answers = {};
    for (const [k, a] of Object.entries(out.json.answers || {})) answers[k] = pack(a);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ model: out.json.model, answers, ids, usage: out.json.usage });
  } catch (e) {
    return res.status(504).json({ error: 'timeout' });
  }
};
