// Public (no-auth) endpoint. Resolves an invoice by its unguessable pay_token,
// LIVE-verifies the contractor's Connect account can take charges, then creates
// a Stripe-hosted Checkout Session as a DIRECT charge on the connected account
// with an application fee to the platform, and 302-redirects to it.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

// Platform fee as a percent of the amount charged. Set PLATFORM_FEE_PERCENT in
// the environment (e.g. "2" for 2%). Defaults to 0 (no fee) when unset.
// PLATFORM_FEE_CAP_CENTS caps the fee in cents (default $25).
const PLATFORM_FEE_PERCENT   = Number(process.env.PLATFORM_FEE_PERCENT || 0);
const PLATFORM_FEE_CAP_CENTS = Number(process.env.PLATFORM_FEE_CAP_CENTS || 2500); // $25 default

function page(res, status, title, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F7F4EE;color:#1A1F2E;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.box{background:#fff;border:1px solid #E6DFD2;border-radius:12px;padding:32px 28px;max-width:420px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:18px;margin:0 0 8px}p{color:#5A6070;font-size:14px;margin:0}</style></head>
<body><div class="box"><h1>${title}</h1><p>${body}</p></div></body></html>`);
}

export default async function handler(req, res) {
  try {
    const token = req.query.token;
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('id, user_id, invoice_number, total, amount_paid, status, pay_token')
      .eq('pay_token', token)
      .maybeSingle();

    if (!invoice) {
      page(res, 404, 'Invoice not found', 'This payment link is invalid or has expired.');
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('user_id', invoice.user_id)
      .maybeSingle();

    if (!profile || !profile.stripe_account_id) {
      page(res, 200, 'Payments unavailable', "This business can't accept online payments yet.");
      return;
    }

    // AUTHORITATIVE live gate — never trust the cached boolean for money.
    const acct = await stripe.accounts.retrieve(profile.stripe_account_id);
    if (!acct.charges_enabled) {
      page(res, 200, 'Payments unavailable', "This business can't accept online payments yet.");
      return;
    }

    const total = Number(invoice.total) || 0;
    const paid = Number(invoice.amount_paid) || 0;
    const balanceCents = Math.round((total - paid) * 100);
    if (invoice.status === 'paid' || balanceCents <= 0) {
      page(res, 200, 'Already paid', 'This invoice is already paid. Thank you!');
      return;
    }

    let feeCents = Math.round(balanceCents * PLATFORM_FEE_PERCENT / 100);
    feeCents = Math.min(feeCents, PLATFORM_FEE_CAP_CENTS);          // cap
    feeCents = Math.max(0, Math.min(feeCents, balanceCents - 1));   // never negative / never >= charge

    const origin = req.headers.origin
      || (req.headers.host ? `https://${req.headers.host}` : null)
      || process.env.APP_URL;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: balanceCents,
          product_data: { name: `Invoice ${invoice.invoice_number}` },
        },
      }],
      payment_intent_data: {
        application_fee_amount: feeCents,
        metadata: { invoice_id: invoice.id, pay_token: token },
      },
      metadata: { invoice_id: invoice.id, pay_token: token },
      success_url: `${origin}/api/pay-result?status=success`,
      cancel_url: `${origin}/api/pay/${token}`,
    }, { stripeAccount: profile.stripe_account_id });

    await supabaseAdmin
      .from('invoices')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', invoice.id);

    res.statusCode = 302;
    res.setHeader('Location', session.url);
    res.end();
  } catch (e) {
    console.error('pay/[token] error:', e);
    page(res, 500, 'Something went wrong', 'We couldn’t start the payment. Please try again later.');
  }
}
