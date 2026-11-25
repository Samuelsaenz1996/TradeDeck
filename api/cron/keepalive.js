// Keeps the Supabase project from being paused for inactivity.
//
// Supabase pauses a free-plan project that goes about a week without enough
// USER DATABASE ACTIVITY. Loading mytradedeck.com is not enough on its own —
// the page is static HTML served by Vercel and never touches Postgres until
// someone signs in. So a quiet week puts the database to sleep, and a sleeping
// project does not wake up when the next visitor arrives: it has to be resumed
// by hand from the Supabase dashboard. The site would keep loading and every
// signup would fail, silently.
//
// This runs once a day from vercel.json and issues one real query, which is
// what the pause rule counts. It is deliberately the cheapest query that still
// reaches Postgres: a count with a zero-row window, no table scan, no data read.
//
// Note the failure mode this does NOT solve: if this function itself breaks —
// bad env var, Supabase key rotated, cron silently unregistered — the project
// sleeps anyway and nothing tells anyone. GET /api/cron/keepalive returns the
// result as JSON so it can be checked from outside; `lastOk` in the response is
// the thing worth watching.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Vercel sends `Authorization: Bearer $CRON_SECRET` when that env var is set.
  // If it is set we require it, so the endpoint can't be hammered by anyone who
  // finds the URL. If it isn't set, the endpoint still works — the query is
  // harmless — but setting CRON_SECRET in Vercel is the better configuration.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

  const startedAt = new Date().toISOString();

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // head:true returns no rows, only the count — one round trip to Postgres.
    const { count, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id', { count: 'exact', head: true });

    if (error) {
      console.error('[keepalive] query failed:', error.message);
      res.status(503).json({ ok: false, at: startedAt, error: error.message });
      return;
    }

    console.log(`[keepalive] ok at ${startedAt}, profiles=${count}`);
    res.status(200).json({ ok: true, at: startedAt, profiles: count });
  } catch (e) {
    console.error('[keepalive] threw:', e && e.message);
    res.status(503).json({ ok: false, at: startedAt, error: String(e && e.message) });
  }
}
