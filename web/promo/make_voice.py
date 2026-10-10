# Narration for promo v3: neural TTS lines placed on the film's own beats, mixed inside the page's synth
# (music ducks under each line, effects do not; one master: -14 LUFS, limiter), muxed over the frames already rendered.
#   cd web/public && python3 -m http.server 5190 &
#   uv run --with playwright --with edge-tts --with numpy python web/promo/make_voice.py <frames_dir> <out_dir> <zh|en> [voice]
# frames_dir holds _v.mp4 from `make_story.py film` (the picture is not re-rendered). Writes the 42 s film, the ~17 s cut,
# SRT subtitles for both, the narration stem and a QA line. The script text and timings are in LINES below.
import asyncio, base64, json, os, re, subprocess, sys, wave
import numpy as np
import edge_tts
from playwright.sync_api import sync_playwright

frames, out, lang = sys.argv[1], sys.argv[2], sys.argv[3]
VOICE = sys.argv[4] if len(sys.argv) > 4 else {'zh': 'zh-CN-YunyangNeural', 'en': 'en-US-AndrewNeural'}[lang]
os.makedirs(out, exist_ok=True); HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
BAR = 4 * 60 / 112; HERO = 16.2; STAMP = 30.7; END = 41.79
CUT = [(0, 3), (7, 11), (14, 15), (17, None)]  # the ~17 s cut, in bars (same as make_story.py)

# (start s, latest end s, text). Ends keep clear of the beats: the stop before the hero hit (15.66), the stamp (30.7), the next caption.
LINES = {
 'zh': [(0.55, 2.95, '还记得，第一次出远门吗？'),
        (2.70, 6.35, '后来，它们都躺进了，一张冰冷的表格。'),
        (6.60, 10.55, '现在，把每一行，重新解码成一条航线。'),
        (11.25, 15.45, '五十一次起飞，十三个国家和地区，绕地球三圈多。'),
        (16.60, 20.85, '航迹护照。把航班记录，做成一本会动的护照。'),
        (21.00, 27.45, '一分钟的影片，一张晒得出手的长图；写错的地名，它也认得出来。'),
        (27.90, 30.40, '而表格，只在你的浏览器里处理。'),
        (31.10, 33.95, '每一次起飞，都值得被记住。'),
        (34.15, 36.30, '这些年的天空，都在这里。'),
        (37.00, 40.60, '扫码，把你的天空，装进一本护照。')],
 'en': [(0.55, 2.95, 'Remember your first trip away?'),
        (2.70, 6.35, 'Then the boarding passes piled up, and became rows in a spreadsheet.'),
        (6.60, 10.55, 'Now, every row is decoded into a route.'),
        (11.25, 15.45, 'Fifty-one take-offs. Thirteen countries. Three laps of the Earth.'),
        (16.60, 20.85, 'Sky Passport. Your flights, as a passport that comes alive.'),
        (21.00, 27.45, 'A one-minute film. A poster worth sharing. Even misspelled airports, it gets them.'),
        (27.90, 30.40, 'And your sheet never leaves your browser.'),
        (31.10, 33.95, 'Every take-off deserves to be remembered.'),
        (34.15, 36.30, 'All those years, in one place.'),
        (37.00, 40.60, 'Scan, and put your sky in a passport.')]}
# the short cut keeps only what fits inside its segments; one shorter line replaces the module sentence
SHORT = {'zh': [0, 1, 4, ('x', 21.00, 23.45, '一分钟影片，一张长图。'), 9],
         'en': [0, 1, 4, ('x', 21.00, 23.45, 'A one-minute film. A poster to share.'), 9]}
RATES = ['-6%', '+0%', '+6%', '+12%', '+18%', '+24%']

async def tts(text, rate, path):
    await edge_tts.Communicate(text, VOICE, rate=rate, pitch='-2Hz' if lang == 'zh' else '+0Hz').save(path)

def clean(mp3):  # trim the TTS padding; voice EQ (rumble out, a little less box, presence) and gentle compression; 48 kHz mono float
    af = ('silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.01,areverse,'
          'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.01,areverse,'
          'highpass=f=80,equalizer=f=250:t=q:w=1.0:g=-2,equalizer=f=3200:t=q:w=1.2:g=2.5,equalizer=f=9000:t=q:w=1.0:g=1,'
          'acompressor=threshold=-22dB:ratio=2.5:attack=6:release=120:makeup=2,afade=t=in:d=0.01,areverse,afade=t=in:d=0.04,areverse')
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', mp3, '-af', af, '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

def render(lines, tag):
    """synthesise each line at the slowest rate that fits its window; returns placed clips"""
    placed = []
    for i, (t0, t1, text) in enumerate(lines):
        for rate in RATES:
            p = os.path.join(out, f'_vo_{tag}_{i}.mp3'); asyncio.run(tts(text, rate, p)); x = clean(p)
            if len(x) / SR <= t1 - t0: break
        d = len(x) / SR; over = d - (t1 - t0)
        print(f'  {t0:6.2f}-{t0 + d:6.2f}  ({rate:>4}) {"OVER %.2fs" % over if over > 0 else "fits"}  {text}', flush=True)
        if placed and placed[-1][0] + len(placed[-1][1]) / SR > t0 - 0.15: print('  !! starts before the previous line has ended (+150 ms breath):', text)
        placed.append((t0, x, text))
    return placed

def track(placed):
    v = np.zeros(int(END * SR) + SR, dtype=np.float32)
    for t0, x, _ in placed: k = int(round(t0 * SR)); v[k:k + len(x)] += x[:len(v) - k]
    return v

def srt(items, path):
    f = lambda s: f'{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round(s % 1 * 1000)) % 1000:03d}'
    with open(path, 'w', encoding='utf-8') as o:
        for i, (a, b, text) in enumerate(items, 1): o.write(f'{i}\n{f(a)} --> {f(b)}\n{text}\n\n')

def cut_map(t):  # film time -> short-cut time (None if the moment is cut out)
    acc = 0
    for a, e in CUT:
        A, E = a * BAR, (e * BAR if e else END)
        if A <= t <= E: return acc + t - A
        acc += E - A
    return None

full_lines = LINES[lang]
short_lines = [(x[1], x[2], x[3]) if isinstance(x, tuple) else full_lines[x] for x in SHORT[lang]]
print('voice', VOICE); print('full:'); P_full = render(full_lines, 'f'); print('short:'); P_short = render(short_lines, 's')

def sprite(name):
    b64 = base64.b64encode(open(os.path.join(HERE, name + '.mp3'), 'rb').read()).decode()
    return [b64, json.loads(re.search(r'=(\{.*\});', open(os.path.join(HERE, name + '.map.js')).read()).group(1))]
SPRITES = [sprite('sfx-promo'), sprite('sfx-tech')]

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True); pg = b.new_page(viewport={'width': 1300, 'height': 900})
    site = 'https://sky-passport.vercel.app' if lang == 'en' else 'https://passport.nybbq.art'
    pg.goto(f'http://localhost:5190/?site={site}&lang={lang}'); pg.wait_for_function('typeof S!=="undefined"&&S&&S.ok', timeout=60000); pg.wait_for_timeout(1200)
    pg.add_script_tag(path=os.path.join(HERE, 'story.js')); info = pg.evaluate('([p,l,s])=>STORY.init(p,l,s)', ['hud', lang, SPRITES]); print(info)
    for tag, placed in (('full', P_full), ('short', P_short)):
        v = track(placed); duck = [[t0, t0 + len(x) / SR, 0.70, 0.45] for t0, x, _ in placed]   # under each line: music -10.5 dB, effects -5.2 dB
        A = pg.evaluate('([b,d])=>STORY.audio(true,{b64:b,duck:d,db:5})', [base64.b64encode(v.tobytes()).decode(), duck])
        with wave.open(os.path.join(out, f'_a_{tag}.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(base64.b64decode(A['pcm']))
        open(os.path.join(out, f'_stems_{tag}.f32'), 'wb').write(base64.b64decode(A['stems']))
    b.close()

name = f'promo-voice-{lang}-{VOICE.split("-")[2].replace("Neural", "").lower()}'
full = os.path.join(out, f'{name}-42s.mp4'); short = os.path.join(out, f'{name}-17s.mp4'); tmp = os.path.join(out, '_full_shortmix.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(frames, '_v.mp4'), '-i', os.path.join(out, '_a_full.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', str(info['seconds']), '-movflags', '+faststart', full], check=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(frames, '_v.mp4'), '-i', os.path.join(out, '_a_short.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'pcm_s16le', '-t', str(info['seconds']), tmp], check=True)
segs = ''.join((f"[0:v]trim={a*BAR}:{e*BAR},setpts=PTS-STARTPTS[v{i}];[0:a]atrim={a*BAR}:{e*BAR},asetpts=PTS-STARTPTS,afade=t=in:d=0.02[a{i}];" if e else
                f"[0:v]trim=start={a*BAR},setpts=PTS-STARTPTS[v{i}];[0:a]atrim=start={a*BAR},asetpts=PTS-STARTPTS,afade=t=in:d=0.02[a{i}];") for i, (a, e) in enumerate(CUT))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-filter_complex', segs + ''.join(f'[v{i}][a{i}]' for i in range(len(CUT))) + f'concat=n={len(CUT)}:v=1:a=1[v][a]', '-map', '[v]', '-map', '[a]',
                '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', short], check=True); os.remove(tmp)
srt([(t0, t0 + len(x) / SR, s) for t0, x, s in P_full], full.replace('.mp4', '.srt'))
items = []
for t0, x, s in P_short:
    a, e = cut_map(t0), cut_map(t0 + len(x) / SR)
    if a is not None and e is not None: items.append((a, e, s))
    else: print('  !! line crosses a cut:', s)
srt(items, short.replace('.mp4', '.srt'))
json.dump({'voice': VOICE, 'full': [(t0, round(len(x) / SR, 3), s) for t0, x, s in P_full], 'short': [(t0, round(len(x) / SR, 3), s) for t0, x, s in P_short]}, open(os.path.join(out, f'{name}.json'), 'w'), ensure_ascii=False, indent=1)
print('wrote', full, short)
