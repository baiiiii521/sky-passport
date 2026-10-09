# Sky Passport (航迹护照) — project memory for Claude Code

## What this is
A tool that turns a person's flight history into a ~60 s vertical (1080×1920, 30 fps) "flight passport" animation with original synthesized music.
Owner: Barry (BYB). Product language: Chinese-first UI, bilingual (中文/English) labels in the video.

Two codebases live here:

| Folder | What | Status |
|---|---|---|
| `web/` | Self-serve website. Users upload an Excel/CSV of flights, type a name, preview in-browser, export MP4. Everything runs client-side (no server, no upload). | v1, published as a claude.ai artifact; this repo is now the source of truth |
| `video-pipeline/` | Offline renderer used for Barry's personal film (v4). Headless Chrome renders frames → ffmpeg; Python synthesizes the score from the exported timeline. | Reference implementation; the web engine was ported from it |
| `data/private/` | Barry's real flight records, photo and derived `data.json`. **Never commit, never publish.** (git-ignored) | |
| `docs/` | `reference_v4.mp4` = approved personal film; `inspiration_reference.mp4` = the third-party app clip we took motion ideas from (do not copy its branding). | |

## web/ architecture (single file: `web/public/index.html`)
- Data files fetched relatively at runtime: `airports.json` (OpenFlights IATA rows + 738 Chinese airport-name keywords + ISO numeric + country names), `world-50m.json` (world-atlas topojson), `flags.json` (flag-icons 1x1 SVGs as data URIs; regenerate with `npm run build:data`).
- CDN scripts (pinned): d3 7.9.0, topojson 3.0.2, SheetJS xlsx 0.18.5, mp4-muxer 5.2.1.
- Pipeline in the page: `readWorkbook` (sheet/column detection, 航旅纵横 export format incl. 待出行/已结束/无效票 sheets) → `buildFlights` (airport resolution: IATA → Chinese keyword longest-match → English city → manual IATA entry; tz-aware durations; dedupe) → `buildScene` (BPM-grid schedule, camera, countries) → `renderFrame(i)` (deterministic, pure function of frame index) → `synth()` (music, same grid) → `exportWebCodecs` (H.264/AAC MP4 via WebCodecs + mp4-muxer; falls back to VP9/Opus-in-MP4, then real-time MediaRecorder).
- When running as a claude.ai artifact, file saving goes through `claude.use('downloads')`; outside claude.ai it falls back to an `<a download>` link.

## Motion/music rules we settled on (keep these)
- 112 BPM grid; one chord per bar (Fmaj7–Em7–Dm7–Cmaj7). Every year starts on a bar line; map-only punch (1.03→1.0 over 20 frames) + crash on each year downbeat. Do NOT scale the whole page (small text shimmers).
- Pacing: sparse years (≤0.5 bar) = "gap" section (drums out, filtered pad); all-upcoming year = "dream" section.
- Ending = stop → hang (1 beat) → ink-stamp slam (SFX on contact frame, page shake) → groove returns with zoom-out + route light pulses → cover closes → poster.
- Opening = poster (2 bars) → cover swings open (0.8 s) → map prints row by row, MRZ types itself.
- Year counter is an odometer, clipped to one glyph height. Flight ticker shows only flight no. + IATA route (no dates).
- Determinism: all randomness via `hash()` / seeded PRNG; same frame index ⇒ same pixels.
- Visual direction: 90s passport / guilloche security print; burgundy cover + gold foil on the site.

## Commands
```bash
# web
cd web && npm install && npm run build:data   # regenerates public/airports.json, flags.json, world-50m.json
npm run dev                                    # http://localhost:5173  (WebCodecs needs https or localhost)

# personal film pipeline (needs ffmpeg, Python 3 with numpy/scipy/pandas/xlrd, Chrome)
cd video-pipeline && npm install
python3 build.py ../data/private/records_byb.xls       # -> data/private/data.json
(cd .. && python3 -m http.server 8765) &               # serve repo root
node shot.mjs test 5 30 55                             # stills
node shot.mjs full && python3 music2.py                # -> out/out_noaudio.mp4, out/music.wav
ffmpeg -i ../out/out_noaudio.mp4 -i ../out/music.wav -c:v copy -c:a aac -shortest ../out/final.mp4
```

## Known gaps / next steps (candidate backlog)
1. Rows without a date (OPEN / 退票 tickets) are skipped on the web; consider letting users assign a date.
2. Let users delete/toggle individual segments in the web UI (today they must edit the spreadsheet).
3. Chinese airport dictionary covers ~738 keywords; unresolved names fall back to manual IATA entry. Grow it from real uploads.
4. Export speed (~1–3 min); consider OffscreenCanvas + Worker.
5. Deploy outside claude.ai (Vercel/Netlify static hosting works as-is: just serve `web/public/`).
6. Share/social: 9:16 cover image export, Xiaohongshu/Douyin-friendly title card.

## Working agreements
- Owner wants concise, directive Chinese replies and ready-to-use outputs; bilingual where text is user-facing.
- Ask before changing the motion/music rules above; they were approved after review.
- Never commit anything in `data/private/`.
