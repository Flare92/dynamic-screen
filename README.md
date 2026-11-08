# Ritmo – la tua routine fisica su misura

PWA (installabile sul telefono, funziona offline) che crea un piano di allenamento personalizzato in base a:

- **corporatura**: sesso, età, altezza, peso
- **storia clinica**: pressione alta, cuore, diabete, asma, schiena, ginocchia, spalle, anche, osteoporosi, reni, gravidanza, interventi recenti, betabloccanti
- **abitudini**: lavoro, passi, sonno, esperienza, alimentazione, fumo, alcol, stress
- **obiettivo**: perdere peso, massa muscolare, tonificare, resistenza, mobilità, salute (con peso e data obiettivo facoltativi)
- **tempo**: minuti al giorno (10–120) e giorni a settimana (2–7), attrezzi disponibili

## Novità della versione 3: personalizzazione misurata

- **Punto di partenza reale**: circonferenze (vita, collo, fianchi) → massa grassa (formula U.S. Navy), massa magra e rapporto vita/altezza; frequenza cardiaca a riposo e pressione; **mappa dei dolori** per 8 zone del corpo.
- **Test fisici guidati in 3D** con strumenti integrati: piegamenti, alzate dalla sedia in 30 s (conto alla rovescia), plank e sospensione alla sbarra (cronometro), step test di 3 minuti (metronomo a 96 bpm + minuto di conteggio del polso), autovalutazione del fiato, flessibilità posteriore, mobilità di spalle e caviglia, squat profondo, equilibrio. I test non sicuri per la persona vengono saltati in automatico.
- **Punteggi rispetto ai valori di riferimento** per età e sesso (ACSM, YMCA, Senior Fitness Test) e profilo a radar su 7 aree.
- **Motore su misura**:
  - livello separato per spinta, tirata, gambe, core e cardio;
  - dosi calcolate sui test (es. piegamenti al 50–70% del massimo, plank al 55% della tenuta massima);
  - esercizi correttivi nel riscaldamento e allungamenti mirati nel defaticamento in base ai limiti misurati (caviglie rigide → squat con talloni rialzati, femorali corti → ponte invece di stacco, spalle rigide → niente spinte sopra la testa…);
  - più lavoro sui punti deboli;
  - zone cardio con la formula di Karvonen e intervalli scelti in base al fiato;
  - metabolismo con Katch-McArdle e proteine sulla massa magra;
  - dolori: lieve → livello ridotto, medio → esercizi esclusi, forte → avviso medico.
- **Il piano impara**: dopo ogni esercizio dell’allenamento guidato puoi dire facile / giusto / duro / dolore → progressione o regressione di quell’esercizio, oppure sostituzione. Dalla scheda di ogni esercizio puoi sostituirlo o escluderlo.
- **Traguardi misurabili (KPI)** coerenti con l’obiettivo, con valore di partenza, traguardo e data (peso, vita, massa grassa, massa magra, test di forza, recupero cardiaco, mobilità…), verificati con il **test di controllo ogni 4 settimane**.
- **Indice di precisione** del piano: quanto il piano si basa su dati misurati invece che su stime.

## Novità della versione 2

- **Design "neon lab"**: tema scuro con accenti neon, sfondo animato, transizioni tra le schermate (View Transitions), anelli di progresso, numeri che contano, esplosione di particelle quando completi un allenamento.
- **Esercizi in 3D**: ogni esercizio (93) è animato su un manichino olografico (Three.js) con i **muscoli coinvolti che si illuminano**, attrezzi (manubri, bilanciere, elastici, panca, sbarra, muro, bici…), rotazione con il dito, vista fronte/lato, rallentatore.
- **Guide ultra dettagliate**: per ogni esercizio perché farlo, posizione di partenza, esecuzione passo passo, respirazione, ritmo, errori comuni, versione più facile e più difficile, avvertenze di sicurezza, link alla ricerca di video tutorial.
- **Allenamento guidato a schermo intero**: il manichino mostra l’esercizio, timer per esercizi a tempo, contatore delle serie, recuperi automatici con anteprima del prossimo esercizio, suggerimenti tecnici che scorrono, bip negli ultimi secondi, **guida vocale in italiano**, schermo sempre acceso.
- **Libreria 3D**: tutti gli esercizi, con ricerca per nome o muscolo e filtro "adatti a te".

## Cosa fa

| Sezione | Contenuto |
|---|---|
| **Oggi** | Allenamento del giorno con checklist, spiegazione di ogni esercizio, timer di recupero, feedback (facile/giusto/duro), abitudini quotidiane, pesata settimanale. Nei giorni di riposo: recupero attivo e possibilità di recuperare un allenamento saltato. |
| **Piano** | Settimana completa, data stimata per raggiungere l’obiettivo con le tappe, calorie e macronutrienti, abitudini prioritarie, avvisi di sicurezza, spiegazione di cosa è stato escluso e perché. |
| **Esercizi** | Libreria 3D con ricerca e filtri; quelli non adatti alla tua salute sono segnalati. |
| **Progressi** | Grafico del peso rispetto alla previsione, costanza, serie di allenamenti consecutivi e **suggerimenti di adattamento** applicabili con un tocco (calorie, giorni, livello). |
| **Profilo** | Modifica dati e obiettivi, backup/ripristino in JSON, installazione. |

### Come vengono costruiti i piani

- **Calorie**: Mifflin-St Jeor × livello di attività (lavoro + passi + allenamenti). Deficit pari allo 0,5–0,75% del peso a settimana, mai sotto il metabolismo basale; surplus moderato per la massa; niente deficit in gravidanza; peso obiettivo limitato a BMI ≥ 18,5.
- **Forza**: schemi motori fondamentali (squat, anca, affondi, spinta, tirata, core) scelti tra ~90 esercizi filtrati per attrezzi, livello e controindicazioni. Serie, ripetizioni e recuperi dipendono da obiettivo e livello.
- **Progressione**: cicli di 4 settimane (adattamento → costruzione → spinta → scarico).
- **Cardio**: zone di frequenza cardiaca con la formula di Tanaka; metodo corsa-cammino per i principianti; niente intervalli intensi in caso di problemi cardiaci, pressione alta o gravidanza.
- **Sicurezza**: le condizioni cliniche escludono esercizi specifici (es. salti con ginocchia/anche/osteoporosi, esercizi sdraiati in gravidanza, carichi massimali con ipertensione) e generano avvisi “consulta il medico prima di iniziare” quando serve.

> Ritmo fornisce indicazioni generali e non sostituisce il parere di medici, fisioterapisti o nutrizionisti.

## Privacy

Tutti i dati restano nel `localStorage` del dispositivo. Nessun server e nessun account.

## Avvio in locale

Non serve installare nulla:

```bash
npm start          # oppure: python3 -m http.server 8080
# apri http://localhost:8080
npm test           # test del motore di raccomandazione
```

## Pubblicazione

Il workflow `.github/workflows/pages.yml` esegue i test e pubblica l’app su GitHub Pages a ogni push su `main`.
Una volta sola: in GitHub, **Settings → Pages → Source: GitHub Actions**.
Poi apri l’indirizzo dal telefono e scegli “Aggiungi alla schermata Home”.

Dopo ogni modifica ai file, aggiorna `VERSION` in `sw.js` così i telefoni scaricano la nuova versione.

## Struttura

```
index.html            shell dell'app
manifest.webmanifest  manifest PWA
sw.js                 service worker (offline)
css/style.css         stile (tema chiaro/scuro automatico)
js/app.js             interfaccia, navigazione, salvataggio
js/engine.js          motore: piano, alimentazione, tempi, abitudini, adattamento
js/exercises.js       database esercizi con controindicazioni
js/guide.js           guida tecnica dettagliata di ogni esercizio
js/assessment.js      test, punteggi, composizione corporea, KPI, indice di precisione
js/assess-ui.js       valutazione guidata con cronometro, metronomo e 3D
js/motions.js         pose chiave delle animazioni 3D
js/viewer3d.js        manichino 3D, animazione, attrezzi, muscoli evidenziati
js/player.js          allenamento guidato a schermo intero
js/sheet.js           scheda esercizio (3D + guida)
js/fx.js              icone, effetti, suoni, voce
vendor/               three.js (MIT)
fonts/                Space Grotesk e JetBrains Mono (SIL OFL 1.1)
dev/pose-lab.html     pagina di sviluppo per controllare le animazioni una per una
tests/                test (node --test)
```

### Aggiungere o correggere un’animazione

Le animazioni sono pose chiave in `js/motions.js` (angoli in gradi di colonna, spalle, gomiti, anche, ginocchia, caviglie). Il visualizzatore interpola le pose, appoggia il corpo a terra e tiene fermi piedi o mani. Per provarne una apri `dev/pose-lab.html` con il server locale e nella console scrivi `show('s_squat', 0.5)`.

### Video reali

L’app non incorpora video di terzi (diritti d’autore). Dalla scheda di ogni esercizio puoi aprire una ricerca di video tutorial; se in futuro registri tuoi video, basta aggiungere un campo `video` all’esercizio in `js/guide.js` e mostrarlo nella scheda.
