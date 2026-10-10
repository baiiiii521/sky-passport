# Promo film v2 (story + features, keynote style) rendered from film.js inside the live demo scene.
#   cd web/public && python3 -m http.server 5190 &
#   uv run --with playwright python web/promo/make_film.py stills <outdir> [t1,t2,...]   # 3 palettes side by side per t
#   uv run --with playwright python web/promo/make_film.py film <outdir> [palette]        # full film + ~16 s cut
#   uv run --with playwright python web/promo/make_film.py posters <outdir>              # 6 layouts x 3 palettes
import base64, json, os, subprocess, sys, wave
from playwright.sync_api import sync_playwright
mode, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
SFX = base64.b64encode(open(os.path.join(HERE, 'sfx-promo.mp3'), 'rb').read()).decode()  # promo-only CC0 recordings (see sfx-promo.md)
def page(p):
    b = p.chromium.launch(channel='chrome', headless=True, args=['--disable-gpu-sandbox']); pg = b.new_page(viewport={'width': 1300, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:5190/?site=https://passport.nybbq.art'); pg.wait_for_function('typeof S!=="undefined"&&S&&S.ok', timeout=60000); pg.wait_for_timeout(1200)
    pg.add_script_tag(path=os.path.join(HERE, 'film.js')); return b, pg, errs
save = lambda path, d: open(path, 'wb').write(base64.b64decode(d.split(',', 1)[1]))
with sync_playwright() as p:
    b, pg, errs = page(p)
    if mode == 'stills':
        ts = [float(x) for x in (sys.argv[3] if len(sys.argv) > 3 else '2,6,9,14').split(',')]
        for pal in ('tech', 'brand', 'aurora'):
            info = pg.evaluate(f'(s)=>FILM.init("{pal}",s)', SFX)
            for t in ts: save(os.path.join(out, f'{pal}_{t:05.2f}.jpg'), pg.evaluate(f'FILM.frame({round(t*30)})'))
        print(info, errs)
    elif mode == 'posters':
        sizes = [('main', 1080, 1920, '9x16'), ('main', 1080, 1440, '3x4'), ('main', 1080, 1080, '1x1'), ('features', 1080, 1920, '9x16'), ('data', 1080, 1920, '9x16'), ('story', 1080, 1440, '3x4')]
        for pal in ('brand', 'tech', 'aurora'):
            pg.evaluate(f'(s)=>FILM.init("{pal}",s)', SFX)
            for k, w, h, tag in sizes: save(os.path.join(out, f'poster-{k}-{tag}-{pal}.png'), pg.evaluate(f'FILM.poster("{k}",{w},{h})'))
        print('errors', errs)
    else:
        pal = sys.argv[3] if len(sys.argv) > 3 else 'brand'; info = pg.evaluate(f'(s)=>FILM.init("{pal}",s)', SFX); n = info['frames']; print(info)
        enc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', os.path.join(out, '_v.mp4')], stdin=subprocess.PIPE)
        for i in range(n):
            enc.stdin.write(base64.b64decode(pg.evaluate(f'FILM.frame({i})').split(',', 1)[1]))
            if i % 150 == 0: print(i, '/', n, flush=True)
        enc.stdin.close(); enc.wait()
        A = pg.evaluate('FILM.audio(true)'); pcm = base64.b64decode(A['pcm'])
        open(os.path.join(out, '_stems.f32'), 'wb').write(base64.b64decode(A['stems'])); json.dump(pg.evaluate('FILM.cues()'), open(os.path.join(out, '_cues.json'), 'w'))
        with wave.open(os.path.join(out, '_a.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000); w.writeframes(pcm)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(out, '_v.mp4'), '-i', os.path.join(out, '_a.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                        '-t', str(info['seconds']), '-movflags', '+faststart', os.path.join(out, 'promo-film-9x16.mp4')], check=True)
        print('errors', errs)
        # ~16 s cut on bar lines: brand + video feature, the line, the end card (music stays on the grid)
        BAR = 4 * 60 / 112; full = os.path.join(out, 'promo-film-9x16.mp4'); parts = [(4, 8), (14, 15), (17, None)]
        segs = ''.join(f"[0:v]trim={a*BAR}:{'' if e is None else e*BAR},setpts=PTS-STARTPTS[v{i}];[0:a]atrim={a*BAR}{'' if e is None else ':'+str(e*BAR)},asetpts=PTS-STARTPTS,afade=t=in:d=0.02[a{i}];" for i, (a, e) in enumerate(parts))
        segs = segs.replace('trim=' + str(17*BAR) + ':,', 'trim=start=' + str(17*BAR) + ',').replace('atrim=' + str(17*BAR) + ',', 'atrim=start=' + str(17*BAR) + ',')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', full, '-filter_complex', segs + ''.join(f'[v{i}][a{i}]' for i in range(3)) + 'concat=n=3:v=1:a=1[v][a]', '-map', '[v]', '-map', '[a]',
                        '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', os.path.join(out, 'promo-short-9x16.mp4')], check=True)
    b.close()
