/* ═══════════════════════════════════════════════════════════
   ArchBrief v5 — data.js
   All persistence: localStorage, daily.json loading,
   feedback sync, spaced repetition state management.
═══════════════════════════════════════════════════════════ */

// ── STORAGE KEYS ────────────────────────────────────────
const KEYS = {
  TUTOR:         'ab5_tutor',
  PROFILE:       'ab5_profile',
  FEEDBACK:      'ab5_feedback',
  DAILY_CACHE:   'ab5_daily_cache',
  VENDORS_ACTIVE:'ab5_vendors',
  APS_MODE:      'ab5_aps',
  SETTINGS:      'ab5_settings',
  MORNING_DONE:  'ab5_morning',
};

// ── SAFE JSON STORAGE ────────────────────────────────────
function storageGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch(e) {
    console.warn(`storageGet(${key}) failed:`, e);
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch(e) {
    console.warn(`storageSet(${key}) failed:`, e);
    return false;
  }
}

// ── PROFILE ──────────────────────────────────────────────
function getProfile() {
  return storageGet(KEYS.PROFILE, {
    articlesRead:   0,
    questionsAsked: 0,
    savedCount:     0,
    quizStreak:     0,
    lastActiveDate: null,
    vendorCounts:   {},
    weeklyGoal:     7,
    weeklySessions: 0,
    weekStart:      null,
  });
}

function saveProfile(p) {
  storageSet(KEYS.PROFILE, p);
}

function trackActivity(type, meta = {}) {
  const p = getProfile();
  const today = todayAEST();

  // Reset weekly counter if new week
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  if (!p.weekStart || p.weekStart < weekAgo) {
    p.weekStart      = today;
    p.weeklySessions = 0;
  }

  if (p.lastActiveDate !== today) {
    p.weeklySessions++;
    p.lastActiveDate = today;
  }

  if (type === 'article') {
    p.articlesRead++;
    (meta.vendors || []).forEach(v => {
      p.vendorCounts[v] = (p.vendorCounts[v] || 0) + 1;
    });
  }
  if (type === 'chat')    p.questionsAsked++;
  if (type === 'save')    p.savedCount++;
  if (type === 'unsave')  p.savedCount = Math.max(0, p.savedCount - 1);

  saveProfile(p);
}

// ── TUTOR DATA ───────────────────────────────────────────
function getTutor() {
  return storageGet(KEYS.TUTOR, {
    glossary:        [],
    moduleProgress:  {},   // moduleId -> 'reading'|'tested'|'mastered'
    moduleNotes:     {},   // moduleId -> string
    quizHistory:     [],   // [{date, score, total, questions, source}]
    quizStreak:      0,
    lastQuizDate:    null,
    srCards:         {},   // cardId -> SRCard
    scenarioHistory: [],
    savedArticles:   [],
  });
}

function saveTutor(d) {
  storageSet(KEYS.TUTOR, d);
}

// ── SPACED REPETITION (SM-2) ─────────────────────────────
// Based on SuperMemo SM-2 algorithm
// https://www.supermemo.com/en/archives1990-2015/english/ol/sm2

const SR_MIN_EF = 1.3;  // Minimum ease factor
const SR_DEFAULT_EF = 2.5; // Default ease factor

function srCard(id, question, answer, vendors = [], topic = '') {
  return {
    id,
    question,
    answer,
    vendors,
    topic,
    ef:            SR_DEFAULT_EF,  // Ease factor
    interval:      0,               // Days until next review
    repetitions:   0,               // Successful reviews in a row
    nextReview:    todayAEST(),     // Next review date (YYYY-MM-DD)
    lastReview:    null,
    totalReviews:  0,
    correctCount:  0,
  };
}

// Quality: 0-5 (0-2 = fail, 3-5 = pass)
// Maps from our UI: wrong=1, correct=4, easy=5
function srReview(card, quality) {
  const c = { ...card };
  c.lastReview   = todayAEST();
  c.totalReviews = (c.totalReviews || 0) + 1;

  if (quality >= 3) {
    // Correct answer
    c.correctCount = (c.correctCount || 0) + 1;
    if (c.repetitions === 0)      c.interval = 1;
    else if (c.repetitions === 1) c.interval = 6;
    else                          c.interval = Math.round(c.interval * c.ef);

    c.repetitions++;
  } else {
    // Wrong answer — reset
    c.repetitions = 0;
    c.interval    = 1;
  }

  // Update ease factor: EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
  c.ef = Math.max(SR_MIN_EF, c.ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Set next review date
  const next = new Date();
  next.setDate(next.getDate() + c.interval);
  c.nextReview = next.toISOString().split('T')[0];

  return c;
}

function srDueCards() {
  const d    = getTutor();
  const today = todayAEST();
  return Object.values(d.srCards || {})
    .filter(c => c.nextReview <= today)
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview));
}

function srAddCards(questions) {
  const d = getTutor();
  if (!d.srCards) d.srCards = {};

  questions.forEach((q, i) => {
    const id = `q_${Date.now()}_${i}`;
    if (!d.srCards[id]) {
      d.srCards[id] = srCard(id, q.q, q.options[q.correct], q.vendors || [], q.topicTag || '');
      d.srCards[id].question    = q.q;
      d.srCards[id].options     = q.options;
      d.srCards[id].correct     = q.correct;
      d.srCards[id].explanation = q.explanation;
    }
  });

  saveTutor(d);
}

function srUpdateCard(id, quality) {
  const d = getTutor();
  if (!d.srCards) d.srCards = {};
  if (!d.srCards[id]) return;
  d.srCards[id] = srReview(d.srCards[id], quality);
  saveTutor(d);
}

// ── FEEDBACK ─────────────────────────────────────────────
function getFeedback() {
  return storageGet(KEYS.FEEDBACK, { ratings: [], pendingSync: [] });
}

function saveFeedback(fb) {
  storageSet(KEYS.FEEDBACK, fb);
}

function addFeedbackRating(article, rating) {
  const fb = getFeedback();

  // Remove existing rating for this article
  fb.ratings     = fb.ratings.filter(r => r.title !== article.title);
  fb.pendingSync = (fb.pendingSync || []).filter(r => r.title !== article.title);

  const entry = {
    title:    article.title,
    rating,
    vendors:  article.vendors || [],
    topicTag: article.topicTag || '',
    ratedAt:  new Date().toISOString(),
  };

  fb.ratings.push(entry);
  fb.pendingSync.push(entry);

  // Cap at 500 ratings
  if (fb.ratings.length > 500) fb.ratings = fb.ratings.slice(-500);

  saveFeedback(fb);

  // Attempt auto-sync to Cloudflare Worker
  syncFeedback();

  return entry;
}

function getFeedbackForArticle(title) {
  const fb = getFeedback();
  return fb.ratings.find(r => r.title === title)?.rating || null;
}

// ── FEEDBACK SYNC (Cloudflare Worker) ────────────────────
const FEEDBACK_WORKER_URL = ''; // Set in settings after Worker deployment

async function syncFeedback() {
  const settings = getSettings();
  const workerUrl = settings.feedbackWorkerUrl;
  if (!workerUrl) return { status: 'no-worker' };

  const fb = getFeedback();
  if (!fb.pendingSync?.length) return { status: 'nothing-to-sync' };

  try {
    const res = await fetch(workerUrl + '/sync', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ratings: fb.pendingSync }),
    });

    if (res.ok) {
      fb.pendingSync = [];
      fb.lastSynced  = new Date().toISOString();
      saveFeedback(fb);
      return { status: 'synced', count: fb.pendingSync.length };
    } else {
      return { status: 'error', code: res.status };
    }
  } catch(e) {
    return { status: 'network-error', error: e.message };
  }
}

function getSyncStatus() {
  const fb = getFeedback();
  const pending = (fb.pendingSync || []).length;
  if (pending === 0)   return { status: 'synced',  label: 'Synced', pending: 0 };
  if (!getSettings().feedbackWorkerUrl) return { status: 'no-worker', label: `${pending} pending (worker not configured)`, pending };
  return { status: 'pending', label: `${pending} unsynced`, pending };
}

// ── DAILY.JSON ───────────────────────────────────────────
let _dailyData = null;

async function loadDailyJson() {
  // Return cached if already loaded this session
  if (_dailyData) return _dailyData;

  try {
    const res = await fetch('./data/daily.json?t=' + todayAEST(), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    _dailyData = data;

    // Cache date for freshness check
    storageSet(KEYS.DAILY_CACHE, { dateKey: data.dateKey, loadedAt: new Date().toISOString() });

    return data;
  } catch(e) {
    console.warn('Could not load daily.json:', e.message);
    return null;
  }
}

function getDailyData() { return _dailyData; }

function isDailyFresh() {
  if (!_dailyData) return false;
  return _dailyData.dateKey === todayAEST();
}

// ── PATH CONTENT ─────────────────────────────────────────
let _pathContent = null;

async function loadPathContent() {
  if (_pathContent) return _pathContent;
  try {
    const res = await fetch('./data/path_content.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _pathContent = await res.json();
    return _pathContent;
  } catch(e) {
    console.warn('Could not load path_content.json — using built-in content');
    return null;
  }
}

// ── SETTINGS ─────────────────────────────────────────────
function getSettings() {
  return storageGet(KEYS.SETTINGS, {
    apiKey:            '',
    feedbackWorkerUrl: '',
    reminderTime:      '05:00',
    reminderEnabled:   false,
    apsMode:           true,
    readDepth:         'standard',  // 'quick' | 'standard' | 'deep'
    theme:             'dark',
  });
}

function saveSettings(s) {
  storageSet(KEYS.SETTINGS, s);
}

function updateSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  saveSettings(s);
}

// ── ACTIVE VENDORS ───────────────────────────────────────
function getActiveVendors() {
  return storageGet(KEYS.VENDORS_ACTIVE, window.VENDOR_KEYS || []);
}

function setActiveVendors(keys) {
  storageSet(KEYS.VENDORS_ACTIVE, keys);
}

function toggleVendor(key) {
  const active = getActiveVendors();
  const idx    = active.indexOf(key);
  if (idx === -1) active.push(key);
  else            active.splice(idx, 1);
  setActiveVendors(active);
  return active;
}

// ── MORNING ROUTINE ──────────────────────────────────────
function isMorningDone() {
  const record = storageGet(KEYS.MORNING_DONE, {});
  return record.date === todayAEST() && record.done === true;
}

function markMorningDone(score, total) {
  storageSet(KEYS.MORNING_DONE, {
    date:      todayAEST(),
    done:      true,
    score,
    total,
    completedAt: new Date().toISOString(),
  });
}

// ── SAVED ARTICLES ───────────────────────────────────────
function getSaved() {
  const d = getTutor();
  return d.savedArticles || [];
}

function saveArticle(article) {
  const d = getTutor();
  if (!d.savedArticles) d.savedArticles = [];
  const exists = d.savedArticles.find(a => a.title === article.title);
  if (!exists) {
    d.savedArticles.unshift({ ...article, savedAt: new Date().toISOString() });
    if (d.savedArticles.length > 200) d.savedArticles = d.savedArticles.slice(0, 200);
    saveTutor(d);
    trackActivity('save');
    return true;
  }
  return false;
}

function unsaveArticle(title) {
  const d = getTutor();
  d.savedArticles = (d.savedArticles || []).filter(a => a.title !== title);
  saveTutor(d);
  trackActivity('unsave');
}

function isArticleSaved(title) {
  return getSaved().some(a => a.title === title);
}

// ── GLOSSARY ─────────────────────────────────────────────
function getGlossary() {
  const d = getTutor();
  return d.glossary || [];
}

function addGlossaryEntry(info) {
  const d = getTutor();
  if (!d.glossary) d.glossary = [];

  const existing = d.glossary.find(g => g.term?.toLowerCase() === info.term?.toLowerCase());
  if (existing) {
    existing.lookupCount = (existing.lookupCount || 1) + 1;
    existing.lastSeen    = new Date().toISOString();
  } else {
    d.glossary.unshift({
      ...info,
      addedAt:     new Date().toISOString(),
      lastSeen:    new Date().toISOString(),
      lookupCount: 1,
    });
    if (d.glossary.length > 500) d.glossary = d.glossary.slice(0, 500);
  }
  saveTutor(d);
  return !existing; // true = new entry
}

function removeGlossaryEntry(term) {
  const d = getTutor();
  d.glossary = (d.glossary || []).filter(g => g.term !== term);
  saveTutor(d);
}

// ── UTILITIES ────────────────────────────────────────────
function todayAEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); // YYYY-MM-DD
}

function formatDateAEST(iso) {
  return new Date(iso).toLocaleDateString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// Export
if (typeof module !== 'undefined') {
  module.exports = {
    KEYS, storageGet, storageSet,
    getProfile, saveProfile, trackActivity,
    getTutor, saveTutor,
    srCard, srReview, srDueCards, srAddCards, srUpdateCard,
    getFeedback, saveFeedback, addFeedbackRating, getFeedbackForArticle, syncFeedback, getSyncStatus,
    loadDailyJson, getDailyData, isDailyFresh,
    loadPathContent,
    getSettings, saveSettings, updateSetting,
    getActiveVendors, setActiveVendors, toggleVendor,
    isMorningDone, markMorningDone,
    getSaved, saveArticle, unsaveArticle, isArticleSaved,
    getGlossary, addGlossaryEntry, removeGlossaryEntry,
    todayAEST, formatDateAEST, daysSince,
  };
} else {
  // Attach all to window for script tag usage
  const exports = {
    KEYS, storageGet, storageSet,
    getProfile, saveProfile, trackActivity,
    getTutor, saveTutor,
    srCard, srReview, srDueCards, srAddCards, srUpdateCard,
    getFeedback, saveFeedback, addFeedbackRating, getFeedbackForArticle, syncFeedback, getSyncStatus,
    loadDailyJson, getDailyData, isDailyFresh,
    loadPathContent,
    getSettings, saveSettings, updateSetting,
    getActiveVendors, setActiveVendors, toggleVendor,
    isMorningDone, markMorningDone,
    getSaved, saveArticle, unsaveArticle, isArticleSaved,
    getGlossary, addGlossaryEntry, removeGlossaryEntry,
    todayAEST, formatDateAEST, daysSince,
  };
  Object.assign(window, exports);
}
