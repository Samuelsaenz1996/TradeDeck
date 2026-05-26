// Node.js serverless function (authed). Mints a public, unguessable pay link
// for one of the authenticated user's OWN invoices. No money moves here — the
// charge is created later by the public /api/pay/[token] endpoint.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

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

    const { invoice_id } = req.body || {};
    if (!invoice_id) {
      res.status(400).json({ error: 'missing_invoice_id' });
      return;
    }

    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('id, user_id, pay_token')
      .eq('id', invoice_id)
      .maybeSingle();

    // Never operate on someone else's invoice.
    if (!invoice || invoice.user_id !== user.id) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    let payToken = invoice.pay_token;
    if (!payToken) {
      payToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
      await supabaseAdmin
        .from('invoices')
        .update({ pay_token: payToken })
        .eq('id', invoice.id);
    }

    const origin = req.headers.origin
      || (req.headers.host ? `https://${req.headers.host}` : null)
      || process.env.APP_URL;

    res.json({ payUrl: `${origin}/api/pay/${payToken}` });
  } catch (e) {
    console.error('create-pay-link error:', e);
    res.status(500).json({ error: 'pay_link_failed' });
  }
}
