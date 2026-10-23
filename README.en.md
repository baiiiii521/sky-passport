<div align="center">

# Sky Passport

**Turn your flight history into a living passport — a one-minute vertical film with an original score, rendered entirely in your browser.**

[![Live Demo](https://img.shields.io/badge/live-passport.nybbq.art-5EEAFF?style=flat-square)](https://passport.nybbq.art/) [![Vercel](https://img.shields.io/badge/overseas-sky--passport.vercel.app-000000?style=flat-square&logo=vercel)](https://sky-passport.vercel.app/) [![Local-first](https://img.shields.io/badge/privacy-local--first-6FF7C8?style=flat-square)](#privacy) [![Format](https://img.shields.io/badge/output-1080%C3%971920%20%C2%B7%2030fps-E9C58E?style=flat-square)](#the-film) [![Vanilla JS](https://img.shields.io/badge/stack-vanilla%20JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)

[简体中文](README.md) · **English**

<a href="https://passport.nybbq.art/"><img src="docs/assets/hero.jpg" alt="Sky Passport home page: route globe and flight stats" width="100%"></a>

<sub>Home · a sample traveller's route globe and flight stats (fictional data, loaded locally)</sub>

</div>

---

## Overview

Sky Passport turns a spreadsheet of flights into a 1080×1920, 30 fps vertical film: the passport cover opens, the map prints row by row, boarding passes flip, routes light up, a stamp lands, the cover closes, and a printable long poster is produced.

It is not a slideshow. Every frame comes from the same deterministic render function, the score is synthesised live with Web Audio, and the video is encoded on your device with WebCodecs. By default the spreadsheet never leaves the browser: no account, no upload, no backend.

The site ships Chinese and English interfaces from one codebase for desktop and mobile. The WeChat mini program is a native wrapper around the same parsing and rendering engine, with video rendered on the server.

## Features

### Import

| Capability | What it does |
|---|---|
| **Spreadsheets** | Exports from 航旅纵横 (`.xls/.xlsx`), Flighty, myFlightradar24 and OpenFlights, or the generic CSV template |
| **Airport resolution** | IATA codes, Chinese names (~738 keywords) and English city names, longest-match disambiguation, manual IATA entry as a fallback |
| **Hand entry** | Date, origin, destination and optional flight number — for missing legs or travellers without an export |
| **Screenshot import** | Upload trip screenshots; server-side OCR reconstructs flights by layout and discards the image immediately (mainland site) |
| **Table check** | Unknown airports, missing dates, duplicate rows, unknown statuses and train-like rows listed with sheet/row/column, fixed in place, clean CSV export |
| **AI review (optional)** | Only cells that need judgement are sent to the server; confidence ≥0.85 is applied in one click, 0.5–0.85 asks for confirmation |

### The film

- **1080×1920 · 30 fps**, about a minute long; the length options only squeeze the year section, leaving the opening and ending untouched.
- Four covers (burgundy, navy, green, black) and two scores (groove, calm).
- Opening: gold-foil emblem → cover swings open → map prints row by row → MRZ types itself. Ending: dead stop → one-beat hang → stamp slam → route pulses → cover closes → poster.
- The year counter is an odometer; the flight ticker is a split-flap board showing only flight number and IATA route.
- **Original score**: 112 BPM, one chord per bar (Fmaj7–Em7–Dm7–Cmaj7), a three-note motif restated on every year downbeat with a rotating instrument; sound effects are real CC0 recordings, mastered to −14 LUFS and ≤ −1 dBTP.
- **Export**: H.264 at 8 Mbps plus AAC at 192 kbps in MP4 via WebCodecs, falling back to VP9/Opus or real-time MediaRecorder.
- Also exports a cover image and a QR end-card poster.

<a href="https://passport.nybbq.art/#/studio/s3"><img src="docs/assets/studio.jpg" alt="Studio: cover, score and length options with a live 1080×1920 preview" width="100%"></a>

<sub>Studio · choose cover, score and length; the live preview is 1080×1920</sub>

### Achievements and sharing

- **33 medals** across distance, places, time and time in the air, in four rarities; locked medals explain how to unlock them and show progress.
- Pick medals to print on a **1080-wide long poster** (two layouts: Night Flight and Classic Passport).
- Share cards: three Xiaohongshu cards (cover / route map / medals) and a single-medal card; the mini program adds a 5:4 share card.

### WeChat mini program

Native, because personal-entity mini programs cannot use `web-view`: home showcase → spreadsheet, screenshots or hand entry → parse on the phone → stats, achievements and long poster. The film is rendered on the server with the same engine, about three jobs in parallel, playable in the mini program and saved to the photo album, then **deleted after 24 hours**.

## How it works

```text
spreadsheet / screenshots / hand entry
        │
        ▼  core.js     parse · airport resolution · time zones · dedupe · diagnostics
        ▼  engine.js   scene schedule · camera · map · frame rendering
        ▼  music.js    112 BPM original score + CC0 sound effects
        ▼  export.js   WebCodecs H.264/AAC → MP4
```

- **Deterministic rendering**: all randomness comes from seeded PRNGs; `renderFrame(i)` is a pure function of the frame index, so the same input always yields the same pixels.
- **Canvas 2D**: coastlines, graticules and country outlines are cached as `Path2D` per projection; preview and export share one drawing path.
- **Sound**: the score is synthesised in a Web Worker built at runtime and shares the picture's BPM grid; `ensureAudio()` returns a Promise that export awaits.
- **Fonts and flags**: every CJK glyph used by the film is preloaded before preview and export so the type never swaps mid-video; flag SVGs are rasterised once.
- **Fallbacks**: if WebCodecs is unavailable or the audio track fails validation, export falls back to real-time recording so the user still gets a file.

### Server rendering (mini program)

`web/server/render.js` runs one shared headless Chromium across three pages, each rendering a frame range and streaming JPEGs into its own x264 encoder; segments are joined losslessly and only the first page synthesises the score. Finished films go to Tencent COS, the local copy is deleted, and nginx keeps the same download URL with a 302.

### The China map

The China outline comes from `china.json` (the DataV.GeoAtlas / AutoNavi standard outline, including Taiwan, South Tibet, Aksai Chin and the South China Sea islands). The nine-dash line is always drawn, other countries' fills are clipped out of China's outline, Taiwan gets a neutral "Taiwan" marker instead of a flag, and Hong Kong, Macau and Taiwan use "…, China" in English names.

> Formal publication of maps in China still requires an official review number (审图号). These rules reduce the risk; they do not replace approval.

## Privacy

- **Local by default**: spreadsheets, names and photos live only in browser memory and localStorage; a refresh clears them.
- **AI review** (optional): only the cells that need judgement plus candidate airports are sent, and the page states exactly what is transmitted. Never the whole sheet.
- **Screenshot import**: the image goes to the mainland server, is read by Tencent Cloud OCR, and is discarded immediately without being stored.
- **Usage counts**: event names only, plus a per-day salted anonymous visitor hash. No flights, names or itinerary data.
- **Mini program**: video is rendered on the server and deleted 24 hours after the job; source files are not retained.

## Quick start

Requirements: Node.js 18+. A browser with Canvas 2D; Chrome or Edge with WebCodecs is recommended for video export.

```bash
cd web
npm install
npm run build:data     # generates airports.json, world-50m.json, flags
npm run dev            # http://localhost:5173
```

There is no bundler: `index.html` loads classic scripts from `public/js/`. WebCodecs requires HTTPS or localhost.

AI review needs the Vercel environment variable `TYPESAFE_API_KEY` and only works under `vercel dev`; `npm run dev` serves the static page and the AI button reports that the service is unavailable.

### Commands

```bash
cd web
npm test               # node:test + vm, no third-party dependencies
npm run build:china    # regenerate china.json
npm run build:fonts    # self-host fonts (Google Fonts is blocked in mainland China)
npm run stamp          # write content hashes into index.html; run before every deploy
```

## Project layout

```text
.
├── web/
│   ├── public/            Single-page app: index.html + js/ + data + fonts + sound
│   ├── api/check.js       AI review (Vercel serverless function)
│   ├── server/            Mainland API: screenshot OCR, video render, COS sync, stats
│   ├── scripts/           Data / China map / fonts / asset stamping / mini program build
│   ├── deploy/            nginx, systemd units, watchdog, deploy scripts
│   ├── tests/             Unit tests + Playwright smoke test
│   └── promo/             Promo and brand-film renderers
├── miniprogram/           WeChat mini program (native; libs generated by web/scripts)
├── video-pipeline/        Offline renderer for the personal film (Python + headless Chrome + ffmpeg)
├── docs/                  Audit, progress notes and screenshots
└── .github/workflows/     CI: unit tests + browser end-to-end
```

## Testing

```bash
cd web && npm test
```

- `tests/core.test.js`: parsing, airport resolution, durations, dedupe, diagnostics.
- `tests/shots.test.js`: OCR text boxes → flights by layout.
- `tests/e2e/smoke.py`: Playwright at desktop and phone viewports — imports, hand entry, all three views, 33 medals, both posters, and a **real MP4 export with sound**.

CI runs the unit tests on every push and pull request, then builds data and fonts and runs the browser test.

## Deployment

| Target | How |
|---|---|
| **Overseas** | Vercel static deploy of `web/public`, English UI, AI review enabled |
| **Mainland** | Tencent Cloud Lighthouse + nginx, static assets on COS/CDN, systemd render service with a watchdog every two minutes |
| **Mini program** | Native package upload; video API points at the mainland render service |

The front end has no build output. Run `npm run stamp` before deploying so scripts and data carry content hashes.

## Stack

| Layer | Choice |
|---|---|
| UI | Plain HTML / CSS / JavaScript, no framework, no bundler |
| Drawing | Canvas 2D, `Path2D` projection caches, SVG-generated flags |
| Sound | Web Audio, runtime Web Worker synthesis, CC0 sound sprite |
| Video | WebCodecs (H.264 + AAC), mp4-muxer, MediaRecorder fallback |
| Data | SheetJS, d3-geo, topojson, OpenFlights airport data |
| Services | Node.js (no framework), headless Chromium, ffmpeg, Tencent COS/OCR |
| Testing | node:test, Playwright |

## Limitations

- Film length varies with the year span, roughly 30–60 seconds; the length options only compress the year section.
- Exporting on a phone is slower than on a desktop, and the page must stay open while it runs.
- WeChat's in-app browser cannot download files directly; the page asks the user to open it in a system browser.
- AI review is only available on the Vercel deployment; the mainland site disables it because of the regional block and falls back to local airport suggestions.
- Screenshot import is mainland-only; images go through Tencent Cloud OCR with per-IP and daily quotas.
- The China map handling reduces compliance risk but formal publication still requires a review number.
- Mini-program films are deleted from the server after 24 hours, so they must be saved in time.

## Acknowledgements

- [OpenFlights](https://openflights.org/data.html) for airport data (ODbL)
- Natural Earth and [DataV.GeoAtlas](https://datav.aliyun.com/portal/school/atlas/area_selector) for map data
- [d3](https://d3js.org/), [topojson](https://github.com/topojson/topojson), [SheetJS](https://sheetjs.com/), [mp4-muxer](https://github.com/Vanilagy/mp4-muxer), [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
- Tencent Cloud OCR and TypeSafe Jev
- CC0 sound effects from Kenney and Freesound
- Noto Serif SC, Noto Sans SC, Open Sans and Space Mono

## License

Proprietary and private. All rights reserved. Do not copy, redistribute or use commercially without the author's written permission.
