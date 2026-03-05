/* ArchBrief v5 — scenarios.js — Scenario Challenges */
let scenarioGenerating=false, currentScenarios=[];
Bus.on('panel:activated', ({id}) => { if(id==='scenarios') initScenarios(); });
function initScenarios() {
  const out=document.getElementById('scenarios-out');
  if(!out||out.dataset.init) return;
  out.dataset.init='1';
  renderEmpty(out,{icon:'⚔️',title:'Architecture Challenges',body:'Real APS decisions. Write your approach — get expert-level feedback.',action:'<button class="btn btn-primary btn-lg" onclick="genScenarios()">⚡ Generate Scenarios</button>'});
}
async function genScenarios() {
  if(scenarioGenerating) return; scenarioGenerating=true;
  const out=document.getElementById('scenarios-out'), btn=document.getElementById('btn-gen-scenarios');
  if(btn){btn.disabled=true;btn.textContent='⏳ Generating…';}
  renderLoader(out,'Building architecture challenges…');

  const d=getTutor(), prog=d.moduleProgress||{};
  const started=LP_DOMAINS.flatMap(dom=>dom.modules).filter(m=>prog[m.id]&&prog[m.id]!=='not-started').map(m=>m.name).slice(0,5).join(', ')||'Cloud Foundations';
  const active=getActiveVendors();

  const system=`Scenario challenge generator for APS Solution Architect at IBM. Return ONLY valid JSON:
{"scenarios":[{
  "title":"string","difficulty":"intermediate|advanced|expert",
  "vendors":["keys"],"apsClassification":"OFFICIAL|PROTECTED",
  "context":"2-3 sentences — agency, environment, constraints",
  "question":"The specific architecture decision to solve",
  "constraints":["c1","c2","c3"],
  "hints":["h1","h2"],
  "modelAnswer":"3-4 paragraphs — approach, rationale, trade-offs, APS considerations"
}]}
3 scenarios. Vary difficulty. One PROTECTED. Ground in real APS contexts. Genuinely challenging.`;
  try {
    const raw=await callClaude({messages:[{role:'user',content:`Scenarios for APS architect. Modules: ${started}. Vendors: ${active.join(', ')}.`}],system,maxTokens:3000,webSearch:false});
    const data=parseClaudeJson(raw);
    currentScenarios=data.scenarios||[];
    renderScenarios(out,currentScenarios);
    toast(`${currentScenarios.length} scenarios generated`,'⚔️');
  } catch(e) { renderEmpty(out,{icon:'⚠️',title:'Failed',body:e.message,action:'<button class="btn btn-primary" onclick="genScenarios()">Retry</button>'}); }
  if(btn){btn.disabled=false;btn.textContent='⚡ Generate';}
  scenarioGenerating=false;
}
function renderScenarios(out,scenarios) {
  if(!out||!scenarios) return;
  out.innerHTML=scenarios.map((s,i)=>{
    const diffColors={'intermediate':'var(--aws)','advanced':'var(--red)','expert':'#c084fc'};
    const diffBgs={'intermediate':'rgba(255,153,0,.1)','advanced':'rgba(255,77,106,.1)','expert':'rgba(192,132,252,.1)'};
    const dc=diffColors[s.difficulty]||'var(--t3)', db=diffBgs[s.difficulty]||'var(--s3)';
    return `<div class="scenario-card" id="sc-${i}">
      <div class="sc-header" onclick="toggleScenario(${i})">
        <div class="sc-difficulty" style="background:${db};color:${dc}">${s.difficulty||'intermediate'}</div>
        <div class="sc-title">${esc(s.title||'')}</div>
        <div class="sc-meta">
          ${(s.vendors||[]).map(v=>`<span style="color:${vendorColor(v)};font-family:'JetBrains Mono',monospace;font-size:9px">${vendorLabel(v)}</span>`).join(' · ')}
          <span class="${s.apsClassification==='PROTECTED'?'mark-protected':'mark-official'}">${s.apsClassification||'OFFICIAL'}</span>
        </div>
      </div>
      <div class="sc-body">
        <div class="sc-context">${esc(s.context||'')}</div>
        <div class="sc-question">🏛 ${esc(s.question||'')}</div>
        <div style="margin-bottom:12px">
          ${(s.constraints||[]).map(c=>`<div class="sc-constraint"><span style="color:var(--aws);flex-shrink:0">⚠</span><span>${esc(c)}</span></div>`).join('')}
        </div>
        <div style="margin-bottom:10px">
          <div class="label" style="margin-bottom:7px">Your Approach</div>
          <textarea class="textarea" id="sc-ans-${i}" placeholder="Write your architecture approach — vendor selection, security controls, APS compliance, trade-offs, migration strategy…" style="min-height:130px"></textarea>
        </div>
        <details style="margin-bottom:12px">
          <summary style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--t4);cursor:pointer;text-transform:uppercase;letter-spacing:1px">💡 Hints (try without first)</summary>
          <div style="margin-top:8px">${(s.hints||[]).map(h=>`<div style="font-size:12.5px;color:var(--t3);padding:6px 10px;background:var(--s1);border-radius:4px;margin-bottom:4px">• ${esc(h)}</div>`).join('')}</div>
        </details>
        <button class="btn btn-primary" onclick="submitScenario(${i})" id="sc-sub-${i}">Get Expert Feedback →</button>
        <div id="sc-fb-${i}"></div>
      </div>
    </div>`;
  }).join('');
}
function toggleScenario(i) { document.getElementById('sc-'+i)?.classList.toggle('open'); }
async function submitScenario(i) {
  const s=currentScenarios[i]; if(!s) return;
  const answer=(document.getElementById(`sc-ans-${i}`)?.value||'').trim();
  if(answer.length<80) { toast('Write a bit more before submitting','⚠️'); return; }
  const btn=document.getElementById(`sc-sub-${i}`), fbEl=document.getElementById(`sc-fb-${i}`);
  if(btn){btn.disabled=true;btn.textContent='Getting feedback…';}
  renderLoader(fbEl,'Reviewing your approach…');
  const system=`Senior IBM Solution Architect reviewing a colleague's answer. Be specific — not generic. Return ONLY valid JSON:
{"score":"X/10","strengths":["s1","s2"],"gaps":["g1","g2"],"expertAdditions":"3-4 paragraphs — what expert would add/do differently","apsNotes":"APS-specific points they missed or nailed","verdict":"1-sentence overall"}`;
  try {
    const raw=await callClaude({messages:[{role:'user',content:`SCENARIO: ${s.question}\nCONTEXT: ${s.context}\nCONSTRAINTS: ${(s.constraints||[]).join('; ')}\n\nCANDIDATE ANSWER:\n${answer}\n\nMODEL ANSWER (reference):\n${s.modelAnswer}`}],system,maxTokens:1500});
    const fb=parseClaudeJson(raw);
    const d=getTutor();
    if(!d.scenarioHistory) d.scenarioHistory=[];
    d.scenarioHistory.push({date:new Date().toISOString(),title:s.title,score:fb.score,answer});
    if(d.scenarioHistory.length>50) d.scenarioHistory=d.scenarioHistory.slice(-50);
    saveTutor(d);
    fbEl.innerHTML=`<div class="sc-feedback">
      <div class="sc-fb-score">Score: <span style="color:var(--g);font-size:18px">${esc(fb.score||'?')}</span> &nbsp;·&nbsp; ${esc(fb.verdict||'')}</div>
      <div style="margin-top:12px">
        <div class="label" style="color:var(--g);margin-bottom:6px">✅ Strengths</div>
        ${(fb.strengths||[]).map(s=>`<div style="font-size:13px;color:var(--t2);margin-bottom:4px">• ${esc(s)}</div>`).join('')}
        <div class="label" style="color:var(--aws);margin:12px 0 6px">⚠️ Gaps</div>
        ${(fb.gaps||[]).map(g=>`<div style="font-size:13px;color:var(--t2);margin-bottom:4px">• ${esc(g)}</div>`).join('')}
        <div class="label" style="color:var(--ibm);margin:12px 0 6px">🏛 What an Expert Would Add</div>
        <div class="prose">${formatBody(fb.expertAdditions||'')}</div>
        ${fb.apsNotes?`<div class="callout callout-aps" style="margin-top:10px"><div class="label" style="color:var(--aps);margin-bottom:5px">🇦🇺 APS</div>${esc(fb.apsNotes)}</div>`:''}
        <div style="margin-top:12px;padding:10px 13px;background:var(--s2);border-radius:var(--r-sm)">
          <span style="font-size:12px;color:var(--t4)">Model answer: </span>
          <button style="background:none;border:none;color:var(--g);cursor:pointer;font-size:12px" onclick="this.parentElement.nextElementSibling.style.display='block';this.parentElement.style.display='none'">Reveal →</button>
        </div>
        <div style="display:none;margin-top:8px;padding:12px;background:var(--s1);border-radius:var(--r-sm);font-size:13px;color:var(--t2);line-height:1.7">${esc(s.modelAnswer||'')}</div>
      </div>
    </div>`;
    if(btn){btn.disabled=false;btn.textContent='Resubmit';}
  } catch(e) {
    fbEl.innerHTML=`<div class="callout callout-warn">${e.message}</div>`;
    if(btn){btn.disabled=false;btn.textContent='Get Expert Feedback →';}
  }
}
document.getElementById('btn-gen-scenarios')?.addEventListener('click',genScenarios);
