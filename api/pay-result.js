// Public (no-auth) result page shown after Stripe-hosted Checkout. No app data.
export default function handler(req, res) {
  const success = req.query.status === 'success';
  const title = success ? 'Payment received' : 'Payment canceled';
  const body = success
    ? 'Thank you — your payment was received.'
    : 'No payment was made. You can close this window.';
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F7F4EE;color:#1A1F2E;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.box{background:#fff;border:1px solid #E6DFD2;border-radius:12px;padding:32px 28px;max-width:420px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.mark{font-size:40px;margin-bottom:10px}h1{font-size:18px;margin:0 0 8px}p{color:#5A6070;font-size:14px;margin:0}</style></head>
<body><div class="box"><div class="mark">${success ? '✅' : '↩️'}</div><h1>${title}</h1><p>${body}</p></div></body></html>`);
}
