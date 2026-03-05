/**
 * ArchBrief — Anthropic API Proxy Worker
 *
 * Proxies requests from the ArchBrief PWA to api.anthropic.com,
 * adding the ANTHROPIC_API_KEY secret server-side so it is never
 * exposed to the browser.
 *
 * Security:
 *   - Only requests from ALLOWED_ORIGINS are accepted (CORS + origin check)
 *   - Only POST to /v1/messages is forwarded
 *   - ANTHROPIC_API_KEY is a Wrangler secret (never in source code)
 *
 * Deploy:
 *   cd .github/scripts/api_proxy
 *   wrangler login
 *   wrangler secret put ANTHROPIC_API_KEY   ← paste key when prompted
 *   wrangler deploy
 *
 * After deploy, copy the worker URL into ArchBrief → My Projects → API Proxy URL
 */

const ALLOWED_ORIGINS = [
  'https://liam-douglas.github.io',   // Production (GitHub Pages)
  'http://localhost:3000',             // Local dev server
  'http://127.0.0.1:3000',
];

const UPSTREAM = 'https://api.anthropic.com/v1/messages';

const CORS_HEADERS = (origin) => ({
  'Access-Control-Allow-Origin':  origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, anthropic-version',
  'Access-Control-Max-Age':       '86400',
  'Vary':                         'Origin',
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // ── Reject disallowed origins ─────────────────────
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response('Forbidden — origin not allowed', { status: 403 });
    }

    // ── CORS preflight ────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS(origin) });
    }

    // ── Only accept POST ──────────────────────────────
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS(origin) });
    }

    // ── Validate API key is configured ───────────────
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: { message: 'Proxy not configured — ANTHROPIC_API_KEY secret missing', type: 'proxy_error' } }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS(origin) } }
      );
    }

    // ── Forward to Anthropic ──────────────────────────
    let body;
    try {
      body = await request.text();
      // Basic sanity check — must be valid JSON
      JSON.parse(body);
    } catch {
      return new Response(
        JSON.stringify({ error: { message: 'Invalid JSON body', type: 'proxy_error' } }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS(origin) } }
      );
    }

    const upstream = await fetch(UPSTREAM, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
      },
      body,
    });

    // Stream response back with CORS headers
    const responseHeaders = {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      ...CORS_HEADERS(origin),
    };

    return new Response(upstream.body, {
      status:  upstream.status,
      headers: responseHeaders,
    });
  },
};
