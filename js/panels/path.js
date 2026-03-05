/* ArchBrief v5 — path.js — Learning Path with living content */
window.LP_DOMAINS=[
  {id:'cloud',icon:'☁️',name:'Cloud Foundations',desc:'Core cloud services and decision frameworks',current:true,modules:[
    {id:'cf-01',name:'Cloud Service Models',desc:'IaaS, PaaS, SaaS — when to use what',vendors:['aws','azure','ibm','oracle'],outcome:'Recommend the right service model for any APS workload'},
    {id:'cf-02',name:'AWS Core Services',desc:'EC2, S3, VPC, IAM, RDS fundamentals',vendors:['aws'],outcome:'Design a basic AWS landing zone for APS OFFICIAL'},
    {id:'cf-03',name:'Azure for Government',desc:'Regions, compliance, APS-specific services',vendors:['azure'],outcome:'Assess Azure for PROTECTED workloads'},
    {id:'cf-04',name:'IBM Cloud & Hybrid',desc:'IBM Cloud, OpenShift, hybrid patterns',vendors:['ibm'],outcome:'Design a hybrid IBM-AWS architecture for enterprise APS'},
    {id:'cf-05',name:'Oracle Cloud for APS',desc:'OCI, sovereign cloud options',vendors:['oracle'],outcome:'Evaluate Oracle Cloud for database-heavy APS workloads'},
    {id:'cf-06',name:'Multi-Cloud Architecture',desc:'Patterns, anti-patterns, governance',vendors:['aws','azure','ibm','oracle'],outcome:'Advise an agency on multi-cloud strategy'},
    {id:'cf-07',name:'Cloud Networking',desc:'VPCs, peering, transit gateways, SD-WAN',vendors:['aws','azure','ibm'],outcome:'Design secure network topology for APS hybrid cloud'},
    {id:'cf-08',name:'FinOps & Cloud Economics',desc:'Cost modelling, reserved instances, showback',vendors:['aws','azure','ibm','oracle'],outcome:'Build a cloud migration business case'},
    {id:'cf-09',name:'Landing Zones',desc:'AWS Control Tower, Azure Landing Zone, ISM controls',vendors:['aws','azure'],outcome:'Implement compliant landing zone for APS ISM controls'},
  ]},
  {id:'ai',icon:'🤖',name:'AI & Data',desc:'ML platforms, generative AI, data architectures',modules:[
    {id:'ai-01',name:'IBM watsonx',desc:'watsonx.ai, .data, .governance',vendors:['ibm'],outcome:'Position watsonx vs Azure OpenAI vs Bedrock for APS'},
    {id:'ai-02',name:'Azure OpenAI & Copilot',desc:'GPT-4, Copilot for Government, responsible AI',vendors:['azure'],outcome:'Evaluate Azure OpenAI for PROTECTED document processing'},
    {id:'ai-03',name:'AWS AI/ML Services',desc:'SageMaker, Bedrock, Rekognition, Comprehend',vendors:['aws'],outcome:'Design document intelligence pipeline on AWS for APS'},
    {id:'ai-04',name:'Emerging AI Tools',desc:'LLM landscape, agentic AI, AI-native startups',vendors:['emerging'],outcome:'Assess emerging AI vendor for APS suitability'},
  ]},
  {id:'security',icon:'🔒',name:'Security & Zero Trust',desc:'Zero trust, SASE, endpoint, cloud security',modules:[
    {id:'sec-01',name:'Zero Trust Principles',desc:'Identity-centric security, never trust always verify',vendors:['paloalto','azure','aws'],outcome:'Explain zero trust to APS executive, map to ISM'},
    {id:'sec-02',name:'Palo Alto SASE & Prisma',desc:'Prisma Cloud, Prisma SASE, Cortex XDR',vendors:['paloalto'],outcome:'Design SASE for APS hybrid workforce'},
    {id:'sec-03',name:'Cloud Security Posture',desc:'CSPM, CIEM, compliance scanning',vendors:['paloalto','aws','azure'],outcome:'Continuous ISM compliance monitoring across multi-cloud'},
    {id:'sec-04',name:'Identity & IAM',desc:'Entra ID, AWS IAM, PIM, federation',vendors:['azure','aws','ibm'],outcome:'Design federated identity for multi-cloud APS agency'},
  ]},
  {id:'platform',icon:'⚙️',name:'Platform & DevOps',desc:'IaC, Kubernetes, CI/CD, platform engineering',modules:[
    {id:'plat-01',name:'HashiCorp Terraform',desc:'IaC, state management, Terraform Cloud',vendors:['hashicorp'],outcome:'Write Terraform module for compliant AWS VPC'},
    {id:'plat-02',name:'Kubernetes & OpenShift',desc:'Container orchestration, AKS, EKS, OpenShift',vendors:['ibm','aws','azure'],outcome:'Recommend Kubernetes platform for APS migration'},
    {id:'plat-03',name:'CI/CD & DevSecOps',desc:'Pipelines, GitOps, security gates',vendors:['hashicorp','aws','azure'],outcome:'Design CI/CD pipeline with ISM security controls'},
  ]},
  {id:'saas',icon:'💼',name:'Enterprise SaaS',desc:'Salesforce, ServiceNow, enterprise platforms',modules:[
    {id:'saas-01',name:'Salesforce for Government',desc:'Gov Cloud, Shield, data residency',vendors:['salesforce'],outcome:'Assess Salesforce Gov Cloud for APS CRM'},
    {id:'saas-02',name:'ServiceNow in APS',desc:'ITSM, GRC, WoG service platforms',vendors:['servicenow'],outcome:'Design ServiceNow ITSM for APS compliance'},
  ]},
  {id:'aps',icon:'🇦🇺',name:'APS & Government',desc:'IRAP, ISM, DTA, protective markings',modules:[
    {id:'aps-01',name:'ISM & IRAP Fundamentals',desc:'What the frameworks require for cloud',vendors:['aws','azure','ibm','oracle'],outcome:'Explain IRAP scope to a client'},
    {id:'aps-02',name:'Protective Markings',desc:'OFFICIAL, PROTECTED — technical implications',vendors:['aws','azure','ibm'],outcome:'Specify controls for a PROTECTED cloud workload'},
    {id:'aps-03',name:'DTA Cloud Policy',desc:'DTA guidance and cloud procurement',vendors:['aws','azure','ibm','oracle'],outcome:'Navigate DTA policy for compliant vendor selection'},
    {id:'aps-04',name:'Data Sovereignty',desc:'What vendors offer, what\'s required',vendors:['aws','azure','ibm','oracle'],outcome:'Advise on data sovereignty for sensitive APS dataset'},
    {id:'aps-05',name:'WoG Platforms',desc:'myGov, ATO, Digital ID, Services Australia',vendors:['aws','azure','ibm'],outcome:'Integrate new agency service with WoG platforms'},
    {id:'aps-06',name:'Vendor Evaluation for APS',desc:'Structured vendor assessment for government',vendors:['aws','azure','ibm','oracle','salesforce','servicenow'],outcome:'Lead a vendor evaluation for APS procurement'},
  ]},
];

Bus.on('panel:activated', ({id}) => { if(id==='path') renderLearningPath(); });
Bus.on('quiz:completed', () => { if(AppState.currentPanel==='path') renderLearningPath(); });

async function renderLearningPath() {
  const el=document.getElementById('lp-domains');
  if(!el) return;
  const d=getTutor(), prog=d.moduleProgress||{};

  // Try loading living content from path_content.json
  const living=await loadPathContent();

  const totalMods=LP_DOMAINS.reduce((s,d)=>s+d.modules.length,0);
  const started=Object.values(prog).filter(v=>v&&v!=='not-started').length;
  const mastered=Object.values(prog).filter(v=>v==='mastered').length;
  document.getElementById('path-progress-text').textContent=`${started} / ${totalMods} modules started`;
  document.getElementById('path-progress-bar').style.width=`${Math.round((mastered/totalMods)*100)}%`;

  el.innerHTML=LP_DOMAINS.map((domain,di)=>{
    const mTotal=domain.modules.length;
    const mStarted=domain.modules.filter(m=>prog[m.id]&&prog[m.id]!=='not-started').length;
    const mMastered=domain.modules.filter(m=>prog[m.id]==='mastered').length;
    const pct=Math.round((mMastered/mTotal)*100);
    const isOpen=(domain.current&&mStarted===0)||mStarted>0;
    return `<div class="lp-domain ${isOpen?'open':''}" id="lpd-${domain.id}">
      <div class="lp-domain-header" onclick="toggleLpDomain('${domain.id}')">
        <div class="lp-domain-icon">${domain.icon}</div>
        <div class="lp-domain-info">
          <div class="lp-domain-name">${domain.name}${domain.current&&mStarted===0?' <span style="font-family:\'JetBrains Mono\',monospace;font-size:8px;padding:2px 7px;border-radius:2px;background:var(--g-d);color:var(--g)">START HERE</span>':''}</div>
          <div class="lp-domain-meta">${mTotal} modules · ${mStarted} started · ${mMastered} mastered</div>
        </div>
        <div class="lp-domain-prog">
          <div class="lp-domain-pct">${pct}%</div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="lp-chevron">⌄</div>
      </div>
      <div class="lp-modules">
        ${domain.modules.map(mod=>buildModuleRow(mod,prog,living)).join('')}
      </div>
    </div>`;
  }).join('');
}

function buildModuleRow(mod, prog, living) {
  const status=prog[mod.id]||'not-started';
  const icons={'not-started':'○','reading':'◑','tested':'◕','mastered':'●'};
  const actionLabels={'not-started':'Start','reading':'Continue','tested':'Review','mastered':'Mastered ✓'};
  const livingMod=living?.modules?.[mod.id];
  const updatedAt=livingMod?.updatedAt?` · updated ${new Date(livingMod.updatedAt).toLocaleDateString('en-AU',{month:'short',year:'numeric'})}`:'';

  // Content: living takes priority over built-in
  const content=livingMod?.content||'';

  return `<div class="lp-module ${status}" id="lpm-${mod.id}" onclick="toggleLpModule('${mod.id}')">
    <div class="lp-status ${status}">${icons[status]||'○'}</div>
    <div style="flex:1">
      <div class="lp-mod-name">${esc(mod.name)}</div>
      <div class="lp-mod-desc">${esc(mod.desc)}</div>
      <div class="lp-mod-tags" style="margin-top:5px">${vendorTags((mod.vendors||[]).slice(0,3))}</div>
    </div>
    <button class="btn btn-ghost btn-sm ${status==='not-started'?'btn-primary':''}" style="${status==='not-started'?'':'border-color:var(--border);color:var(--t3)'}" onclick="event.stopPropagation();startLpModule('${mod.id}')">${actionLabels[status]||'Start'}</button>
  </div>
  <div class="lp-detail" id="lpdet-${mod.id}">
    <div class="lp-outcome">After this module: <strong>${esc(mod.outcome)}</strong></div>
    ${content?`<div class="prose" style="margin-top:14px">${formatBody(content)}</div>`:`<div style="font-size:13px;color:var(--t3);margin-top:10px;line-height:1.65">Content loads from your monthly-updated path_content.json — or generate it with the monthly workflow.</div>`}
    ${updatedAt?`<div class="lp-updated">Living content${updatedAt}</div>`:''}
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" onclick="startLpModule('${mod.id}')">Mark as Reading →</button>
      <button class="btn btn-secondary btn-sm" onclick="chatAbout('${esc(mod.name).replace(/'/g,"\\'")} — explain for APS Solution Architect')">Explore in Chat</button>
      ${status==='reading'||status==='tested'?`<button class="btn btn-ghost btn-sm" style="color:var(--g);border-color:var(--g)" onclick="markLpMastered('${mod.id}')">Mark Mastered ✓</button>`:''}
    </div>
  </div>`;
}

function toggleLpDomain(id) { document.getElementById('lpd-'+id)?.classList.toggle('open'); }

function toggleLpModule(id) {
  const mod=document.getElementById('lpm-'+id);
  if(!mod) return;
  // Close siblings
  mod.closest('.lp-modules')?.querySelectorAll('.lp-module.open').forEach(m=>{ if(m.id!=='lpm-'+id) m.classList.remove('open'); });
  mod.classList.toggle('open');
}

function startLpModule(id) {
  const d=getTutor();
  if(!d.moduleProgress) d.moduleProgress={};
  if(!d.moduleProgress[id]||d.moduleProgress[id]==='not-started') {
    d.moduleProgress[id]='reading';
    saveTutor(d);
    toast('Module started! 📖','🗺');
  }
  renderLearningPath();
}

function markLpMastered(id) {
  const d=getTutor();
  if(!d.moduleProgress) d.moduleProgress={};
  d.moduleProgress[id]='mastered';
  saveTutor(d);
  renderLearningPath();
  toast('Module mastered! 🎉','✅');
  Bus.emit('module:mastered',{id});
}
