/* ArchBrief v5 — progress.js — Progress Dashboard */
Bus.on('panel:activated', ({id}) => { if(id==='progress') renderProgress(); });
Bus.on('quiz:completed', () => { if(AppState.currentPanel==='progress') renderProgress(); });
Bus.on('module:mastered', () => { if(AppState.currentPanel==='progress') renderProgress(); });

function renderProgress() {
  const out=document.getElementById('progress-out'); if(!out) return;
  const d=getTutor(), p=getProfile();
  const prog=d.moduleProgress||{};
  const sr=srStats();
  const totalMods=LP_DOMAINS.reduce((s,dom)=>s+dom.modules.length,0);
  const mastered=Object.values(prog).filter(v=>v==='mastered').length;
  const started=Object.values(prog).filter(v=>v&&v!=='not-started').length;
  const history=d.quizHistory||[];
  const last7=history.slice(-7);
  const avgAcc=last7.length?Math.round(last7.reduce((s,q)=>s+(q.score/q.total),0)/last7.length*100):0;
  const certProgress=getCertProgress();

  out.innerHTML=`
    <!-- Summary stats -->
    <div class="stat-row">
      <div class="stat"><div class="stat-value">${p.articlesRead||0}</div><div class="stat-label">Articles read</div></div>
      <div class="stat"><div class="stat-value">${d.quizStreak||0}</div><div class="stat-label">🔥 Streak</div></div>
      <div class="stat"><div class="stat-value">${avgAcc}%</div><div class="stat-label">Quiz accuracy</div></div>
      <div class="stat"><div class="stat-value">${mastered}</div><div class="stat-label">Mastered</div></div>
      <div class="stat"><div class="stat-value">${getGlossary().length}</div><div class="stat-label">Glossary terms</div></div>
    </div>

    <!-- Dash grid -->
    <div class="dash-grid">

      <!-- Quiz trend -->
      <div class="dash-card">
        <div class="dash-card-header">Quiz Accuracy — Last 10 sessions</div>
        <div class="dash-card-body">
          ${last7.length?renderQuizSparkline(history.slice(-10)):`<div style="font-size:12px;color:var(--t4);text-align:center;padding:20px 0">No quiz history yet</div>`}
        </div>
      </div>

      <!-- SR stats -->
      <div class="dash-card">
        <div class="dash-card-header">Spaced Repetition Cards</div>
        <div class="dash-card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${[['Total',sr.total,'var(--t2)'],['Due now',sr.due,'var(--aws)'],['Learning',sr.learning,'var(--azure)'],['Mastered',sr.mastered,'var(--g)']].map(([l,v,c])=>`<div style="text-align:center;padding:10px;background:var(--s2);border-radius:var(--r-md)"><div style="font-family:'JetBrains Mono',monospace;font-size:22px;color:${c}">${v}</div><div class="label" style="margin-top:3px">${l}</div></div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Module progress by domain -->
      <div class="dash-card">
        <div class="dash-card-header">Module Completion by Domain</div>
        <div class="dash-card-body">
          ${LP_DOMAINS.map(dom=>{
            const total=dom.modules.length;
            const done=dom.modules.filter(m=>prog[m.id]==='mastered').length;
            const started=dom.modules.filter(m=>prog[m.id]&&prog[m.id]!=='not-started').length;
            const pct=Math.round((done/total)*100);
            return `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px;color:var(--t2)">${dom.icon} ${dom.name}</span>
                <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--t4)">${done}/${total}</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width:${pct}%;background:${pct===100?'var(--g)':pct>50?'var(--azure)':'var(--ibm)'}"></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Certification readiness -->
      <div class="dash-card">
        <div class="dash-card-header">Certification Readiness</div>
        <div class="dash-card-body">
          ${certProgress.map(cert=>`<div class="cert-row">
            <div class="cert-name">${cert.name.split('—')[0].split('Certified')[0].trim().slice(0,18)}</div>
            <div class="cert-track"><div class="progress-track"><div class="progress-fill" style="width:${cert.pct}%;background:${cert.color}"></div></div></div>
            <div class="cert-pct" style="color:${cert.color}">${cert.pct}%</div>
          </div>`).join('')}
          <div style="font-size:11px;color:var(--t4);margin-top:8px;line-height:1.5">Based on started modules aligned to each certification's syllabus.</div>
        </div>
      </div>

    </div>

    <!-- Vendor knowledge heatmap -->
    <div class="dash-card" style="margin-top:0">
      <div class="dash-card-header">Knowledge Coverage — Vendor × Domain</div>
      <div class="dash-card-body" style="overflow-x:auto">
        ${renderKnowledgeHeatmap(prog)}
      </div>
    </div>

    <!-- Scenario history -->
    ${d.scenarioHistory?.length?`<div class="dash-card">
      <div class="dash-card-header">Recent Scenario Scores</div>
      <div class="dash-card-body">
        ${d.scenarioHistory.slice(-5).reverse().map(s=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="font-size:13px;color:var(--t2);flex:1">${esc(s.title||'')}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--g)">${esc(s.score||'')}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--t4)">${new Date(s.date).toLocaleDateString('en-AU')}</div>
        </div>`).join('')}
      </div>
    </div>`:''}
  `;
}

function renderQuizSparkline(history) {
  if(!history.length) return '';
  const w=260, h=60, pad=4;
  const vals=history.map(q=>Math.round((q.score/q.total)*100));
  const max=100, min=0;
  const xStep=(w-pad*2)/(vals.length-1||1);
  const yScale=(h-pad*2)/(max-min);
  const pts=vals.map((v,i)=>`${pad+i*xStep},${h-pad-(v-min)*yScale}`).join(' ');
  const area=`${pad},${h-pad} ${pts} ${pad+(vals.length-1)*xStep},${h-pad}`;
  const last=vals[vals.length-1];
  const color=last>=80?'var(--g)':last>=60?'var(--azure)':'var(--aws)';
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">
    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".3"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${area}" fill="url(#sg)"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    <text x="${w-pad}" y="${pad+8}" text-anchor="end" font-family="'JetBrains Mono',monospace" font-size="10" fill="${color}">${last}%</text>
  </svg>
  <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--t4);margin-top:4px">
    <span>${history.length} sessions</span><span>avg ${Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)}%</span>
  </div>`;
}

function renderKnowledgeHeatmap(prog) {
  const domains=['cloud','ai','security','platform','saas','aps'];
  const vendors=['aws','azure','ibm','oracle','paloalto','hashicorp'];
  const vendorModuleMap={};
  LP_DOMAINS.forEach(dom=>{
    dom.modules.forEach(mod=>{
      (mod.vendors||[]).forEach(v=>{
        if(!vendorModuleMap[v]) vendorModuleMap[v]={};
        if(!vendorModuleMap[v][dom.id]) vendorModuleMap[v][dom.id]=[];
        vendorModuleMap[v][dom.id].push(mod.id);
      });
    });
  });
  const domainLabels={cloud:'Cloud',ai:'AI',security:'Sec',platform:'DevOps',saas:'SaaS',aps:'APS'};
  let html=`<div style="display:grid;grid-template-columns:60px repeat(${domains.length},1fr);gap:3px;font-family:'JetBrains Mono',monospace;font-size:8px">
    <div></div>
    ${domains.map(d=>`<div style="text-align:center;color:var(--t4);padding-bottom:4px">${domainLabels[d]||d}</div>`).join('')}`;
  vendors.forEach(v=>{
    const vc=vendorColor(v);
    html+=`<div style="display:flex;align-items:center;color:${vc};padding-right:5px">${vendorLabel(v).slice(0,6)}</div>`;
    domains.forEach(d=>{
      const mods=vendorModuleMap[v]?.[d]||[];
      const done=mods.filter(m=>prog[m]==='mastered').length;
      const started=mods.filter(m=>prog[m]&&prog[m]!=='not-started').length;
      const level=done===mods.length&&mods.length>0?4:started>1?3:started>0?2:mods.length>0?1:0;
      const bg=level===0?'var(--s3)':level===1?`${vc}20`:level===2?`${vc}40`:level===3?`${vc}70`:`${vc}`;
      const title=`${vendorLabel(v)} / ${domainLabels[d]||d}: ${started}/${mods.length} started, ${done} mastered`;
      html+=`<div style="height:24px;border-radius:3px;background:${bg};cursor:pointer" title="${esc(title)}" onclick="showPanel('path')"></div>`;
    });
  });
  html+='</div>';
  return html;
}
