# Promo v4 = promo v3 picture with narration as the single source of the words on screen.
# TTS lines are fitted to the film's beats first; their real timings are handed to story.js (STORY.setVO), which shows each line
# as a subtitle that lights up with the voice (headlines that are already on screen only get the voice meter). The sound is mixed
# inside the page's synth: music and effects duck under each line, one master (-14 LUFS, limiter).
#   cd web/public && python3 -m http.server 5190 &
#   uv run --with playwright --with edge-tts --with numpy python web/promo/make_voice.py <out_dir> <zh|en> [voice] [--audio-only]
# --audio-only reuses <out_dir>/_v.mp4 (same lines, so the subtitles still match).
import asyncio, base64, json, os, re, subprocess, sys, wave
import numpy as np
import edge_tts
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith('--')]; AUDIO_ONLY = '--audio-only' in sys.argv
out, lang = args[0], args[1]
VOICE = args[2] if len(args) > 2 else {'zh': 'zh-CN-YunyangNeural', 'en': 'en-US-AndrewNeural'}[lang]
os.makedirs(out, exist_ok=True); HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000; END = 41.79

# (start s, text, head, y). head=1: the sentence is already the headline on screen at that moment, so no subtitle is drawn.
# Starts sit on the picture: 6.43 decode headline, 16.2 title hit, 17.1 tagline, 19.29 + k*2.143 the five modules,
# 30.7 stamp then its two lines, 36.43 end card. A line may run until 0.12 s before the next one; the last few must also
# clear the dead stop before the title (15.66) and the stamp (30.54).
LINES = {
 'zh': [(0.45, '2018 年，第一次一个人出远门。', 0, 0),
        (2.90, '后来，登机牌越攒越多。', 0, 0),
        (4.80, '最后，都成了一张表格。', 0, 0),
        (6.50, '把每一行，解码成一条航线。', 1, 1720),
        (10.95, '51 次起飞，13 个国家和地区，绕地球 3.28 圈。', 0, 0),
        (16.32, '航迹护照。', 1, 1480),
        (17.15, '把你的航班记录，做成一本会动的护照。', 1, 1480),
        (19.95, '一分钟的飞行护照。', 1, 1790),
        (21.60, '一张图，晒出这些年。', 1, 1790),
        (23.70, '写错的地名，它认得出。', 1, 1790),
        (25.82, '各种 App 的导出，直接上传。', 1, 1790),
        (28.10, '表格，只在你的浏览器里处理。', 1, 1790),
        (30.98, '每一次起飞，都值得被记住。', 0, 1620),
        (33.40, '这些年，51 次起飞，13 万公里。', 0, 1620),
        (37.00, '把你的天空，装进一本护照。', 1, 1740),
        (39.35, '扫码，免费生成你的。', 0, 1760)],
 'en': [(0.45, '2018. My first flight on my own.', 0, 0),
        (2.90, 'Then the boarding passes piled up.', 0, 0),
        (4.80, 'And ended up in a spreadsheet.', 0, 0),
        (6.50, 'Decoding every row into a route.', 1, 1720),
        (10.95, '51 take-offs. 13 countries. 3.28 times around the Earth.', 0, 0),
        (16.32, 'Sky Passport.', 1, 1480),
        (17.15, 'Your flight history, as a passport that comes alive.', 1, 1480),
        (19.95, 'A one-minute passport film.', 1, 1790),
        (21.60, 'One image, all those years.', 1, 1790),
        (23.70, 'Typos? It still gets them.', 1, 1790),
        (25.82, 'Upload your exports as they are.', 1, 1790),
        (28.10, 'Your sheet never leaves your browser.', 1, 1790),
        (30.98, 'Every take-off deserves to be remembered.', 0, 1620),
        (33.40, 'Over the years: 51 flights, 131 thousand kilometres.', 0, 1620),
        (37.00, 'Every flight. One passport.', 1, 1740),
        (39.35, 'Scan, and make yours for free.', 0, 1760)]}
HARD = [15.55, 30.45, 36.35, END - 0.35]          # nothing is spoken across these moments
RATES = ['-4%', '+0%', '+5%', '+10%', '+15%', '+20%', '+26%']

async def tts(text, rate, path):
    await edge_tts.Communicate(text, VOICE, rate=rate, pitch='-2Hz' if lang == 'zh' else '+0Hz').save(path)

def clean(mp3):  # trim the TTS padding; voice EQ (rumble out, less box, presence) and gentle compression; 48 kHz mono float
    af = ('silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.01,areverse,'
          'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.01,areverse,'
          'highpass=f=80,equalizer=f=250:t=q:w=1.0:g=-2,equalizer=f=3200:t=q:w=1.2:g=2.5,equalizer=f=9000:t=q:w=1.0:g=1,'
          'acompressor=threshold=-22dB:ratio=2.5:attack=6:release=120:makeup=2,afade=t=in:d=0.01,areverse,afade=t=in:d=0.04,areverse')
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', mp3, '-af', af, '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

lines = LINES[lang]; placed = []; bad = 0
print('voice', VOICE)
for i, (t0, text, head, y) in enumerate(lines):
    limit = min([lines[i + 1][0] - 0.12 if i + 1 < len(lines) else 99] + [h for h in HARD if h > t0])
    for rate in RATES:
        p = os.path.join(out, f'_vo_{i}.mp3'); asyncio.run(tts(text, rate, p)); x = clean(p)
        if t0 + len(x) / SR <= limit: break
    d = len(x) / SR; over = t0 + d - limit; bad += over > 0
    print(f'  {t0:6.2f}-{t0 + d:6.2f}  ({rate:>4}) {"OVER %.2fs" % over if over > 0 else "fits"}  {text}', flush=True)
    placed.append((t0, x, text, head, y))
if bad: sys.exit('a line does not fit its window: shorten it')
VOJS = [[t0, round(t0 + len(x) / SR, 3), text, head, y] for t0, x, text, head, y in placed]
v = np.zeros(int(END * SR) + SR, dtype=np.float32)
for t0, x, *_ in placed: k = int(round(t0 * SR)); v[k:k + len(x)] += x[:len(v) - k]
duck = [[a, b, 0.70, 0.45] for a, b, *_ in VOJS]   # under each line: music -10.5 dB, effects -5.2 dB

def sprite(name):
    b64 = base64.b64encode(open(os.path.join(HERE, name + '.mp3'), 'rb').read()).decode()
    return [b64, json.loads(re.search(r'=(\{.*\});', open(os.path.join(HERE, name + '.map.js')).read()).group(1))]
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True); pg = b.new_page(viewport={'width': 1300, 'height': 900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    site = 'https://sky-passport.vercel.app' if lang == 'en' else 'https://passport.nybbq.art'
    pg.goto(f'http://localhost:5190/?site={site}&lang={lang}'); pg.wait_for_function('typeof S!=="undefined"&&S&&S.ok', timeout=60000); pg.wait_for_timeout(1200)
    pg.add_script_tag(path=os.path.join(HERE, 'story.js')); info = pg.evaluate('([p,l,s])=>STORY.init(p,l,s)', ['hud', lang, [sprite('sfx-promo'), sprite('sfx-tech')]]); print(info, flush=True)
    pg.evaluate('v=>STORY.setVO(v)', VOJS)
    if not AUDIO_ONLY:
        enc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', os.path.join(out, '_v.mp4')], stdin=subprocess.PIPE)
        for i in range(info['frames']):
            enc.stdin.write(base64.b64decode(pg.evaluate(f'STORY.frame({i})').split(',', 1)[1]))
            if i % 300 == 0: print(i, '/', info['frames'], flush=True)
        enc.stdin.close(); enc.wait()
    A = pg.evaluate('([b,d])=>STORY.audio(true,{b64:b,duck:d,db:5})', [base64.b64encode(v.tobytes()).decode(), duck])
    with wave.open(os.path.join(out, '_a.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(base64.b64decode(A['pcm']))
    open(os.path.join(out, '_stems_full.f32'), 'wb').write(base64.b64decode(A['stems'])); print('errors', errs); b.close()

name = f'promo-v4-{lang}-{VOICE.split("-")[2].replace("Neural", "").lower()}'; full = os.path.join(out, name + '.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(out, '_v.mp4'), '-i', os.path.join(out, '_a.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', str(info['seconds']), '-movflags', '+faststart', full], check=True)
f = lambda s: f'{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round(s % 1 * 1000)) % 1000:03d}'
with open(full.replace('.mp4', '.srt'), 'w', encoding='utf-8') as o:
    for i, (a, e, text, *_) in enumerate(VOJS, 1): o.write(f'{i}\n{f(a)} --> {f(e)}\n{text}\n\n')
json.dump({'voice': VOICE, 'full': [(a, round(e - a, 3), text) for a, e, text, *_ in VOJS]}, open(os.path.join(out, name + '.json'), 'w'), ensure_ascii=False, indent=1)
print('wrote', full)
