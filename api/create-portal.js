// Node.js serverless function (see create-checkout.js for the runtime note).
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

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user } = {}, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile || !profile.stripe_customer_id) {
      res.status(400).json({ error: 'no_customer' });
      return;
    }

    // Return URL derived from APP_URL server-side (client returnUrl ignored).
    const appUrl = process.env.APP_URL;
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: appUrl + '/?portal=return',
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('create-portal error:', e);
    res.status(500).json({ error: 'portal_failed' });
  }
}
