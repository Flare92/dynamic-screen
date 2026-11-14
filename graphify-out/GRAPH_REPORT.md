# Graph Report - dynamic-screen  (2026-11-14)

## Corpus Check
- 29 files · ~71,305 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .css 1, .webmanifest 1)

## Summary
- 496 nodes · 1300 edges · 21 communities (17 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8fa5ad8c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- Motore del piano
- UI test e player guidato
- Valutazione e KPI
- diet.js
- Workflow GitHub Pages
- narrative.js
- Guided 3D Physical Tests
- esc
- Configurazione npm
- Prodotto e analisi testo
- Design neon
- Pubblicazione e versione SW
- Service worker offline
- Barra di navigazione
- Riepilogo del coach
- viewToday
- route
- fromISO
- startPlayer
- gymPickerHTML

## God Nodes (most connected - your core abstractions)
1. `viewToday()` - 26 edges
2. `esc()` - 26 edges
3. `route()` - 25 edges
4. `computeProfile()` - 21 edges
5. `R()` - 20 edges
6. `fromISO()` - 19 edges
7. `derive()` - 18 edges
8. `Ritmo – note per l'assistente` - 16 edges
9. `viewTraining()` - 15 edges
10. `strengthSession()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Ritmo – note per l'assistente` --references--> `weekMenu()`  [INFERRED]
  CLAUDE.md → js/diet.js
- `Ritmo – note per l'assistente` --references--> `passiCoperti()`  [INFERRED]
  CLAUDE.md → js/flow.js
- `Ritmo – note per l'assistente` --references--> `passiPer()`  [INFERRED]
  CLAUDE.md → js/flow.js
- `Ritmo – note per l'assistente` --references--> `generatePlan()`  [INFERRED]
  CLAUDE.md → js/engine.js
- `Ritmo – note per l'assistente` --references--> `parseGymList()`  [INFERRED]
  CLAUDE.md → js/gymreview.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Measured Personalization Loop (v3)** — readme_guided_physical_tests, readme_reference_norms, readme_tailored_engine, readme_kpi_milestones, readme_precision_index [EXTRACTED 1.00]
- **Physiological Formulas Feeding the Plan Engine** — readme_mifflin_st_jeor, readme_katch_mcardle, readme_us_navy_body_fat, readme_karvonen_formula, readme_tanaka_formula [INFERRED 0.85]

## Communities (21 total, 4 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.07
Nodes (40): ALIAS, analyzeStory(), $app, bindFlowInputs(), BLOCK_LABELS, cap(), CAT_LABEL, coachToday() (+32 more)

### Community 1 - "Motore del piano"
Cohesion: 0.06
Nodes (76): Ritmo – note per l'assistente, dietNotes(), mealPlan(), mealStructure(), alerts(), allowed(), alternativesFor(), buildSession() (+68 more)

### Community 2 - "UI test e player guidato"
Cohesion: 0.08
Nodes (61): AREA_LABEL, cancelAssessment(), disposeViewer(), doneScreen(), esc(), finishStopwatch(), fmtMin(), fmtS() (+53 more)

### Community 3 - "Valutazione e KPI"
Cohesion: 0.10
Nodes (33): kpiSection(), ageBand(), AREAS, BF_LABEL, bfLevel(), bodyFat(), buildKpis(), CHAIR_MID (+25 more)

### Community 4 - "diet.js"
Cohesion: 0.06
Nodes (41): MEASURES, PAIN_LEVELS, PAIN_REGIONS, BOOST, BOOST_BY_MEAL, boostersFor(), DAYS, DIET_EXCLUDE (+33 more)

### Community 5 - "Workflow GitHub Pages"
Cohesion: 0.07
Nodes (29): concurrency, cancel-in-progress, group, environment, needs, runs-on, steps, name (+21 more)

### Community 6 - "narrative.js"
Cohesion: 0.07
Nodes (33): DEMOS, hasDemo(), generatePlan(), BY_ID, EXERCISES, CATALOG, GYM_PICKS, gymFromNarrative() (+25 more)

### Community 7 - "Guided 3D Physical Tests"
Cohesion: 0.11
Nodes (18): #player Guided Workout Dialog, 3D Holographic Exercise Mannequin (Three.js), Adaptive Plan Feedback (easy/right/hard/pain), 4-week Progression Cycles, Guided 3D Physical Tests, Full-screen Guided Workout, Karvonen Heart Rate Zones, Katch-McArdle Metabolism (+10 more)

### Community 8 - "esc"
Cohesion: 0.14
Nodes (21): backBtn(), bmiLabel(), chips(), coach(), esc(), gymAnalysisHTML(), libCards(), mergedAssess() (+13 more)

### Community 9 - "Configurazione npm"
Cohesion: 0.22
Nodes (8): description, name, private, scripts, start, test, type, version

### Community 10 - "Prodotto e analisi testo"
Cohesion: 0.29
Nodes (6): Ritmo App Shell (index.html), Advanced Analysis with Claude, Diet-type Nutrition and Typical Day, Mixed Session Weeks, Built-in Offline Italian Rule Analyzer, Ritmo PWA (personalized workout routine)

### Community 11 - "Design neon"
Cohesion: 0.67
Nodes (3): Animated Background FX (grid, orbs, scan), Shared SVG Gradients (ecgGrad, ringGrad, areaGrad), Neon Lab Design (v2)

### Community 16 - "viewToday"
Cohesion: 0.25
Nodes (19): exList(), fmt(), getPlan(), gymCard(), gymReview(), habitsCard(), hasGym(), hdr() (+11 more)

### Community 17 - "route"
Cohesion: 0.15
Nodes (17): aiKey(), bindStory(), latestWeight(), qchips(), route(), storySave(), storyText(), toggleDictation() (+9 more)

### Community 18 - "fromISO"
Cohesion: 0.30
Nodes (16): currentWeek(), daysSinceAssess(), historyList(), restCard(), suggestions(), viewProgress(), weightChart(), addDays() (+8 more)

### Community 19 - "startPlayer"
Cohesion: 0.33
Nodes (11): applyAction(), beginAssessment(), dayLog(), finishFlow(), markDone(), rerender(), save(), startPlayer() (+3 more)

### Community 20 - "gymPickerHTML"
Cohesion: 0.43
Nodes (8): bindGym(), gymLines(), gymPickerHTML(), gymPickerRedraw(), gymRefresh(), recap(), toggleGymPick(), lineIsPick()

## Knowledge Gaps
- **19 isolated node(s):** `Ritmo App Shell (index.html)`, `Diet-type Nutrition and Typical Day`, `Mixed Session Weeks`, `Animated Background FX (grid, orbs, scan)`, `Shared SVG Gradients (ecgGrad, ringGrad, areaGrad)` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 141 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `computeProfile()` connect `Valutazione e KPI` to `app.js`, `esc`, `viewToday`, `Motore del piano`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `route()` (e.g. with `viewFlow()` and `viewFood()`) actually correct?**
  _`route()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Ritmo App Shell (index.html)`, `Diet-type Nutrition and Typical Day`, `Mixed Session Weeks` to the rest of the system?**
  _19 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0664451827242525 - nodes in this community are weakly interconnected._
- **Why does `parseNarrative()` connect `narrative.js` to `app.js`, `route`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `Motore del piano` be split into smaller, more focused modules?**
  _Cohesion score 0.05759493670886076 - nodes in this community are weakly interconnected._
- **Why does `derive()` connect `Motore del piano` to `app.js`, `esc`, `fromISO`, `narrative.js`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._