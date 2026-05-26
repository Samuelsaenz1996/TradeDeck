// Node.js serverless function. CONNECT webhook (events on connected accounts),
// separate from the subscription webhook and verified with its OWN secret
// (STRIPE_CONNECT_WEBHOOK_SECRET). Marks invoices paid when a hosted Checkout
// session on the connected account completes. Signature verification needs the
// UNPARSED body, so the body parser is disabled and raw bytes are read directly.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
  } catch (err) {
    // Signature failure is the ONLY case that returns non-200.
    console.error('Connect webhook signature verification failed:', err.message);
    res.status(400).send('Webhook Error: ' + err.message);
    return;
  }

  // On Connect events this is the connected account the event belongs to.
  const eventAccount = event.account;

  try {
    if (event.type !== 'checkout.session.completed') {
      res.status(200).json({ received: true });
      return;
    }

    const session = event.data.object;
    // Cards settle synchronously, but guard anyway.
    if (session.payment_status !== 'paid') {
      res.status(200).json({ received: true });
      return;
    }

    const invoiceId = session.metadata && session.metadata.invoice_id;
    const piId = session.payment_intent;
    const paidCents = session.amount_total; // cents
    if (!invoiceId) {
      res.status(200).json({ received: true });
      return;
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('id, user_id, total, amount_paid, status, paid_at, stripe_payment_intent_id')
      .eq('id', invoiceId)
      .maybeSingle();
    if (!invoice) {
      res.status(200).json({ received: true });
      return;
    }

    // DEFENSE: the event's connected account must own this invoice.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('user_id', invoice.user_id)
      .maybeSingle();
    if (!profile || !profile.stripe_account_id || profile.stripe_account_id !== eventAccount) {
      console.error('Connect webhook account mismatch — ignoring.', {
        invoiceId, eventAccount, owner: profile && profile.stripe_account_id,
      });
      res.status(200).json({ received: true });
      return;
    }

    // IDEMPOTENCY: same payment_intent already recorded → no-op (Stripe retries/dupes).
    if (invoice.stripe_payment_intent_id && invoice.stripe_payment_intent_id === piId) {
      res.status(200).json({ received: true });
      return;
    }

    // RECONCILE in cents to avoid float drift.
    const totalCents = Math.round(Number(invoice.total) * 100);
    const newPaidCents = Math.round(Number(invoice.amount_paid) * 100) + Number(paidCents || 0);
    const newAmountPaid = newPaidCents / 100;
    const isPaid = newPaidCents >= totalCents;

    await supabaseAdmin.from('invoices').update({
      amount_paid: newAmountPaid,
      status: isPaid ? 'paid' : 'partial',
      paid_at: isPaid ? new Date().toISOString() : invoice.paid_at,
      stripe_payment_intent_id: piId,
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    }).eq('id', invoice.id);
  } catch (e) {
    // Log loudly but still 200 so Stripe doesn't retry a handled-but-errored event forever.
    console.error('Connect webhook handler error (returning 200 to avoid retries):', e);
  }

  res.status(200).json({ received: true });
}
