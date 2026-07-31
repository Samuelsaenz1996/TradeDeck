export const config = { runtime: 'edge' };

const ALLOWED_MODELS = new Set(['claude-sonnet-4-6']);
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_CAP = 32000;
const MIN_TOKENS = 256;
const MAX_PROMPT_CHARS = 60000;

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!apiKey) {
    return json(500, { error: 'Server not configured: ANTHROPIC_API_KEY missing' });
  }
  if (!supabaseUrl || !supabaseKey) {
    return json(500, { error: 'Server not configured: Supabase env missing' });
  }

  // --- Require a valid Supabase session -------------------------------------
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return json(401, { error: 'Not signed in' });

  let user = null;
  try {
    const userResp = await fetch(supabaseUrl + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: supabaseKey },
    });
    if (!userResp.ok) return json(401, { error: 'Invalid or expired session' });
    user = await userResp.json();
  } catch (e) {
    return json(503, { error: 'Auth check unavailable' });
  }
  if (!user || !user.id) return json(401, { error: 'Invalid session' });

  // --- Validate and clamp the request ---------------------------------------
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { model, max_tokens, prompt } = body || {};

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return json(400, { error: 'Missing prompt' });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return json(413, { error: 'Prompt too long' });
  }

  const safeModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
  const n = Math.floor(Number(max_tokens));
  const safeMaxTokens = Number.isFinite(n)
    ? Math.min(Math.max(n, MIN_TOKENS), MAX_TOKENS_CAP)
    : MAX_TOKENS_CAP;

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: safeModel,
      max_tokens: safeMaxTokens,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    return json(upstream.status || 502, {
      error: (errText || 'Upstream error').slice(0, 200),
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
