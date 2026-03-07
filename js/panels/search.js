/* ═══════════════════════════════════════════════════════════
   ArchBrief v5 — search.js
   Global search: digest articles, explorer articles, glossary terms.
   Client-side only — no API calls.
═══════════════════════════════════════════════════════════ */

let searchDebounce = null;

Bus.on('panel:activated', ({ id }) => {
  if (id === 'search') initSearch();
});

// Also called when topbar search button is clicked
Bus.on('search:focus', () => {
  document.getElementById('global-search-input')?.focus();
});

function initSearch() {
  const input = document.getElementById('global-search-input');
  const out   = document.getElementById('search-out');
  if (!input || !out) return;

  // Show prompt if empty
  if (!input.value.trim()) {
    renderEmpty(out, { icon: '🔍', title: 'Search everything', body: 'Type to search articles, topics, vendors, and glossary terms.' });
  }

  // Only attach listener once
  if (input.dataset.searchBound) return;
  input.dataset.searchBound = '1';
  input.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => runSearch(input.value), 180);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { input.value = ''; runSearch(''); input.blur(); }
  });

  // Focus the input
  setTimeout(() => input.focus(), 80);
}

function runSearch(query) {
  const out = document.getElementById('search-out');
  if (!out) return;

  const q = query.trim().toLowerCase();
  if (!q) {
    renderEmpty(out, { icon: '🔍', title: 'Search everything', body: 'Type to search articles, topics, vendors, and glossary terms.' });
    return;
  }

  const results = collectResults(q);

  if (!results.total) {
    renderEmpty(out, { icon: '🔍', title: `No results for "${esc(query)}"`, body: 'Try a vendor name, topic, or keyword.' });
    return;
  }

  let html = `<div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--t4);margin-bottom:14px">${results.total} result${results.total !== 1 ? 's' : ''} for <span style="color:var(--g)">"${esc(query)}"</span></div>`;

  if (results.digest.length) {
    html += renderSearchSection('📰 Digest Articles', results.digest, q, item =>
      `<span onclick="showPanel('digest')" style="cursor:pointer">${renderSearchItem(item, q)}</span>`
    );
  }

  if (results.explorer.length) {
    html += renderSearchSection('🗂 Topic Explorer', results.explorer, q, item =>
      `<span onclick="showPanel('explorer')" style="cursor:pointer">${renderSearchItem(item, q)}</span>`
    );
  }

  if (results.saved.length) {
    html += renderSearchSection('📌 Saved Articles', results.saved, q, item =>
      `<span onclick="showPanel('saved')" style="cursor:pointer">${renderSearchItem(item, q)}</span>`
    );
  }

  if (results.glossary.length) {
    html += renderSearchSection('📖 Glossary', results.glossary, q, item =>
      `<span onclick="showPanel('glossary')" style="cursor:pointer">${renderSearchItem(item, q, true)}</span>`
    );
  }

  out.innerHTML = html;
}

function collectResults(q) {
  const daily    = getDailyData();
  const saved    = getSaved();
  const glossary = getGlossary();
  const digest   = [];
  const explorer = [];
  const savedRes = [];
  const glossRes = [];

  // Digest articles
  for (const a of daily?.digest?.articles || []) {
    const score = scoreMatch(q, [a.title, a.lead, a.body, ...(a.key_points || []), ...(a.vendors || []), a.topicTag]);
    if (score > 0) digest.push({ ...a, _score: score });
  }

  // Explorer articles
  for (const a of daily?.explorer?.articles || []) {
    const sectionText = (a.sections || []).map(s => s.content).join(' ');
    const score = scoreMatch(q, [a.title, a.navTitle, a.lead, sectionText, ...(a.vendors || []), a.topicTag]);
    if (score > 0) explorer.push({ ...a, _score: score });
  }

  // Saved articles
  for (const a of saved) {
    const score = scoreMatch(q, [a.title, a.lead, a.body, ...(a.vendors || [])]);
    if (score > 0) savedRes.push({ ...a, _score: score });
  }

  // Glossary terms
  for (const term of glossary) {
    const score = scoreMatch(q, [term.term, term.definition, term.context]);
    if (score > 0) glossRes.push({ ...term, _score: score, title: term.term, lead: term.definition });
  }

  // Sort each group by relevance
  const byScore = arr => arr.sort((a, b) => b._score - a._score).slice(0, 5);
  const d = byScore(digest), e = byScore(explorer), s = byScore(savedRes), g = byScore(glossRes);
  return { digest: d, explorer: e, saved: s, glossary: g, total: d.length + e.length + s.length + g.length };
}

function scoreMatch(q, fields) {
  let score = 0;
  for (const f of fields) {
    if (!f) continue;
    const text = String(f).toLowerCase();
    if (text === q) score += 10;
    else if (text.startsWith(q)) score += 5;
    else if (text.includes(q)) score += 2;
  }
  return score;
}

function renderSearchSection(heading, items, q, renderer) {
  return `<div style="margin-bottom:20px">
    <div style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--t4);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">${heading}</div>
    ${items.map(item => renderer(item)).join('')}
  </div>`;
}

function renderSearchItem(item, q, isGlossary = false) {
  const title = highlightMatch(esc(item.title || ''), q);
  const lead  = highlightMatch(esc((item.lead || item.definition || '').slice(0, 120)), q);
  const vendorBadges = (item.vendors || []).map(v => {
    const color = VENDORS[v]?.color || '#888';
    const label = VENDORS[v]?.label || v;
    return `<span style="font-size:9px;padding:1px 6px;border-radius:2px;background:${color}20;color:${color};font-family:'JetBrains Mono',monospace">${label}</span>`;
  }).join(' ');

  return `<div style="padding:10px 14px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:8px;cursor:pointer" class="search-result-card">
    <div style="font-size:13px;font-weight:600;color:var(--t1);margin-bottom:4px">${title}</div>
    ${lead ? `<div style="font-size:12px;color:var(--t3);line-height:1.5;margin-bottom:6px">${lead}${item.lead?.length > 120 ? '…' : ''}</div>` : ''}
    ${vendorBadges ? `<div>${vendorBadges}</div>` : ''}
  </div>`;
}

function highlightMatch(text, q) {
  if (!q) return text;
  // Highlight the search term (case-insensitive, escaped for HTML)
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark style="background:rgba(34,255,168,.25);color:var(--g);border-radius:2px;padding:0 2px">$1</mark>');
}
