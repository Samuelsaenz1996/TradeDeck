// Node.js serverless function. Mints a single-use verification token, stores
// it on the user's profile (24h expiry), and emails the verify link via Resend.
// Recipient is ALWAYS the authenticated user's email — never a client-supplied
// value. Idempotent: a no-op + no email if the account is already verified.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

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
      .select('user_id, email_verified_by_us')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile && profile.email_verified_by_us === true) {
      res.json({ alreadyVerified: true });
      return;
    }

    const verifyToken = randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update({ verify_token: verifyToken, verify_token_expires_at: expiry })
      .eq('user_id', user.id);
    if (updErr) {
      console.error('verify/send profile update error:', updErr);
      res.status(500).json({ error: 'profile_update_failed' });
      return;
    }

    const link = `${process.env.APP_URL}/verify?token=${verifyToken}`;
    const email = user.email;

    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F7F4EE;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1A1F2E;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="background:#fff;border:1px solid #E6DFD2;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
      <h1 style="font-size:18px;margin:0 0 12px;">Confirm your email</h1>
      <p style="font-size:14px;line-height:1.55;color:#5A6070;margin:0 0 20px;">Thanks for signing up for MyTradeDeck. Tap the button below to confirm this email address. The link expires in 24 hours.</p>
      <p style="margin:0 0 20px;"><a href="${link}" style="display:inline-block;background:#1A1F2E;color:#fff;text-decoration:none;padding:11px 18px;border-radius:7px;font-size:14px;font-weight:500;">Confirm email</a></p>
      <p style="font-size:12px;color:#8A8F9B;margin:0 0 16px;word-break:break-all;">If the button doesn&rsquo;t work, paste this link into your browser:<br/><a href="${link}" style="color:#1A1F2E;">${link}</a></p>
      <hr style="border:0;border-top:1px solid #E6DFD2;margin:18px 0;" />
      <h2 style="font-size:16px;margin:0 0 10px;">Confirma tu correo</h2>
      <p style="font-size:14px;line-height:1.55;color:#5A6070;margin:0 0 12px;">Gracias por registrarte en MyTradeDeck. Toca el bot&oacute;n de arriba para confirmar este correo. El enlace expira en 24 horas.</p>
      <p style="font-size:12px;color:#8A8F9B;margin:0;">Si no fuiste t&uacute;, puedes ignorar este mensaje.</p>
    </div>
  </div>
</body></html>`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MyTradeDeck <noreply@mail.mytradedeck.com>',
        to: email,
        subject: 'Confirm your email — MyTradeDeck',
        html,
      }),
    });

    if (!resp.ok) {
      let detail = null;
      try { detail = await resp.text(); } catch (e) {}
      console.error('verify/send Resend failure:', resp.status, detail);
      res.status(502).json({ error: 'email_send_failed' });
      return;
    }

    res.json({ sent: true });
  } catch (e) {
    console.error('verify/send error:', e);
    res.status(500).json({ error: 'verify_send_failed' });
  }
}
