# Browser smoke test of the whole page (desktop + phone): imports, hand entry, views, medals, both long posters,
# cover image and a real MP4 export with sound. Exits non-zero on any failure or page error.
#   cd web/public && python3 -m http.server 5190 &
#   uv run --with playwright python web/tests/e2e/smoke.py [base_url] [--quick]   (--quick: skip the export)
import glob, os, sys
from playwright.sync_api import sync_playwright
BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'http://localhost:5190'); QUICK = '--quick' in sys.argv
FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fixtures'); problems = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what, flush=True)
    if not ok: problems.append(what)
def run(p, name, vp, lang, mobile):
    b = p.chromium.launch(channel='chrome', headless=True); ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    for attempt in range(4):
        try: pg.goto(f'{BASE}/?lang={lang}', timeout=60000); pg.wait_for_function('typeof S!=="undefined"&&S&&S.ok', timeout=60000); break
        except Exception as e: print('reload', attempt, str(e)[:80])
    else: check(False, f'{name}: page loads'); b.close(); return
    pg.wait_for_timeout(1200)
    for v, s in [('home', None), ('studio', 's1'), ('studio', 's2'), ('studio', 's3'), ('badges', None)]:
        pg.evaluate('([v,s])=>HOME.go(v,s)', [v, s]); pg.wait_for_timeout(400)
        check(pg.evaluate('document.documentElement.scrollWidth-innerWidth') <= 1, f'{name}: no sideways scroll on {v} {s or ""}')
    pg.evaluate('HOME.go("studio","s1")')
    for f in sorted(glob.glob(FX + '/*.csv')):
        pg.set_input_files('#file', f); pg.wait_for_timeout(1500)
        check(pg.evaluate('S.flights?S.flights.length:0') >= 2, f'{name}: import {os.path.basename(f)}')
    pg.evaluate('document.getElementById("quickAdd").open=true'); pg.fill('#qaDate', '2024-05-01'); pg.fill('#qaFrom', 'PVG'); pg.fill('#qaTo', 'london heathrow'); pg.click('#btnQaAdd'); pg.wait_for_timeout(800)
    check('LHR' in pg.inner_text('#qaHint'), f'{name}: add a flight by hand')
    pg.click('#btnDemo'); pg.wait_for_timeout(1200); pg.evaluate('HOME.go("badges")'); pg.wait_for_timeout(500)
    check(pg.evaluate('document.querySelectorAll("#badges > *").length') == 33, f'{name}: 33 medals')
    for k in range(2):
        pg.query_selector_all('#segPoster button')[k].click(); pg.evaluate('document.getElementById("imgPrev").removeAttribute("src")'); pg.click('#btnLong')
        pg.wait_for_function('document.getElementById("imgPrev").naturalHeight>0', timeout=90000); check(pg.evaluate('document.getElementById("imgPrev").naturalHeight') > 2000, f'{name}: long poster style {k}')
    if not QUICK:
        pg.evaluate('HOME.go("studio","s3")'); pg.wait_for_timeout(400); pg.query_selector_all('#segLen button')[-1].click(); pg.wait_for_timeout(1000)
        pg.click('#btnMakeM' if mobile and pg.is_visible('#btnMakeM') else '#btnMake')
        try:
            pg.wait_for_function('document.getElementById("outVideo").src.length>10', timeout=420000)
            r = pg.evaluate('''async()=>{const v=document.getElementById("outVideo"),b=await (await fetch(v.src)).blob();let a=0;try{const buf=await new AudioContext().decodeAudioData(await b.arrayBuffer());const d=buf.getChannelData(0);for(let i=0;i<d.length;i+=50)a=Math.max(a,Math.abs(d[i]));}catch(e){a=-1;}return {mb:b.size/1048576,type:b.type,peak:a}}''')
            check(r['mb'] > 1 and r['peak'] > 0.05, f'{name}: export {r}')
        except Exception as e: check(False, f'{name}: export ({str(e)[:120]}) status={pg.inner_text("#status")[:120]}')
    check(not errs, f'{name}: no page errors {errs[:3]}'); b.close()
with sync_playwright() as p:
    run(p, 'desktop', {'width': 1360, 'height': 900}, 'zh', False)
    run(p, 'phone', {'width': 390, 'height': 844}, 'en', True)
print('\n' + ('ALL GOOD' if not problems else f'{len(problems)} PROBLEM(S): ' + '; '.join(problems)))
sys.exit(1 if problems else 0)
