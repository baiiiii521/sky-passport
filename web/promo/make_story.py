# Promo v3 (story + HUD) rendered from story.js inside the live demo scene.
#   cd web/public && python3 -m http.server 5190 &
#   uv run --with playwright python web/promo/make_story.py stills <outdir> <t1,t2,...> [lang]   # all three directions per time
#   uv run --with playwright python web/promo/make_story.py film <outdir> <palette> <zh|en>       # MP4 + stems + cue sheet + ~17 s cut
#   uv run --with playwright python web/promo/make_story.py posters <outdir> [palette]           # 5 layouts x zh/en, incl. og.jpg for the site
import base64, json, os, re, subprocess, sys, wave
from playwright.sync_api import sync_playwright
mode, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
def sprite(name, var):  # CC0 recordings (see sfx-promo.md); the map is read from the JS line that sprite.py wrote next to it
    b64 = base64.b64encode(open(os.path.join(HERE, name + '.mp3'), 'rb').read()).decode()
    return [b64, json.loads(re.search(r'=(\{.*\});', open(os.path.join(HERE, name + '.map.js')).read()).group(1))]
SPRITES = [sprite('sfx-promo', 'SFX_PROMO_MAP'), sprite('sfx-tech', 'SFX_TECH_MAP')]
def page(p, lang):
    b = p.chromium.launch(channel='chrome', headless=True); pg = b.new_page(viewport={'width': 1300, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    site = 'https://sky-passport.vercel.app' if lang == 'en' else 'https://passport.nybbq.art'
    pg.goto(f'http://localhost:5190/?site={site}&lang={lang}'); pg.wait_for_function('typeof S!=="undefined"&&S&&S.ok', timeout=60000); pg.wait_for_timeout(1200)
    pg.add_script_tag(path=os.path.join(HERE, 'story.js')); return b, pg, errs
save = lambda path, d: open(path, 'wb').write(base64.b64decode(d.split(',', 1)[1]))
with sync_playwright() as p:
    if mode == 'stills':
        lang = sys.argv[4] if len(sys.argv) > 4 else 'zh'; b, pg, errs = page(p, lang); ts = [float(x) for x in sys.argv[3].split(',')]
        for pal in ('hud', 'gold', 'aurora'):
            info = pg.evaluate('([p,l,s])=>STORY.init(p,l,s)', [pal, lang, SPRITES])
            for t in ts: save(os.path.join(out, f'{pal}_{lang}_{t:05.2f}.jpg'), pg.evaluate(f'STORY.frame({round(t * 30)})'))
        print(info, errs); b.close()
    elif mode == 'posters':
        pal = sys.argv[3] if len(sys.argv) > 3 else 'hud'
        for lang in ('zh', 'en'):
            b, pg, errs = page(p, lang); pg.evaluate('([p,l,s])=>STORY.init(p,l,s)', [pal, lang, SPRITES])
            for k, w, h, tag in [('main', 1080, 1920, '9x16'), ('story', 1080, 1920, '9x16'), ('xhs', 1080, 1440, '3x4'), ('square', 1080, 1080, '1x1'), ('og', 1200, 630, 'og')]:
                save(os.path.join(out, f'v3-{k}-{tag}-{lang}.' + ('jpg' if k == 'og' else 'png')), pg.evaluate(f'STORY.poster("{k}",{w},{h})'))
            print(lang, 'posters', errs); b.close()
    else:
        pal, lang = sys.argv[3], sys.argv[4]; b, pg, errs = page(p, lang); audio_only = mode == 'audio'  # audio: re-mix the sound over the frames already rendered
        info = pg.evaluate('([p,l,s])=>STORY.init(p,l,s)', [pal, lang, SPRITES]); n = 0 if audio_only else info['frames']; print(info, flush=True)
        enc = None if audio_only else  subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', os.path.join(out, '_v.mp4')], stdin=subprocess.PIPE)
        for i in range(n):
            enc.stdin.write(base64.b64decode(pg.evaluate(f'STORY.frame({i})').split(',', 1)[1]))
            if i % 200 == 0: print(i, '/', n, flush=True)
        if enc: enc.stdin.close(); enc.wait()
        A = pg.evaluate('STORY.audio(true)'); pcm = base64.b64decode(A['pcm'])
        open(os.path.join(out, '_stems.f32'), 'wb').write(base64.b64decode(A['stems'])); json.dump(pg.evaluate('STORY.cues()'), open(os.path.join(out, '_cues.json'), 'w')); json.dump(info, open(os.path.join(out, '_info.json'), 'w'))
        with wave.open(os.path.join(out, '_a.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000); w.writeframes(pcm)
        full = os.path.join(out, 'promo-film-9x16.mp4')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(out, '_v.mp4'), '-i', os.path.join(out, '_a.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                        '-t', str(info['seconds']), '-movflags', '+faststart', full], check=True)
        # ~17 s cut on bar lines: the hook, the hero and modules, the stamp line, the end card (music stays on the grid)
        BAR = 4 * 60 / 112; parts = [(0, 3), (7, 11), (14, 15), (17, None)]
        segs = ''.join((f"[0:v]trim={a*BAR}:{e*BAR},setpts=PTS-STARTPTS[v{i}];[0:a]atrim={a*BAR}:{e*BAR},asetpts=PTS-STARTPTS,afade=t=in:d=0.02[a{i}];" if e else
                        f"[0:v]trim=start={a*BAR},setpts=PTS-STARTPTS[v{i}];[0:a]atrim=start={a*BAR},asetpts=PTS-STARTPTS,afade=t=in:d=0.02[a{i}];") for i, (a, e) in enumerate(parts))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', full, '-filter_complex', segs + ''.join(f'[v{i}][a{i}]' for i in range(len(parts))) + f'concat=n={len(parts)}:v=1:a=1[v][a]', '-map', '[v]', '-map', '[a]',
                        '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', os.path.join(out, 'promo-short-9x16.mp4')], check=True)
        print('errors', errs); b.close()
