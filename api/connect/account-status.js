// Node.js serverless function. Retrieves the authenticated user's Connect
// account status and caches the capability booleans on their profile.
// These booleans are a UI cache ONLY — the authoritative charges_enabled
// check happens LIVE at charge-creation time (PAY-B). The account id is
// always derived from the user's own profile row, never from the client.
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
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile || !profile.stripe_account_id) {
      res.json({ connected: false });
      return;
    }

    const acct = await stripe.accounts.retrieve(profile.stripe_account_id);

    await supabaseAdmin.from('profiles').update({
      stripe_charges_enabled: !!acct.charges_enabled,
      stripe_details_submitted: !!acct.details_submitted,
      stripe_payouts_enabled: !!acct.payouts_enabled,
      stripe_connect_updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    res.json({
      connected: true,
      charges_enabled: !!acct.charges_enabled,
      details_submitted: !!acct.details_submitted,
      payouts_enabled: !!acct.payouts_enabled,
    });
  } catch (e) {
    console.error('connect account-status error:', e);
    res.status(500).json({ error: 'connect_status_failed' });
  }
}
