// Node.js serverless function. Hard-delete the authenticated user's account
// and all their data. Mirrors api/create-portal.js: POST + bearer auth, no
// trusted body, user ID derived ONLY from supabaseAdmin.auth.getUser(token).
//
// Execution order matters:
//   1. Cancel Stripe subscription (immediate) if one exists — best-effort.
//   2. Null out the circular FK between quotes.job_id and jobs.quote_id so
//      RESTRICT-on-FK can't block the per-table deletes.
//   3. Delete user data in dependency order: followups → invoices → jobs →
//      quotes → clients → profiles. Each wrapped so partial failure still
//      maximizes cleanup.
//   4. Delete the logo from storage (best-effort — supabase-js v2 returns
//      no error when the file doesn't exist).
//   5. Delete the auth user LAST. Failure mode is recoverable (user retries).
//      Reverse order would leave orphaned data with no owner.
//
// We deliberately do NOT delete the Stripe customer record — financial
// records remain attached to the customer for accounting / refund handling.
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

    // Support traceability — if a user later claims they didn't delete
    // their account, this line is the paper trail.
    console.log(`delete-account: user_id=${user.id} email=${user.email}`);

    // --- Step 1: cancel Stripe subscription (best-effort) ----------------
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile && profile.stripe_subscription_id) {
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      }
    } catch (e) {
      // Already-canceled subscriptions throw resource_missing. Log and
      // continue — the account deletion must not block on Stripe state.
      console.warn('delete-account: stripe cancel skipped:', e && e.message);
    }

    // --- Step 2: break circular FK before deletes ------------------------
    // quotes.job_id ↔ jobs.quote_id is a circular reference. Without
    // pre-nulling one side, RESTRICT-on-FK in either direction would block
    // the explicit deletes below.
    try {
      await supabaseAdmin.from('quotes').update({ job_id: null }).eq('user_id', user.id);
    } catch (e) { console.warn('delete-account: null quotes.job_id failed:', e && e.message); }
    try {
      await supabaseAdmin.from('jobs').update({ quote_id: null }).eq('user_id', user.id);
    } catch (e) { console.warn('delete-account: null jobs.quote_id failed:', e && e.message); }

    // --- Step 3: hard-delete user data in dependency order ---------------
    // Each step wrapped so one failure logs and continues — partial cleanup
    // is better than no cleanup if a single table errors.
    const tables = ['followups', 'invoices', 'jobs', 'quotes', 'clients', 'profiles'];
    for (const table of tables) {
      try {
        const { error } = await supabaseAdmin.from(table).delete().eq('user_id', user.id);
        if (error) console.warn(`delete-account: delete from ${table} returned error:`, error.message);
      } catch (e) {
        console.warn(`delete-account: delete from ${table} threw:`, e && e.message);
      }
    }

    // --- Step 4: storage cleanup (best-effort) ---------------------------
    try {
      await supabaseAdmin.storage.from('logos').remove([`${user.id}/logo`]);
    } catch (e) {
      console.warn('delete-account: logo remove failed:', e && e.message);
    }

    // --- Step 5: delete the auth user LAST -------------------------------
    // If this fails after data is wiped, the data is gone but the auth row
    // remains. User sees an error and can retry; the next call will no-op
    // through the data deletes (everything already cleaned) and attempt
    // auth delete again.
    try {
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (authErr) {
        console.error('delete-account: auth.admin.deleteUser error:', authErr.message);
        res.status(500).json({ error: 'delete_failed' });
        return;
      }
    } catch (e) {
      console.error('delete-account: auth.admin.deleteUser threw:', e && e.message);
      res.status(500).json({ error: 'delete_failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('delete-account: top-level error:', e);
    res.status(500).json({ error: 'delete_failed' });
  }
}
