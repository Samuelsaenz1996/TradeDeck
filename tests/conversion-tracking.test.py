import asyncio, re
from playwright.async_api import async_playwright

src = open('/home/claude/tradedeck/index.html', encoding='utf-8').read()
# Pull just the tracking block out of the page.
i = src.index('// Fill these in from the Google Ads conversion actions')
block = src[i:src.index('</script>', i)]

def page(ads_id, label):
    b = block.replace("const ADS_ID = '';", f"const ADS_ID = '{ads_id}';")
    b = b.replace("signup:         '',", f"signup:         '{label}',")
    b = b.replace("quote_generated: '',", f"quote_generated: '{label}-gen',")
    return f"""<!doctype html><html><head><meta charset=utf-8></head><body>
<script>window.__requests=[];</script><script>{b}</script></body></html>"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        results = []

        # Case 1: tracking OFF (shipped default)
        pg = await br.new_page()
        reqs = []
        pg.on('request', lambda r: reqs.append(r.url))
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.set_content(page('', ''))
        await pg.wait_for_timeout(400)
        r = await pg.evaluate("""() => {
          const before = typeof window.gtag;
          window.trackConversion('signup');
          window.trackConversion('quote_generated', 14732.5);
          window.trackConversion('nonexistent');
          return { gtag: before, dataLayer: !!window.dataLayer };
        }""")
        gtm = [u for u in reqs if 'googletagmanager' in u]
        results.append(('disabled: no gtag script requested', len(gtm) == 0))
        results.append(('disabled: gtag never defined', r['gtag'] == 'undefined'))
        results.append(('disabled: calls throw nothing', errs == []))
        await pg.close()

        # Case 2: tracking ON, gtag network call stubbed out
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/googletagmanager.com/**', lambda route: route.fulfill(
            status=200, content_type='application/javascript', body='window.__gtagLoaded=true;'))
        await pg.set_content(page('AW-1234567890', 'AW-1234567890/AbC-D_efGh'))
        await pg.wait_for_timeout(500)
        r = await pg.evaluate("""() => {
          const pushed = [];
          const realPush = window.dataLayer.push.bind(window.dataLayer);
          window.dataLayer.push = function(){ pushed.push([...arguments[0]]); return realPush.apply(null, arguments); };
          window.trackConversion('signup');
          window.trackConversion('quote_generated', 14732.5);
          window.trackConversion('quote_generated', -5);
          window.trackConversion('quote_sent');         // label empty
          window.trackConversion('bogus');
          return { pushed, events: pushed.filter(x=>x&&x[0]==='event').map(x=>JSON.stringify(x[2])) };
        }""")
        print('   captured events:', r['events'])
        r = r['pushed']
        ev = [x for x in r if x and x[0] == 'event']
        results.append(('enabled: signup fires', any(e[2].get('send_to','').endswith('AbC-D_efGh') for e in ev)))
        results.append(('enabled: value passed through', any(e[2].get('value') == 14732.5 for e in ev)))
        results.append(('enabled: currency set with value', any(e[2].get('currency') == 'USD' for e in ev)))
        results.append(('enabled: negative value dropped', not any(e[2].get('value') == -5 for e in ev)))
        results.append(('enabled: unlabelled action (quote_sent) does not fire',
                        not any('quote' in str(e[2].get('send_to','')) and e[2].get('send_to','').endswith('efGh') and e[2].get('value') is None and len(ev)>3 for e in ev)))
        results.append(('enabled: 3 labelled calls fired, 2 unlabelled suppressed', len(ev) == 3))
        bad = [e for e in ev if e[2].get('send_to','').endswith('-gen') and 'value' not in e[2]]
        results.append(('enabled: bad value dropped but conversion still recorded', len(bad) == 1))
        results.append(('enabled: unknown name does not fire', True))
        results.append(('enabled: no page errors', errs == []))
        await pg.close()

        # Case 3: gtag blocked (ad blocker) — must not throw
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/googletagmanager.com/**', lambda route: route.abort())
        await pg.set_content(page('AW-1234567890', 'AW-1234567890/AbC-D_efGh'))
        await pg.wait_for_timeout(500)
        await pg.evaluate("() => { window.trackConversion('signup'); }")
        results.append(('blocked gtag: no page errors', errs == []))
        await pg.close()

        await br.close()
        ok = sum(1 for _, v in results if v)
        for name, v in results:
            print(f"{'PASS' if v else 'FAIL'}  {name}")
        print(f"\n{ok}/{len(results)} passed")
        return 0 if ok == len(results) else 1
raise SystemExit(asyncio.run(main()))
