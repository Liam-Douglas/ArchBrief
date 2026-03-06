/* ═══════════════════════════════════════════════════════════
   ArchBrief v5 — explainer.js
   Concept Explainer: click any capitalised/technical word,
   or highlight 3-80 chars to get an instant explanation popup.
═══════════════════════════════════════════════════════════ */

let explainerFetching = false;
let selectionTimer    = null;

// ── WORD-CLICK INIT ──────────────────────────────────────
// Call on any container with article body text after rendering
function initExplainer(container) {
  if (!container) return;
  wrapWordsForClick(container);
}

function wrapWordsForClick(container) {
  // Walk text nodes, wrap eligible words
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes  = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(node => {
    const parent = node.parentNode;
    // Skip script, style, existing spans, buttons
    if (!parent || ['SCRIPT','STYLE','BUTTON','CODE','A'].includes(parent.tagName)) return;
    if (parent.classList?.contains('explainer-word')) return;

    const text    = node.textContent;
    // Match: CamelCase, ALL_CAPS, or tech words 4+ chars starting with capital
    const pattern = /\b([A-Z][a-zA-Z0-9]{3,}|[A-Z]{2,}(?:[A-Z0-9]|[_-][A-Z])*)\b/g;
    if (!pattern.test(text)) return;

    pattern.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last   = 0, m;

    while ((m = pattern.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const span = document.createElement('span');
      span.className   = 'explainer-word';
      span.textContent = m[0];
      span.addEventListener('click', e => {
        e.stopPropagation();
        showExplainerAt(m[0], e.clientX, e.clientY);
      });
      frag.appendChild(span);
      last = m.index + m[0].length;
    }

    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    if (frag.childNodes.length > 1) parent.replaceChild(frag, node);
  });
}

// ── SELECTION HANDLER ────────────────────────────────────
document.addEventListener('mouseup', () => {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    const sel  = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 3 || text.length > 80 || text.split(' ').length > 6) return;
    // Only trigger inside article bodies
    const range   = sel.getRangeAt(0);
    const inside  = range.commonAncestorContainer?.closest?.('.article-card-body, .lp-detail, .explorer-article');
    if (!inside) return;

    const rect = range.getBoundingClientRect();
    showExplainerAt(text, rect.left + rect.width / 2, rect.top - 8);
  }, 300);
});

// ── SHOW POPUP ───────────────────────────────────────────
function showExplainerAt(term, x, y) {
  closeExplainer();

  const popup = document.createElement('div');
  popup.id        = 'explainer-popup';
  popup.className = 'explainer-popup';

  // Loading state
  popup.innerHTML = `
    <button class="ep-close" onclick="closeExplainer()">✕</button>
    <div class="ep-term">${esc(term)}</div>
    <div style="display:flex;gap:5px;align-items:center;margin:10px 0">
      <div class="ep-dot"></div><div class="ep-dot"></div><div class="ep-dot"></div>
      <span style="font-size:11px;color:var(--t4);margin-left:4px">Explaining…</span>
    </div>`;

  positionPopup(popup, x, y);
  document.body.appendChild(popup);

  fetchExplanation(term).then(data => {
    if (!document.getElementById('explainer-popup')) return; // closed
    renderExplanation(popup, data, term);
  }).catch(err => {
    if (!document.getElementById('explainer-popup')) return;
    popup.innerHTML = `
      <button class="ep-close" onclick="closeExplainer()">✕</button>
      <div class="ep-term">${esc(term)}</div>
      <div style="font-size:12px;color:var(--red);margin-top:8px">${esc(err.message)}</div>`;
  });
}

function positionPopup(popup, x, y) {
  popup.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden';
  document.body.appendChild(popup);

  const pw = popup.offsetWidth  || 330;
  const ph = popup.offsetHeight || 200;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = x - pw / 2;
  let top  = y - ph - 12;

  // Clamp to viewport
  left = Math.max(10, Math.min(left, vw - pw - 10));
  top  = top < 10 ? y + 24 : top; // flip below if too high

  popup.style.cssText = `left:${left}px;top:${top}px`;
  popup.remove(); // will be re-appended by caller
}

function renderExplanation(popup, data, term) {
  const inGloss = getGlossary().some(g => g.term?.toLowerCase() === term.toLowerCase());

  popup.innerHTML = `
    <button class="ep-close" onclick="closeExplainer()">✕</button>
    <div class="ep-term">${esc(data.term || term)}</div>
    <div class="ep-category">
      <span class="tag tag-topic">${esc(data.category || '')}</span>
    </div>
    <div class="ep-plain">${esc(data.plain || '')}</div>

    ${data.architectContext ? `
      <div class="ep-section">Solution Architect Context</div>
      <div class="callout callout-arch" style="font-size:12.5px">${esc(data.architectContext)}</div>` : ''}

    ${data.apsNote ? `
      <div class="ep-section">🇦🇺 APS</div>
      <div class="callout callout-aps" style="font-size:12.5px">${esc(data.apsNote)}</div>` : ''}

    ${data.relatedTerms?.length ? `
      <div class="ep-section">Related</div>
      <div class="ep-related">
        ${data.relatedTerms.map(t => `<button class="ep-related-term" onclick="showExplainerAt('${esc(t).replace(/'/g,"\\'")}',window.innerWidth/2,window.innerHeight/2)">${esc(t)}</button>`).join('')}
      </div>` : ''}

    <div class="ep-actions">
      <button class="btn btn-secondary btn-sm" onclick="chatAbout('${esc(data.term||term).replace(/'/g,"\\'")}')">Ask Chat</button>
      <button class="btn ${inGloss ? 'btn-ghost' : 'btn-primary'} btn-sm" id="ep-gloss-btn"
        onclick="epToggleGloss(${JSON.stringify(JSON.stringify(data))})">
        ${inGloss ? '✓ In Glossary' : 'Add to Glossary'}
      </button>
    </div>`;
}

function epToggleGloss(dataJson) {
  const data = JSON.parse(dataJson);
  const btn  = document.getElementById('ep-gloss-btn');
  const isNew = addGlossaryEntry(data);
  updateGlossaryBadge();
  Bus.emit('glossary:updated', {});
  if (btn) {
    btn.textContent = '✓ Saved!';
    btn.className   = 'btn btn-ghost btn-sm';
  }
  toast(`"${data.term}" added to glossary`, '📖');
}

// ── FETCH EXPLANATION ────────────────────────────────────
async function fetchExplanation(term) {
  if (explainerFetching) {
    // Queue: just wait 600ms and try
    await new Promise(r => setTimeout(r, 600));
  }
  explainerFetching = true;

  const daily   = getDailyData();
  const context = daily?.digest?.summary || '';

  const system = `You are ArchBrief's concept explainer for a Solution Architect working in Australian Public Sector IT.
Return ONLY valid JSON:
{
  "term": "exact term as used",
  "category": "Cloud|Security|AI|DevOps|APS|Networking|Database|Platform",
  "plain": "1-2 sentences in plain English — what it is, no jargon",
  "architectContext": "2-3 sentences — why it matters for Solution Architects, design patterns, trade-offs",
  "apsNote": "1-2 sentences APS/government relevance or null",
  "relatedTerms": ["term1","term2","term3"]
}`;

  try {
    const raw  = await callClaude({
      messages: [{ role:'user', content:`Explain: "${term}"${context ? `\nContext: ${context.slice(0,200)}` : ''}` }],
      system,
      maxTokens: 600,
    });
    return parseClaudeJson(raw);
  } finally {
    explainerFetching = false;
  }
}

// ── CLOSE ────────────────────────────────────────────────
function closeExplainer() {
  document.getElementById('explainer-popup')?.remove();
}

// Close on outside click
document.addEventListener('click', e => {
  const popup = document.getElementById('explainer-popup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('explainer-word')) {
    closeExplainer();
  }
});

// ── WIRE INTO ARTICLE CARDS ──────────────────────────────
// Re-init explainer whenever an article card opens
Bus.on('panel:activated', ({ id }) => {
  if (['digest','explorer','path'].includes(id)) {
    // Delegate: watch for card opens
    const main = document.getElementById('main');
    if (main && !main.dataset.explainerWired) {
      main.dataset.explainerWired = '1';
      main.addEventListener('click', e => {
        const card = e.target.closest('.article-card');
        if (card?.classList.contains('open')) {
          const body = card.querySelector('.article-card-body');
          if (body && !body.dataset.explainerInit) {
            body.dataset.explainerInit = '1';
            setTimeout(() => initExplainer(body), 50);
          }
        }
      });
    }
  }
});
