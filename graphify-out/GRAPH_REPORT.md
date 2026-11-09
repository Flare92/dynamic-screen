# Graph Report - dynamic-screen  (2026-11-09)

## Corpus Check
- 24 files · ~58,261 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .css 1, .webmanifest 1)

## Summary
- 437 nodes · 1050 edges · 16 communities (12 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.84)
- Token cost: 100,172 input · 0 output

## Community Hubs (Navigation)
- UI app e router
- Motore del piano
- UI test e player guidato
- Valutazione e KPI
- Visualizzatore 3D
- Workflow GitHub Pages
- Relazione testo libero
- Esercizi, movimenti e scheda
- Funzioni utente (README)
- Configurazione npm
- Prodotto e analisi testo
- Design neon
- Pubblicazione e versione SW
- Service worker offline
- Barra di navigazione
- Riepilogo del coach

## God Nodes (most connected - your core abstractions)
1. `route()` - 24 edges
2. `computeProfile()` - 21 edges
3. `fromISO()` - 19 edges
4. `viewToday()` - 17 edges
5. `esc()` - 16 edges
6. `R()` - 16 edges
7. `createViewer()` - 15 edges
8. `kpiSection()` - 14 edges
9. `daysBetween()` - 13 edges
10. `derive()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `window.show(id, frac, muscles)` --shares_data_with--> `MOTION_MAP`  [EXTRACTED]
  dev/pose-lab.html → js/motions.js
- `Pose Lab Dev Page` --calls--> `createViewer()`  [EXTRACTED]
  dev/pose-lab.html → js/viewer3d.js
- `Pose Lab Dev Page` --conceptually_related_to--> `3D Holographic Exercise Mannequin (Three.js)`  [INFERRED]
  dev/pose-lab.html → README.md
- `route()` --indirect_call--> `renderAssessment()`  [INFERRED]
  js/app.js → js/assess-ui.js
- `burst()` --indirect_call--> `frame()`  [INFERRED]
  js/fx.js → js/viewer3d.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Physiological Formulas Feeding the Plan Engine** — readme_mifflin_st_jeor, readme_katch_mcardle, readme_us_navy_body_fat, readme_karvonen_formula, readme_tanaka_formula [INFERRED 0.85]
- **Measured Personalization Loop (v3)** — readme_guided_physical_tests, readme_reference_norms, readme_tailored_engine, readme_kpi_milestones, readme_precision_index [EXTRACTED 1.00]
- **3D Animation Authoring and Inspection Workflow** — readme_motion_keyframes, readme_3d_exercise_mannequin, dev_pose_lab, dev_pose_lab_show [EXTRACTED 1.00]

## Communities (16 total, 4 thin omitted)

### Community 0 - "UI app e router"
Cohesion: 0.07
Nodes (85): $app, applyAction(), assessCard(), beginAssessment(), bindWizardInputs(), BLOCK_LABELS, bmiLabel(), CAT_LABEL (+77 more)

### Community 1 - "Motore del piano"
Cohesion: 0.05
Nodes (74): DIET_LABEL, dietNotes(), F, MEAL_LABEL, MEAL_SHARE, mealPlan(), MENUS, PROTEIN_FACTOR (+66 more)

### Community 2 - "UI test e player guidato"
Cohesion: 0.12
Nodes (45): AREA_LABEL, cancelAssessment(), disposeViewer(), doneScreen(), esc(), finishStopwatch(), fmtMin(), fmtS() (+37 more)

### Community 3 - "Valutazione e KPI"
Cohesion: 0.08
Nodes (38): planCtx(), ageBand(), AREAS, BF_LABEL, bfLevel(), bodyFat(), buildKpis(), CHAIR_MID (+30 more)

### Community 4 - "Visualizzatore 3D"
Cohesion: 0.08
Nodes (37): motionFor(), applyPose(), bandLine(), barbell(), bodyMat(), _box, buildRig(), C (+29 more)

### Community 5 - "Workflow GitHub Pages"
Cohesion: 0.07
Nodes (29): concurrency, cancel-in-progress, group, environment, needs, runs-on, steps, name (+21 more)

### Community 6 - "Relazione testo libero"
Cohesion: 0.11
Nodes (26): aiKey(), analyzeStory(), bindStory(), draftFromStory(), qchips(), storySave(), storyText(), toggleDictation() (+18 more)

### Community 7 - "Esercizi, movimenti e scheda"
Cohesion: 0.12
Nodes (23): BY_ID, EXERCISES, gait(), K(), MAP, mirror(), MOTION_MAP, MOTIONS (+15 more)

### Community 8 - "Funzioni utente (README)"
Cohesion: 0.10
Nodes (20): Pose Lab Dev Page, window.show(id, frac, muscles), #player Guided Workout Dialog, 3D Holographic Exercise Mannequin (Three.js), Adaptive Plan Feedback (easy/right/hard/pain), 4-week Progression Cycles, Guided 3D Physical Tests, Full-screen Guided Workout (+12 more)

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
- **18 isolated node(s):** `Mixed Session Weeks`, `Diet-type Nutrition and Typical Day`, `Plan Summary Coach Report`, `ACSM / YMCA / Senior Fitness Test Reference Values`, `U.S. Navy Body Fat Formula` (+13 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 124 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `load3D()` connect `UI test e player guidato` to `UI app e router`, `Visualizzatore 3D`, `Esercizi, movimenti e scheda`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `route()` (e.g. with `viewLibrary()` and `viewPlan()`) actually correct?**
  _`route()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Mixed Session Weeks`, `Diet-type Nutrition and Typical Day`, `Plan Summary Coach Report` to the rest of the system?**
  _18 weakly-connected nodes found - possible missing edges._
- **Should `UI app e router` be split into smaller, more focused modules?**
  _Cohesion score 0.06818181818181818 - nodes in this community are weakly interconnected._
- **Why does `createViewer()` connect `Visualizzatore 3D` to `Funzioni utente (README)`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `Motore del piano` be split into smaller, more focused modules?**
  _Cohesion score 0.053703703703703705 - nodes in this community are weakly interconnected._
- **Should `UI test e player guidato` be split into smaller, more focused modules?**
  _Cohesion score 0.11591836734693878 - nodes in this community are weakly interconnected._