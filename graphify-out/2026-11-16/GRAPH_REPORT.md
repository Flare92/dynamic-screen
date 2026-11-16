# Graph Report - dynamic-screen  (2026-11-15)

## Corpus Check
- 34 files · ~81,943 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .css 1, .webmanifest 1)

## Summary
- 577 nodes · 1607 edges · 21 communities (16 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9bc5fbb4`
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
- flow.js
- Configurazione npm
- Prodotto e analisi testo
- Design neon
- Pubblicazione e versione SW
- Service worker offline
- Barra di navigazione
- Riepilogo del coach
- analyzeStory
- gymreview.js
- narrative.test.js
- indagine.test.js
- ai.js

## God Nodes (most connected - your core abstractions)
1. `esc()` - 32 edges
2. `Ritmo – note per l'assistente` - 32 edges
3. `route()` - 30 edges
4. `viewToday()` - 28 edges
5. `R()` - 25 edges
6. `derive()` - 24 edges
7. `fromISO()` - 23 edges
8. `computeProfile()` - 21 edges
9. `getPlan()` - 19 edges
10. `viewCouple()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Ritmo – note per l'assistente` --references--> `aiConfig()`  [INFERRED]
  CLAUDE.md → js/ai.js
- `Ritmo – note per l'assistente` --references--> `ask()`  [INFERRED]
  CLAUDE.md → js/ai.js
- `Ritmo – note per l'assistente` --references--> `aiRicette()`  [INFERRED]
  CLAUDE.md → js/ai.js
- `Ritmo – note per l'assistente` --references--> `aiGiornata()`  [INFERRED]
  CLAUDE.md → js/ai.js
- `Ritmo – note per l'assistente` --references--> `coupleMenu()`  [INFERRED]
  CLAUDE.md → js/diet.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Measured Personalization Loop (v3)** — readme_guided_physical_tests, readme_reference_norms, readme_tailored_engine, readme_kpi_milestones, readme_precision_index [EXTRACTED 1.00]
- **Physiological Formulas Feeding the Plan Engine** — readme_mifflin_st_jeor, readme_katch_mcardle, readme_us_navy_body_fat, readme_karvonen_formula, readme_tanaka_formula [INFERRED 0.85]

## Communities (21 total, 5 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.05
Nodes (132): aiKey(), ALIAS, $app, applyAction(), askDayAI(), backBtn(), beginAssessment(), bindFlowInputs() (+124 more)

### Community 1 - "Motore del piano"
Cohesion: 0.05
Nodes (91): Ritmo – note per l'assistente, AREAS, LEVEL_LABEL, bestTogetherDay(), buildCard(), CARD_VERSION, decodeCard(), encodeCard() (+83 more)

### Community 2 - "UI test e player guidato"
Cohesion: 0.06
Nodes (69): AREA_LABEL, assessmentActive(), cancelAssessment(), disposeViewer(), doneScreen(), esc(), finishStopwatch(), fmtMin() (+61 more)

### Community 3 - "Valutazione e KPI"
Cohesion: 0.11
Nodes (31): ageBand(), BF_LABEL, bfLevel(), bodyFat(), buildKpis(), CHAIR_MID, clamp(), computeProfile() (+23 more)

### Community 4 - "diet.js"
Cohesion: 0.07
Nodes (43): BOOST, BOOST_BY_MEAL, boostersFor(), CARB_COTTURA, CARB_MAIN, CARB_NOME, CARB_SWEET, coupleMenu() (+35 more)

### Community 5 - "Workflow GitHub Pages"
Cohesion: 0.07
Nodes (29): concurrency, cancel-in-progress, group, environment, needs, runs-on, steps, name (+21 more)

### Community 6 - "narrative.js"
Cohesion: 0.21
Nodes (12): clauses(), gymLine(), iso(), MONTHS, near(), norm(), NUM, parseNarrative() (+4 more)

### Community 7 - "Guided 3D Physical Tests"
Cohesion: 0.11
Nodes (18): #player Guided Workout Dialog, 3D Holographic Exercise Mannequin (Three.js), Adaptive Plan Feedback (easy/right/hard/pain), 4-week Progression Cycles, Guided 3D Physical Tests, Full-screen Guided Workout, Karvonen Heart Rate Zones, Katch-McArdle Metabolism (+10 more)

### Community 8 - "flow.js"
Cohesion: 0.13
Nodes (11): MEASURES, PAIN_LEVELS, PAIN_REGIONS, INTOLLERANZE, NON_CIBI, CONDITIONS, EQUIPMENT, FREQ (+3 more)

### Community 9 - "Configurazione npm"
Cohesion: 0.22
Nodes (8): description, name, private, scripts, start, test, type, version

### Community 10 - "Prodotto e analisi testo"
Cohesion: 0.29
Nodes (6): Ritmo App Shell (index.html), Advanced Analysis with Claude, Diet-type Nutrition and Typical Day, Mixed Session Weeks, Built-in Offline Italian Rule Analyzer, Ritmo PWA (personalized workout routine)

### Community 11 - "Design neon"
Cohesion: 0.67
Nodes (3): Animated Background FX (grid, orbs, scan), Shared SVG Gradients (ecgGrad, ringGrad, areaGrad), Neon Lab Design (v2)

### Community 16 - "analyzeStory"
Cohesion: 0.19
Nodes (13): analyzeStory(), bindStory(), qchips(), startFlow(), storySave(), toggleDictation(), updateStoryCoverage(), wordCount() (+5 more)

### Community 17 - "gymreview.js"
Cohesion: 0.23
Nodes (9): CATALOG, GYM_PICKS, gymFromNarrative(), NEED, parseGymList(), PAT_LABEL, VERDICT_COUNT, VERDICT_LABEL (+1 more)

### Community 19 - "indagine.test.js"
Cohesion: 0.16
Nodes (13): finishFlow(), mealStructure(), PASSI, diagnosi(), GOAL_ORDER, goalFromSogni(), n1(), SOGNI (+5 more)

### Community 23 - "ai.js"
Cohesion: 0.11
Nodes (26): aiConfig(), aiError(), aiGiornata(), aiProvider(), aiRicette(), ask(), askClaude(), askGemini() (+18 more)

## Knowledge Gaps
- **19 isolated node(s):** `Ritmo App Shell (index.html)`, `Diet-type Nutrition and Typical Day`, `Mixed Session Weeks`, `Animated Background FX (grid, orbs, scan)`, `Shared SVG Gradients (ecgGrad, ringGrad, areaGrad)` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 161 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `computeProfile()` connect `Valutazione e KPI` to `app.js`, `Motore del piano`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 31 inferred relationships involving `Ritmo – note per l'assistente` (e.g. with `aiConfig()` and `aiGiornata()`) actually correct?**
  _`Ritmo – note per l'assistente` has 31 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Ritmo App Shell (index.html)`, `Diet-type Nutrition and Typical Day`, `Mixed Session Weeks` to the rest of the system?**
  _19 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0514161220043573 - nodes in this community are weakly interconnected._
- **Why does `parseNarrative()` connect `narrative.js` to `app.js`, `analyzeStory`, `narrative.test.js`, `gymreview.js`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `route()` (e.g. with `viewCouple()` and `viewDay()`) actually correct?**
  _`route()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Should `Motore del piano` be split into smaller, more focused modules?**
  _Cohesion score 0.05111683848797251 - nodes in this community are weakly interconnected._