/* ArchBrief v5 — morning.js — Guided Morning Routine */
let morningStep=0, morningArticles=[], morningQuizQ=[], morningQuizAnswers=[];
const MORNING_STEPS=['headline','articles','quiz','done'];
Bus.on('panel:activated', ({id}) => { if(id==='morning') initMorning(); });

function initMorning() {
  const el=document.getElementById('morning-content'); if(!el) return;
  if(isMorningDone()) { renderMorningComplete(el,true); return; }
  const daily=getDailyData();
  if(!daily?.digest?.articles?.length) {
    el.innerHTML=`<div class="empty-state">
      <div class="empty-icon">🌅</div>
      <div class="empty-title" style="font-family:'Instrument Serif',serif;font-size:26px">Good ${greeting()}</div>
      <div class="empty-body">Your 5am brief hasn't arrived yet. Generate it now or go straight to the digest.</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-lg" onclick="showPanel('digest');generateDigest()">⚡ Generate Digest</button>
        <button class="btn btn-secondary" onclick="showPanel('digest')">Go to Digest →</button>
      </div>
    </div>`; return;
  }
  morningStep=0;
  morningArticles=daily.digest.articles.slice(0,2);
  morningQuizQ=daily.quiz?.questions||[];
  morningQuizAnswers=[];
  renderMorningStep(el);
}

function greeting() {
  const h=new Date().getHours();
  return h<12?'morning':h<17?'afternoon':'evening';
}

function renderMorningProgress(el) {
  const labels=['Headline','Articles','Quiz','Done'];
  const pct=Math.round((morningStep/3)*100);
  el.innerHTML=`<div class="morning-progress">
    <div class="morning-progress-track"><div class="morning-progress-fill" style="width:${pct}%"></div></div>
    <div class="morning-step-labels">${labels.map((l,i)=>`<span style="color:${i<=morningStep?'var(--g)':'var(--t4)'}">${l}</span>`).join('')}</div>
  </div>`;
}

function renderMorningStep(el) {
  el.innerHTML=''; // clear
  const prog=document.createElement('div');
  renderMorningProgress(prog);
  el.appendChild(prog);
  const body=document.createElement('div');
  body.className='morning-step active';

  const daily=getDailyData();
  if(morningStep===0) { // Headline
    const d=daily.digest;
    body.innerHTML=`<div style="padding:20px 0">
      <div style="font-family:'Instrument Serif',serif;font-size:28px;margin-bottom:8px">Good ${greeting()}</div>
      <div style="font-size:13px;color:var(--t3);margin-bottom:20px">Your 8-minute morning brief</div>
      <div style="padding:16px 18px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r-lg);margin-bottom:16px">
        <div class="label" style="margin-bottom:8px">Today's Headline</div>
        <div style="font-family:'Instrument Serif',serif;font-size:19px;line-height:1.4;margin-bottom:8px">${esc(d.summary||'')}</div>
        ${d.apsAlert?`<div class="callout callout-aps" style="margin-top:10px">🇦🇺 ${esc(d.apsAlert)}</div>`:''}
      </div>
      <button class="btn btn-primary btn-lg btn-full" onclick="morningNext()">Read today's top stories →</button>
    </div>`;
  } else if(morningStep===1) { // Articles
    body.innerHTML=`<div>
      <div class="label" style="margin-bottom:14px">Top ${morningArticles.length} stories today</div>
      ${morningArticles.map((a,i)=>`<div class="morning-article-mini">
        <div style="display:flex;gap:6px;margin-bottom:8px">${vendorTags((a.vendors||[]).slice(0,2))}</div>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.lead||'')}</p>
        ${a.arch_impact?`<div class="callout callout-arch" style="margin-top:10px;font-size:12.5px"><strong>Architect note:</strong> ${esc(a.arch_impact)}</div>`:''}
      </div>`).join('')}
      <button class="btn btn-primary btn-lg btn-full" style="margin-top:4px" onclick="morningNext()">${morningQuizQ.length?'Take today\'s quiz →':'Complete morning →'}</button>
    </div>`;
  } else if(morningStep===2) { // Quiz
    if(!morningQuizQ.length) { morningNext(); return; }
    renderMorningQuiz(body);
  } else { // Done
    renderMorningComplete(el, false);
    return;
  }
  el.appendChild(body);
}

function morningNext() { morningStep++; const el=document.getElementById('morning-content'); if(el) renderMorningStep(el); }

function renderMorningQuiz(body) {
  const idx=morningQuizAnswers.length;
  if(idx>=morningQuizQ.length) { morningNext(); return; }
  const q=morningQuizQ[idx];
  const letters=['A','B','C','D'];
  body.innerHTML=`<div style="margin-bottom:10px"><div class="label">Quick Quiz — ${idx+1} of ${morningQuizQ.length}</div></div>
    <div class="quiz-question">
      <div class="quiz-q-text">${esc(q.q||'')}</div>
      <div class="quiz-options">
        ${(q.options||[]).map((opt,i)=>`<button class="quiz-option" onclick="morningAnswer(${i})">
          <span class="quiz-option-letter">${letters[i]}</span>
          <span>${esc(opt.replace(/^[A-D]\.\s*/,''))}</span>
        </button>`).join('')}
      </div>
      <div id="morning-explanation" style="display:none"></div>
    </div>`;
}

function morningAnswer(chosen) {
  const idx=morningQuizAnswers.length;
  const q=morningQuizQ[idx];
  const correct=q.correct??0, isRight=chosen===correct;
  morningQuizAnswers.push({chosen,correct,isRight});
  document.querySelectorAll('.quiz-option').forEach((b,i)=>{
    b.setAttribute('disabled','');
    if(i===correct) b.classList.add('correct');
    else if(i===chosen&&!isRight) b.classList.add('wrong');
    else b.classList.add('reveal');
  });
  const exp=document.getElementById('morning-explanation');
  if(exp) {
    exp.style.display='block';
    exp.className=`quiz-explanation${isRight?'':' wrong'}`;
    const more=idx<morningQuizQ.length-1?'Next Question →':'See Results →';
    exp.innerHTML=`<strong>${isRight?'✅':'❌'}</strong> ${esc(q.explanation||'')}
      <div style="margin-top:8px"><button class="btn btn-primary btn-sm" onclick="morningQuizNext()">${more}</button></div>`;
    exp.querySelector('button').textContent=more;
  }
  srUpdateCard(q.id||'', isRight?4:1);
  Bus.emit('sr:reviewed', {});
}

function morningQuizNext() {
  if(morningQuizAnswers.length<morningQuizQ.length) {
    const body=document.querySelector('.morning-step.active'); if(body) renderMorningQuiz(body);
  } else morningNext();
}

function renderMorningComplete(el,alreadyDone) {
  const score=morningQuizAnswers.filter(a=>a.isRight).length;
  const total=morningQuizAnswers.length||morningQuizQ.length||3;
  if(!alreadyDone) {
    markMorningDone(score,total);
    updateMorningBadge();
    const d=getTutor(), today=todayAEST();
    const yest=new Date(Date.now()-86400000).toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'});
    if(d.lastQuizDate===yest) d.quizStreak=(d.quizStreak||0)+1;
    else if(d.lastQuizDate!==today) d.quizStreak=1;
    d.lastQuizDate=today;
    if(total>0) {
      if(!d.quizHistory) d.quizHistory=[];
      d.quizHistory.push({date:new Date().toISOString(),score,total,completed:true,source:'morning'});
      saveTutor(d);
    }
  }
  const record=storageGet(KEYS.MORNING_DONE,{});
  el.innerHTML=`<div class="morning-complete">
    <div style="font-size:48px;margin-bottom:12px">✅</div>
    <div class="morning-score-display">${record.score||score}/${record.total||total}</div>
    <div style="font-family:'Instrument Serif',serif;font-size:22px;margin-bottom:8px">Morning complete</div>
    <div style="font-size:14px;color:var(--t2);margin-bottom:24px">${alreadyDone?'Already done today — come back tomorrow.':'Great work. You\'re ready for the day.'}</div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="showPanel('digest')">Read full digest →</button>
      <button class="btn btn-secondary" onclick="showPanel('path')">Learning Path →</button>
    </div>
  </div>`;
}
