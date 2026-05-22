// Node.js serverless function (NOT Edge — the Stripe SDK + Supabase admin
// client need the Node runtime). ESM syntax matches generate.js; the runtime
// is left at Vercel's Node default by omitting any `runtime` config.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Auth: bearer token → user.
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user } = {}, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const { interval } = req.body || {};
    const priceId = interval === 'annual'
      ? process.env.STRIPE_PRICE_ID_ANNUAL
      : process.env.STRIPE_PRICE_ID_MONTHLY;

    // Profile (service role).
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, plan')
      .eq('user_id', user.id)
      .maybeSingle();

    // Already subscribed — don't let them double-subscribe.
    if (profile && profile.plan === 'pro') {
      res.json({ alreadyPro: true });
      return;
    }

    // Reuse or create the Stripe customer.
    let customerId = profile && profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    // Redirect targets are derived server-side from APP_URL; the client-supplied
    // returnUrl is intentionally ignored to avoid an open-redirect.
    const appUrl = process.env.APP_URL;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      allow_promotion_codes: true,
      success_url: appUrl + '/?checkout=success',
      cancel_url: appUrl + '/?checkout=cancel',
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('create-checkout error:', e);
    res.status(500).json({ error: 'checkout_failed' });
  }
}
