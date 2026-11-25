// Node.js serverless function (authed). Mints a public, unguessable share link
// for one of the authenticated user's OWN quotes. Nothing is published by this
// call beyond the quote the caller already owns, and the token is the only
// credential the public page accepts.
//
// Mirrors api/invoice/create-pay-link.js — same ownership check, same token
// shape — so there is one pattern to reason about rather than two.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const authHeader = req.headers['authorization'] || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user } = {}, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const { quote_id } = req.body || {};
    if (!quote_id) {
      res.status(400).json({ error: 'missing_quote_id' });
      return;
    }

    const { data: quote } = await supabaseAdmin
      .from('quotes')
      .select('id, user_id, share_token')
      .eq('id', quote_id)
      .maybeSingle();

    // Never mint a link for someone else's quote. 404 rather than 403 so this
    // can't be used to discover which quote ids exist.
    if (!quote || quote.user_id !== user.id) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Reuse an existing token: re-sharing a quote must not break a link the
    // customer already has.
    let shareToken = quote.share_token;
    if (!shareToken) {
      shareToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
      const { error: updErr } = await supabaseAdmin
        .from('quotes')
        .update({ share_token: shareToken, shared_at: new Date().toISOString() })
        .eq('id', quote.id);
      if (updErr) {
        console.warn('share token write failed:', updErr);
        res.status(500).json({ error: 'token_write_failed' });
        return;
      }
    }

    const origin = req.headers.origin
      || (req.headers.host ? `https://${req.headers.host}` : null)
      || process.env.APP_URL;

    res.status(200).json({ url: `${origin}/q/${shareToken}` });
  } catch (e) {
    console.warn('create-share-link threw:', e);
    res.status(500).json({ error: 'server_error' });
  }
}
