# Graph Report - dynamic-screen  (2026-11-09)

## Corpus Check
- 25 files · ~63,302 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .css 1, .webmanifest 1)

## Summary
- 477 nodes · 1180 edges · 16 communities (12 shown, 4 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `960c989f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- UI app e router
- Motore del piano
- UI test e player guidato
- Valutazione e KPI
- Visualizzatore 3D
- Workflow GitHub Pages
- narrative.js
- Guided 3D Physical Tests
- Funzioni utente (README)
- Configurazione npm
- Prodotto e analisi testo
- Design neon
- Pubblicazione e versione SW
- Service worker offline
- Barra di navigazione
- Riepilogo del coach

## God Nodes (most connected - your core abstractions)
1. `route()` - 26 edges
2. `computeProfile()` - 21 edges
3. `esc()` - 20 edges
4. `fromISO()` - 19 edges
5. `viewToday()` - 18 edges
6. `R()` - 17 edges
7. `derive()` - 16 edges
8. `createViewer()` - 15 edges
9. `kpiSection()` - 14 edges
10. `parseNarrative()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Ritmo – note per l'assistente` --references--> `parseGymList()`  [INFERRED]
  CLAUDE.md → js/gymreview.js
- `Ritmo – note per l'assistente` --references--> `reviewGym()`  [INFERRED]
  CLAUDE.md → js/gymreview.js
- `Ritmo – note per l'assistente` --references--> `coachSummary()`  [INFERRED]
  CLAUDE.md → js/engine.js
- `Ritmo – note per l'assistente` --references--> `derive()`  [INFERRED]
  CLAUDE.md → js/engine.js
- `Ritmo – note per l'assistente` --references--> `generatePlan()`  [INFERRED]
  CLAUDE.md → js/engine.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **3D Animation Authoring and Inspection Workflow** — readme_motion_keyframes, readme_3d_exercise_mannequin, dev_pose_lab, dev_pose_lab_show [EXTRACTED 1.00]
- **Measured Personalization Loop (v3)** — readme_guided_physical_tests, readme_reference_norms, readme_tailored_engine, readme_kpi_milestones, readme_precision_index [EXTRACTED 1.00]
- **Physiological Formulas Feeding the Plan Engine** — readme_mifflin_st_jeor, readme_katch_mcardle, readme_us_navy_body_fat, readme_karvonen_formula, readme_tanaka_formula [INFERRED 0.85]

## Communities (16 total, 4 thin omitted)

### Community 0 - "UI app e router"
Cohesion: 0.06
Nodes (103): aiKey(), analyzeStory(), $app, applyAction(), assessCard(), beginAssessment(), bindStory(), bindWizardInputs() (+95 more)

### Community 1 - "Motore del piano"
Cohesion: 0.05
Nodes (80): Ritmo – note per l'assistente, AREAS, LEVEL_LABEL, PAIN_REGIONS, DIET_LABEL, dietNotes(), F, MEAL_LABEL (+72 more)

### Community 2 - "UI test e player guidato"
Cohesion: 0.10
Nodes (54): AREA_LABEL, cancelAssessment(), disposeViewer(), doneScreen(), esc(), finishStopwatch(), fmtMin(), fmtS() (+46 more)

### Community 3 - "Valutazione e KPI"
Cohesion: 0.10
Nodes (33): ageBand(), BF_LABEL, bfLevel(), bodyFat(), buildKpis(), CHAIR_MID, clamp(), computeProfile() (+25 more)

### Community 4 - "Visualizzatore 3D"
Cohesion: 0.08
Nodes (37): motionFor(), applyPose(), bandLine(), barbell(), bodyMat(), _box, buildRig(), C (+29 more)

### Community 5 - "Workflow GitHub Pages"
Cohesion: 0.07
Nodes (29): concurrency, cancel-in-progress, group, environment, needs, runs-on, steps, name (+21 more)

### Community 6 - "narrative.js"
Cohesion: 0.07
Nodes (41): bindGym(), gymAnalysisHTML(), gymApply(), gymChosenHTML(), gymPickerHTML(), gymReview(), planCtx(), viewGym() (+33 more)

### Community 7 - "Guided 3D Physical Tests"
Cohesion: 0.10
Nodes (20): Pose Lab Dev Page, window.show(id, frac, muscles), #player Guided Workout Dialog, 3D Holographic Exercise Mannequin (Three.js), Adaptive Plan Feedback (easy/right/hard/pain), 4-week Progression Cycles, Guided 3D Physical Tests, Full-screen Guided Workout (+12 more)

### Community 8 - "Funzioni utente (README)"
Cohesion: 0.12
Nodes (16): BY_ID, EXERCISES, gait(), K(), MAP, mirror(), MOTION_MAP, MOTIONS (+8 more)

### Community 9 - "Configurazione npm"
Cohesion: 0.22
Nodes (8): description, name, private, scripts, start, test, type, version

### Community 10 - "Prodotto e analisi testo"
Cohesion: 0.29
Nodes (6): Ritmo App Shell (index.html), Advanced Analysis with Claude, Diet-type Nutrition and Typical Day, Mixed Session Weeks, Built-in Offline Italian Rule Analyzer, Ritmo PWA (personalized workout routine)

### Community 11 - "Design neon"
Cohesion: 0.67
Nodes (3): Animated Background FX (grid, orbs, scan), Shared SVG Gradients (ecgGrad, ringGrad, areaGrad), Neon Lab Design (v2)

## Knowledge Gaps
- **18 isolated node(s):** `Ritmo App Shell (index.html)`, `Diet-type Nutrition and Typical Day`, `Mixed Session Weeks`, `Animated Background FX (grid, orbs, scan)`, `Shared SVG Gradients (ecgGrad, ringGrad, areaGrad)` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 135 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `load3D()` connect `UI test e player guidato` to `UI app e router`, `Visualizzatore 3D`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `route()` (e.g. with `viewGym()` and `viewLibrary()`) actually correct?**
  _`route()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Ritmo App Shell (index.html)`, `Diet-type Nutrition and Typical Day`, `Mixed Session Weeks` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI app e router` be split into smaller, more focused modules?**
  _Cohesion score 0.05695970695970696 - nodes in this community are weakly interconnected._
- **Why does `createViewer()` connect `Visualizzatore 3D` to `Guided 3D Physical Tests`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Should `Motore del piano` be split into smaller, more focused modules?**
  _Cohesion score 0.05266106442577031 - nodes in this community are weakly interconnected._
- **Should `UI test e player guidato` be split into smaller, more focused modules?**
  _Cohesion score 0.09548022598870057 - nodes in this community are weakly interconnected._