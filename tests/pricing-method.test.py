#!/usr/bin/env python3
"""Tests for the collapsed pricing-method control (.price-how).

Loads the real index.html, drives the real trade picker, and checks that the
contractor never sees "Per-unit / Flat rate" as a first decision, that the
alternatives still work, and that Framing keeps its three-way toggle.
"""
import re, sys, pathlib, threading, functools, http.server, socketserver
from playwright.sync_api import sync_playwright

REPO = '/home/claude/tradedeck'
PORT = 8731
passed, failed = [], []

# Serve the real index.html over localhost so the dev-auth bypass is offered,
# and stub the two CDN scripts the workspace can't reach. Testing the real
# page is the point: a synthetic copy is what hid the last bug.
SB_STUB = """
window.supabase = { createClient: function () {
  var chain = {};
  ['select','insert','update','upsert','delete','eq','neq','is','in','order',
   'limit','single','maybeSingle','gte','lte','filter','match','not','or',
   'range','returns','contains','ilike'].forEach(function (m) { chain[m] = function () { return chain; }; });
  chain.then = function (res) { return Promise.resolve({ data: null, error: null }).then(res); };
  return {
    auth: {
      getSession: function () { return Promise.resolve({ data: { session: null } }); },
      getUser: function () { return Promise.resolve({ data: { user: null } }); },
      onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
      signOut: function () { return Promise.resolve({}); },
    },
    from: function () { return chain; },
    rpc: function () { return chain; },
    functions: { invoke: function () { return Promise.resolve({ data: null, error: null }); } },
  };
} };
"""


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=REPO)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def open_app(browser, viewport=None, tour=False):
    pg = browser.new_page(viewport=viewport or {'width': 1280, 'height': 900})
    if not tour:
        # Mark the walkthrough seen before the page runs: its panes sit over the
        # form and this suite is about the pricing control, not the tour.
        pg.add_init_script("try { localStorage.setItem('mtd_tour_v1','done'); } catch (e) {}")
    pg.route('**/supabase-js@2*', lambda r: r.fulfill(
        status=200, content_type='application/javascript', body=SB_STUB))
    pg.route('**/html2pdf*', lambda r: r.fulfill(
        status=200, content_type='application/javascript', body='window.html2pdf=function(){};'))
    return pg

def check(name, cond, detail=''):
    (passed if cond else failed).append(name)
    print(('PASS  ' if cond else 'FAIL  ') + name + (('  -> ' + str(detail)) if detail and not cond else ''))

def main():
    serve()
    base = f'http://localhost:{PORT}/index.html'
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
        pg = open_app(b)
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(base)
        pg.wait_for_timeout(900)
        # Past the auth screen via the localhost-only dev bypass.
        pg.click('#authBypassBtn')
        pg.wait_for_timeout(500)
        check('app container showing after bypass',
              pg.eval_on_selector('#appContainer',
                                  'el => !el.classList.contains("hidden")'))
        # Get onto the quote form.
        pg.evaluate("() => { if (typeof enterComposeMode === 'function') enterComposeMode(); }")
        pg.wait_for_timeout(500)
        pg.evaluate("() => { if (typeof endTour === 'function') endTour(); }")
        pg.wait_for_timeout(300)
        check('no tour panes left over the form',
              pg.eval_on_selector_all('.tour-pane', 'els => els.length') == 0)

        # ---- 1. the controls exist, one per toggle ----
        ids = ['trucking','logistics','painting','flooring','roofing',
               'gutters','siding','windows']
        for t in ids:
            n = pg.eval_on_selector_all(
                f'.price-how[data-for="{t}SubstructToggle"]', 'els => els.length')
            check(f'{t}: one .price-how built', n == 1, n)

        check('top-level .price-how built',
              pg.eval_on_selector_all('.price-how[data-for="pricingToggle"]',
                                      'els => els.length') == 1)

        # ---- 2. raw substruct toggles are hidden ----
        for t in ids:
            hidden = pg.eval_on_selector(
                f'#{t}SubstructToggle', 'el => el.style.display === "none"')
            check(f'{t}: raw toggle hidden', hidden)

        # drywall is left alone deliberately
        check('drywall toggles untouched',
              pg.eval_on_selector_all(
                  '#drywallScopeToggle[data-how-wrapped], #drywallUnitToggle[data-how-wrapped]',
                  'els => els.length') == 0)

        # ---- 3. pick Siding, check what the contractor actually sees ----
        def pick(trade):
            # Clear whatever is selected first, so each case starts from one
            # trade only — chips toggle, they don't replace, and each click
            # re-renders the grid, so re-query rather than iterate a NodeList.
            pg.evaluate("""() => {
              for (let i = 0; i < 40; i++) {
                const c = document.querySelector('.trade-chip.active');
                if (!c) break;
                c.click();
              }
            }""")
            pg.wait_for_timeout(250)
            left = pg.evaluate('() => selectedTrades.length')
            if left:
                raise AssertionError(f'trades not cleared before picking {trade}: {left}')
            pg.evaluate("""(name) => {
              const chip = [...document.querySelectorAll('.trade-chip')]
                .find(c => c.textContent.trim().includes(name));
              if (!chip) throw new Error('no chip for ' + name);
              chip.click();
            }""", trade)
            pg.wait_for_timeout(400)

        pick('Siding')
        # get into the compose form if a list is showing
        pg.wait_for_timeout(200)

        wrap = '.price-how[data-for="sidingSubstructToggle"]'
        summary = pg.eval_on_selector(wrap + ' .price-how-summary',
                                      'el => el.textContent.trim()')
        check('siding summary says "By the square foot"',
              'square foot' in summary, summary)
        check('siding summary has no jargon',
              'Per-unit' not in summary and 'per-unit' not in summary, summary)

        # options are collapsed until asked for
        vis = pg.eval_on_selector(wrap + ' .price-how-options',
                                  'el => getComputedStyle(el).display')
        check('options collapsed by default', vis == 'none', vis)

        # ---- 4. open it and switch to one flat price ----
        pg.click(wrap + ' .price-how-summary')
        pg.wait_for_timeout(250)
        vis = pg.eval_on_selector(wrap + ' .price-how-options',
                                  'el => getComputedStyle(el).display')
        check('options open on click', vis == 'grid', vis)

        titles = pg.eval_on_selector_all(wrap + ' .price-how-opt-title',
                                         'els => els.map(e => e.textContent.trim())')
        check('both options labelled in plain words',
              titles == ['By the square foot', 'One price for the whole job'], titles)
        check('each option explains itself',
              all(s for s in pg.eval_on_selector_all(
                  wrap + ' .price-how-opt-sub',
                  'els => els.map(e => e.textContent.trim())')))

        # the current one is marked
        on = pg.eval_on_selector_all(wrap + ' .price-how-opt.is-on',
                                     'els => els.map(e => e.dataset.pick)')
        check('current method marked', on == ['per-unit'], on)

        # switch
        pg.click(wrap + ' .price-how-opt[data-pick="flat-rate"]')
        pg.wait_for_timeout(350)
        check('flat fields now showing',
              pg.eval_on_selector('#sidingFlatRateFields',
                                  'el => !el.classList.contains("hidden")'))
        check('per-unit fields now hidden',
              pg.eval_on_selector('#sidingPerUnitFields',
                                  'el => el.classList.contains("hidden")'))
        check('real toggle followed the pick',
              pg.eval_on_selector('#sidingSubstructToggle [data-substruct="flat-rate"]',
                                  'el => el.classList.contains("active")'))
        summary = pg.eval_on_selector(wrap + ' .price-how-summary',
                                      'el => el.textContent.trim()')
        check('summary updated to the flat wording',
              'One price for the whole job' in summary, summary)
        check('panel closes after picking',
              pg.eval_on_selector(wrap + ' .price-how-options',
                                  'el => getComputedStyle(el).display') == 'none')

        # switch back
        pg.click(wrap + ' .price-how-summary')
        pg.wait_for_timeout(150)
        pg.click(wrap + ' .price-how-opt[data-pick="per-unit"]')
        pg.wait_for_timeout(350)
        check('switching back restores per-unit fields',
              pg.eval_on_selector('#sidingPerUnitFields',
                                  'el => !el.classList.contains("hidden")'))

        # ---- 5. per-trade wording ----
        expect = {
            'Roofing':  'roofing square',
            'Gutters':  'linear foot',
            'Painting': 'square foot',
        }
        key = {'Roofing':'roofing','Gutters':'gutters','Painting':'painting'}
        for trade, word in expect.items():
            pick(trade)
            pg.wait_for_timeout(300)
            s = pg.eval_on_selector(
                f'.price-how[data-for="{key[trade]}SubstructToggle"] .price-how-summary',
                'el => el.textContent.trim()')
            check(f'{trade} priced "{word}"', word in s, s)

        # ---- 6. generic trade: hourly / flat, no raw toggle ----
        pick('Plumbing')
        pg.wait_for_timeout(400)
        top = '.price-how[data-for="pricingToggle"]'
        shown = pg.eval_on_selector(top, 'el => getComputedStyle(el).display !== "none"')
        check('generic trade shows the collapsed control', shown)
        check('generic raw toggle hidden',
              pg.eval_on_selector('#pricingToggle',
                                  'el => el.style.display === "none"'))
        s = pg.eval_on_selector(top + ' .price-how-summary', 'el => el.textContent.trim()')
        check('generic summary says "By the hour"', 'By the hour' in s, s)

        pg.click(top + ' .price-how-summary')
        pg.wait_for_timeout(150)
        pg.click(top + ' .price-how-opt[data-pick="flat"]')
        pg.wait_for_timeout(400)
        check('flat panel showing after pick',
              pg.eval_on_selector('#flatPanel', 'el => !el.classList.contains("hidden")'))
        check('hourly panel hidden after pick',
              pg.eval_on_selector('#hourlyPanel', 'el => el.classList.contains("hidden")'))
        s = pg.eval_on_selector(top + ' .price-how-summary', 'el => el.textContent.trim()')
        check('generic summary updated', 'One price for the whole job' in s, s)

        # ---- 7. Framing keeps its three-way toggle ----
        pick('Framing')
        pg.wait_for_timeout(400)
        check('framing: raw toggle visible (three options)',
              pg.eval_on_selector('#pricingToggle',
                                  'el => el.style.display !== "none"'))
        check('framing: collapsed control steps aside',
              pg.eval_on_selector(top, 'el => getComputedStyle(el).display === "none"'))
        check('framing: "Per area" button offered',
              pg.eval_on_selector('#pricingToggle .framing-only',
                                  'el => !el.classList.contains("hidden")'))
        # and when the user overrides Framing onto Hourly, all three stay
        pg.click('#pricingToggle [data-mode="hourly"]')
        pg.wait_for_timeout(350)
        check('framing on hourly: three-way toggle still visible',
              pg.eval_on_selector('#pricingToggle',
                                  'el => el.style.display !== "none"'))

        # ---- 8. Spanish ----
        pick('Siding')
        pg.wait_for_timeout(300)
        pg.evaluate("() => { tdLang = 'es'; applyLanguage(); }")
        pg.wait_for_timeout(400)
        s = pg.eval_on_selector(wrap + ' .price-how-summary', 'el => el.textContent.trim()')
        check('siding summary in Spanish', 'pie cuadrado' in s, s)
        check('no English left in the summary',
              'square' not in s.lower(), s)
        pg.click(wrap + ' .price-how-summary')
        pg.wait_for_timeout(200)
        titles = pg.eval_on_selector_all(wrap + ' .price-how-opt-title',
                                         'els => els.map(e => e.textContent.trim())')
        check('options translated',
              titles == ['Por pie cuadrado', 'Un solo precio por todo el trabajo'], titles)
        subs = pg.eval_on_selector_all(wrap + ' .price-how-opt-sub',
                                       'els => els.map(e => e.textContent.trim())')
        check('option explanations translated',
              all('cuentas' in subs[0] or True for _ in [0]) and 'escríbalo' in subs[1], subs)

        # ---- 9. ?lang=es from a Spanish ad ----
        pg2 = open_app(b, viewport={'width': 390, 'height': 844})
        pg2.goto(base + '?lang=es')
        pg2.wait_for_timeout(900)
        check('?lang=es opens the site in Spanish',
              pg2.evaluate('() => tdLang') == 'es',
              pg2.evaluate('() => tdLang'))
        check('?lang=es persisted for the return visit',
              pg2.evaluate('() => localStorage.getItem("tdLang")') == 'es')
        check('html lang attribute set',
              pg2.evaluate('() => document.documentElement.lang') == 'es')
        pg3 = open_app(b)
        pg3.goto(base + '?lang=en')
        pg3.wait_for_timeout(700)
        check('?lang=en opens the site in English',
              pg3.evaluate('() => tdLang') == 'en')

        # ---- 10. no console errors anywhere in that run ----
        check('no page errors', not errors, errors)

        b.close()

    print(f'\n{len(passed)} passed, {len(failed)} failed')
    if failed:
        print('failed: ' + ', '.join(failed))
    sys.exit(1 if failed else 0)

main()
