/* ═══════════════════════════════════════════════════════════
   ArchBrief v5 — Cloudflare Worker
   feedback_worker/worker.js

   Receives article ratings from the browser app and
   writes them to feedback.json in the GitHub repo via
   the GitHub Contents API.

   SETUP:
   1. Sign up at cloudflare.com (free)
   2. Install Wrangler: npm install -g wrangler
   3. Run: wrangler login
   4. Run: wrangler deploy
   5. Add secrets:
        wrangler secret put GITHUB_TOKEN
        wrangler secret put GITHUB_OWNER   (your github username)
        wrangler secret put GITHUB_REPO    (your repo name, e.g. archbrief)
   6. Copy the deployed worker URL into ArchBrief Settings
      as the Feedback Worker URL.

   ENDPOINTS:
   POST /sync   — receive array of ratings, merge into feedback.json
   GET  /status — health check, returns sync stats
   OPTIONS *    — CORS preflight
═══════════════════════════════════════════════════════════ */

export default {
  async fetch(request, env) {
    // ── CORS ─────────────────────────────────────────────
    const corsHeaders = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // ── GET /status ─────────────────────────────────
      if (request.method === 'GET' && url.pathname === '/status') {
        const feedback = await readFeedbackJson(env);
        return json({
          ok:           true,
          totalRatings: feedback.ratings?.length || 0,
          lastUpdated:  feedback.lastUpdated || null,
          repo:         `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
        }, corsHeaders);
      }

      // ── POST /sync ──────────────────────────────────
      if (request.method === 'POST' && url.pathname === '/sync') {
        const body = await request.json();
        const incoming = body.ratings;

        if (!Array.isArray(incoming) || incoming.length === 0) {
          return json({ ok: false, error: 'No ratings provided' }, corsHeaders, 400);
        }

        // Validate ratings
        const valid = incoming.filter(r =>
          r.title && r.rating && ['up','down'].includes(r.rating) && r.ratedAt
        );

        if (valid.length === 0) {
          return json({ ok: false, error: 'No valid ratings' }, corsHeaders, 400);
        }

        // Read current feedback.json from repo
        const { content: current, sha } = await readFeedbackJsonWithSha(env);

        // Merge: incoming ratings override existing ones for same article
        const existingMap = {};
        (current.ratings || []).forEach(r => { existingMap[r.title] = r; });
        valid.forEach(r => { existingMap[r.title] = r; });

        const merged = {
          ratings:     Object.values(existingMap)
            .sort((a,b) => new Date(b.ratedAt) - new Date(a.ratedAt))
            .slice(0, 500), // cap at 500
          lastUpdated: new Date().toISOString(),
          totalCount:  Object.keys(existingMap).length,
        };

        // Write back to repo
        await writeFeedbackJson(env, merged, sha);

        return json({
          ok:      true,
          synced:  valid.length,
          total:   merged.ratings.length,
        }, corsHeaders);
      }

      return json({ ok: false, error: 'Not found' }, corsHeaders, 404);

    } catch(e) {
      console.error('Worker error:', e);
      return json({ ok: false, error: e.message }, corsHeaders, 500);
    }
  }
};

// ── GITHUB HELPERS ───────────────────────────────────────

const FEEDBACK_PATH = 'feedback.json';

async function githubRequest(env, method, path, body = null) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept':        'application/vnd.github.v3+json',
      'Content-Type':  'application/json',
      'User-Agent':    'ArchBrief-Feedback-Worker/1.0',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub API ${res.status}: ${err.message || 'Unknown error'}`);
  }
  return res;
}

async function readFeedbackJsonWithSha(env) {
  const res = await githubRequest(env, 'GET', FEEDBACK_PATH);

  if (res.status === 404) {
    // File doesn't exist yet — start fresh
    return { content: { ratings: [] }, sha: null };
  }

  const data    = await res.json();
  const decoded = JSON.parse(atob(data.content.replace(/\n/g, '')));
  return { content: decoded, sha: data.sha };
}

async function readFeedbackJson(env) {
  const { content } = await readFeedbackJsonWithSha(env);
  return content;
}

async function writeFeedbackJson(env, data, sha) {
  const encoded = btoa(JSON.stringify(data, null, 2) + '\n');

  const body = {
    message: `📊 Feedback sync — ${data.ratings?.length || 0} ratings`,
    content: encoded,
    branch:  'main',
  };

  // Include SHA if updating existing file
  if (sha) body.sha = sha;

  await githubRequest(env, 'PUT', FEEDBACK_PATH, body);
}

// ── RESPONSE HELPERS ─────────────────────────────────────

function json(data, extraHeaders = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}
