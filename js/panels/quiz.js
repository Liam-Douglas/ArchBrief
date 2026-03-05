/* ArchBrief v5 — quiz.js — Daily Quiz with SM-2 spaced repetition */
let quizState = { questions:[], idx:0, answers:[], source:'', generating:false };
Bus.on('panel:activated', ({id}) => { if(id==='quiz') initQuiz(); });
Bus.on('digest:generated', (data) => { if(data) flagQuizAvailable(); });

function initQuiz() {
  const el=document.getElementById('quiz-content');
  if(!el) return;
  const d=getTutor(), today=todayAEST();
  const doneToday=(d.quizHistory||[]).some(q=>q.date?.startsWith(today)&&q.completed);
  updateQuizHeader(d);
  if(doneToday) { const last=d.quizHistory.filter(q=>q.date?.startsWith(today)).pop(); showQuizComplete(last.score,last.total,true); return; }

  // Check for SR due cards first
  const due=srDueCards();
  const daily=getDailyData();
  const hasDigest=daily?.quiz?.questions?.length||daily?.digest?.articles?.length;

  el.innerHTML=`
    <div class="quiz-meta-bar">
      <div class="quiz-streak" id="quiz-streak-display">🔥 ${d.quizStreak||0} day streak</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--t4)">${due.length>0?`${due.length} cards due for review`:''}</div>
    </div>
    <div id="quiz-body">
      ${due.length>0 ? renderQuizStartScreen('review',due.length,hasDigest) : renderQuizStartScreen('new',0,hasDigest)}
    </div>`;
}

function renderQuizStartScreen(mode,dueCount,hasDigest) {
  if(mode==='review') return `<div class="empty-state">
    <div class="empty-icon">🔁</div>
    <div class="empty-title">${dueCount} card${dueCount>1?'s':''} due for review</div>
    <div class="empty-body">Spaced repetition — questions you got wrong are back for another try.</div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="startReviewSession()">Start Review (${dueCount})</button>
      ${hasDigest?'<button class="btn btn-secondary" onclick="startNewQuiz()">New Questions instead</button>':''}
    </div>
  </div>`;
  if(hasDigest) return `<div class="empty-state">
    <div class="empty-icon">🧠</div>
    <div class="empty-title">Ready for today's quiz?</div>
    <div class="empty-body">3 questions from today's digest · 2 minutes · results tracked over time</div>
    <button class="btn btn-primary btn-lg" onclick="startNewQuiz()">Start Quiz →</button>
  </div>`;
  return `<div class="empty-state">
    <div class="empty-icon">📰</div>
    <div class="empty-title">Generate your digest first</div>
    <div class="empty-body">Quiz questions are built from today's articles.</div>
    <button class="btn btn-primary" onclick="showPanel('digest');generateDigest()">Go to Digest →</button>
  </div>`;
}

function updateQuizHeader(d) {
  const el=document.getElementById('quiz-streak-display');
  if(el) el.textContent=`🔥 ${d?.quizStreak||0} day streak`;
}

async function startNewQuiz() {
  if(quizState.generating) return;
  quizState.generating=true;
  const body=document.getElementById('quiz-body');
  renderLoader(body,'Generating quiz questions…');

  const daily=getDailyData();
  let questions=daily?.quiz?.questions;

  if(!questions?.length) {
    const articles=(daily?.digest?.articles||[]).slice(0,5);
    if(!articles.length) { renderEmpty(body,{icon:'📰',title:'No articles yet',body:'Generate your digest first.'}); quizState.generating=false; return; }
    const summaries=articles.map((a,i)=>`Article ${i+1}: "${a.title}" — ${a.lead||''} Key: ${(a.key_points||[]).join('; ')}`).join('\n\n');
    const system=`Quiz generator for APS Solution Architect. RESPOND WITH ONLY A JSON OBJECT. No prose, no markdown. Start with { end with }. Shape:
{"questions":[{"q":"question","options":["A. opt","B. opt","C. opt","D. opt"],"correct":0,"explanation":"2-3 sentences","vendors":["key"],"topicTag":"arch|security|ai|devops|industry"}]}
3 questions: 1 recall, 1 comprehension, 1 application. Wrong options must be plausible.`;
    try {
      const raw=await callClaude({messages:[{role:'user',content:`Quiz from:\n\n${summaries}`}],system,maxTokens:1200});
      const data=parseClaudeJson(raw);
      questions=data.questions;
    } catch(e) { renderEmpty(body,{icon:'⚠️',title:'Failed',body:e.message,action:'<button class="btn btn-primary" onclick="startNewQuiz()">Retry</button>'}); quizState.generating=false; return; }
  }

  quizState={questions,idx:0,answers:[],source:'digest',generating:false};
  srAddCards(questions);
  renderQuestion();
}

function startReviewSession() {
  const due=srDueCards();
  if(!due.length) { initQuiz(); return; }
  const questions=due.slice(0,5).map(c=>({...c,isReview:true,srId:c.id}));
  quizState={questions,idx:0,answers:[],source:'review',generating:false};
  renderQuestion();
}

function renderQuestion() {
  const body=document.getElementById('quiz-body');
  if(!body) return;
  const {questions,idx}=quizState;
  const q=questions[idx];
  if(!q) return;
  const letters=['A','B','C','D'];
  body.innerHTML=`<div class="quiz-question">
    ${q.isReview?`<div class="quiz-review-badge">🔁 Review card</div>`:''}
    <div class="quiz-q-num">Question ${idx+1} of ${questions.length}</div>
    <div class="quiz-q-text">${esc(q.q||q.question||'')}</div>
    <div class="quiz-options">
      ${(q.options||[]).map((opt,i)=>`<button class="quiz-option" onclick="answerQuiz(${i})">
        <span class="quiz-option-letter">${letters[i]}</span>
        <span>${esc(opt.replace(/^[A-D]\.\s*/,''))}</span>
      </button>`).join('')}
    </div>
    <div id="quiz-explanation" style="display:none"></div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
    <div class="quiz-dots">${questions.map((_,i)=>`<div class="quiz-dot ${i<idx?'done':i===idx?'current':''}"></div>`).join('')}</div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--t4)">${(q.vendors||[]).map(v=>vendorLabel(v)).join(' · ')}</div>
  </div>`;
}

function answerQuiz(chosen) {
  const {questions,idx}=quizState;
  const q=questions[idx];
  const correct=q.correct??0, isRight=chosen===correct;
  quizState.answers.push({chosen,correct,isRight});

  // Update SR card
  const quality=isRight?4:1;
  if(q.isReview&&q.srId) srUpdateCard(q.srId,quality);
  else if(q.id) srUpdateCard(q.id,quality);

  // Disable options, apply colours
  document.querySelectorAll('.quiz-option').forEach((btn,i)=>{
    btn.setAttribute('disabled','');
    if(i===correct) btn.classList.add('correct');
    else if(i===chosen&&!isRight) btn.classList.add('wrong');
    else btn.classList.add('reveal');
  });

  // Show explanation
  const expEl=document.getElementById('quiz-explanation');
  if(expEl) {
    expEl.style.display='block';
    expEl.className=`quiz-explanation${isRight?'':' wrong'}`;
    const nextLabel=idx<questions.length-1?'Next Question →':'See Results →';
    const nextFn=idx<questions.length-1?'nextQuestion()':'finishQuiz()';
    expEl.innerHTML=`<strong>${isRight?'✅ Correct!':'❌ Not quite.'}</strong> ${esc(q.explanation||'')}
      <div style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="${nextFn}">${nextLabel}</button></div>`;
  }
  if(isRight) toast('Correct! 🎉','✅',1500);
}

function nextQuestion() { quizState.idx++; renderQuestion(); }

function finishQuiz() {
  const {questions,answers,source}=quizState;
  const score=answers.filter(a=>a.isRight).length, total=questions.length;
  const d=getTutor(), today=todayAEST();

  // Streak
  const yest=new Date(Date.now()-86400000).toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'});
  if(d.lastQuizDate===yest) d.quizStreak=(d.quizStreak||0)+1;
  else if(d.lastQuizDate!==today) d.quizStreak=1;
  d.lastQuizDate=today;

  if(!d.quizHistory) d.quizHistory=[];
  d.quizHistory.push({date:new Date().toISOString(),score,total,completed:true,source,questions:questions.map((q,i)=>({...q,userAnswer:answers[i]?.chosen}))});
  if(d.quizHistory.length>90) d.quizHistory=d.quizHistory.slice(-90);
  saveTutor(d);

  // Hide quiz badge
  const badge=document.getElementById('nav-quiz-badge');
  if(badge) badge.classList.add('hidden');

  updateQuizHeader(d);
  showQuizComplete(score,total,false);
  Bus.emit('quiz:completed',{score,total});
}

function showQuizComplete(score,total,alreadyDone) {
  const body=document.getElementById('quiz-body');
  if(!body) return;
  const pct=Math.round((score/total)*100);
  const msg=pct===100?'Perfect! Outstanding.':pct>=66?'Solid work — good understanding.':'Keep at it — review the explanations.';
  const d=getTutor();
  body.innerHTML=`<div class="quiz-complete">
    <div class="quiz-score-big">${score}/${total}</div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--t3);margin-bottom:10px">${pct}% correct${alreadyDone?' · already done today':''}</div>
    <div style="font-size:14px;color:var(--t2);margin-bottom:20px">${msg}</div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      ${!alreadyDone?`<button class="btn btn-secondary btn-sm" onclick="startNewQuiz()">Try again</button>`:''}
      <button class="btn btn-secondary btn-sm" onclick="showPanel('path')">Learning Path →</button>
      <button class="btn btn-secondary btn-sm" onclick="showPanel('scenarios');genScenarios()">Scenarios →</button>
    </div>
    <div style="margin-top:16px;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--g)">🔥 ${d.quizStreak||1} day streak</div>
    <div style="margin-top:6px;font-size:11px;color:var(--t4)">${srStats().due>0?`${srStats().due} review cards due`:'All cards up to date'}</div>
  </div>`;
}

function flagQuizAvailable() {
  const d=getTutor(), today=todayAEST();
  const done=(d.quizHistory||[]).some(q=>q.date?.startsWith(today)&&q.completed);
  if(!done) {
    const badge=document.getElementById('nav-quiz-badge');
    if(badge){badge.textContent='!';badge.classList.remove('hidden');badge.classList.add('alert');}
  }
}
