/* ═══════════════════════════════════════════════════════════
   ArchBrief v5 — core.js
   App init, routing, Anthropic API wrapper, toast system,
   global event bus, and shared utilities.
═══════════════════════════════════════════════════════════ */

// ── APP STATE ────────────────────────────────────────────
const AppState = {
  currentPanel:  'morning',
  dailyData:     null,
  loading:       false,
  initialized:   false,
};

// ── EVENT BUS ────────────────────────────────────────────
// Lightweight pub/sub so panels can communicate without coupling
const Bus = (() => {
  const listeners = {};
  return {
    on(event, fn)  { (listeners[event] ||= []).push(fn); },
    off(event, fn) { listeners[event] = (listeners[event] || []).filter(f => f !== fn); },
    emit(event, data) { (listeners[event] || []).forEach(fn => fn(data)); },
  };
})();

// ── ROUTING ──────────────────────────────────────────────
const PANELS = [
  'morning','digest','explorer','compare','aps',
  'chat','quiz','path','scenarios','glossary',
  'progress','projects','recap','saved','search',
];

function showPanel(id, opts = {}) {
  if (!PANELS.includes(id)) return;

  // Deactivate all panels and nav items
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Activate target
  const panelEl = document.getElementById('panel-' + id);
  const navEl   = document.getElementById('nav-' + id);
  if (panelEl) panelEl.classList.add('active');
  if (navEl)   navEl.classList.add('active');

  // Update panel heading
  const headingEl = document.getElementById('panel-heading');
  if (headingEl) headingEl.textContent = PANEL_TITLES[id] || id;

  AppState.currentPanel = id;

  // Close mobile sidebar
  if (window.innerWidth <= 680) {
    document.getElementById('sidebar')?.classList.remove('open');
  }

  // Notify panels they've become active
  Bus.emit('panel:activated', { id, opts });

  // Scroll main to top
  document.getElementById('main')?.scrollTo(0, 0);
}

const PANEL_TITLES = {
  morning:   '🌅 Start My Day',
  digest:    '📰 Daily Digest',
  explorer:  '🗂 Topic Explorer',
  compare:   '⚖️ Vendor Compare',
  aps:       '🇦🇺 APS Radar',
  chat:      '💬 Q&A Chat',
  quiz:      '🧠 Daily Quiz',
  path:      '🗺 Learning Path',
  scenarios: '⚔️ Scenario Challenges',
  glossary:  '📖 My Glossary',
  progress:  '📈 Progress',
  projects:  '🎯 My Projects',
  recap:     '📊 Weekly Recap',
  saved:     '📌 Saved',
  search:    '🔍 Search Results',
};

// ── ANTHROPIC API WRAPPER ────────────────────────────────
const MODEL = 'claude-sonnet-4-20250514';

async function callClaude({ messages, system, maxTokens = 1000, webSearch = false, onStream }) {
  const settings = getSettings();

  // Build endpoint list: proxy first, direct API key as fallback
  const endpoints = [];
  if (settings.proxyUrl) {
    let url = settings.proxyUrl.replace(/\/$/, '');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    endpoints.push({ endpoint: url, extraHeaders: {} });
  }
  if (settings.apiKey) {
    endpoints.push({
      endpoint: 'https://api.anthropic.com/v1/messages',
      extraHeaders: {
        'x-api-key': settings.apiKey,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });
  }
  if (!endpoints.length) {
    throw new Error('No API proxy configured — add the proxy URL in My Projects → API Proxy');
  }

  const payload = {
    model:      MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  };

  if (webSearch) {
    payload.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  let lastError;
  for (const { endpoint, extraHeaders } of endpoints) {
    const headers = {
      'Content-Type':      'application/json',
      'anthropic-version': '2023-06-01',
      ...extraHeaders,
    };
    if (webSearch) headers['anthropic-beta'] = 'web-search-2025-03-05';

    let res;
    try {
      res = await fetch(endpoint, {
        method:  'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // Network error (proxy unreachable, CORS, etc.) — try next endpoint
      console.warn(`[callClaude] ${endpoint} failed: ${e.message}`);
      lastError = e;
      continue;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Unknown API error');

    // Extract text content from all blocks, stripping web-search citation tags
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text.replace(/<\/?cite[^>]*>/g, ''))
      .join('\n');

    return text;
  }

  // All endpoints failed
  throw lastError || new Error('All API endpoints failed');
}

// Parse JSON from Claude response
// Handles: markdown fences, preamble/postamble text, web-search narration
function parseClaudeJson(raw) {
  let cleaned = raw.trim();

  // 1. Strip markdown code fences (```json ... ```)
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines[lines.length - 1].trim() === '```') lines.pop();
    cleaned = lines.join('\n').trim();
  }

  // 2. Try direct parse (ideal case — model returned pure JSON)
  try { return JSON.parse(cleaned); } catch (_) {}

  // 3. Extract the outermost JSON object from surrounding prose
  //    Handles "Based on my search... { ... } Here is your brief."
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (_) {}
  }

  // 4. Extract a JSON array (fallback for array-only responses)
  const aStart = cleaned.indexOf('[');
  const aEnd   = cleaned.lastIndexOf(']');
  if (aStart !== -1 && aEnd > aStart) {
    try { return JSON.parse(cleaned.slice(aStart, aEnd + 1)); } catch (_) {}
  }

  throw new SyntaxError('No valid JSON found in response: ' + cleaned.slice(0, 120));
}

// ── LOADING STATES ───────────────────────────────────────
function renderLoader(el, message = 'Generating…') {
  const bars = [1,2,3,4,5].map((_, i) =>
    `<div class="loader-bar" style="background:var(--g);height:${14+i*3}px;animation-delay:${i*.1}s"></div>`
  ).join('');
  el.innerHTML = `<div class="loader">
    <div class="loader-bars">${bars}</div>
    <div class="loader-text">${message}</div>
  </div>`;
}

function renderEmpty(el, { icon = '📭', title = 'Nothing here yet', body = '', action = '' } = {}) {
  el.innerHTML = `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${title}</div>
    ${body   ? `<div class="empty-body">${body}</div>` : ''}
    ${action ? action : ''}
  </div>`;
}

// ── TOAST SYSTEM ─────────────────────────────────────────
function toast(message, icon = 'ℹ️', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'fadeIn .2s ease reverse';
    setTimeout(() => el.remove(), 200);
  }, duration);
}

// ── APP INITIALISATION ───────────────────────────────────
async function initApp() {
  if (AppState.initialized) return;
  AppState.initialized = true;

  // Topbar date
  const dateEl = document.getElementById('topbar-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-AU', {
      timeZone: 'Australia/Sydney',
      weekday: 'short', day: 'numeric', month: 'short',
    }).toUpperCase();
  }

  // Build sidebar vendor toggles
  buildVendorToggles();

  // Build sidebar nav
  buildSidebarNav();

  // Mobile hamburger
  document.getElementById('topbar-hamburger')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  // Tap scrim to close sidebar
  document.getElementById('sidebar-scrim')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
  });

  // Global search trigger
  document.getElementById('topbar-search')?.addEventListener('click', () => {
    showPanel('search');
  });

  // Keyboard shortcut: Escape closes mobile sidebar / explainer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('explainer-popup')?.remove();
    }
  });

  // Load daily.json in background
  try {
    AppState.dailyData = await loadDailyJson();
    Bus.emit('daily:loaded', AppState.dailyData);
  } catch(e) {
    console.warn('Daily data load failed:', e);
  }

  // Determine start panel
  const startPanel = isMorningDone() ? 'digest' : 'morning';
  showPanel(startPanel);

  // Update morning nav badge
  updateMorningBadge();

  // Update misc badges
  updateGlossaryBadge();
  updateSavedBadge();

  // Attempt background feedback sync
  setTimeout(syncFeedback, 2000);

  Bus.emit('app:ready', {});
}

// ── SIDEBAR BUILDING ─────────────────────────────────────
function buildSidebarNav() {
  // Morning badge
  updateMorningBadge();
}

function updateMorningBadge() {
  const badge = document.getElementById('nav-morning-badge');
  if (!badge) return;
  const done = isMorningDone();
  badge.textContent = done ? '✓' : 'Start';
  badge.className   = 'nav-badge ' + (done ? 'success' : 'alert');
  document.getElementById('nav-morning')?.classList.toggle('done', done);
}

function updateGlossaryBadge() {
  const el = document.getElementById('nav-glossary-badge');
  if (el) el.textContent = getGlossary().length;
}

function updateSavedBadge() {
  const el = document.getElementById('nav-saved-badge');
  if (el) el.textContent = getSaved().length;
}

// ── VENDOR TOGGLES ───────────────────────────────────────
function buildVendorToggles() {
  const grid = document.getElementById('vendor-grid');
  if (!grid) return;

  const active = getActiveVendors();
  grid.innerHTML = VENDOR_KEYS.map(key => {
    const v    = VENDORS[key];
    const isOn = active.includes(key);
    return `<button
      class="vendor-toggle ${isOn ? 'active' : ''}"
      id="vtog-${key}"
      style="--vendor-color:${v.color}"
      onclick="handleVendorToggle('${key}')"
      title="${v.fullName}"
    >${v.label}</button>`;
  }).join('');

  // Topbar vendor pills
  buildTopbarVendors(active);
}

function handleVendorToggle(key) {
  const newActive = toggleVendor(key);
  const btn = document.getElementById('vtog-' + key);
  btn?.classList.toggle('active', newActive.includes(key));
  buildTopbarVendors(newActive);
  Bus.emit('vendors:changed', newActive);
  toast(`${VENDORS[key].label} ${newActive.includes(key) ? 'enabled' : 'disabled'}`, newActive.includes(key) ? '✅' : '⬜');
}

function buildTopbarVendors(active) {
  const wrap = document.getElementById('topbar-vendors');
  if (!wrap) return;
  const showing = active.slice(0, 6); // limit topbar to 6
  wrap.innerHTML = showing.map(key => {
    const v = VENDORS[key];
    return `<span class="topbar-vendor-pill" style="color:${v.color};border-color:${v.color}40;background:${v.color}10">${v.label}</span>`;
  }).join('');
}

// ── HELPERS ──────────────────────────────────────────────

// Format article body into readable HTML
function formatBody(text) {
  if (!text) return '';
  return text
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => `<p>${p.trim()}</p>`)
    .join('');
}

// Escape HTML
function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// Chat helper — open Q&A panel with pre-filled query
function chatAbout(query) {
  showPanel('chat');
  Bus.emit('chat:prefill', { query });
}

// ── DOM READY ────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
