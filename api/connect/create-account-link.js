// Node.js serverless function. Creates (or reuses) a Stripe Connect STANDARD
// account for the authenticated user and returns a hosted onboarding link.
// No money moves here. The account id is ALWAYS derived from the user's own
// profile row — never accepted from the client.
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

    // Profile (service role).
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Reuse or create the Connect account.
    let accountId = profile && profile.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({ type: 'standard', email: user.email });
      accountId = account.id;
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('user_id', user.id);
    }

    // Return to whichever deployment made the request (Preview vs Production),
    // falling back to APP_URL.
    const origin = req.headers.origin
      || (req.headers.host ? `https://${req.headers.host}` : null)
      || process.env.APP_URL;

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/?connect=refresh`,
      return_url: `${origin}/?connect=return`,
      type: 'account_onboarding',
    });

    res.json({ url: link.url });
  } catch (e) {
    console.error('connect create-account-link error:', e);
    res.status(500).json({ error: 'connect_link_failed' });
  }
}
