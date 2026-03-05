/* ArchBrief v5 — aps.js — APS Radar */
let apsGenerating = false;
Bus.on('panel:activated', ({id}) => { if(id==='aps') initAps(); });
Bus.on('daily:loaded', () => { if(AppState.currentPanel==='aps') initAps(); });
function initAps() {
  const out=document.getElementById('aps-out'), daily=getDailyData();
  if(!out) return;
  if(daily?.aps) {
    renderApsChanges(daily.apsChanges||[]);
    renderAps(out,daily.aps);
  } else renderEmpty(out,{icon:'🇦🇺',title:'APS Radar',body:"Generate your digest to load today's APS compliance snapshot.",action:'<button class="btn btn-primary" onclick="generateAps()">⚡ Refresh</button>'});
}
function renderApsChanges(changes) {
  const banner=document.getElementById('aps-changes-banner'); if(!banner) return;
  if(!changes.length){banner.classList.add('hidden');return;}
  banner.classList.remove('hidden');
  banner.innerHTML=`<div style="padding:11px 14px;background:rgba(255,153,0,.07);border:1px solid rgba(255,153,0,.2);border-radius:var(--r-md);margin-bottom:14px">
    <div class="label" style="color:var(--aws);margin-bottom:8px">🔔 Overnight APS Changes Detected</div>
    ${changes.map(c=>`<div style="font-size:12.5px;color:rgba(255,153,0,.85);margin-bottom:4px">• ${c.type==='irap_change'?`<strong>${esc(c.vendor)}</strong> IRAP: ${esc(c.from||'')} → ${esc(c.to||'')}`:esc(c.alert||'')}</div>`).join('')}
  </div>`;
}
function renderAps(out,aps) {
  if(!out||!aps) return;
  let html='';
  // Key alerts
  if(aps.keyAlerts?.length) {
    html+=`<div style="margin-bottom:20px"><div class="label" style="margin-bottom:10px">Key Alerts</div>
      ${aps.keyAlerts.map(a=>`<div style="padding:11px 14px;background:${a.severity==='high'?'rgba(255,77,106,.07)':a.severity==='medium'?'rgba(255,153,0,.06)':'var(--s1)'};border:1px solid ${a.severity==='high'?'rgba(255,77,106,.2)':a.severity==='medium'?'rgba(255,153,0,.15)':'var(--border)'};border-radius:var(--r-md);margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <span style="font-size:14px">${a.severity==='high'?'🔴':a.severity==='medium'?'🟡':'🟢'}</span>
          <span style="font-family:'Instrument Serif',serif;font-size:15px">${esc(a.title||a.alert||'')}</span>
          ${a.vendor?`<span class="tag tag-vendor" style="--vendor-color:${vendorColor(a.vendor)}">${vendorLabel(a.vendor)}</span>`:''}
        </div>
        <div style="font-size:13px;color:var(--t2);line-height:1.65">${esc(a.detail||a.description||'')}</div>
        ${a.action?`<div style="margin-top:6px;font-size:12px;color:var(--g)">→ ${esc(a.action)}</div>`:''}
      </div>`).join('')}
    </div>`;
  }
  // IRAP status
  if(aps.irapStatus?.length) {
    html+=`<div style="margin-bottom:20px"><div class="label" style="margin-bottom:10px">IRAP Assessment Status</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
        ${aps.irapStatus.map(v=>{
          const color=v.status==='assessed'?'var(--g)':v.status==='in-progress'?'var(--aws)':'var(--t4)';
          const icon=v.status==='assessed'?'✅':v.status==='in-progress'?'⏳':'○';
          return `<div class="card card-sm" style="border-left:3px solid ${color}">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
              <span>${icon}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${vendorColor(v.vendor||v.key)}">${esc(v.label||vendorLabel(v.vendor||v.key))}</span>
            </div>
            <div style="font-size:11px;color:${color};text-transform:uppercase;letter-spacing:.5px;font-family:'JetBrains Mono',monospace">${esc(v.status||'unknown')}</div>
            ${v.level?`<div style="font-size:11px;color:var(--t3);margin-top:3px">${esc(v.level)}</div>`:''}
            ${v.note?`<div style="font-size:11px;color:var(--t4);margin-top:4px;line-height:1.5">${esc(v.note)}</div>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }
  // DTA section
  if(aps.dtaUpdate) {
    html+=`<div class="callout callout-aps" style="margin-bottom:14px">
      <div class="label" style="color:var(--aps);margin-bottom:6px">DTA Update</div>
      ${esc(aps.dtaUpdate)}
    </div>`;
  }
  // Data sovereignty
  if(aps.dataSovereignty) {
    html+=`<div style="padding:14px 16px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-lg);margin-bottom:14px">
      <div class="label" style="margin-bottom:8px">Data Sovereignty</div>
      <div style="font-size:13px;color:var(--t2);line-height:1.7">${esc(aps.dataSovereignty)}</div>
    </div>`;
  }
  // WoG platforms
  if(aps.wogPlatforms?.length) {
    html+=`<div style="margin-bottom:14px"><div class="label" style="margin-bottom:10px">Whole of Government Platforms</div>
      ${aps.wogPlatforms.map(p=>`<div style="display:flex;gap:10px;padding:10px 14px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:7px">
        <span style="color:var(--aps)">⬤</span>
        <div><div style="font-size:13px;font-weight:500;margin-bottom:3px">${esc(p.name||'')}</div><div style="font-size:12px;color:var(--t3)">${esc(p.update||p.status||'')}</div></div>
      </div>`).join('')}
    </div>`;
  }
  out.innerHTML = html || `<div class="callout callout-aps">APS data loaded — no specific alerts today.</div>`;
}
async function generateAps() {
  if(apsGenerating) return; apsGenerating=true;
  const out=document.getElementById('aps-out'), btn=document.getElementById('btn-gen-aps');
  if(btn){btn.disabled=true;btn.textContent='⏳ Refreshing…';}
  renderLoader(out,'Checking APS compliance landscape…');
  const system=`You are ArchBrief APS compliance specialist. Return ONLY valid JSON:
{"keyAlerts":[{"title":"string","severity":"high|medium|low","vendor":"key or null","detail":"2-3 sentences","action":"1 sentence or null"}],"irapStatus":[{"vendor":"key","label":"string","status":"assessed|in-progress|not-assessed","level":"PROTECTED|OFFICIAL|unknown","note":"string or null"}],"dtaUpdate":"string or null","dataSovereignty":"string","wogPlatforms":[{"name":"string","update":"string"}]}`;
  try {
    const raw=await callClaude({messages:[{role:'user',content:'Current APS cloud compliance status, IRAP assessments, DTA updates.'}],system,maxTokens:2000,webSearch:true});
    const data=parseClaudeJson(raw);
    renderAps(out,data);
    toast('APS radar refreshed','🇦🇺');
  } catch(e) { renderEmpty(out,{icon:'⚠️',title:'Refresh failed',body:e.message,action:'<button class="btn btn-primary" onclick="generateAps()">Retry</button>'}); }
  if(btn){btn.disabled=false;btn.textContent='⚡ Refresh';}
  apsGenerating=false;
}
document.getElementById('btn-gen-aps')?.addEventListener('click',generateAps);
