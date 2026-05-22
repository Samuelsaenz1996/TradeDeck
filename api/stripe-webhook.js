// Node.js serverless function. Stripe signature verification requires the
// UNPARSED request body, so the body parser is disabled below and the raw
// bytes are read straight off the request stream.
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
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Signature failure is the ONLY case that returns non-200.
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send('Webhook Error: ' + err.message);
    return;
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await supabaseAdmin.from('profiles').update({
        plan: 'pro',
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        subscription_status: 'active',
      }).eq('user_id', session.client_reference_id);
    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object;
      // Plan flips off subscription STATUS only — this must never depend on
      // current_period_end resolving.
      const plan = (sub.status === 'active' || sub.status === 'trialing') ? 'pro' : 'free';
      // Defensive read for the display column. Stripe moved current_period_end
      // off the top-level Subscription in newer API versions; fall back to the
      // item and null-guard so a missing value can never throw / abort the update.
      const periodEndUnix = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
      const current_period_end = periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : null;
      await supabaseAdmin.from('profiles').update({
        plan,
        subscription_status: sub.status,
        stripe_subscription_id: sub.id,
        current_period_end,
      }).eq('stripe_customer_id', sub.customer);
    }
    // Any other event type: ignore.
  } catch (e) {
    // Log loudly but still 200 so Stripe doesn't retry a handled-but-errored event forever.
    console.error('Webhook handler error (returning 200 to avoid retries):', event.type, e);
  }

  res.status(200).json({ received: true });
}
