// Node.js serverless function. Confirms an email by validating the
// single-use token minted by /api/verify/send. The token itself is the
// auth — there is intentionally NO Bearer header check, because the
// click from the email may happen in a browser tab with no Supabase
// session (e.g. mobile email app → default browser). On success the
// token is nulled so a replay returns invalid_token.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const token = req.body && req.body.token;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'missing_token' });
      return;
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_id, verify_token_expires_at, email_verified_by_us')
      .eq('verify_token', token)
      .maybeSingle();

    if (!profile) {
      res.status(400).json({ error: 'invalid_token' });
      return;
    }

    if (profile.email_verified_by_us === true) {
      res.json({ verified: true, already: true });
      return;
    }

    const expiresAt = profile.verify_token_expires_at
      ? new Date(profile.verify_token_expires_at).getTime()
      : 0;
    if (!expiresAt || expiresAt < Date.now()) {
      res.status(400).json({ error: 'expired_token' });
      return;
    }

    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update({
        email_verified_by_us: true,
        verify_token: null,
        verify_token_expires_at: null,
      })
      .eq('user_id', profile.user_id);
    if (updErr) {
      console.error('verify/confirm profile update error:', updErr);
      res.status(500).json({ error: 'profile_update_failed' });
      return;
    }

    res.json({ verified: true });
  } catch (e) {
    console.error('verify/confirm error:', e);
    res.status(500).json({ error: 'verify_confirm_failed' });
  }
}
