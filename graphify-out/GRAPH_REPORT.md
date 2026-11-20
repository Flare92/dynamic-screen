# Graph Report - dynamic-screen  (2026-11-20)

## Corpus Check
- 34 files · ~83,923 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .css 1, .webmanifest 1)

## Summary
- 587 nodes · 1658 edges · 21 communities (17 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 80 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1b726368`
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
- coppia-giornata.test.js
- Configurazione npm
- Prodotto e analisi testo
- Design neon
- Pubblicazione e versione SW
- Service worker offline
- Barra di navigazione
- Riepilogo del coach
- weekMenu
- Ritmo – note per l'assistente
- ai.test.js
- flow.js
- ai.js

## God Nodes (most connected - your core abstractions)
1. `esc()` - 34 edges
2. `Ritmo – note per l'assistente` - 32 edges
3. `route()` - 31 edges
4. `viewToday()` - 28 edges
5. `R()` - 26 edges
6. `fromISO()` - 26 edges
7. `derive()` - 25 edges
8. `computeProfile()` - 21 edges
9. `getPlan()` - 20 edges
10. `viewCouple()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Ritmo – note per l'assistente` --references--> `derive()`  [INFERRED]
  CLAUDE.md → js/engine.js
- `Ritmo – note per l'assistente` --references--> `strengthSession()`  [INFERRED]
  CLAUDE.md → js/engine.js
- `Ritmo – note per l'assistente` --references--> `mixedSchedule()`  [INFERRED]
  CLAUDE.md → js/engine.js
- `Ritmo – note per l'assistente` --references--> `weekSchedule()`  [INFERRED]
  CLAUDE.md → js/engine.js
- `Ritmo – note per l'assistente` --references--> `nutrition()`  [INFERRED]
  CLAUDE.md → js/engine.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Measured Personalization Loop (v3)** — readme_guided_physical_tests, readme_reference_norms, readme_tailored_engine, readme_kpi_milestones, readme_precision_index [EXTRACTED 1.00]
- **Physiological Formulas Feeding the Plan Engine** — readme_mifflin_st_jeor, readme_katch_mcardle, readme_us_navy_body_fat, readme_karvonen_formula, readme_tanaka_formula [INFERRED 0.85]

## Communities (21 total, 4 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.06
Nodes (123): aiKey(), ALIAS, $app, askDayAI(), backBtn(), beginAssessment(), bindFlowInputs(), bindGym() (+115 more)

### Community 1 - "Motore del piano"
Cohesion: 0.07
Nodes (72): dietNotes(), mealPlan(), alerts(), allowed(), allowedExercises(), alternativesFor(), buildSession(), cardioModality() (+64 more)

### Community 2 - "UI test e player guidato"
Cohesion: 0.07
Nodes (66): AREA_LABEL, assessmentActive(), cancelAssessment(), disposeViewer(), doneScreen(), esc(), finishStopwatch(), fmtMin() (+58 more)

### Community 3 - "Valutazione e KPI"
Cohesion: 0.10
Nodes (33): ageBand(), AREAS, BF_LABEL, bfLevel(), bodyFat(), buildKpis(), CHAIR_MID, clamp() (+25 more)

### Community 4 - "diet.js"
Cohesion: 0.07
Nodes (32): BOOST, BOOST_BY_MEAL, CARB_COTTURA, CARB_MAIN, CARB_NOME, CARB_SWEET, DAYS, DIET_EXCLUDE (+24 more)

### Community 5 - "Workflow GitHub Pages"
Cohesion: 0.07
Nodes (29): concurrency, cancel-in-progress, group, environment, needs, runs-on, steps, name (+21 more)

### Community 6 - "narrative.js"
Cohesion: 0.07
Nodes (37): analyzeStory(), bindStory(), qchips(), storySave(), storyText(), toggleDictation(), updateStoryCoverage(), viewStory() (+29 more)

### Community 7 - "Guided 3D Physical Tests"
Cohesion: 0.11
Nodes (18): #player Guided Workout Dialog, 3D Holographic Exercise Mannequin (Three.js), Adaptive Plan Feedback (easy/right/hard/pain), 4-week Progression Cycles, Guided 3D Physical Tests, Full-screen Guided Workout, Karvonen Heart Rate Zones, Katch-McArdle Metabolism (+10 more)

### Community 8 - "coppia-giornata.test.js"
Cohesion: 0.12
Nodes (28): applyAction(), applyPick(), dayLog(), markDone(), partLog(), rerender(), save(), shareMyCode() (+20 more)

### Community 9 - "Configurazione npm"
Cohesion: 0.22
Nodes (8): description, name, private, scripts, start, test, type, version

### Community 10 - "Prodotto e analisi testo"
Cohesion: 0.29
Nodes (6): Ritmo App Shell (index.html), Advanced Analysis with Claude, Diet-type Nutrition and Typical Day, Mixed Session Weeks, Built-in Offline Italian Rule Analyzer, Ritmo PWA (personalized workout routine)

### Community 11 - "Design neon"
Cohesion: 0.67
Nodes (3): Animated Background FX (grid, orbs, scan), Shared SVG Gradients (ecgGrad, ringGrad, areaGrad), Neon Lab Design (v2)

### Community 16 - "weekMenu"
Cohesion: 0.33
Nodes (10): boostersFor(), coupleMenu(), dishesFor(), excludedTags(), lim(), mainSource(), portion(), shoppingList() (+2 more)

### Community 17 - "Ritmo – note per l'assistente"
Cohesion: 0.39
Nodes (7): Ritmo – note per l'assistente, aiGiornata(), aiRicette(), ask(), findRecipes(), foodLabel(), pantryRecipes()

### Community 18 - "ai.test.js"
Cohesion: 0.33
Nodes (5): GEMINI_MODEL, cfg, ok(), reply(), schema

### Community 19 - "flow.js"
Cohesion: 0.08
Nodes (28): domandeMancanti(), finishFlow(), startFlow(), MEASURES, PAIN_LEVELS, PAIN_REGIONS, INTOLLERANZE, mealStructure() (+20 more)

### Community 23 - "ai.js"
Cohesion: 0.14
Nodes (21): aiConfig(), aiError(), aiProvider(), askClaude(), askGemini(), callGemini(), GEMINI_MODELS, geminiModelInUse() (+13 more)

## Knowledge Gaps
- **19 isolated node(s):** `Ritmo App Shell (index.html)`, `Diet-type Nutrition and Typical Day`, `Mixed Session Weeks`, `Animated Background FX (grid, orbs, scan)`, `Shared SVG Gradients (ecgGrad, ringGrad, areaGrad)` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 162 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `computeProfile()` connect `Valutazione e KPI` to `app.js`, `Motore del piano`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 31 inferred relationships involving `Ritmo – note per l'assistente` (e.g. with `aiConfig()` and `aiGiornata()`) actually correct?**
  _`Ritmo – note per l'assistente` has 31 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Ritmo App Shell (index.html)`, `Diet-type Nutrition and Typical Day`, `Mixed Session Weeks` to the rest of the system?**
  _19 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05561804774403199 - nodes in this community are weakly interconnected._
- **Why does `parseNarrative()` connect `narrative.js` to `app.js`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `route()` (e.g. with `viewCouple()` and `viewDay()`) actually correct?**
  _`route()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Should `Motore del piano` be split into smaller, more focused modules?**
  _Cohesion score 0.06516105146242132 - nodes in this community are weakly interconnected._