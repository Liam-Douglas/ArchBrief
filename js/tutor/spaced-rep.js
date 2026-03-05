/* ArchBrief v5 — spaced-rep.js */
/* SM-2 algorithm implementation — augments data.js SR functions */
/* Core algorithm already lives in data.js — this file adds UI helpers */

// Quality ratings mapped to SM-2 quality scores
const SR_QUALITY = { wrong: 1, correct: 4, easy: 5 };

// Get a human-readable next review estimate
function srNextReviewLabel(card) {
  if (!card.nextReview) return 'Now';
  const days = Math.ceil((new Date(card.nextReview) - Date.now()) / 86400000);
  if (days <= 0) return 'Due now';
  if (days === 1) return 'Tomorrow';
  if (days < 7)  return `In ${days} days`;
  if (days < 30) return `In ${Math.round(days/7)} weeks`;
  return `In ${Math.round(days/30)} months`;
}

// Get SR stats summary
function srStats() {
  const d = getTutor();
  const cards = Object.values(d.srCards || {});
  const today = todayAEST();
  return {
    total:    cards.length,
    due:      cards.filter(c => c.nextReview <= today).length,
    mastered: cards.filter(c => c.interval >= 21).length,
    learning: cards.filter(c => c.interval > 0 && c.interval < 21).length,
    new:      cards.filter(c => c.repetitions === 0).length,
  };
}
