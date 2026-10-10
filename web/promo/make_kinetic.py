# Promo "kinetic" (~24 s): boarding passes at speed, giant numbers, title hit, montage, stamp, end card. No narration.
# Picture and sound come from story.js (STORY.setKinetic); the sound is the film's own mix, cut on the same bar lines.
#   cd web/public && python3 -m http.server 5190 &
#   uv run --with playwright python web/promo/make_kinetic.py <out_dir> <zh|en> [--no-qr] [--stills t1,t2,...]
import base64, json, os, re, subprocess, sys, wave
from playwright.sync_api import sync_playwright
args = [a for a in sys.argv[1:] if not a.startswith('--')]; out, lang = args[0], args[1]; NOQR = '--no-qr' in sys.argv; NOURL = '--no-url' in sys.argv; MODE = sys.argv[sys.argv.index('--mode') + 1] if '--mode' in sys.argv else 'A'   # A rapid fire | B one pass | C departures board
STILLS = [float(x) for x in sys.argv[sys.argv.index('--stills') + 1].split(',')] if '--stills' in sys.argv else None
os.makedirs(out, exist_ok=True); HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
def sprite(name):
    b64 = base64.b64encode(open(os.path.join(HERE, name + '.mp3'), 'rb').read()).decode()
    return [b64, json.loads(re.search(r'=(\{.*\});', open(os.path.join(HERE, name + '.map.js')).read()).group(1))]
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True); pg = b.new_page(viewport={'width': 1300, 'height': 900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    site = 'https://sky-passport.vercel.app' if lang == 'en' else 'https://passport.nybbq.art'
    pg.goto(f'http://localhost:5190/?site={site}&lang={lang}'); pg.wait_for_function('typeof S!=="undefined"&&S&&S.ok', timeout=60000); pg.wait_for_timeout(1200)
    pg.add_script_tag(path=os.path.join(HERE, 'story.js')); pg.evaluate('([p,l,s])=>STORY.init(p,l,s)', ['hud', lang, [sprite('sfx-promo'), sprite('sfx-tech')]])
    pg.evaluate('([a,b])=>STORY.setNoQR(a,b)', [NOQR or NOURL, NOURL]); info = pg.evaluate('m=>STORY.setKinetic(m)', MODE); print(info, flush=True)
    if STILLS:
        for t in STILLS: open(os.path.join(out, f'k_{t:05.2f}.jpg'), 'wb').write(base64.b64decode(pg.evaluate(f'STORY.frame({round(t * 30)})').split(',', 1)[1]))
        print('errors', errs); b.close(); sys.exit()
    enc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', os.path.join(out, '_v.mp4')], stdin=subprocess.PIPE)
    for i in range(info['frames']):
        enc.stdin.write(base64.b64decode(pg.evaluate(f'STORY.frame({i})').split(',', 1)[1]))
        if i % 300 == 0: print(i, '/', info['frames'], flush=True)
    enc.stdin.close(); enc.wait()
    A = pg.evaluate('STORY.audio(false)')
    with wave.open(os.path.join(out, '_a_src.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(base64.b64decode(A))
    print('errors', errs); b.close()
segs = info['segs']; n = len(segs)
fc = ''.join(f"[0:a]atrim={a}:{e},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,areverse,afade=t=in:d=0.012,areverse[a{i}];" for i, (a, e) in enumerate(segs)) + ''.join(f'[a{i}]' for i in range(n)) + f'concat=n={n}:v=0:a=1[a]'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(out, '_a_src.wav'), '-filter_complex', fc, '-map', '[a]', os.path.join(out, '_a.wav')], check=True)
full = os.path.join(out, f'promo-kinetic-{MODE}-{lang}.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(out, '_v.mp4'), '-i', os.path.join(out, '_a.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', full], check=True)
print('wrote', full)
