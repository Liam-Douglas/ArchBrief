/* ArchBrief v5 — compare.js — Vendor Compare */
let compareGenerating = false;
const COMPARE_TOPICS = ['Security & Compliance','AI & Machine Learning','Pricing & Commercial','APS Suitability','Developer Experience','Data Sovereignty','Support & SLAs','Migration Ease','Certifications','Open Standards'];
Bus.on('panel:activated', ({id}) => { if(id==='compare') initCompare(); });
function initCompare() {
  const out=document.getElementById('compare-out');
  if(!out||out.dataset.init) return;
  out.dataset.init='1';
  const active=getActiveVendors();
  let selectedVendors=active.slice(0,3), selectedTopic=COMPARE_TOPICS[0];
  function buildUI() {
    out.innerHTML = `
      <div style="margin-bottom:16px">
        <div class="label" style="margin-bottom:8px">Select vendors (2–4)</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap" id="compare-vendor-picks">
          ${active.map(k=>{const v=VENDORS[k];const on=selectedVendors.includes(k);return `<button class="pill ${on?'active':''}" id="cvp-${k}" style="${on?`border-color:${v.color};background:${v.color}15;color:${v.color}`:''}" onclick="toggleCompareVendor('${k}')">${v.label}</button>`;}).join('')}
        </div>
      </div>
      <div style="margin-bottom:16px">
        <div class="label" style="margin-bottom:8px">Compare on</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${COMPARE_TOPICS.map(t=>`<button class="pill ${t===selectedTopic?'active':''}" onclick="setCompareTopic('${t}',this)">${t}</button>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary" id="btn-run-compare" onclick="runCompare()">⚡ Compare</button>
      <div id="compare-result" style="margin-top:20px"></div>`;
    window._compareState = { selectedVendors, selectedTopic };
  }
  window.toggleCompareVendor = (k) => {
    const s=window._compareState;
    const i=s.selectedVendors.indexOf(k);
    if(i===-1){ if(s.selectedVendors.length<4) s.selectedVendors.push(k); else { toast('Max 4 vendors','⚠️'); return; }}
    else if(s.selectedVendors.length>2) s.selectedVendors.splice(i,1);
    else { toast('Select at least 2','ℹ️'); return; }
    const v=VENDORS[k], btn=document.getElementById('cvp-'+k), on=s.selectedVendors.includes(k);
    btn?.classList.toggle('active',on);
    if(btn) btn.style.cssText=on?`border-color:${v.color};background:${v.color}15;color:${v.color}`:'';
  };
  window.setCompareTopic = (t,el) => {
    window._compareState.selectedTopic=t;
    document.querySelectorAll('#compare-out .pill').forEach(b=>b.classList.remove('active'));
    el?.classList.add('active');
  };
  buildUI();
}
async function runCompare() {
  if(compareGenerating) return; compareGenerating=true;
  const {selectedVendors,selectedTopic}=window._compareState||{};
  if(!selectedVendors?.length) { toast('Select vendors first','⚠️'); compareGenerating=false; return; }
  const result=document.getElementById('compare-result'), btn=document.getElementById('btn-run-compare');
  if(btn){btn.disabled=true;btn.textContent='⏳ Comparing…';}
  renderLoader(result,'Comparing vendors…');
  const system=`You are ArchBrief vendor analyst for APS Solution Architect. RESPOND WITH ONLY A JSON OBJECT. No prose, no markdown. Start with { end with }. Shape:
{"topic":"string","summary":"2-3 sentence overview","vendors":[{"key":"string","label":"string","score":8,"verdict":"1 sentence","strengths":["s1","s2","s3"],"weaknesses":["w1","w2"],"apsNote":"APS-specific note or null"}],"recommendation":"2-3 sentences on which to choose and why for APS context","apsContext":"1-2 sentences on government-specific considerations"}`;
  try {
    const vLabels=selectedVendors.map(k=>VENDORS[k]?.fullName||k);
    const raw=await callClaude({messages:[{role:'user',content:`Compare ${vLabels.join(' vs ')} on: ${selectedTopic}. APS context.`}],system,maxTokens:2000,webSearch:true});
    const data=parseClaudeJson(raw);
    renderCompare(result,data);
  } catch(e) { result.innerHTML=`<div class="callout callout-warn">${e.message}</div>`; }
  if(btn){btn.disabled=false;btn.textContent='⚡ Compare';}
  compareGenerating=false;
}
function renderCompare(out,data) {
  if(!out||!data) return;
  const cols=data.vendors||[];
  out.innerHTML = `
    <div style="margin-bottom:16px;padding:14px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-lg)">
      <div style="font-family:'Instrument Serif',serif;font-size:20px;margin-bottom:6px">${esc(data.topic||'')}</div>
      <div style="font-size:13px;color:var(--t2);line-height:1.7">${esc(data.summary||'')}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(${cols.length},1fr);gap:10px;margin-bottom:14px">
      ${cols.map(v=>{const vc=vendorColor(v.key);return `<div class="card" style="border-top:3px solid ${vc}">
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${vc};margin-bottom:4px">${esc(v.label||v.key)}</div>
        <div style="font-family:'Instrument Serif',serif;font-size:28px;color:${vc};margin-bottom:2px">${v.score||'?'}<span style="font-size:14px;color:var(--t4)">/10</span></div>
        <div style="font-size:12px;color:var(--t3);margin-bottom:10px">${esc(v.verdict||'')}</div>
        <div class="label" style="margin-bottom:5px">Strengths</div>
        ${(v.strengths||[]).map(s=>`<div style="font-size:11.5px;color:var(--g);margin-bottom:3px">✓ ${esc(s)}</div>`).join('')}
        <div class="label" style="margin:8px 0 5px">Weaknesses</div>
        ${(v.weaknesses||[]).map(w=>`<div style="font-size:11.5px;color:var(--red);margin-bottom:3px">✗ ${esc(w)}</div>`).join('')}
        ${v.apsNote?`<div class="callout callout-aps" style="margin-top:8px;font-size:11.5px">🇦🇺 ${esc(v.apsNote)}</div>`:''}
      </div>`}).join('')}
    </div>
    ${data.recommendation?`<div class="callout callout-green"><div class="label" style="color:var(--g);margin-bottom:6px">Recommendation</div>${esc(data.recommendation)}</div>`:''}
    ${data.apsContext?`<div class="callout callout-aps" style="margin-top:8px"><div class="label" style="color:var(--aps);margin-bottom:6px">🇦🇺 APS Context</div>${esc(data.apsContext)}</div>`:''}
    <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="chatAbout('${esc(data.topic||'').replace(/'/g,"\\'")} vendor comparison')">Discuss in Chat →</button>`;
}
