# Build the promo kit: posters (PNG) + a ~31 s vertical promo video, from the live demo scene.
#   cd web/public && python3 -m http.server 5190 &   then   uv run --with playwright python web/promo/make_promo.py <film.mp4> <music.wav> <outdir>
# film/music = the demo film rendered with ?site=https://passport.nybbq.art (see deploy notes); posters/overlays come from promo.js.
import base64, json, os, subprocess, sys
from playwright.sync_api import sync_playwright
film, music, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True); tmp = os.path.join(out, '_parts'); os.makedirs(tmp, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True); pg = b.new_page(viewport={'width': 1300, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:5190/?site=https://passport.nybbq.art'); pg.wait_for_function('typeof S!=="undefined"&&S&&S.ok', timeout=60000); pg.wait_for_timeout(1500)
    pg.add_script_tag(path=os.path.join(os.path.dirname(__file__), 'promo.js'))
    r = pg.evaluate('PROMO.all()'); b.close()
    if errs: print('page errors', errs)
info = json.loads(r.pop('info'))
for k, v in r.items():
    d = tmp if k.startswith('v-') else out
    open(os.path.join(d, k + '.png'), 'wb').write(base64.b64decode(v.split(',', 1)[1]))
run = lambda *a: subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *a], check=True)
T = info; FPS = 30
c0 = T['T_CARD'] - 0.55            # the film's cover starts closing here: cut to the long poster
a_end, b_end, total = round(T['T_ZOOM'] * FPS) / FPS, round(c0 * FPS) / FPS, T['T_END']
P = lambda n: os.path.join(tmp, n)
# A: the film up to the zoom-out, with captions fading in/out
caps = [('v-cap-0', 0.5, T['T_OPEN'] - 0.4), ('v-cap-1', T['T_OPEN'] - 0.2, T['T_F0'] + 0.6), ('v-cap-2', T['T_F0'] + 0.9, T['T_F0'] + 6.5), ('v-cap-3', T['T_F0'] + 6.8, T['T_FE'] - 0.2), ('v-cap-4', T['T_FE'], a_end - 0.1)]
inputs = ['-i', film]; fc = []; last = '[0:v]'
for i, (n, s, e) in enumerate(caps, 1):
    inputs += ['-loop', '1', '-t', f'{a_end}', '-i', P(n + '.png')]
    fc.append(f'[{i}:v]format=rgba,fade=t=in:st={s}:d=0.3:alpha=1,fade=t=out:st={e-0.3}:d=0.3:alpha=1[c{i}]')
    fc.append(f'{last}[c{i}]overlay=0:0:enable=\'between(t,{s},{e})\'[o{i}]'); last = f'[o{i}]'
run(*inputs, '-filter_complex', ';'.join(fc), '-map', last, '-t', f'{a_end}', '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', P('A.mp4'))
# B: the long poster scrolling inside a leather frame
dur_b = b_end - a_end; lh = T['longH'] * 860 / 1080; travel = max(0, lh - 1540)
run('-loop', '1', '-t', f'{dur_b}', '-i', P('v-long-bg.png'), '-loop', '1', '-t', f'{dur_b}', '-i', P('v-long.png'),
    # the poster scrolls inside a fixed window under the title (ease in-out), never over it
    '-filter_complex', f"[1:v]scale=860:-1,crop=860:{min(1540, int(lh))}:0:'{travel}*min(1,t/{dur_b})*min(1,t/{dur_b})*(3-2*min(1,t/{dur_b}))'[l];[0:v][l]overlay=x=110:y=330:shortest=1[v]",
    '-map', '[v]', '-t', f'{dur_b}', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', P('B.mp4'))
# C: the end card with a slow push-in
dur_c = total - b_end; nfr = round(dur_c * FPS)
run('-loop', '1', '-i', P('v-end.png'), '-vf', f"scale=2160:-1,zoompan=z='1+0.04*on/{nfr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={nfr}:s=1080x1920:fps=30", '-frames:v', str(nfr),
    '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', P('C.mp4'))
open(P('list.txt'), 'w').write(''.join(f"file '{P(n)}'\n" for n in ('A.mp4', 'B.mp4', 'C.mp4')))
final = os.path.join(out, 'promo-video-9x16.mp4')
run('-f', 'concat', '-safe', '0', '-i', P('list.txt'), '-i', music, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final)
print('done', final, os.path.getsize(final))
