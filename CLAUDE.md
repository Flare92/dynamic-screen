# Ritmo – note per l'assistente

Questo repository ha un grafo di conoscenza del codice in `graphify-out/` (generato con graphify).
Prima di leggere i file uno per uno, interroga il grafo: costa circa 24 volte meno token.

- Panoramica: `graphify-out/GRAPH_REPORT.md` (nodi centrali, comunità, connessioni)
- Domande: `graphify query "<domanda>" --budget 1500`
- Percorso tra due simboli: `graphify path "derive()" "weekSchedule()"`
- Spiegazione di un simbolo: `graphify explain "computeProfile()"`
- Dopo modifiche al codice: `graphify update .` (estrazione AST, nessun costo LLM)

Mappa rapida dei moduli (comunità del grafo):
- `js/app.js` – interfaccia, router, viste (Oggi, Piano, Esercizi, Progressi, Profilo, racconto, revisione)
- `js/engine.js` – motore del piano: `derive`, `weekSchedule`/`mixedSchedule`, sessioni, `nutrition`, `generatePlan`, `coachSummary`
- `js/assessment.js` + `js/assess-ui.js` – test fisici, punteggi, composizione corporea, KPI, precisione
- `js/narrative.js` – relazione in testo libero: analisi offline in italiano e analisi con Claude
- `js/gymreview.js` – revisione della scheda di palestra dell’utente: `parseGymList`, `reviewGym` (tieni/cambia/togli/aggiungi), `GYM_PICKS` (elenco da toccare), preferiti nel piano
- `js/diet.js` – alimentazione per tipo di dieta e giornata tipo
- `js/exercises.js`, `js/guide.js`, `js/motions.js` – esercizi, guide tecniche, pose 3D
- `js/viewer3d.js`, `js/sheet.js`, `js/player.js`, `js/fx.js` – 3D, scheda esercizio, allenamento guidato, effetti
- Test: `npm test` (node --test, 38 test)
