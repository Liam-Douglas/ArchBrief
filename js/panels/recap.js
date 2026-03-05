/* ArchBrief v5 — recap.js — Weekly Recap */
let recapGenerating = false;
Bus.on('panel:activated', ({id}) => { if(id==='recap') initRecap(); });
function initRecap() {
  const out=document.getElementById('recap-out'), daily=getDailyData();
  if(!out) return;
  const weekly=daily?.weeklySummary||daily?.weekly_summary;
  if(weekly?.topStories?.length) { renderRecap(out,weekly); }
  else renderEmpty(out,{icon:'📊',title:'Weekly Recap',body:'Generated each Friday at 5am — or generate now for a summary of recent coverage.',action:'<button class="btn btn-primary" onclick="generateRecap()">⚡ Generate</button>'});
}
function renderRecap(out,weekly) {
  if(!out||!weekly) return;
  let html='';
  if(weekly.weekHeadline) html+=`<div style="padding:16px 18px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-lg);margin-bottom:18px"><div style="font-family:'Instrument Serif',serif;font-size:22px;line-height:1.3">${esc(weekly.weekHeadline)}</div></div>`;
  if(weekly.weekStats) {
    const s=weekly.weekStats;
    html+=`<div class="stat-row" style="margin-bottom:18px">
      ${s.articleCount!==undefined?`<div class="stat"><div class="stat-value">${s.articleCount}</div><div class="stat-label">Articles</div></div>`:''}
      ${s.vendorCount!==undefined?`<div class="stat"><div class="stat-value">${s.vendorCount}</div><div class="stat-label">Vendors covered</div></div>`:''}
      ${s.feedbackUp!==undefined?`<div class="stat"><div class="stat-value">${s.feedbackUp}</div><div class="stat-label">👍 ratings</div></div>`:''}
    </div>`;
  }
  if(weekly.topStories?.length) {
    html+=`<div style="margin-bottom:18px"><div class="label" style="margin-bottom:10px">Top Stories This Week</div>
      ${weekly.topStories.map(s=>`<div style="padding:12px 14px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:8px">
        <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:6px">
          ${vendorTags((s.vendors||[]).slice(0,2))}
          <div style="font-size:13px;font-weight:500;flex:1">${esc(s.title||'')}</div>
        </div>
        <div style="font-size:12.5px;color:var(--t3)">${esc(s.why||s.relevance||'')}</div>
      </div>`).join('')}
    </div>`;
  }
  if(weekly.vendorHighlights?.length) {
    html+=`<div style="margin-bottom:18px"><div class="label" style="margin-bottom:10px">Vendor Highlights</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
        ${weekly.vendorHighlights.map(v=>`<div class="card card-sm" style="border-left:3px solid ${vendorColor(v.vendor)}">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${vendorColor(v.vendor)};margin-bottom:5px">${esc(v.label||vendorLabel(v.vendor))}</div>
          <div style="font-size:12.5px;color:var(--t2);line-height:1.6">${esc(v.highlight||'')}</div>
        </div>`).join('')}
      </div>
    </div>`;
  }
  if(weekly.apsWeekly) html+=`<div class="callout callout-aps" style="margin-bottom:14px"><div class="label" style="color:var(--aps);margin-bottom:6px">🇦🇺 APS Week</div>${esc(weekly.apsWeekly)}</div>`;
  if(weekly.nextWeekWatch?.length) {
    html+=`<div style="margin-bottom:14px"><div class="label" style="margin-bottom:10px">Watch Next Week</div>
      ${weekly.nextWeekWatch.map(w=>`<div style="display:flex;gap:8px;font-size:13px;color:var(--t2);margin-bottom:6px"><span style="color:var(--aws);flex-shrink:0">→</span><span>${esc(w)}</span></div>`).join('')}
    </div>`;
  }
  out.innerHTML=html;
}
async function generateRecap() {
  if(recapGenerating) return; recapGenerating=true;
  const out=document.getElementById('recap-out'), btn=document.getElementById('btn-gen-recap');
  if(btn){btn.disabled=true;btn.textContent='⏳ Generating…';}
  renderLoader(out,'Summarising the week…');
  const system=`You are ArchBrief weekly summariser for APS Solution Architect. Return ONLY valid JSON:
{"weekHeadline":"string","topStories":[{"title":"string","vendors":["key"],"why":"string"}],"vendorHighlights":[{"vendor":"key","label":"string","highlight":"string"}],"apsWeekly":"string","nextWeekWatch":["string","string","string"],"weekStats":{"articleCount":35,"vendorCount":9}}`;
  try {
    const raw=await callClaude({messages:[{role:'user',content:'Weekly recap for APS Solution Architect — key stories, vendor highlights, APS developments.'}],system,maxTokens:2500,webSearch:true});
    const data=parseClaudeJson(raw);
    renderRecap(out,data);
    toast('Weekly recap ready','📊');
  } catch(e) { renderEmpty(out,{icon:'⚠️',title:'Failed',body:e.message,action:'<button class="btn btn-primary" onclick="generateRecap()">Retry</button>'}); }
  if(btn){btn.disabled=false;btn.textContent='⚡ Generate';}
  recapGenerating=false;
}
document.getElementById('btn-gen-recap')?.addEventListener('click',generateRecap);
