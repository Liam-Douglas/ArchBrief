/* ArchBrief v5 — explorer.js — Topic Explorer */
let explorerArticles = [], explorerGenerating = false;
Bus.on('panel:activated', ({id}) => { if(id==='explorer') initExplorer(); });
Bus.on('daily:loaded', () => { if(AppState.currentPanel==='explorer') initExplorer(); });
function initExplorer() {
  const out=document.getElementById('explorer-out'), daily=getDailyData();
  if(!out) return;
  if(daily?.explorer?.articles?.length) { renderExplorer(out,daily.explorer); }
  else renderEmpty(out,{icon:'🗂',title:'No explorer content yet',body:'Five deep-dives generated alongside your daily digest.',action:'<button class="btn btn-primary" onclick="generateExplorer()">⚡ Generate</button>'});
}
function renderExplorer(out,explorer) {
  if(!out||!explorer) return;
  explorerArticles = explorer.articles||[];
  const nav = explorerArticles.map((a,i)=>{
    const c=vendorColor((a.vendors||[])[0]);
    return `<button class="pill ${i===0?'active':''}" id="ex-nav-${i}" style="${i===0?`border-color:${c};background:${c}15;color:${c}`:''}" onclick="selectExplorer(${i})">${esc(a.title.length>38?a.title.slice(0,35)+'…':a.title)}</button>`;
  }).join('');
  out.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px">${nav}</div><div id="explorer-article"></div>`;
  selectExplorer(0);
}
function selectExplorer(idx) {
  explorerArticles.forEach((_,i)=>{
    const btn=document.getElementById(`ex-nav-${i}`); if(!btn) return;
    if(i===idx){ const c=vendorColor((explorerArticles[i].vendors||[])[0]); btn.classList.add('active'); btn.style.cssText=`border-color:${c};background:${c}15;color:${c}`; }
    else { btn.classList.remove('active'); btn.style.cssText=''; }
  });
  const a=explorerArticles[idx], out=document.getElementById('explorer-article');
  if(!a||!out) return;
  const vendors=(a.vendors||[]).slice(0,4), saved=isArticleSaved(a.title);
  out.innerHTML = `<div class="card" style="border-top:2px solid ${vendorColor(vendors[0])}50">
    <div style="padding:18px 20px 0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">
        <h2 style="font-family:'Instrument Serif',serif;font-size:22px;line-height:1.3;flex:1">${esc(a.title)}</h2>
        <button class="btn-icon" id="ex-save-btn" style="font-size:18px;flex-shrink:0" onclick="toggleExSave(${idx})">${saved?'📌':'🔖'}</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
        ${vendorTags(vendors)}${a.apsRelevance?'<span class="tag tag-aps">APS</span>':''}${a.readTime?`<span class="tag tag-topic">~${a.readTime}min</span>`:''}
      </div>
    </div>
    <div style="height:1px;background:var(--border);margin:0 20px"></div>
    <div style="padding:18px 20px">
      ${a.lead?`<p style="font-size:15px;color:var(--t2);font-style:italic;line-height:1.7;margin-bottom:16px">${esc(a.lead)}</p>`:''}
      <div class="prose">${formatBody(a.body)}</div>
      ${(a.sections||[]).map(s=>`<div style="margin-top:20px"><h4 style="font-family:'Instrument Serif',serif;font-size:16px;margin-bottom:8px">${esc(s.heading)}</h4><div class="prose">${formatBody(s.content)}</div></div>`).join('')}
      ${a.key_points?.length?`<div style="margin-top:18px;padding:14px 16px;background:var(--s2);border-radius:var(--r-md)"><div class="label" style="margin-bottom:10px">Key Takeaways</div>${a.key_points.map(p=>`<div style="display:flex;gap:8px;font-size:13px;color:var(--t2);margin-bottom:5px"><span style="color:var(--g);flex-shrink:0">›</span><span>${esc(p)}</span></div>`).join('')}</div>`:''}
      ${a.arch_impact?`<div class="callout callout-arch" style="margin-top:14px"><div class="label" style="color:var(--ibm);margin-bottom:6px">🏛 Architect Implications</div>${formatBody(a.arch_impact)}</div>`:''}
      ${a.apsRelevance?`<div class="callout callout-aps" style="margin-top:10px"><div class="label" style="color:var(--aps);margin-bottom:6px">🇦🇺 APS</div>${esc(a.apsRelevance)}</div>`:''}
      <div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="chatAbout('${esc(a.title).replace(/'/g,"\\'")} deep dive')">Explore in Chat →</button>
        ${idx<explorerArticles.length-1?`<button class="btn btn-ghost btn-sm" onclick="selectExplorer(${idx+1})">Next →</button>`:''}
      </div>
    </div>
  </div>`;
  trackActivity('article',{vendors});
}
function toggleExSave(idx){ toggleSaveArticle(explorerArticles[idx],document.getElementById('ex-save-btn')); }
async function generateExplorer() {
  if(explorerGenerating) return; explorerGenerating=true;
  const out=document.getElementById('explorer-out'), btn=document.getElementById('btn-gen-explorer');
  if(btn){btn.disabled=true;btn.textContent='⏳ Generating…';}
  renderLoader(out,'Writing deep-dives…');
  const active=getActiveVendors();
  const system=`You are ArchBrief deep-dive writer for APS Solution Architect. RESPOND WITH ONLY A JSON OBJECT. No prose, no markdown. Start with { end with }. Shape:
{"articles":[{"title":"string","vendors":["key"],"lead":"hook","body":"6-8 paragraphs","sections":[{"heading":"string","content":"2-3 paragraphs"}],"key_points":["p1","p2","p3","p4","p5"],"arch_impact":"3-4 sentences","apsRelevance":"string or null","readTime":8}]}
5 articles, varied vendors, expert depth.`;
  try {
    const raw=await callClaude({messages:[{role:'user',content:`5 deep-dives, vendors: ${active.join(',')}`}],system,maxTokens:5000,webSearch:true});
    const data=parseClaudeJson(raw);
    renderExplorer(out,data);
    toast(`${data.articles?.length||0} deep-dives ready`,'🗂');
  } catch(e) { renderEmpty(out,{icon:'⚠️',title:'Failed',body:e.message,action:'<button class="btn btn-primary" onclick="generateExplorer()">Retry</button>'}); }
  if(btn){btn.disabled=false;btn.textContent='⚡ Generate';}
  explorerGenerating=false;
}
document.getElementById('btn-gen-explorer')?.addEventListener('click',generateExplorer);
