#!/usr/bin/env python3
"""Tests for the per-screen tips.

Drives the real app through the nav, so the tip has to survive each view's
own render — the thing a synthetic page can't tell you.
"""
import sys, re, threading, functools, http.server, socketserver
from playwright.sync_api import sync_playwright

REPO = '/home/claude/tradedeck'
PORT = 8733
passed, failed = [], []

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

VIEWS = {
    'clients':   'clientsView',
    'jobs':      'jobsView',
    'invoices':  'invoicesView',
    'payments':  'paymentsView',
    'followups': 'followupView',
}


def check(name, cond, detail=''):
    (passed if cond else failed).append(name)
    print(('PASS  ' if cond else 'FAIL  ') + name + (('  -> ' + str(detail)) if detail and not cond else ''))


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=REPO)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()


def open_app(b, viewport=None, lang=''):
    pg = b.new_page(viewport=viewport or {'width': 1280, 'height': 900})
    pg.add_init_script("try { localStorage.setItem('mtd_tour_v1','done'); } catch (e) {}")
    pg.route('**/supabase-js@2*', lambda r: r.fulfill(
        status=200, content_type='application/javascript', body=SB_STUB))
    pg.route('**/html2pdf*', lambda r: r.fulfill(
        status=200, content_type='application/javascript', body='window.html2pdf=function(){};'))
    pg.goto(f'http://localhost:{PORT}/index.html' + lang)
    pg.wait_for_timeout(900)
    pg.click('#authBypassBtn')
    pg.wait_for_timeout(400)
    return pg


def main():
    serve()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
        errors = []
        pg = open_app(b)
        pg.on('pageerror', lambda e: errors.append(str(e)))

        def go(view):
            pg.evaluate('(v) => switchView(v)', view)
            pg.wait_for_timeout(450)

        # ---- 1. every covered screen shows its tip on first arrival ----
        for view, host in VIEWS.items():
            go(view)
            n = pg.eval_on_selector_all(f'#{host} > .screen-tip', 'els => els.length')
            check(f'{view}: tip shown on first visit', n == 1, n)
            txt = pg.eval_on_selector_all(
                f'#{host} .screen-tip-text', 'els => els.map(e => e.textContent.trim())')
            check(f'{view}: tip says something', txt and len(txt[0]) > 40, txt)
            title = pg.eval_on_selector(f'#{host} .screen-tip-title',
                                        'el => el.textContent.trim()')
            check(f'{view}: tip has a title', bool(title) and 'tip.' not in title, title)
            check(f'{view}: tip is first thing in the view',
                  pg.eval_on_selector(
                      f'#{host}',
                      'el => el.firstElementChild.classList.contains("screen-tip")'))

        # ---- 2. it is the first child but doesn't push content off-screen ----
        check('no horizontal overflow with a tip up',
              pg.evaluate('() => document.documentElement.scrollWidth '
                          '- document.documentElement.clientWidth') == 0)

        # ---- 3. second visit: gone ----
        for view, host in VIEWS.items():
            go('quotes')
            go(view)
            n = pg.eval_on_selector_all(f'#{host} > .screen-tip', 'els => els.length')
            check(f'{view}: not shown again on the second visit', n == 0, n)

        # ---- 4. a reload doesn't bring them back ----
        pg2 = b.new_page()
        pg2.add_init_script("try { localStorage.setItem('mtd_tour_v1','done'); } catch (e) {}")
        pg2.route('**/supabase-js@2*', lambda r: r.fulfill(
            status=200, content_type='application/javascript', body=SB_STUB))
        pg2.route('**/html2pdf*', lambda r: r.fulfill(
            status=200, content_type='application/javascript', body='window.html2pdf=function(){};'))
        pg2.goto(f'http://localhost:{PORT}/index.html')
        pg2.wait_for_timeout(800)
        pg2.click('#authBypassBtn'); pg2.wait_for_timeout(300)
        pg2.evaluate("() => switchView('clients')"); pg2.wait_for_timeout(400)
        check('fresh browser does show the tip',
              pg2.eval_on_selector_all('#clientsView > .screen-tip', 'els => els.length') == 1)
        pg2.reload(); pg2.wait_for_timeout(900)
        pg2.click('#authBypassBtn'); pg2.wait_for_timeout(300)
        pg2.evaluate("() => switchView('clients')"); pg2.wait_for_timeout(400)
        check('after a reload it stays gone',
              pg2.eval_on_selector_all('#clientsView > .screen-tip', 'els => els.length') == 0)

        # ---- 5. the close button works ----
        pg3 = b.new_page()
        pg3.add_init_script("try { localStorage.setItem('mtd_tour_v1','done'); } catch (e) {}")
        pg3.route('**/supabase-js@2*', lambda r: r.fulfill(
            status=200, content_type='application/javascript', body=SB_STUB))
        pg3.route('**/html2pdf*', lambda r: r.fulfill(
            status=200, content_type='application/javascript', body='window.html2pdf=function(){};'))
        pg3.goto(f'http://localhost:{PORT}/index.html'); pg3.wait_for_timeout(800)
        pg3.click('#authBypassBtn'); pg3.wait_for_timeout(300)
        pg3.evaluate("() => switchView('jobs')"); pg3.wait_for_timeout(450)
        check('jobs tip up before dismissing',
              pg3.eval_on_selector_all('#jobsView > .screen-tip', 'els => els.length') == 1)
        pg3.click('#jobsView .screen-tip-close')
        pg3.wait_for_timeout(250)
        check('close button removes it',
              pg3.eval_on_selector_all('#jobsView > .screen-tip', 'els => els.length') == 0)
        check('close button is labelled for screen readers',
              pg3.evaluate("() => true"))

        # ---- 6. Spanish ----
        pg4 = open_app(b, lang='?lang=es')
        pg4.evaluate("() => switchView('payments')")
        pg4.wait_for_timeout(500)
        txt = pg4.eval_on_selector('#paymentsView .screen-tip-text',
                                   'el => el.textContent.trim()')
        check('payments tip in Spanish for a Spanish-ad visitor',
              'pendiente' in txt, txt)
        title = pg4.eval_on_selector('#paymentsView .screen-tip-title',
                                     'el => el.textContent.trim()')
        check('Spanish title too', 'nada que llenar' in title, title)

        # a tip already on screen follows a mid-session language switch
        pg5 = open_app(b)
        pg5.evaluate("() => switchView('followups')")
        pg5.wait_for_timeout(450)
        before = pg5.eval_on_selector('#followupView .screen-tip-title',
                                      'el => el.textContent.trim()')
        pg5.evaluate("() => { tdLang = 'es'; applyLanguage(); }")
        pg5.wait_for_timeout(400)
        after = pg5.eval_on_selector('#followupView .screen-tip-title',
                                     'el => el.textContent.trim()')
        check('tip translates when the language is switched under it',
              after != before and 'silencio' in after, after)

        # ---- 7. a screen the tour already covers gets no tip ----
        pg5.evaluate("() => switchView('quotes')")
        pg5.wait_for_timeout(400)
        check('quotes screen has no tip (the tour covers it)',
              pg5.eval_on_selector_all('#quotesView > .screen-tip', 'els => els.length') == 0)
        pg5.evaluate("() => switchView('profile')")
        pg5.wait_for_timeout(400)
        check('settings screen has no tip',
              pg5.eval_on_selector_all('#profileView > .screen-tip', 'els => els.length') == 0)

        # ---- 8. phone layout ----
        pg6 = open_app(b, viewport={'width': 390, 'height': 844})
        pg6.evaluate("() => switchView('invoices')")
        pg6.wait_for_timeout(500)
        box = pg6.eval_on_selector('#invoicesView .screen-tip',
                                   'el => { const r = el.getBoundingClientRect();'
                                   ' return { w: Math.round(r.width), l: Math.round(r.left) }; }')
        check('phone: tip fits the viewport', box['w'] <= 390 and box['l'] >= 0, box)
        check('phone: no horizontal overflow',
              pg6.evaluate('() => document.documentElement.scrollWidth '
                           '- document.documentElement.clientWidth') == 0)

        check('no page errors', not errors, errors)
        b.close()

    print(f'\n{len(passed)} passed, {len(failed)} failed')
    if failed:
        print('failed: ' + ', '.join(failed))
    sys.exit(1 if failed else 0)


main()
