/* ArchBrief v5 — projects.js — My Projects & Feedback Sync */
Bus.on('panel:activated', ({id}) => { if(id==='projects') renderProjects(); });
Bus.on('feedback:updated', () => { if(AppState.currentPanel==='projects') updateFeedbackSection(); });
function renderProjects() {
  const out=document.getElementById('projects-out'), daily=getDailyData();
  if(!out) return;
  const ctx=daily?.context||{};
  const settings=getSettings();
  out.innerHTML=`
    <div class="stat-row" style="margin-bottom:18px">
      <div class="stat"><div class="stat-value">${ctx.activeProjects||0}</div><div class="stat-label">Active projects</div></div>
      <div class="stat"><div class="stat-value">${ctx.historyDays||0}</div><div class="stat-label">Days tracked</div></div>
      <div class="stat"><div class="stat-value">${(getFeedback().ratings||[]).length}</div><div class="stat-label">Ratings stored</div></div>
    </div>
    <div style="padding:14px 16px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-lg);margin-bottom:16px">
      <div class="label" style="margin-bottom:8px">Active Projects</div>
      <div id="projects-list">
        ${ctx.projectNames?.length
          ? ctx.projectNames.map(p=>`<div style="display:flex;gap:8px;font-size:13px;color:var(--t2);margin-bottom:6px"><span style="color:var(--g)">▸</span>${esc(p)}</div>`).join('')
          : `<div style="font-size:13px;color:var(--t4)">No project context loaded yet — edit projects.json in your repo.</div>`}
      </div>
    </div>

    <div style="padding:14px 16px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-lg);margin-bottom:16px">
      <div class="label" style="margin-bottom:10px">Anthropic API Key</div>
      <div style="font-size:13px;color:var(--t3);margin-bottom:10px;line-height:1.65">
        Required for Generate, Chat, Quiz, and all AI features. Stored locally in your browser only.
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <input class="input input-mono" id="api-key-input" type="password" placeholder="sk-ant-api03-..." value="${esc(settings.apiKey||'')}" style="flex:1">
        <button class="btn btn-secondary btn-sm" onclick="saveApiKey()">Save</button>
      </div>
      <div id="api-key-status"></div>
    </div>

    <div style="padding:14px 16px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-lg);margin-bottom:16px">
      <div class="label" style="margin-bottom:10px">Feedback Worker (Auto-sync)</div>
      <div style="font-size:13px;color:var(--t3);margin-bottom:10px;line-height:1.65">
        Ratings sync automatically to your repo via a Cloudflare Worker. One-time setup.
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <input class="input input-mono" id="worker-url-input" placeholder="https://archbrief-feedback.yourname.workers.dev" value="${esc(settings.feedbackWorkerUrl||'')}" style="flex:1">
        <button class="btn btn-secondary btn-sm" onclick="saveWorkerUrl()">Save</button>
      </div>
      <div id="worker-status"></div>
    </div>

    <div style="padding:14px 16px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-lg)">
      <div class="label" style="margin-bottom:8px">Deploy Instructions</div>
      <div style="font-size:12.5px;color:var(--t3);line-height:1.8">
        1. Install Wrangler: <code style="background:var(--s3);padding:1px 5px;border-radius:3px;color:var(--g)">npm install -g wrangler</code><br>
        2. <code style="background:var(--s3);padding:1px 5px;border-radius:3px;color:var(--g)">cd .github/scripts/feedback_worker</code><br>
        3. <code style="background:var(--s3);padding:1px 5px;border-radius:3px;color:var(--g)">wrangler login && wrangler deploy</code><br>
        4. Set secrets: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO<br>
        5. Paste the worker URL above
      </div>
    </div>`;
  updateApiKeyStatus();
  updateFeedbackSection();
  updateWorkerStatus();
}
function updateFeedbackSection() {
  const el=document.getElementById('feedback-summary-out'); if(!el) return;
  const sync=getSyncStatus();
  const dotColor={'synced':'var(--g)','pending':'var(--aws)','no-worker':'var(--t4)','error':'var(--red)'}[sync.status]||'var(--t4)';
  el.innerHTML=`<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-md)">
    <span class="sync-dot" style="background:${dotColor}${sync.status==='pending'?';animation:pulse 1.5s infinite':''}"></span>
    <span style="font-size:13px;color:var(--t2)">${esc(sync.label)}</span>
    ${sync.pending>0&&sync.status!=='no-worker'?`<button class="btn btn-secondary btn-sm" style="margin-left:auto" onclick="syncFeedback().then(()=>{updateFeedbackSection();toast('Sync attempted','🔄')})">Sync now</button>`:''}
  </div>`;
}
function updateWorkerStatus() {
  const el=document.getElementById('worker-status'); if(!el) return;
  const settings=getSettings();
  if(!settings.feedbackWorkerUrl) { el.innerHTML=`<div style="font-size:11px;color:var(--t4)">Not configured — deploy the worker first</div>`; return; }
  el.innerHTML=`<div style="font-size:11px;color:var(--g)">✓ Worker URL saved</div>`;
}
function saveWorkerUrl() {
  const url=(document.getElementById('worker-url-input')?.value||'').trim();
  updateSetting('feedbackWorkerUrl',url);
  updateWorkerStatus();
  toast('Worker URL saved','✅');
  if(url) syncFeedback().then(()=>updateFeedbackSection());
}
function saveApiKey() {
  const key=(document.getElementById('api-key-input')?.value||'').trim();
  updateSetting('apiKey',key);
  updateApiKeyStatus();
  toast(key?'API key saved':'API key cleared', key?'🔑':'⬜');
}
function updateApiKeyStatus() {
  const el=document.getElementById('api-key-status'); if(!el) return;
  const key=getSettings().apiKey;
  if(!key) { el.innerHTML=`<div style="font-size:11px;color:var(--t4)">Not set — AI features will not work</div>`; return; }
  el.innerHTML=`<div style="font-size:11px;color:var(--g)">✓ Key saved (${key.slice(0,10)}…)</div>`;
}
function showProjectsGuide() { toast('Edit projects.json in your GitHub repo and commit — takes effect next morning','ℹ️'); }
