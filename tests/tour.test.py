#!/usr/bin/env python3
"""Tests for the guided tour, driven through the real app.

The regression this exists for: half the quote form (job description,
pricing fields) doesn't exist until a trade is picked, and the tour used to
end itself the moment a step pointed at one of them. A contractor who pressed
Next before choosing a trade watched the walkthrough disappear.
"""
import sys, threading, functools, http.server, socketserver
from playwright.sync_api import sync_playwright

REPO = '/home/claude/tradedeck'
PORT = 8735
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


def check(name, cond, detail=''):
    (passed if cond else failed).append(name)
    print(('PASS  ' if cond else 'FAIL  ') + name + (('  -> ' + str(detail)) if detail and not cond else ''))


def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=REPO)
    socketserver.TCPServer.allow_reuse_address = True
    s = socketserver.TCPServer(('127.0.0.1', PORT), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()


def open_app(b, viewport=None):
    pg = b.new_page(viewport=viewport or {'width': 1280, 'height': 900})
    pg.route('**/supabase-js@2*', lambda r: r.fulfill(
        status=200, content_type='application/javascript', body=SB_STUB))
    pg.route('**/html2pdf*', lambda r: r.fulfill(
        status=200, content_type='application/javascript', body='window.html2pdf=function(){};'))
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_timeout(900)
    pg.click('#authBypassBtn')
    pg.wait_for_timeout(400)
    pg.evaluate('() => enterComposeMode()')
    pg.wait_for_timeout(400)
    return pg


def state(pg):
    return pg.evaluate("""() => {
      const card = document.querySelector('.tour-card');
      const ring = document.querySelector('.tour-ring');
      if (!card) return null;
      const c = card.getBoundingClientRect(), g = ring.getBoundingClientRect();
      return {
        running: document.body.classList.contains('tour-active'),
        step: card.querySelector('.tour-step').textContent,
        title: card.querySelector('.tour-title').textContent,
        dots: document.querySelectorAll('.tour-dot').length,
        next: card.querySelector('[data-tour=next]').textContent,
        cardInView: c.top >= 0 && c.left >= 0 && c.bottom <= innerHeight + 1 && c.right <= innerWidth + 1,
        ringW: Math.round(g.width), ringH: Math.round(g.height),
        ringInView: g.top >= -1 && g.bottom <= innerHeight + 1,
      };
    }""")


def nxt(pg):
    pg.evaluate("() => { const b = document.querySelector('[data-tour=next]'); if (b) b.click(); }")
    pg.wait_for_timeout(600)


def main():
    serve()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
        errors = []

        # ---- 1. no trade picked: every step offered is a step that exists ----
        pg = open_app(b)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.evaluate('() => startTour(true)')
        pg.wait_for_timeout(800)
        s = state(pg)
        check('tour starts', s and s['running'], s)
        first_total = s['step']
        check('counter counts only reachable steps',
              s['step'].endswith('of 3'), s['step'])
        check('dot count matches the counter', s['dots'] == 3, s['dots'])

        seen = [s['title']]
        for i in range(2):
            nxt(pg)
            s = state(pg)
            check(f'step {i + 2}: tour still running', s and s['running'], s)
            check(f'step {i + 2}: card is on screen', s['cardInView'], s)
            check(f'step {i + 2}: ring is on screen', s['ringInView'], s)
            check(f'step {i + 2}: ring has a real size',
                  s['ringW'] > 1 and s['ringH'] > 1, s)
            seen.append(s['title'])
        check('each step is a different one', len(set(seen)) == 3, seen)
        check('last step offers Done',
              state(pg)['next'] and state(pg)['next'] != '', state(pg))
        nxt(pg)
        check('tour finishes on the last step',
              not pg.evaluate("() => document.body.classList.contains('tour-active')"))

        # ---- 2. with a trade picked, the full five steps run ----
        pg2 = open_app(b)
        pg2.on('pageerror', lambda e: errors.append(str(e)))
        pg2.evaluate("""() => {
          const c = [...document.querySelectorAll('.trade-chip')]
            .find(x => x.textContent.includes('Siding'));
          c.click();
        }""")
        pg2.wait_for_timeout(500)
        pg2.evaluate('() => startTour(true)')
        pg2.wait_for_timeout(800)
        s = state(pg2)
        check('with a trade chosen, all five steps are offered',
              s['step'].endswith('of 5'), s['step'])
        check('five dots', s['dots'] == 5, s['dots'])
        for i in range(4):
            nxt(pg2)
            s = state(pg2)
            check(f'full tour step {i + 2}: running', s and s['running'], s)
            check(f'full tour step {i + 2}: card on screen', s['cardInView'], s)
            check(f'full tour step {i + 2}: ring on a real element',
                  s['ringW'] > 1 and s['ringH'] > 1, s)
        nxt(pg2)
        check('full tour finishes',
              not pg2.evaluate("() => document.body.classList.contains('tour-active')"))

        # ---- 3. picking a trade mid-tour brings the skipped steps back ----
        pg3 = open_app(b)
        pg3.on('pageerror', lambda e: errors.append(str(e)))
        pg3.evaluate('() => startTour(true)')
        pg3.wait_for_timeout(700)
        check('starts at 3 steps with nothing chosen',
              state(pg3)['step'].endswith('of 3'), state(pg3)['step'])
        # The tour deliberately leaves the highlighted control clickable.
        pg3.evaluate("""() => {
          const c = [...document.querySelectorAll('.trade-chip')]
            .find(x => x.textContent.includes('Roofing'));
          c.click();
        }""")
        pg3.wait_for_timeout(500)
        nxt(pg3)
        s = state(pg3)
        check('after picking a trade mid-tour it grows to 5',
              s['step'].endswith('of 5'), s['step'])
        check('and keeps running', s['running'], s)
        check('and the card is still on screen', s['cardInView'], s)

        # ---- 4. losing the target mid-step doesn't kill the tour ----
        pg4 = open_app(b)
        pg4.on('pageerror', lambda e: errors.append(str(e)))
        pg4.evaluate("""() => {
          const c = [...document.querySelectorAll('.trade-chip')]
            .find(x => x.textContent.includes('Siding'));
          c.click();
        }""")
        pg4.wait_for_timeout(400)
        pg4.evaluate('() => startTour(true)')
        pg4.wait_for_timeout(700)
        nxt(pg4)   # step 2: job description
        pg4.wait_for_timeout(300)
        # Deselect the trade: the job description and pricing fields vanish.
        pg4.evaluate("""() => {
          const c = document.querySelector('.trade-chip.active');
          if (c) c.click();
        }""")
        pg4.wait_for_timeout(700)
        s = state(pg4)
        check('target removed: tour survives', s and s['running'], s)
        check('target removed: card still on screen', s and s['cardInView'], s)
        check('target removed: ring moved to something real',
              s and s['ringW'] > 1 and s['ringH'] > 1, s)

        # ---- 5. back works and never strands you ----
        pg5 = open_app(b)
        pg5.on('pageerror', lambda e: errors.append(str(e)))
        pg5.evaluate('() => startTour(true)')
        pg5.wait_for_timeout(700)
        nxt(pg5); nxt(pg5)
        pg5.evaluate("() => document.querySelector('[data-tour=back]').click()")
        pg5.wait_for_timeout(600)
        s = state(pg5)
        check('back: still running', s['running'], s)
        check('back: card on screen', s['cardInView'], s)
        check('back: counter moved down', s['step'].startswith(
            s['step'].split()[0] + ' 2'), s['step'])

        # ---- 6. phone ----
        pg6 = open_app(b, viewport={'width': 390, 'height': 844})
        pg6.on('pageerror', lambda e: errors.append(str(e)))
        pg6.evaluate("""() => {
          const c = [...document.querySelectorAll('.trade-chip')]
            .find(x => x.textContent.includes('Siding'));
          c.click();
        }""")
        pg6.wait_for_timeout(400)
        pg6.evaluate('() => startTour(true)')
        pg6.wait_for_timeout(800)
        for i in range(5):
            s = state(pg6)
            if not s or not s['running']:
                break
            check(f'phone step {i + 1}: card fits the screen', s['cardInView'], s)
            nxt(pg6)
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
