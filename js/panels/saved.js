/* ArchBrief v5 — saved.js — Saved Articles */
Bus.on('panel:activated', ({id}) => { if(id==='saved') renderSaved(); });
Bus.on('feedback:updated', () => { if(AppState.currentPanel==='saved') renderSaved(); });
function renderSaved() {
  const out=document.getElementById('saved-out'), items=getSaved();
  const sub=document.getElementById('saved-subtitle');
  if(sub) sub.textContent=`${items.length} saved article${items.length!==1?'s':''}`;
  if(!out) return;
  if(!items.length){ renderEmpty(out,{icon:'📌',title:'Nothing saved yet',body:'Click the bookmark icon on any article to save it for later.'}); return; }
  out.innerHTML=items.map((a,i)=>{
    const vendors=(a.vendors||[]).slice(0,3);
    const color=vendorColor(vendors[0]);
    return `<div class="article-card" style="--vendor-color:${color}">
      <div class="article-card-header" onclick="toggleSavedCard(this.closest('.article-card'))">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px">
          <h3 style="font-family:'Instrument Serif',serif;font-size:16px;line-height:1.3;flex:1">${esc(a.title)}</h3>
          <button class="btn-icon" onclick="event.stopPropagation();removeSaved('${esc(a.title).replace(/'/g,"\\'")}',this)" title="Remove" style="font-size:16px;flex-shrink:0">✕</button>
        </div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
          ${vendorTags(vendors)}
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--t4);margin-left:auto">${new Date(a.savedAt||Date.now()).toLocaleDateString('en-AU')}</span>
        </div>
      </div>
      <div class="article-card-body">
        ${a.lead?`<p style="font-size:13px;color:var(--t3);font-style:italic;margin-bottom:10px">${esc(a.lead)}</p>`:''}
        <div class="prose">${formatBody(a.body||'')}</div>
        ${a.arch_impact?`<div class="callout callout-arch" style="margin-top:10px"><div class="label" style="color:var(--ibm);margin-bottom:4px">🏛 Architect Impact</div>${esc(a.arch_impact)}</div>`:''}
        <div style="margin-top:12px">
          <button class="btn btn-ghost btn-sm" onclick="chatAbout('${esc(a.title).replace(/'/g,"\\'")}')">Ask Chat →</button>
        </div>
      </div>
    </div>`;
  }).join('');
  out.querySelectorAll('.article-card-header').forEach(h=>h.addEventListener('click',()=>h.closest('.article-card')?.classList.toggle('open')));
}
function toggleSavedCard(card){ card?.classList.toggle('open'); }
function removeSaved(title,btn) {
  unsaveArticle(title);
  btn?.closest('.article-card')?.remove();
  updateSavedBadge();
  const items=getSaved();
  const sub=document.getElementById('saved-subtitle');
  if(sub) sub.textContent=`${items.length} saved article${items.length!==1?'s':''}`;
  if(!items.length) renderSaved();
  toast('Removed from saved','🗑️');
}
document.getElementById('btn-clear-saved')?.addEventListener('click',()=>{
  if(!confirm('Clear all saved articles?')) return;
  const d=getTutor(); d.savedArticles=[]; saveTutor(d);
  renderSaved(); updateSavedBadge(); toast('Saved articles cleared','🗑️');
});
