# Ritmo – note per l'assistente

Questo repository ha un grafo di conoscenza del codice in `graphify-out/` (generato con graphify).
Prima di leggere i file uno per uno, interroga il grafo: costa circa 24 volte meno token.

- Panoramica: `graphify-out/GRAPH_REPORT.md` (nodi centrali, comunità, connessioni)
- Domande: `graphify query "<domanda>" --budget 1500`
- Percorso tra due simboli: `graphify path "derive()" "weekSchedule()"`
- Spiegazione di un simbolo: `graphify explain "computeProfile()"`
- Dopo modifiche al codice: `graphify update .` (estrazione AST, nessun costo LLM)

Mappa rapida dei moduli (comunità del grafo):
- `js/app.js` – interfaccia, router, viste (Oggi, Allenamento, Alimentazione, Progressi, Profilo, percorso guidato, racconto, perché)
- `js/flow.js` – percorso guidato dal coach: `PASSI` (una domanda per schermata), `passiPer`, `passiCoperti`
- `js/indagine.js` – `SOGNI`, `ZONE`, `ZONE_PATTERNS`, `diagnosi` (cause reali del risultato cercato), `regoleCibo`
- `js/engine.js` – motore del piano: `derive`, `weekSchedule`/`mixedSchedule`, `strengthSession` (zone prioritarie), `resizeSession`, `coupleSession`, `nutrition`, `generatePlan`, `coachSummary`
- `js/assessment.js` + `js/assess-ui.js` – test fisici, punteggi, composizione corporea, KPI, precisione
- `js/narrative.js` – relazione in testo libero: analisi offline in italiano e analisi con Claude
- `js/gymreview.js` – revisione della scheda di palestra dell’utente: `parseGymList`, `reviewGym`, `GYM_PICKS`
- `js/diet.js` – tipi di dieta, `weekMenu`, `coupleMenu` (menu di coppia), `pantryRecipes` (ricette dalla dispensa), `shoppingList`
- `js/giornata.js` – giornata flessibile: `dayOptions`, `applyOption`, `undoOption` (log: sessionFrom -1 = riposo, extra = doppio, short = versione corta)
- `js/coppia.js` – codice di coppia senza server: `buildCard`, `encodeCard`/`decodeCard`, `weekTogether`, `bestTogetherDay`
- `js/ai.js` – AI con la chiave dell'utente, Gemini 3.8 Flash (predefinito, gratuito, REST) o Claude: `ask`, `aiConfig`, `aiRicette`, `aiGiornata`
- `js/exercises.js`, `js/guide.js`, `js/guide-extra.js` – esercizi e guide tecniche
- `js/demos.js`, `js/demo.js` – foto reali degli esercizi (`media/ex/`), riquadro animato e miniature
- `js/sheet.js`, `js/player.js`, `js/fx.js` – scheda esercizio, allenamento guidato, effetti
- Test: `npm test` (node --test, 61 test)
- Dopo ogni rilascio: aggiorna `VERSION` in `sw.js`
