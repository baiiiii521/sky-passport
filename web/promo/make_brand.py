# 航迹手帐 brand film (20 s): picture and sound from brand.js, drawn on the product page.
#   cd web/public && python3 -m http.server 5190 &
#   uv run --with playwright python web/promo/make_brand.py <out_dir> [--stills t1,t2,...] [--sheet]
# --stills writes single frames; --sheet also writes a contact sheet (one frame per half bar) for review.
import base64, json, os, re, subprocess, sys, wave
from playwright.sync_api import sync_playwright
args = [a for a in sys.argv[1:] if not a.startswith('--')]; out = args[0]; os.makedirs(out, exist_ok=True); HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
STILLS = [float(x) for x in sys.argv[sys.argv.index('--stills') + 1].split(',')] if '--stills' in sys.argv else None
def sprite(name):
    b64 = base64.b64encode(open(os.path.join(HERE, name + '.mp3'), 'rb').read()).decode()
    return [b64, json.loads(re.search(r'=(\{.*\});', open(os.path.join(HERE, name + '.map.js')).read()).group(1))]
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True); pg = b.new_page(viewport={'width': 1300, 'height': 900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    for attempt in range(5):   # the local static server sometimes stalls a load: reload instead of giving up
        try: pg.goto('http://localhost:5190/?site=https://passport.nybbq.art&lang=zh', timeout=30000); pg.wait_for_function('typeof S!=="undefined"&&S&&S.ok', timeout=30000); break
        except Exception as e: print('reload', attempt, str(e)[:60], flush=True)
    pg.wait_for_timeout(1200); pg.add_script_tag(path=os.path.join(HERE, 'brand.js'))
    info = pg.evaluate('s=>BRAND.init(s)', [sprite('sfx-promo'), sprite('sfx-tech')]); print(info, flush=True)
    grab = lambda i: base64.b64decode(pg.evaluate(f'BRAND.frame({i})').split(',', 1)[1])
    if STILLS:
        for t in STILLS: open(os.path.join(out, f'b_{t:05.2f}.jpg'), 'wb').write(grab(round(t * 30)))
        print('errors', errs); b.close(); sys.exit()
    enc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', os.path.join(out, '_v.mp4')], stdin=subprocess.PIPE)
    for i in range(info['frames']):
        enc.stdin.write(grab(i))
        if i % 150 == 0: print(i, '/', info['frames'], flush=True)
    enc.stdin.close(); enc.wait()
    with wave.open(os.path.join(out, '_a.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(base64.b64decode(pg.evaluate('BRAND.audio()')))
    json.dump(pg.evaluate('BRAND.cues()'), open(os.path.join(out, 'cues.json'), 'w')); print('errors', errs); b.close()
full = os.path.join(out, 'brand-20s.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(out, '_v.mp4'), '-i', os.path.join(out, '_a.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', full], check=True)
if '--sheet' in sys.argv: subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', full, '-vf', 'fps=30/32,scale=270:-1,tile=10x2', '-frames:v', '1', os.path.join(out, 'sheet.jpg')], check=True)
print('wrote', full)
