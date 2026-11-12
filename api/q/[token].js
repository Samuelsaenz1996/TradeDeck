// Public (no-auth) endpoint. Renders the customer-facing quote for an
// unguessable share_token, and records acceptance.
//
// This is the only MyTradeDeck page a homeowner ever sees, so it is also the
// thing that decides whether the contractor looks professional. It is rendered
// server-side and self-contained: no app bundle, no fonts to wait on, no
// JavaScript needed to read it. A quote should open instantly on a phone with
// one bar of signal, in a driveway.
//
// GET  /q/<token>   the quote
// POST /q/<token>   { name } -> records acceptance
import { createClient } from '@supabase/supabase-js';

const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Quote content is stored per language ({en, es}) or as a plain string on
// older rows. Prefer the language the quote was written in.
function pick(val, lang) {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const want = (val[lang] || '').trim();
    if (want) return want;
    return (val.en || '').trim() || (val.es || '').trim();
  }
  return '';
}

function notice(res, status, title, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>:root{color-scheme:light}
body{font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;background:#F4F5F7;color:#1A1F2E;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
.box{background:#fff;border:1px solid #E3E6EB;border-radius:14px;padding:32px 28px;max-width:420px;text-align:center}
h1{font-size:18px;margin:0 0 8px}p{color:#5A6070;font-size:14px;margin:0;line-height:1.5}</style></head>
<body><div class="box"><h1>${esc(title)}</h1><p>${esc(body)}</p></div></body></html>`);
}

const STR = {
  en: {
    quote: 'Quote', validUntil: 'Valid until', preparedFor: 'Prepared for',
    from: 'From', scope: 'Scope of work', lineItems: 'What\'s included',
    subtotal: 'Subtotal', tax: 'Tax', total: 'Total', terms: 'Payment terms',
    warranty: 'Warranty', accept: 'Accept this quote', acceptHint:
      'Type your name to accept. We\'ll let your contractor know right away.',
    yourName: 'Your full name', acceptBtn: 'Accept quote',
    accepted: 'Accepted', acceptedOn: 'You accepted this quote on',
    questions: 'Questions? Reply to the message your contractor sent, or call them directly.',
    expired: 'This quote is past its valid-until date. Your contractor can send an updated one.',
    nameRequired: 'Please type your name to accept.',
    failed: 'Something went wrong. Please try again, or contact your contractor.',
    poweredBy: 'Quote sent with MyTradeDeck',
  },
  es: {
    quote: 'Cotización', validUntil: 'Válida hasta', preparedFor: 'Preparada para',
    from: 'De', scope: 'Alcance del trabajo', lineItems: 'Lo que incluye',
    subtotal: 'Subtotal', tax: 'Impuesto', total: 'Total', terms: 'Términos de pago',
    warranty: 'Garantía', accept: 'Aceptar esta cotización', acceptHint:
      'Escriba su nombre para aceptar. Le avisaremos a su contratista de inmediato.',
    yourName: 'Su nombre completo', acceptBtn: 'Aceptar cotización',
    accepted: 'Aceptada', acceptedOn: 'Usted aceptó esta cotización el',
    questions: '¿Preguntas? Responda al mensaje que le envió su contratista, o llámelo directamente.',
    expired: 'Esta cotización pasó su fecha de vigencia. Su contratista puede enviarle una actualizada.',
    nameRequired: 'Escriba su nombre para aceptar.',
    failed: 'Algo salió mal. Intente de nuevo, o contacte a su contratista.',
    poweredBy: 'Cotización enviada con MyTradeDeck',
  },
};

function renderPage({ quote, profile, lang, error }) {
  const T = STR[lang] || STR.en;
  const p = quote.payload || {};
  const brand = (profile && profile.brand_color) || '#2A5BD7';
  const company = (profile && profile.company_name) || '';
  const accepted = !!quote.accepted_at;

  const items = Array.isArray(p.lineItems) ? p.lineItems : [];
  const rows = items.map((li) => {
    const name = esc(pick(li.name, lang)) || '&nbsp;';
    const desc = esc(pick(li.desc || li.description, lang));
    const amt = money(li.amount != null ? li.amount : li.amt);
    return `<tr><td><div class="li-name">${name}</div>${desc ? `<div class="li-desc">${desc}</div>` : ''}</td><td class="amt">${amt}</td></tr>`;
  }).join('');

  const subtotal = p.subtotal != null ? p.subtotal : quote.total;
  const taxAmt = p.tax != null ? p.tax : 0;
  const scope = esc(pick(p.scope, lang)).replace(/\n/g, '<br>');
  const terms = esc(
    pick(p.paymentTerms && (p.paymentTerms.literal || p.paymentTerms.template), lang)
  ).replace(/\n/g, '<br>');
  const warranty = esc(pick(p.warranty, lang)).replace(/\n/g, '<br>');

  const acceptedDate = accepted
    ? new Date(quote.accepted_at).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US',
        { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(T.quote)}${company ? ' · ' + esc(company) : ''}</title>
<meta name="robots" content="noindex, nofollow">
<style>
  :root{
    color-scheme: light;
    --brand: ${esc(brand)};
    --ink:#161A23; --ink-2:#4A5160; --ink-3:#848B99;
    --line:#E3E6EB; --line-2:#EFF1F4;
    --bg:#F4F5F7; --surface:#FFFFFF; --surface-2:#F8F9FB;
    --good:#1E7F4F;
    --radius:10px; --radius-lg:16px;
  }
  *{box-sizing:border-box}
  body{
    margin:0; padding:24px 16px 56px;
    background:var(--bg); color:var(--ink);
    font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
    font-size:15px; line-height:1.55;
    -webkit-font-smoothing:antialiased;
  }
  .sheet{
    max-width:720px; margin:0 auto; background:var(--surface);
    border:1px solid var(--line); border-radius:var(--radius-lg);
    overflow:hidden; box-shadow:0 1px 2px rgba(16,24,40,.04),0 8px 24px rgba(16,24,40,.06);
  }
  /* The contractor's colour, used once, at the top. */
  .rule{height:4px;background:var(--brand)}
  .pad{padding:28px 28px 0}
  .pad-b{padding-bottom:28px}

  header{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-start}
  .logo{max-width:150px;max-height:56px;object-fit:contain;display:block;margin-bottom:10px}
  .company{font-size:18px;font-weight:700;letter-spacing:-.015em}
  .company-meta{font-size:13px;color:var(--ink-3);margin-top:2px;line-height:1.45}
  .meta{text-align:right;flex-shrink:0}
  .meta-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-3)}
  .meta-val{font-size:14px;font-weight:600;margin-bottom:8px}

  .badge{
    display:inline-flex;align-items:center;gap:6px;margin-top:10px;
    padding:5px 11px;border-radius:999px;font-size:12px;font-weight:600;
    background:#E8F5EE;color:var(--good);
  }

  .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:26px}
  .block-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-3);margin-bottom:5px}
  .block-val{font-size:14px;line-height:1.5}
  .block-val strong{font-weight:600}

  section{margin-top:28px}
  h2{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;
     color:var(--ink-3);margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid var(--line-2)}
  .scope{font-size:14.5px;color:var(--ink-2);line-height:1.6}

  table{width:100%;border-collapse:collapse}
  td{padding:12px 0;border-bottom:1px solid var(--line-2);vertical-align:top}
  tr:last-child td{border-bottom:none}
  .li-name{font-weight:600;font-size:14.5px}
  .li-desc{font-size:13px;color:var(--ink-3);margin-top:3px;line-height:1.5}
  .amt{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:600;padding-left:16px}

  .totals{margin-top:18px;margin-left:auto;max-width:300px}
  .trow{display:flex;justify-content:space-between;gap:16px;padding:5px 0;font-size:14px;color:var(--ink-2)}
  .trow .v{font-variant-numeric:tabular-nums}
  .ttotal{display:flex;justify-content:space-between;gap:16px;align-items:baseline;
          margin-top:10px;padding-top:12px;border-top:2px solid var(--ink)}
  .ttotal .l{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
  .ttotal .v{font-size:25px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}

  .fine{font-size:13px;color:var(--ink-2);line-height:1.55}

  /* Accept panel — the whole point of the page. Deliberately the only
     coloured, full-width action on screen. */
  .accept{margin-top:30px;border-top:1px solid var(--line);background:var(--surface-2);padding:24px 28px 28px}
  .accept h3{margin:0 0 4px;font-size:17px;letter-spacing:-.015em}
  .accept p{margin:0 0 16px;font-size:13.5px;color:var(--ink-2)}
  label{display:block;font-size:12px;font-weight:600;color:var(--ink-2);margin-bottom:6px}
  input[type=text]{
    width:100%;padding:13px 14px;font-size:16px; /* 16px: stops iOS zooming on focus */
    border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);
    color:var(--ink);font-family:inherit;
  }
  input[type=text]:focus{outline:2px solid var(--brand);outline-offset:1px;border-color:var(--brand)}
  button{
    width:100%;margin-top:12px;padding:14px 18px;font-size:16px;font-weight:600;
    color:#fff;background:var(--brand);border:none;border-radius:var(--radius);
    font-family:inherit;cursor:pointer;
  }
  button:hover{filter:brightness(.94)}
  button:disabled{opacity:.6;cursor:default}
  .err{margin-top:10px;font-size:13px;color:#B42318}
  .done{padding:24px 28px 28px;border-top:1px solid var(--line);background:#F4FBF7}
  .done h3{margin:0 0 4px;font-size:17px;color:var(--good);letter-spacing:-.015em}
  .done p{margin:0;font-size:13.5px;color:var(--ink-2)}

  footer{max-width:720px;margin:18px auto 0;text-align:center;font-size:12px;color:var(--ink-3)}

  @media (max-width:560px){
    body{padding:0 0 40px}
    .sheet{border-radius:0;border-left:none;border-right:none}
    .pad{padding:22px 18px 0}
    .accept,.done{padding:22px 18px 24px}
    .grid{grid-template-columns:1fr;gap:16px}
    .meta{text-align:left}
    header{gap:14px}
  }
  @media print{
    body{background:#fff;padding:0}
    .sheet{border:none;box-shadow:none;max-width:none}
    .accept{display:none}
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="rule"></div>
  <div class="pad pad-b">
    <header>
      <div>
        ${profile && profile.logo_url ? `<img class="logo" src="${esc(profile.logo_url)}" alt="">` : ''}
        <div class="company">${esc(company || p.companyName || '')}</div>
        <div class="company-meta">${[
          profile && profile.business_address,
          profile && profile.phone,
          profile && profile.license_number ? `Lic. ${esc(profile.license_number)}` : '',
        ].filter(Boolean).map(esc).join(' · ')}</div>
      </div>
      <div class="meta">
        <div class="meta-label">${esc(T.quote)}</div>
        <div class="meta-val">${esc(p.quoteNumber || p.quoteId || '')}</div>
        ${p.validUntil ? `<div class="meta-label">${esc(T.validUntil)}</div>
        <div class="meta-val">${esc(pick(p.validUntil, lang))}</div>` : ''}
        ${accepted ? `<div class="badge">&#10003; ${esc(T.accepted)}</div>` : ''}
      </div>
    </header>

    <div class="grid">
      <div>
        <div class="block-label">${esc(T.preparedFor)}</div>
        <div class="block-val">
          <strong>${esc(quote.client_name || '')}</strong><br>
          ${esc(quote.client_addr || '')}
        </div>
      </div>
      <div>
        <div class="block-label">${esc(T.from)}</div>
        <div class="block-val">
          <strong>${esc(company)}</strong><br>
          ${esc((profile && profile.phone) || '')}
        </div>
      </div>
    </div>

    ${scope ? `<section><h2>${esc(T.scope)}</h2><div class="scope">${scope}</div></section>` : ''}

    ${rows ? `<section><h2>${esc(T.lineItems)}</h2>
      <table><tbody>${rows}</tbody></table>
      <div class="totals">
        <div class="trow"><span>${esc(T.subtotal)}</span><span class="v">${money(subtotal)}</span></div>
        ${taxAmt > 0 ? `<div class="trow"><span>${esc(T.tax)}</span><span class="v">${money(taxAmt)}</span></div>` : ''}
        <div class="ttotal"><span class="l">${esc(T.total)}</span><span class="v">${money(quote.total)}</span></div>
      </div>
    </section>` : `<section><div class="totals">
        <div class="ttotal"><span class="l">${esc(T.total)}</span><span class="v">${money(quote.total)}</span></div>
      </div></section>`}

    ${terms ? `<section><h2>${esc(T.terms)}</h2><div class="fine">${terms}</div></section>` : ''}
    ${warranty ? `<section><h2>${esc(T.warranty)}</h2><div class="fine">${warranty}</div></section>` : ''}
  </div>

  ${accepted ? `<div class="done">
      <h3>&#10003; ${esc(T.accepted)}</h3>
      <p>${esc(T.acceptedOn)} ${esc(acceptedDate)}${quote.accepted_name ? ' — ' + esc(quote.accepted_name) : ''}.</p>
    </div>`
  : `<div class="accept">
      <h3>${esc(T.accept)}</h3>
      <p>${esc(T.acceptHint)}</p>
      <form method="POST" action="">
        <label for="nm">${esc(T.yourName)}</label>
        <input type="text" id="nm" name="name" autocomplete="name" required
               value="${esc(quote.client_name || '')}">
        <button type="submit">${esc(T.acceptBtn)}</button>
        ${error ? `<div class="err">${esc(error)}</div>` : ''}
      </form>
    </div>`}
</div>
<footer>${esc(T.questions)}<br><br>${esc(T.poweredBy)}</footer>
</body>
</html>`;
}

export default async function handler(req, res) {
  try {
    const token = req.query.token;
    if (!token || typeof token !== 'string' || token.length < 32) {
      notice(res, 404, 'Quote not found', 'This link is invalid or has expired.');
      return;
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: quote } = await supabaseAdmin
      .from('quotes')
      .select('id, user_id, client_name, client_addr, total, status, payload, archived_at, share_token, viewed_at, accepted_at, accepted_name')
      .eq('share_token', token)
      .maybeSingle();

    if (!quote || quote.archived_at) {
      notice(res, 404, 'Quote not found', 'This link is invalid or has expired.');
      return;
    }

    // Only the contractor's public-facing details, never their account.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('company_name, phone, business_address, license_number, brand_color, logo_url')
      .eq('user_id', quote.user_id)
      .maybeSingle();

    const p = quote.payload || {};
    const lang = (p.language === 'es' || p.lang === 'es') ? 'es' : 'en';
    const T = STR[lang];

    if (req.method === 'POST') {
      // Parse the form body. Vercel gives an object for urlencoded bodies, but
      // fall back to parsing a raw string so this doesn't depend on that.
      let name = '';
      const b = req.body;
      if (b && typeof b === 'object') name = b.name || '';
      else if (typeof b === 'string') name = new URLSearchParams(b).get('name') || '';
      name = String(name).trim().slice(0, 120);

      if (!name) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(400).end(renderPage({ quote, profile, lang, error: T.nameRequired }));
        return;
      }

      // Accepting twice is not an error; the first acceptance stands.
      if (!quote.accepted_at) {
        const now = new Date().toISOString();
        const { error: accErr } = await supabaseAdmin
          .from('quotes')
          .update({ accepted_at: now, accepted_name: name, status: 'accepted' })
          .eq('id', quote.id)
          .is('accepted_at', null);
        if (accErr) {
          console.warn('quote accept failed:', accErr);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.status(500).end(renderPage({ quote, profile, lang, error: T.failed }));
          return;
        }
        quote.accepted_at = now;
        quote.accepted_name = name;
      }

      // Redirect after POST so a refresh doesn't resubmit.
      res.statusCode = 303;
      res.setHeader('Location', `/q/${token}`);
      res.end();
      return;
    }

    // Record the first open, so the contractor knows it landed. Fire and
    // forget: a failure here must never stop the quote rendering.
    if (!quote.viewed_at) {
      supabaseAdmin.from('quotes')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', quote.id)
        .is('viewed_at', null)
        .then(null, (e) => console.warn('viewed_at write failed:', e));
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Private: a share link is unguessable, but it should never be cached by
    // a proxy between the customer and us.
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).end(renderPage({ quote, profile, lang }));
  } catch (e) {
    console.warn('public quote page threw:', e);
    notice(res, 500, 'Something went wrong', 'Please try again, or contact your contractor.');
  }
}
