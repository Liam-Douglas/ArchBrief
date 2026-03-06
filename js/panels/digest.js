/* ═══════════════════════════════════════════════════════════
   ArchBrief v5 — digest.js
   Daily Digest: article cards, feedback buttons, pre-gen banner
═══════════════════════════════════════════════════════════ */

let digestArticles = [];
let digestGenerating = false;

Bus.on('panel:activated', ({ id }) => { if (id === 'digest') initDigest(); });
Bus.on('daily:loaded',    (data)   => { if (data && AppState.currentPanel === 'digest') initDigest(); });

function initDigest() {
  const out = document.getElementById('digest-out');
  const banner = document.getElementById('digest-pregen-banner');
  const sub = document.getElementById('digest-subtitle');
  const daily = getDailyData();
  if (!out) return;
  if (daily?.digest?.articles?.length) {
    renderPregenBanner(banner, daily);
    renderDigest(out, daily.digest);
    if (sub) sub.textContent = daily.date || 'Today';
    flagQuizReady();
  } else {
    if (banner) banner.innerHTML = '';
    if (sub) sub.textContent = "Click Generate for today's brief";
    renderEmpty(out, {
      icon: '📰', title: "No digest yet",
      body: "Generate to pull today's news across all 9 vendors with APS context.",
      action: '<button class="btn btn-primary btn-lg" onclick="generateDigest()">⚡ Generate Today\'s Brief</button>',
    });
  }
}

function renderPregenBanner(el, daily) {
  if (!el) return;
  const fresh = isDailyFresh();
  const ctx = daily.context;
  const meta = ctx ? `${ctx.activeProjects||0} projects · ${ctx.historyDays||0}d history` : '';
  el.innerHTML = fresh
    ? `<div style="padding:9px 14px;margin-bottom:14px;background:rgba(34,255,168,.05);border:1px solid rgba(34,255,168,.12);border-radius:var(--r-md);display:flex;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--g)">
        <span>⚡</span><span>Pre-generated at 5am AEST — content is fresh</span>
        ${meta ? `<span style="margin-left:auto;color:var(--t4)">${meta}</span>` : ''}
       </div>`
    : `<div style="padding:9px 14px;margin-bottom:14px;background:rgba(255,153,0,.05);border:1px solid rgba(255,153,0,.15);border-radius:var(--r-md);display:flex;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--aws)">
        <span>⚠</span><span>Showing ${daily.date||'previous'} brief — today's may still be running</span>
        <button onclick="generateDigest()" class="btn btn-secondary btn-sm" style="margin-left:auto">Regenerate</button>
       </div>`;
}

function renderDigest(out, digest) {
  if (!out || !digest) return;
  digestArticles = digest.articles || [];

  let html = '';
  if (digest.summary) {
    html += `<div style="padding:14px 16px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-lg);margin-bottom:16px;font-size:14px;color:var(--t2);line-height:1.75">${esc(digest.summary)}</div>`;
  }
  if (digest.apsAlert) {
    html += `<div class="callout callout-aps" style="margin-bottom:16px">🇦🇺 ${esc(digest.apsAlert)}</div>`;
  }

  // APS change alerts from overnight diff
  const changes = getDailyData()?.apsChanges || [];
  if (changes.length) {
    html += `<div style="padding:11px 14px;background:rgba(255,153,0,.06);border:1px solid rgba(255,153,0,.2);border-radius:var(--r-md);margin-bottom:14px">
      <div class="label" style="color:var(--aws);margin-bottom:6px">🔔 APS Status Changes</div>
      ${changes.map(c => `<div style="font-size:12px;color:rgba(255,153,0,.8)">• ${esc(c.vendor||c.alert||'')}${c.from ? `: ${esc(c.from)} → ${esc(c.to||'')}` : ''}</div>`).join('')}
    </div>`;
  }

  html += digestArticles.map((a, i) => buildArticleCard(a, i)).join('');
  out.innerHTML = html;

  // Wire interactions
  out.querySelectorAll('.article-card-header').forEach(hdr => {
    hdr.addEventListener('click', () => toggleArticleCard(hdr.closest('.article-card')));
  });
  out.querySelectorAll('.btn-save-article').forEach(btn => {
    const i = +btn.dataset.idx;
    refreshSaveBtn(btn, digestArticles[i]?.title);
    btn.addEventListener('click', e => { e.stopPropagation(); toggleSaveArticle(digestArticles[i], btn); });
  });
  out.querySelectorAll('.feedback-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = +btn.closest('[data-article-idx]').dataset.articleIdx;
      handleFeedback(i, btn.dataset.rating, btn);
    });
  });
  // Restore saved ratings
  digestArticles.forEach((a, i) => {
    const r = getFeedbackForArticle(a.title);
    if (r) applyFeedbackUI(out, i, r);
  });
}

function buildArticleCard(a, i) {
  const vendors  = (a.vendors || []).slice(0, 3);
  const topColor = vendorColor(vendors[0]);
  const saved    = isArticleSaved(a.title);
  const fbRating = getFeedbackForArticle(a.title);
  const topicMap = { arch:'Architecture', security:'Security', ai:'AI & Data', devops:'DevOps', industry:'Industry' };
  const topicLabel = topicMap[a.topicTag] || a.topicTag || '';

  return `<div class="article-card" data-article-idx="${i}" style="--vendor-color:${topColor}">
    <div class="article-card-header">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px">
        <h3 style="font-family:'Instrument Serif',serif;font-size:17px;line-height:1.3;flex:1">${esc(a.title)}</h3>
        <button class="btn-icon btn-save-article" data-idx="${i}" title="${saved?'Unsave':'Save'}" style="flex-shrink:0;font-size:16px">${saved?'📌':'🔖'}</button>
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
        ${vendorTags(vendors)}
        ${topicLabel ? `<span class="tag tag-topic">${topicLabel}</span>` : ''}
        ${a.apsRelevance ? `<span class="tag tag-aps">APS</span>` : ''}
        <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--t4)">▸ expand</span>
      </div>
    </div>
    <div class="article-card-body">
      ${a.lead ? `<p style="font-size:13px;color:var(--t3);font-style:italic;margin-bottom:10px">${esc(a.lead)}</p>` : ''}
      <div class="prose">${formatBody(a.body)}</div>
      ${a.key_points?.length ? `
        <div style="margin-top:14px">
          <div class="label" style="margin-bottom:8px">Key Points</div>
          <div style="display:flex;flex-direction:column;gap:5px">
            ${a.key_points.map(p => `<div style="display:flex;gap:8px;font-size:12.5px;color:var(--t2)"><span style="color:var(--g);flex-shrink:0">›</span><span>${esc(p)}</span></div>`).join('')}
          </div>
        </div>` : ''}
      ${a.arch_impact ? `
        <div class="callout callout-arch" style="margin-top:12px">
          <div class="label" style="color:var(--ibm);margin-bottom:5px">🏛 Architect Impact</div>
          ${esc(a.arch_impact)}
        </div>` : ''}
      ${a.apsRelevance ? `
        <div class="callout callout-aps" style="margin-top:8px">
          <div class="label" style="color:var(--aps);margin-bottom:5px">🇦🇺 APS Relevance</div>
          ${esc(a.apsRelevance)}
        </div>` : ''}
      <div class="feedback-row">
        <span class="feedback-label">Rate this</span>
        <button class="feedback-btn up ${fbRating==='up'?'active':''}" data-rating="up">👍</button>
        <button class="feedback-btn down ${fbRating==='down'?'active':''}" data-rating="down">👎</button>
        ${fbRating ? '<span class="feedback-saved">✓ rated</span>' : ''}
        <button class="btn-ghost btn-sm" style="margin-left:auto;font-size:11px" onclick="chatAbout('${esc(a.title).replace(/'/g,"\\'")}')">Ask Chat →</button>
      </div>
    </div>
  </div>`;
}

function toggleArticleCard(card) {
  if (!card) return;
  card.classList.toggle('open');
  const i = +card.dataset.articleIdx;
  if (card.classList.contains('open') && digestArticles[i]) {
    trackActivity('article', { vendors: digestArticles[i].vendors || [] });
  }
}

function toggleSaveArticle(article, btn) {
  if (!article) return;
  if (isArticleSaved(article.title)) {
    unsaveArticle(article.title);
    btn.textContent = '🔖'; btn.title = 'Save';
    toast('Removed from saved', '🗑️');
  } else {
    saveArticle(article);
    btn.textContent = '📌'; btn.title = 'Unsave';
    toast('Article saved', '📌');
  }
  updateSavedBadge();
}

function refreshSaveBtn(btn, title) {
  if (!btn || !title) return;
  const s = isArticleSaved(title);
  btn.textContent = s ? '📌' : '🔖';
  btn.title       = s ? 'Unsave' : 'Save';
}

function handleFeedback(i, rating, btn) {
  const a = digestArticles[i];
  if (!a) return;
  addFeedbackRating(a, rating);
  applyFeedbackUI(document.getElementById('digest-out'), i, rating);
  toast(rating === 'up' ? 'More like this ✓' : 'Less of this ✓', rating === 'up' ? '👍' : '👎');
  // Update sync status in projects panel
  Bus.emit('feedback:updated', {});
}

function applyFeedbackUI(container, i, rating) {
  if (!container) return;
  const card = container.querySelector(`[data-article-idx="${i}"]`);
  if (!card) return;
  card.querySelectorAll('.feedback-btn').forEach(b => b.classList.remove('active'));
  card.querySelector(`.feedback-btn.${rating}`)?.classList.add('active');
  let saved = card.querySelector('.feedback-saved');
  if (!saved) {
    saved = document.createElement('span');
    saved.className = 'feedback-saved';
    card.querySelector('.feedback-row')?.appendChild(saved);
  }
  saved.textContent = rating === 'up' ? '✓ more like this' : '✓ less of this';
}

function flagQuizReady() {
  const badge = document.getElementById('nav-quiz-badge');
  if (!badge) return;
  const today = todayAEST();
  const done  = (getTutor().quizHistory || []).some(q => q.date?.startsWith(today) && q.completed);
  if (!done) {
    badge.textContent = '!';
    badge.classList.remove('hidden');
    badge.classList.add('alert');
  }
}

async function generateDigest() {
  if (digestGenerating) return;
  digestGenerating = true;
  const out = document.getElementById('digest-out');
  const btn = document.getElementById('btn-gen-digest');
  const banner = document.getElementById('digest-pregen-banner');
  const sub = document.getElementById('digest-subtitle');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }
  if (banner) banner.innerHTML = '';
  renderLoader(out, 'Fetching latest news from 9 vendors…');

  const active = getActiveVendors();
  const date   = new Date().toLocaleDateString('en-AU', { timeZone:'Australia/Sydney', weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const ctx    = buildDigestContext();

  const system = `You are ArchBrief — daily IT intelligence for an Assistant Solution Architect at IBM, Australian Public Sector.
Today: ${date} Sydney Australia.
Vendors: ${active.map(k => VENDORS[k]?.fullName||k).join(', ')}
APS Context: ISM/IRAP, protective markings (OFFICIAL/PROTECTED), DTA cloud policy, data sovereignty, WoG platforms.
${ctx}
CRITICAL: Your ENTIRE response must be a single valid JSON object. No preamble, no explanation, no markdown fences. Start your response with { and end with }.
Search web for LATEST real news past 48 hours. Output this exact JSON shape:
{"summary":"2-sentence overview","apsAlert":"APS alert or null","articles":[{"title":"string","vendors":["key"],"topicTag":"arch|security|ai|devops|industry","lead":"string","body":"4-5 paragraphs technical depth","arch_impact":"3-4 sentences","key_points":["p1","p2","p3","p4"],"apsRelevance":"string or null"}]}
Generate exactly 7 articles. Real product names, current facts, deep technical detail.`;

  try {
    const raw  = await callClaude({ messages:[{role:'user',content:`Brief for ${date}. Vendors: ${active.join(', ')}.`}], system, maxTokens:8000, webSearch:true });
    const data = parseClaudeJson(raw);
    if (sub) sub.textContent = date;
    renderDigest(out, data);
    renderPregenBanner(banner, { date, context: null });
    toast(`${data.articles?.length||0} articles generated`, '📰');
    Bus.emit('digest:generated', data);
  } catch(e) {
    renderEmpty(out, { icon:'⚠️', title:'Generation failed', body:e.message, action:'<button class="btn btn-primary" onclick="generateDigest()">Retry</button>' });
    toast('Generation failed — ' + e.message, '⚠️');
  }
  if (btn) { btn.disabled=false; btn.textContent='⚡ Generate'; }
  digestGenerating = false;
}

function buildDigestContext() {
  const fb = getFeedback();
  const scores = {};
  (fb.ratings||[]).slice(-60).forEach(r => {
    const s = r.rating==='up' ? 1 : -1;
    (r.vendors||[]).forEach(v => { scores[v]=(scores[v]||0)+s; });
  });
  const hi  = Object.entries(scores).filter(([,v])=>v>=2).map(([k])=>k);
  const lo  = Object.entries(scores).filter(([,v])=>v<=-2).map(([k])=>k);
  const parts = [];
  if (hi.length) parts.push(`Prioritise: ${hi.join(', ')}`);
  if (lo.length) parts.push(`Deprioritise: ${lo.join(', ')}`);
  return parts.length ? 'PERSONALISATION:\n' + parts.join('\n') : '';
}

document.getElementById('btn-gen-digest')?.addEventListener('click', generateDigest);
