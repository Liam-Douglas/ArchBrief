# ArchBrief v5 — Product Requirements Document
## Learning Platform Enhancement

**Version:** 1.0
**Date:** March 2026
**Status:** Draft — pending implementation

---

## 1. Background & Purpose

ArchBrief is a daily IT intelligence platform for a Solution Architect in the Australian Public Sector. Its primary delivery is a pre-generated daily brief (news, APS compliance radar, quiz, topic deep-dives). The platform also hosts a 27-module Learning Path, a spaced-repetition quiz engine (SM-2), scenario challenges, and a click-to-explain glossary.

**The core problem:** ArchBrief is currently optimised for *consumption*, not *learning*. Reading articles is passive. The spaced repetition system and learning path exist as islands, disconnected from the daily content flow. The learning path has no content. Users receive no signal about where their knowledge gaps actually are. This PRD defines requirements to fix that.

**Guiding principle:** Every feature must close a specific learning loop. If a feature doesn't produce a measurable change in knowledge retention or skill application, it doesn't belong here.

---

## 2. User Persona

**Single user.** ArchBrief is a personal tool (GitHub Pages, single-user).

| Attribute | Detail |
|---|---|
| Role | Assistant Solution Architect, IBM, Australian Public Sector |
| Context | Advises APS agencies on cloud, security, AI, and platform choices across 9 vendors |
| Learning goal | Stay current across 9 vendor landscapes; build certifiable depth in priority domains |
| Time budget | ~8 minutes at 5am (morning routine), 20–30 min/day total |
| Pain point | Too much to know; uncertain which vendors/topics need deeper study |

---

## 3. Goals & Success Metrics

| Goal | Metric | Target |
|---|---|---|
| Learning path is actually useful | Modules have populated content | 100% (27/27) |
| Glossary terms are retained, not just collected | % of glossary terms with an active SR card | >80% |
| Learner knows their weak areas | Topic accuracy shown in Progress | Implemented |
| Active recall embedded in daily flow | Post-article retrieval prompt completed | Present in digest |
| Morning routine reinforces yesterday | Recall step before today's headline | Implemented |
| Scenario difficulty grows with the learner | Completed scenarios tracked, difficulty increases | Implemented |
| Weekly learning summary | Friday email includes learning section | Implemented |

---

## 4. Current State Summary

### What works
- SM-2 spaced repetition: quiz cards with `ef`, `interval`, `repetitions`, `nextReview`, `correctCount` fields
- 27 learning path modules across 6 domains — metadata only, no content
- Quiz history stored per session with `score`, `total`, `source`, `date`
- Glossary terms stored with `term`, `plain`, `architectContext`, `apsNote`, `category`, `lookupCount`
- Scenario history stored with `title`, `score`, `date`, `answer`
- Progress panel: quiz sparkline, SR card counts, module completion heatmap, cert readiness, recent scenarios
- Morning routine: 4-step flow (headline → articles → quiz → done)

### What doesn't work / is missing
- `path_content.json` is empty — every module shows a placeholder
- Glossary → SR pipeline: glossary terms are never queued for review
- Quiz results have no topic/vendor breakdown — can't identify weak areas
- Post-article retrieval: reading is purely passive
- Morning routine has no "recall yesterday" step
- Scenario difficulty doesn't adapt; all scenarios are regenerated fresh
- Weekly recap has no learning section
- Learning path mastery is self-declared with no evidence gate
- Article → module linking: no connection between daily news and learning modules

---

## 5. Feature Requirements

Features are ordered by: **Learning Impact × Effort ratio** (highest first).

---

### F-01: Populate Learning Path Content
**Priority:** P0 — Blocker. The learning path currently has no content.

**Problem:** The monthly generator (`generate_monthly.py`) is fully implemented and correct. `path_content.json` exists but is empty (`{"modules": {}, "generatedAt": null}`). Every module shows the fallback message: *"Content loads from your monthly-updated path_content.json."*

**User story:** As a learner, when I open a learning path module I should see 6–8 paragraphs of current, APS-contextualised content with key facts, so I can actually learn from it.

**Acceptance criteria:**
- All 27 modules in `path_content.json` have `content`, `keyFacts`, `apsConsiderations`, `currentAsOf` fields
- Content renders in the module detail drawer in `path.js` (the `livingMod.content` branch already handles this)
- Monthly GitHub Actions workflow runs on the 1st and refreshes stale content (>30 days old)
- Module shows "Updated Mar 2026" timestamp in the detail view

**Technical notes:**
- No code changes needed. Run `python .github/scripts/generate_monthly.py` once to seed.
- Add a `workflow_dispatch` trigger to `monthly.yml` so it can be manually triggered without waiting for the 1st.
- `monthly.yml` currently has no manual trigger — add `workflow_dispatch: {}`.

**Effort:** XS (run script + one-line yml change)
**Dependencies:** `ANTHROPIC_API_KEY` secret set in GitHub

---

### F-02: Glossary → Spaced Repetition Pipeline
**Priority:** P0 — Closes the most obvious learning loop gap.

**Problem:** Every term the user looks up via the explainer popup is saved to `getGlossary()` with rich data (`plain`, `architectContext`, `apsNote`). None of these terms ever appear in the SR queue. The glossary is a write-only reference — terms are collected but never reviewed. This directly contradicts spaced repetition's purpose.

**User story:** As a learner, when I look up a term and it gets saved to my glossary, I want it to automatically appear in my spaced repetition review queue so I'll actually remember it over time.

**Acceptance criteria:**
- When `addToGlossary()` is called in `data.js`, an SR card is automatically created for the term
- SR card format:
  ```js
  {
    id: `gloss_${slugify(term)}`,
    question: `What is ${term}?`,
    answer: plain + '\n\nArchitect context: ' + architectContext,
    // No options[] — glossary cards are free-recall, not multiple-choice
    explanation: apsNote || architectContext,
    vendors: [categoryToVendorKey(category)],
    topic: 'glossary',
    isGlossary: true,
    // SM-2 defaults:
    ef: 2.5, interval: 0, repetitions: 0,
    nextReview: todayAEST(), correctCount: 0, totalReviews: 0
  }
  ```
- When a glossary term is removed (`removeGlossaryEntry()`), the corresponding SR card is also deleted
- If a term already has an SR card (looked up again), update the card's content but do NOT reset its SM-2 state
- Quiz panel: glossary SR cards appear in the review session alongside quiz cards (they are in `srCards` already, so `srDueCards()` will include them automatically)
- Quiz panel: glossary cards are displayed as free-recall (show question → user selects "I knew it" / "I didn't") rather than multiple-choice, because they have no `options[]` array

**Data model change:**
- Add `isGlossary: true` flag to glossary-sourced SR cards
- Quiz `renderQuestion()`: detect `!q.options?.length` and render a two-button self-grade UI instead of ABCD

**Technical notes:**
- `addToGlossary()` is in `data.js` — add `srAddGlossaryCard(term, plain, architectContext, apsNote, category)` call there
- `srAddGlossaryCard()`: new function in `data.js` (or `spaced-rep.js`) that upserts an SR card without resetting SM-2 state
- `categoryToVendorKey(cat)`: map glossary categories (Cloud, Security, AI, etc.) to vendor keys, or leave `vendors: []` if no direct match
- Glossary cards with `isGlossary: true` can be filtered out of the quiz summary stats so they don't inflate "quiz accuracy" (they are self-graded, not objectively scored)

**Effort:** S (~60 lines across `data.js` + `quiz.js`)
**Dependencies:** F-01 (none technically, but glossary SR is only useful once learning path seeds the vocab)

---

### F-03: Quiz Topic & Vendor Performance Breakdown
**Priority:** P1 — Enables self-directed learning.

**Problem:** `quizHistory` stores every session's `score/total` but nothing per-topic or per-vendor. SR cards store `topic` and `vendors` fields but these are never aggregated. The user has no way to know: "I score 40% on security questions" or "I'm weakest on HashiCorp content." Without this signal, the learning path recommendation is a guess.

**User story:** As a learner, I want to see my quiz accuracy broken down by topic (arch, security, ai, devops, industry) and by vendor, so I know exactly where to focus.

**Acceptance criteria:**
- Progress panel gains a new "Quiz Performance by Topic" card showing a bar chart (5 topics: arch, security, ai, devops, industry) with % accuracy and count
- Progress panel gains a "Quiz Performance by Vendor" card showing mini bars per vendor, colour-coded by vendor brand colour
- Calculation uses the last 30 sessions from `quizHistory`, pulling per-question data from `quizHistory[n].questions`
- Weak topics (< 60% accuracy, ≥ 3 questions attempted) are highlighted in amber
- The "next best module" recommendation: below the Progress header, show 1 sentence: *"Focus recommendation: Security & Zero Trust (43% accuracy)"* linking to the relevant LP domain

**Data model change:**
- `quizHistory` entries currently store `questions` — verify this is an array of `{q, correct, userAnswer, vendors, topicTag}` objects. If `userAnswer` is missing, add it in `finishQuiz()` in `quiz.js`.
- No schema change needed if `questions` is already populated correctly.

**Technical notes:**
- Aggregation function in `progress.js`:
  ```js
  function quizTopicStats(history) {
    const stats = {}; // { topicTag: { correct, total } }
    for (const session of history.slice(-30)) {
      for (const q of session.questions || []) {
        const tag = q.topicTag || 'unknown';
        stats[tag] = stats[tag] || { correct: 0, total: 0 };
        stats[tag].total++;
        if (q.userAnswer === q.correct) stats[tag].correct++;
      }
    }
    return stats;
  }
  ```
- Vendor aggregation: same pattern using `q.vendors[0]` as the key
- Weak topic detection: `correct/total < 0.6 && total >= 3`

**Effort:** M (~100 lines in `progress.js`, data verification in `quiz.js`)
**Dependencies:** Verify `quizHistory[n].questions` stores `userAnswer` and `topicTag` per question

---

### F-04: Post-Article Retrieval Prompt
**Priority:** P1 — Highest-leverage learning technique for passive-to-active conversion.

**Problem:** Reading articles in the Digest is completely passive — scroll, absorb, move on. No forced retrieval occurs. Learning science consistently shows that attempting to recall information immediately after reading (even unsuccessfully) dramatically improves long-term retention versus re-reading.

**User story:** As a learner, after I finish reading a digest article I want a brief prompt asking me to state the architect implication in my own words, so I'm forced to process rather than just scan.

**Acceptance criteria:**
- Each article card in the Digest panel has a "Reflect" button at the bottom (below the existing 👍/👎 feedback buttons)
- Clicking "Reflect" expands a text area with the prompt: *"In one sentence: what's the main architect implication for your APS projects?"*
- User types their reflection and clicks "Save note" — the text is saved to the article's entry in `savedArticles` (or a new `articleNotes` key in tutor state) with `articleId`, `note`, `savedAt`
- No Claude call — pure text save
- If the user has already written a reflection on this article, show it instead of the empty prompt
- The reflection is visible when the article is opened in the Saved panel
- SR card bonus: if the user writes a reflection and the article has `topicTag` and `vendors`, offer a one-tap "Add to review cards" button that creates an SR card from `title` + `lead` as question, reflection as answer

**Data model change:**
- Add `articleNotes: {}` to tutor state: `{ [articleId]: { note, savedAt } }`
- `articleId` = digest article title slug (`slugify(article.title)`)

**Technical notes:**
- Reflect button added in `renderArticleCard()` in `digest.js` (currently ends with feedback buttons)
- `saveArticleNote(articleId, note)`: upsert into `tutor.articleNotes`, call `saveTutor()`
- Expand/collapse via CSS, no panel re-render needed
- Article identifier: use `encodeURIComponent(article.title).slice(0, 40)` as a stable key

**Effort:** S (~50 lines in `digest.js` + 5 lines in `data.js`)
**Dependencies:** None

---

### F-05: Morning Routine — Yesterday's Recall Step
**Priority:** P1 — Adds spaced retrieval at the optimal 24-hour interval.

**Problem:** The morning routine starts with today's headline immediately. The 24-hour interval is the most critical review interval in spaced learning (the first time a memory is tested after initial encoding). Currently nothing in the routine leverages yesterday's content.

**User story:** As a learner, before I see today's brief I want a single prompt asking what I remember from yesterday, so I reinforce yesterday's learning at the 24-hour mark.

**Acceptance criteria:**
- Morning routine gains a new Step 0 ("Recall") inserted before the existing Step 0 ("Headline")
- Step ordering: `recall → headline → articles → quiz → done`
- Recall step shows: yesterday's digest summary (from `history.json` last entry, or from a stored snapshot) and the prompt: *"Before today's brief — name one thing you remember from yesterday."*
- Text input, 3–5 words minimum to proceed (or a "Skip" link)
- Response is saved to `tutor.morningRecalls[]`: `{ date, prompt, response }` — not graded
- If no yesterday data is available (first run, or yesterday's generation failed), step is silently skipped
- Progress bar label updated: `Recall · Headline · Articles · Quiz · Done`

**Data model change:**
- Add `morningRecalls: []` to tutor state (max 30 entries, FIFO)
- Store yesterday's digest summary in `MORNING_DONE` when morning is completed: `{ ..., yesterdaySummary: digest.summary }`

**Technical notes:**
- `morning.js`: add `'recall'` to `MORNING_STEPS` array before `'headline'`
- Yesterday summary source: `storageGet(KEYS.MORNING_DONE, {}).yesterdaySummary` — written the previous day when morning completes
- If `yesterdaySummary` is falsy, `morningStep` starts at 1 (headline) not 0
- `renderMorningStep()`: add `morningStep === 0` branch for recall UI
- `morningNext()`: no change needed — it just increments the step

**Effort:** S (~60 lines in `morning.js`, ~5 lines in `data.js`)
**Dependencies:** None (degrades gracefully if no yesterday data)

---

### F-06: Article → Learning Path Linking
**Priority:** P2 — Bridges the consumption/learning gap.

**Problem:** When a daily article covers a topic that maps to a learning module (e.g., an article about Terraform maps to `plat-01 HashiCorp Terraform`), there's no visual connection. The user reads the news without realising it's directly relevant to a module they're studying or should start.

**User story:** As a learner, when a digest or explorer article is about a topic that maps to a learning module, I want to see a chip linking me to that module, so news naturally feeds into structured learning.

**Acceptance criteria:**
- After the vendor tags on each article card, show a "📚 Module: [Module Name]" chip if a match is found
- Matching rules (in priority order):
  1. Exact vendor key match: article `vendors` ∩ module `vendors` is non-empty AND
  2. Topic tag match: article `topicTag` maps to domain (`security` → Security & Zero Trust, `ai` → AI & Data, `devops` → Platform & DevOps, etc.)
- If multiple modules match, show the one the user has most recently started (status `reading` or `tested`)
- Clicking the chip navigates to `showPanel('path')` and opens the relevant domain/module
- Module chip shows the module's current status: `○` `◑` `◕` `●`

**Technical notes:**
- `getModuleForArticle(article)` utility in `path.js` or `core.js`:
  ```js
  function getModuleForArticle(article) {
    const topicToDomain = {
      security: 'security', ai: 'ai', devops: 'platform',
      arch: 'cloud', industry: 'aps'
    };
    const domainId = topicToDomain[article.topicTag];
    const prog = getTutor().moduleProgress || {};
    const candidates = LP_DOMAINS
      .filter(d => !domainId || d.id === domainId)
      .flatMap(d => d.modules)
      .filter(m => (m.vendors || []).some(v => (article.vendors || []).includes(v)));
    // Prefer in-progress modules
    return candidates.sort((a, b) => {
      const order = { reading: 0, tested: 1, mastered: 2, 'not-started': 3 };
      return (order[prog[a.id]] ?? 3) - (order[prog[b.id]] ?? 3);
    })[0] || null;
  }
  ```
- Chip HTML appended in `renderArticleCard()` in `digest.js` and `renderExplorerArticle()` in `explorer.js`
- On chip click: `showPanel('path')` then `Bus.emit('path:highlight', { moduleId })` — add listener in `path.js` to open the domain and scroll to module

**Effort:** M (~80 lines across `digest.js`, `explorer.js`, `path.js`)
**Dependencies:** None

---

### F-07: Quiz-Gated Module Mastery
**Priority:** P2 — Adds evidence to self-declared mastery.

**Problem:** A module moves to `mastered` status when the user clicks "Mark Mastered ✓" — completely self-declared. No verification of actual understanding occurs. This means the progress heatmap and cert readiness scores are unreliable signals.

**User story:** As a learner, I want the "Mastered" status to require that I've correctly answered at least one quiz question on this module's topic, so the status means something.

**Acceptance criteria:**
- "Mark Mastered" button is visible only if the user has at least 1 correct SR card answer for the module's topic/vendor
- The check: `srCards` where `vendors` overlaps the module's `vendors` AND `correctCount >= 1`
- If no qualifying SR card exists, "Mark Mastered" button is replaced with: *"Answer a quiz question on this topic first →"* that navigates to the quiz panel
- Previously mastered modules retain their status (no regression for existing data)
- Alternative path: completing a module's in-Chat Q&A (`chatAbout(mod.name)`) also unlocks mastery — tracked by saving a `chatEvidenced: [moduleId]` array in tutor state when a chat covers the module topic

**Technical notes:**
- `canMarkMastered(moduleId)` in `path.js`:
  ```js
  function canMarkMastered(moduleId) {
    const mod = findModule(moduleId);
    const cards = Object.values(getTutor().srCards || {});
    return cards.some(c =>
      c.correctCount >= 1 &&
      (c.vendors || []).some(v => (mod.vendors || []).includes(v))
    );
  }
  ```
- `buildModuleRow()` already has the "Mark Mastered" button — wrap in `canMarkMastered()` check
- Previous `mastered` status entries: skip check (only gate new transitions)

**Effort:** S (~30 lines in `path.js`)
**Dependencies:** F-02 (glossary SR) — increases the pool of qualifying cards

---

### F-08: Interleaved Quiz Mode
**Priority:** P2 — Improves long-term retention over blocked practice.

**Problem:** The daily quiz is always 3 questions from today's articles (blocked practice). Interleaved practice — mixing topics and timeframes — produces better long-term retention than blocked practice, even though it feels harder. Currently the SR review queue is entirely separate from the daily quiz.

**User story:** As a learner, I want my daily quiz to automatically include one SR review card from my deck, so I'm practising interleaved recall across time without needing to run a separate review session.

**Acceptance criteria:**
- When `startNewQuiz()` runs and there are SR due cards, automatically append 1 due card to the 3 daily questions (total: 4 questions)
- The interleaved card appears in a random position (not always last)
- It is marked with `isReview: true` so the "🔁 Review card" badge renders
- If there are 0 due cards, quiz remains 3 questions as before
- The interleaved card is answered the same as a regular review card (SM-2 update on answer)
- Quiz complete screen: show "1 review card included" note

**Technical notes:**
- `startNewQuiz()` in `quiz.js`: after loading `questions`, call `srDueCards().slice(0, 1)` and splice the result into a random index
- `quizState.source` becomes `'digest+review'` when a review card is included
- No prompt change needed — the card already has `q`, `options`, `correct`, `explanation`

**Effort:** XS (~15 lines in `quiz.js`)
**Dependencies:** F-02 (more SR cards in the deck = more value)

---

### F-09: Scenario Score Trend & Difficulty Tracking
**Priority:** P3 — Closes the scenario learning loop.

**Problem:** `scenarioHistory` records scores (`"7/10"`) and dates but these are never visualised. Scenarios are always regenerated at the same difficulty mix (1 intermediate, 1 advanced, 1 expert per session). There's no adaptation to the user's improving performance.

**User story:** As a learner, I want to see my scenario scores trending over time, and I want scenarios to get harder as I consistently score well.

**Acceptance criteria (trend):**
- Progress panel's "Recent Scenario Scores" section gains a simple sparkline (like the quiz sparkline) showing score/10 over the last 10 scenarios
- Scores shown as numeric (7, 8, 9 etc.) not strings
- Rolling 5-scenario average shown

**Acceptance criteria (adaptive difficulty):**
- `gen_scenarios()` in `scenarios.js` receives a difficulty bias based on recent scores:
  - Average ≤ 5/10 (last 5): bias = `['beginner', 'intermediate', 'advanced']`
  - Average 5–7/10: bias = `['intermediate', 'advanced', 'expert']` (current default)
  - Average ≥ 8/10: bias = `['advanced', 'expert', 'expert']`
- Difficulty bias passed to Claude's system prompt: *"Today's difficulties: [intermediate, advanced, expert]"*
- No backend change — computed in `scenarios.js` before calling Claude

**Data model change:**
- `scenarioHistory[n].score`: normalize to integer (parse `"7/10"` → `7`) when saving in `scenarios.js`
- Existing string scores handled by: `parseInt(score) || 0`

**Technical notes:**
- Difficulty bias function in `scenarios.js`:
  ```js
  function scenarioDifficultyBias() {
    const scores = (getTutor().scenarioHistory || [])
      .slice(-5).map(s => parseInt(s.score) || 0);
    if (!scores.length) return ['intermediate','advanced','expert'];
    const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
    if (avg >= 8) return ['advanced','expert','expert'];
    if (avg <= 5) return ['beginner','intermediate','advanced'];
    return ['intermediate','advanced','expert'];
  }
  ```
- Progress panel sparkline: reuse `renderQuizSparkline()` pattern with scenario scores

**Effort:** S (~50 lines across `scenarios.js` + `progress.js`)
**Dependencies:** None

---

### F-10: Weekly Recap — Learning Section
**Priority:** P3 — Closes the weekly learning feedback loop.

**Problem:** The Friday weekly recap (email and in-app) covers news highlights and vendor counts but has no learning content. The user gets no weekly signal about their learning progress, quiz trends, or what to focus on next week.

**User story:** As a learner, I want my Friday recap to include a "Learning Week" section showing quiz accuracy, SR cards due, modules completed, and a focus recommendation, so I can plan the following week's study.

**Acceptance criteria (in-app recap panel):**
- `recap.js` renders a "Learning This Week" card below the vendor highlights:
  - Quiz accuracy this week (sessions where `date` is within last 7 days)
  - SR cards due vs. mastered
  - Modules newly marked as `mastered` this week
  - One sentence: *"Focus next week: [weakest topic]"*

**Acceptance criteria (Friday email):**
- `build_email_html()` in `generate_daily.py` receives a `learningStats` object
- New email section: "Your Learning Week" with quiz accuracy %, SR cards due, modules completed
- `gen_weekly()` or `main()` in `generate_daily.py` computes learning stats from `data/daily.json` quiz field and the values passed in (the script can't access localStorage, but `data/daily.json` has quiz questions generated and `data/history.json` has article counts)

**Technical notes:**
- In-app: purely from localStorage — `getTutor().quizHistory`, `srStats()`, `getTutor().moduleProgress`
- Email: `generate_daily.py` can only estimate — use `quiz.questions.length` from today's `daily.json` and a note to check the app for full stats. Full learning stats live in localStorage only.
- `recap.js`: add `renderLearningCard()` called from `renderRecap()`, using same localStorage sources as `progress.js`

**Effort:** S for in-app (~50 lines in `recap.js`), S for email note (~15 lines in `generate_daily.py`)
**Dependencies:** F-03 (topic breakdown needed for "weakest topic" recommendation)

---

### F-11: Glossary → Module Linking
**Priority:** P4 — Polish, improves discoverability.

**Problem:** Glossary terms have a `category` field (Cloud, Security, AI, DevOps, APS, Networking, Database, Platform). Learning path modules are in the same domains. There's no connection between a glossary term and the module that covers it.

**User story:** As a learner, when I view a glossary term I want to see "Related module: [Module Name] →" so I can navigate directly to structured learning on that topic.

**Acceptance criteria:**
- In the `showGlossDetail()` popup, below the APS note, show "Related module: [Module Name] →" if a match is found
- Matching: find the first LP module where `module.vendors` overlaps the term's vendor-mapped category OR module name contains a word from the term
- Clicking navigates to the Learning Path and highlights the module
- If no module match, the section is omitted

**Technical notes:**
- `findModuleForTerm(term, category)`: check LP_DOMAINS for vendor overlap from `categoryToVendorKey(category)`
- Add to `showGlossDetail()` in `glossary.js` before the actions row

**Effort:** XS (~20 lines in `glossary.js`)
**Dependencies:** None

---

## 6. Data Model Changes Summary

| Key | Change | Feature |
|---|---|---|
| `tutor.srCards` | New cards with `isGlossary: true`, `topic: 'glossary'`, no `options[]` | F-02 |
| `tutor.articleNotes` | New: `{ [articleId]: { note, savedAt } }` | F-04 |
| `tutor.morningRecalls` | New: `[{ date, prompt, response }]` max 30 | F-05 |
| `MORNING_DONE` | Add `yesterdaySummary: string` field | F-05 |
| `tutor.quizHistory[n].questions` | Ensure `userAnswer` and `topicTag` per question | F-03 |
| `tutor.scenarioHistory[n].score` | Normalise to integer on save | F-09 |
| `tutor.chatEvidenced` | New: `[moduleId]` — modules evidenced via chat | F-07 |

All changes are additive. No migration needed — missing keys default gracefully via `||` guards already present throughout `data.js`.

---

## 7. Non-Functional Requirements

- **No new dependencies** — all features use existing APIs (SM-2, Claude via proxy, localStorage)
- **Offline-first** — all new UI features work without network (they operate on localStorage). Only SR card creation for glossary requires no Claude call.
- **No breaking changes** — all data model changes are additive; existing localStorage state from v5 is compatible
- **Performance** — no feature should block UI rendering. Article → module matching runs synchronously on `LP_DOMAINS` (27 modules × 7 articles = ~189 comparisons, negligible)
- **Single-user** — no multi-user considerations. All state is localStorage.
- **Privacy** — article notes and morning recalls stay in localStorage only; never synced to GitHub (unlike `feedback.json`)

---

## 8. Out of Scope

The following are explicitly excluded from this PRD:

| Item | Reason |
|---|---|
| Multi-user support | ArchBrief is a personal tool |
| Authentication | Single-user, no auth needed |
| Feynman prompts with AI grading | Adds Claude call per article — cost not justified for P1 |
| Adaptive morning quiz difficulty | Low evidence of benefit vs. complexity |
| Social features (sharing, leaderboard) | Single-user |
| Mobile app (native) | PWA already serves this |
| Custom module creation | Out of scope for v5 |
| Integration with external LMS | Not planned |
| Analytics dashboard for multiple users | N/A |

---

## 9. Implementation Order

Based on dependencies and impact:

| Phase | Features | Rationale |
|---|---|---|
| Phase 1 | F-01, F-08 | Unblock the learning path (content); quick SR win |
| Phase 2 | F-02, F-04, F-05 | Core active learning loops (glossary SR, retrieval, recall) |
| Phase 3 | F-03, F-06 | Visibility and connection features |
| Phase 4 | F-07, F-09, F-10 | Polish and adaptation |
| Phase 5 | F-11 | Discoverability polish |

Total estimated implementation effort: ~17–22 hours across all features (excluding F-01 which is a script run).

---

## 10. Open Questions

1. **F-02 — Free-recall SR UI:** For glossary cards with no `options[]`, the quiz UI needs a self-grade flow ("I knew it" / "I didn't"). Should this use a simpler 2-button rating (wrong/correct) or expose the full SM-2 quality scale (0–5)? Recommendation: 2-button (wrong=1, correct=4) for simplicity.

2. **F-04 — Article note persistence:** Should article reflections sync to GitHub via the feedback worker, or stay localStorage-only? Recommendation: localStorage only — private reflections, no external sync.

3. **F-05 — Recall step skip rate:** If the recall step is skipped frequently, it should be removed or made optional. Add a `morningRecallSkips` counter — if skipped 5 days in a row, offer to permanently disable.

4. **F-07 — Mastery gate strictness:** The "1 correct SR card on this vendor" gate is loose (a user could get a single AWS card right and unlock all AWS modules). Should the gate require 1 correct card *per module's specific topic tag*? Recommendation: vendor match is sufficient for v1; tighten if feedback indicates it's too easy.

5. **F-01 — Cost optimisation (resolved):** Implemented a three-part strategy in `generate_monthly.py`:
   - **Model:** switched `claude-opus-4-6` → `claude-sonnet-4-6` (~80% cost reduction)
   - **Two-tier web search:** 7 fast-moving modules (`ai-01–04`, `cf-08`, `aps-01`, `aps-03`) get `web_search_20250305` enabled; 20 stable foundational modules use training knowledge only (~70% input token reduction for stable tier)
   - **Two-tier refresh cadence:** fast-moving modules refresh every 30 days; stable modules refresh every 90 days (~60% fewer calls in steady-state months)
   - Combined steady-state cost reduction: ~95% vs. original Opus + all-search approach
