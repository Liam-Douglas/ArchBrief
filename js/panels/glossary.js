/* ArchBrief v5 — glossary.js — Glossary */
Bus.on('panel:activated', ({id}) => { if(id==='glossary') renderGlossaryPanel(); });
function renderGlossaryPanel(searchQ='') {
  const out=document.getElementById('glossary-out'); if(!out) return;
  buildGlossaryFilters();
  const activeCat=document.querySelector('#glossary-filters .pill.active')?.dataset.cat;
  let items=getGlossary();
  if(activeCat&&activeCat!=='all') items=items.filter(g=>g.category===activeCat);
  if(searchQ) { const q=searchQ.toLowerCase(); items=items.filter(g=>g.term?.toLowerCase().includes(q)||g.plain?.toLowerCase().includes(q)||g.category?.toLowerCase().includes(q)); }
  if(!items.length) { renderEmpty(out,{icon:'📖',title:searchQ?'No matches':'Glossary empty',body:searchQ?'Try a different search.':'Click any word in an article to explain it and save it here.'}); return; }
  out.innerHTML=`<div class="glossary-grid">${items.map(g=>{
    const color=Object.values(VENDORS).find(v=>g.category?.toLowerCase().includes(v.label.toLowerCase()))?.color||'var(--g)';
    return `<div class="gloss-item" onclick="showGlossDetail('${esc(g.term||'').replace(/'/g,"\\'")}')">
      <div class="gloss-item-header">
        <div class="gloss-term">${esc(g.term||'')}</div>
        <span class="tag tag-vendor" style="--vendor-color:${color}">${esc(g.category||'')}</span>
        <span class="gloss-count">${g.lookupCount||1}× looked up</span>
      </div>
      <div class="gloss-plain">${esc((g.plain||'').substring(0,140))}${(g.plain||'').length>140?'…':''}</div>
    </div>`;
  }).join('')}</div>`;
}
function buildGlossaryFilters() {
  const el=document.getElementById('glossary-filters'); if(!el||el.dataset.built) return;
  el.dataset.built='1';
  const cats=['all','Cloud','Security','AI','DevOps','APS','Networking','Database','Platform'];
  el.innerHTML=cats.map(c=>`<button class="pill ${c==='all'?'active':''}" data-cat="${c}"
    onclick="document.querySelectorAll('#glossary-filters .pill').forEach(b=>b.classList.remove('active'));this.classList.add('active');renderGlossaryPanel(document.getElementById('glossary-search')?.value||'')"
  >${c==='all'?'All':c}</button>`).join('');
}
function showGlossDetail(term) {
  const g=getGlossary().find(x=>x.term===term); if(!g) return;
  const popup=document.createElement('div');
  popup.id='explainer-popup';
  popup.className='explainer-popup';
  popup.style.cssText='left:50%;top:50%;transform:translate(-50%,-50%)';
  popup.innerHTML=`
    <button class="ep-close" onclick="document.getElementById('explainer-popup')?.remove()">✕</button>
    <div class="ep-term">${esc(g.term)}</div>
    <div class="ep-category"><span class="tag tag-topic">${esc(g.category||'')}</span></div>
    <div class="ep-plain">${esc(g.plain||'')}</div>
    <div class="ep-section">Solution Architect Context</div>
    <div class="callout callout-arch">${esc(g.architectContext||'')}</div>
    ${g.apsNote?`<div class="ep-section">🇦🇺 APS</div><div class="callout callout-aps">${esc(g.apsNote)}</div>`:''}
    <div style="margin-top:10px;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--t4)">Added ${new Date(g.addedAt||Date.now()).toLocaleDateString('en-AU')} · ${g.lookupCount||1}× looked up</div>
    <div class="ep-actions">
      <button class="btn btn-secondary btn-sm" onclick="document.getElementById('explainer-popup')?.remove();chatAbout('${esc(g.term).replace(/'/g,"\\'")} deep dive')">Ask Chat →</button>
      <button class="btn btn-danger btn-sm" onclick="removeGlossaryEntry('${esc(g.term).replace(/'/g,"\\'")}');document.getElementById('explainer-popup')?.remove();renderGlossaryPanel();updateGlossaryBadge()">Remove</button>
    </div>`;
  document.body.appendChild(popup);
}
function updateGlossaryBadge() { const el=document.getElementById('nav-glossary-badge'); if(el) el.textContent=getGlossary().length; }
function exportGlossaryMd() {
  const items=getGlossary(); if(!items.length){toast('Glossary is empty','ℹ️');return;}
  const md=`# ArchBrief Glossary\n_${items.length} terms · ${new Date().toLocaleDateString('en-AU')}_\n\n`+
    items.map(g=>`## ${g.term}\n**Category:** ${g.category||''}\n**Plain English:** ${g.plain||''}\n**Architect Context:** ${g.architectContext||''}\n${g.apsNote?`**APS:** ${g.apsNote}\n`:''}`).join('\n---\n\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([md],{type:'text/markdown'}));
  a.download='archbrief-glossary.md';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast(`Exported ${items.length} terms`,'📖');
}
document.getElementById('glossary-search')?.addEventListener('input',e=>renderGlossaryPanel(e.target.value));
document.getElementById('btn-export-glossary')?.addEventListener('click',exportGlossaryMd);
