/* ArchBrief v5 — chat.js — Q&A Chat */
let chatHistory = [], chatSending = false;
const CHAT_CHIPS = ['IRAP assessment process','AWS vs Azure for PROTECTED','Zero trust in APS','HashiCorp Terraform patterns','IBM watsonx vs Azure OpenAI','ServiceNow in government','Data sovereignty options','Cost optimisation strategies'];
Bus.on('panel:activated', ({id}) => { if(id==='chat') initChat(); });
Bus.on('chat:prefill', ({query}) => { const el=document.getElementById('chat-input'); if(el){el.value=query;el.focus();} });
function initChat() {
  const msgs=document.getElementById('chat-messages');
  if(msgs&&!msgs.dataset.init) {
    msgs.dataset.init='1';
    if(!chatHistory.length) renderChatWelcome(msgs);
  }
  buildChatChips();
}
function renderChatWelcome(msgs) {
  msgs.innerHTML=`<div style="padding:20px 0">
    <div style="font-family:'Instrument Serif',serif;font-size:22px;margin-bottom:8px">Ask me anything</div>
    <div style="font-size:13px;color:var(--t3);line-height:1.65;margin-bottom:16px">APS compliance, vendor comparisons, architecture decisions — I have context from your daily brief and projects.</div>
  </div>`;
}
function buildChatChips() {
  const el=document.getElementById('chat-chips'); if(!el) return;
  el.innerHTML=CHAT_CHIPS.map(c=>`<button class="pill" onclick="chatChip('${c.replace(/'/g,"\\'")}')"><span style="color:var(--g)">›</span> ${c}</button>`).join('');
}
function chatChip(text) {
  const el=document.getElementById('chat-input');
  if(el){el.value=text; sendChat();}
}
async function sendChat() {
  if(chatSending) return;
  const input=document.getElementById('chat-input');
  const query=(input?.value||'').trim();
  if(!query) return;
  chatSending=true;
  input.value='';
  const msgs=document.getElementById('chat-messages');
  if(!msgs) { chatSending=false; return; }

  // Add user bubble
  chatHistory.push({role:'user',content:query});
  appendMsg(msgs,'user',query);
  trackActivity('chat');

  // Thinking bubble
  const thinkId='think-'+Date.now();
  msgs.insertAdjacentHTML('beforeend',`<div id="${thinkId}" style="display:flex;gap:8px;margin-bottom:12px;align-items:flex-start">
    <div style="width:28px;height:28px;border-radius:50%;background:var(--g-d);border:1px solid rgba(34,255,168,.2);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">A</div>
    <div style="padding:10px 14px;background:var(--s1);border:1px solid var(--border);border-radius:0 var(--r-lg) var(--r-lg) var(--r-lg);display:flex;gap:5px;align-items:center">
      <div class="ep-dot"></div><div class="ep-dot"></div><div class="ep-dot"></div>
    </div>
  </div>`);
  msgs.scrollTop=msgs.scrollHeight;

  const daily=getDailyData();
  const system=`You are ArchBrief — an expert AI assistant for an Assistant Solution Architect at IBM, Australian Public Sector.
You are deeply knowledgeable about: AWS, Azure, IBM Cloud, Oracle Cloud, Salesforce, ServiceNow, Palo Alto Networks, HashiCorp, and emerging technologies.
APS context: ISM, IRAP, PROTECTED/OFFICIAL markings, DTA cloud policy, data sovereignty, WoG platforms (myGov, ATO, Digital ID).
${daily?.digest?.summary?`Today's brief summary: ${daily.digest.summary}`:''}
Be direct, technical, and specific. Reference real products, version numbers, and current facts. For APS queries always address compliance implications.`;

  try {
    const raw=await callClaude({messages:chatHistory.map(m=>({role:m.role,content:m.content})),system,maxTokens:1500,webSearch:true});
    document.getElementById(thinkId)?.remove();
    chatHistory.push({role:'assistant',content:raw});
    appendMsg(msgs,'assistant',raw);
    // Keep history bounded
    if(chatHistory.length>40) chatHistory=chatHistory.slice(-40);
  } catch(e) {
    document.getElementById(thinkId)?.remove();
    appendMsg(msgs,'error','Sorry — ' + e.message);
  }
  chatSending=false;
}
function appendMsg(msgs,role,content) {
  const isUser=role==='user', isError=role==='error';
  const avatar=isUser?'U':'A';
  const bgColor=isUser?'var(--s2)':'var(--s1)';
  const borderColor=isUser?'var(--border)':'var(--border)';
  const align=isUser?'flex-end':'flex-start';
  const borderRadius=isUser?'var(--r-lg) 0 var(--r-lg) var(--r-lg)':'0 var(--r-lg) var(--r-lg) var(--r-lg)';
  const formattedContent=isUser?esc(content):formatMarkdown(content);
  msgs.insertAdjacentHTML('beforeend',`<div style="display:flex;gap:8px;margin-bottom:14px;align-items:flex-start;flex-direction:${isUser?'row-reverse':'row'}">
    <div style="width:28px;height:28px;border-radius:50%;background:${isUser?'var(--ibm-d)':'var(--g-d)'};border:1px solid ${isUser?'rgba(69,137,255,.2)':'rgba(34,255,168,.2)'};display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:10px;flex-shrink:0;color:${isUser?'var(--ibm)':'var(--g)'}">${avatar}</div>
    <div style="max-width:80%;padding:12px 16px;background:${bgColor};border:1px solid ${isError?'rgba(255,77,106,.3)':borderColor};border-radius:${borderRadius};font-size:13px;line-height:1.75;color:${isError?'var(--red)':'var(--t2)'};animation:slideUp .15s ease">
      ${formattedContent}
    </div>
  </div>`);
  msgs.scrollTop=msgs.scrollHeight;
}
function formatMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/^### (.+)$/gm,'<h4 style="font-family:\'Instrument Serif\',serif;font-size:15px;margin:10px 0 5px">$1</h4>')
    .replace(/^## (.+)$/gm,'<h3 style="font-family:\'Instrument Serif\',serif;font-size:17px;margin:12px 0 6px">$1</h3>')
    .replace(/^- (.+)$/gm,'<div style="display:flex;gap:7px;margin-bottom:4px"><span style="color:var(--g);flex-shrink:0">›</span><span>$1</span></div>')
    .replace(/\n\n/g,'</p><p style="margin-top:8px">')
    .replace(/^(?!<)/,'<p>')
    .replace(/(?!>)$/,'</p>');
}
const chatInput=document.getElementById('chat-input');
chatInput?.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();} });
document.getElementById('btn-chat-send')?.addEventListener('click',sendChat);
document.getElementById('btn-clear-chat')?.addEventListener('click',()=>{ chatHistory=[]; const msgs=document.getElementById('chat-messages'); if(msgs){msgs.innerHTML='';renderChatWelcome(msgs);} });
