# Ritmo – il tuo coach

PWA (installabile sul telefono, funziona offline) che si comporta come un personal trainer e un nutrizionista:
prima indaga, poi prepara allenamento e menu su misura, poi segue la persona giorno per giorno.

## Novità della versione 6: in coppia e più intelligente

- **In coppia, senza account né server**: ognuno manda all’altro un link (WhatsApp, email…) con i soli dati che servono.
  Il codice non contiene diagnosi né dolori: solo gli esercizi da evitare, il livello per ogni schema motorio, dieta,
  fabbisogno e settimana. Collegati, si ottengono:
  - **menu di coppia**: stessi piatti per tutti e due, porzioni calcolate per ciascuno, una sola lista della spesa,
    rispettando dieta, intolleranze ed esclusioni di entrambi;
  - **allenamento insieme**: il giorno migliore della settimana e una sessione con esercizi adatti a entrambi,
    al livello del più basso dei due, con la dose di ciascuno;
  - **sfida della settimana**: allenamenti fatti da te e dall’altra persona (si aggiorna quando vi rimandate il codice).
- **Giornata flessibile** ("Com’è la tua giornata?"): energia, sonno, tempo disponibile, dolori e impegni dei prossimi giorni.
  L’app propone e applica con un tocco: come previsto, versione corta o leggera ricostruita sul tempo, scambio con un altro
  giorno, spostamento in un giorno libero, riposo oggi e doppio allenamento un altro giorno (solo se sostenibile),
  recupero attivo, anticipo di una sessione. Ogni scelta si annulla.
- **Ricette con quello che hai in casa**: dalla dispensa (alimenti da toccare più testo libero) ricette con grammature
  calcolate sul pasto da sostituire. Offline con i calcoli integrati; con Claude ricette vere e varie, con i valori
  ricalcolati sulla tabella di Ritmo. "Mangio questo" sostituisce il pasto nel menu.
- **Coach AI con Gemini 3.8 Flash (gratuito) o Claude**: si sceglie nel profilo e si incolla la propria chiave
  (Gemini: chiave gratuita da Google AI Studio; Claude: chiave a pagamento da Anthropic). L’AI sceglie tra le opzioni della giornata calcolate dall’app e spiega
  perché (non può proporre cambi non previsti). Senza chiave tutto funziona con i calcoli integrati.

## Novità della versione 5: indagine, foto reali, menu, tema caldo

- **Percorso guidato dal coach**: una domanda per schermata, in prima persona, con le sole domande che riguardano quella persona
  (obiettivo e zone, girovita, dove accumula, plica addominale, gonfiore, postura, gravidanza o parto recente, salute e dolori,
  giornata, sonno e stress, tempo e luoghi, scheda di palestra, abitudini a tavola). Chi preferisce può raccontarsi a parole:
  l’app mostra cosa ha capito e chiede solo ciò che manca.
- **Diagnosi "Ecco cosa ho capito di te"**: per ogni risultato cercato l’app distingue le cause reali (grasso addominale, gonfiore,
  postura, core debole, post-parto, sedentarietà, poco sonno, stress) e per ciascuna dice cosa cambia nel piano.
- **Zone prioritarie**: addome, glutei, gambe, braccia, petto, schiena, spalle. I loro esercizi fondamentali aprono la sessione,
  hanno una serie in più e si aggiunge un esercizio complementare dedicato; le sessioni brevi diventano "focus" sulle zone.
- **Protocollo ventre piatto**: deficit calorico solo se il girovita o la plica lo giustificano; attivazione profonda (vacuum,
  dead bug) prima di plank e addominali dinamici; correttivi per la postura; regole anti-gonfiore; niente crunch dopo il parto.
- **Foto reali al posto del manichino 3D**: ogni esercizio mostra la posizione di partenza e di arrivo con foto di persone vere
  (118 esercizi su 135; per gli altri, descrizione e collegamento a un video). Le foto compaiono anche negli elenchi.
- **39 esercizi nuovi**: addome, braccia, glutei e macchine da palestra, ciascuno con guida tecnica completa.
- **Menu settimanale con grammature**: piatti reali filtrati per tipo di dieta, intolleranze (lattosio, glutine, frutta secca),
  cibi non graditi, numero di pasti, colazione dolce o salata, pranzo a casa, portato o fuori, tempo per cucinare.
  Porzioni calcolate su calorie e proteine, lista della spesa e regole personali ricavate dalle abitudini dichiarate.
- **Interfaccia più semplice**: quattro schede (Oggi, Allenamento, Alimentazione, Progressi), una sola cosa da fare per volta
  nella schermata Oggi, dettagli tecnici raccolti in pagine secondarie.
- **Tema caldo e chiaro**: carta color crema, terracotta e verde salvia, caratteri Fraunces e Figtree.

## Novità della versione 4: la tua relazione diventa il piano

- **Relazione iniziale in testo libero** (o dettata a voce): 7 domande guida si accendono man mano che il testo le copre. L’app ricava età, misure, sessioni (frequenza, durata e luogo di ciascuna), lavoro, sonno, dieta, dolori con la loro intensità, condizioni di salute, obiettivo e scadenza, poi mostra **"Ecco cosa ho capito"** per confermare o correggere prima di generare il piano.
- **Due livelli di analisi**: l’analizzatore integrato (offline, gratuito, regole per l’italiano) e, facoltativa, l’**analisi avanzata con Claude** usando la propria chiave API di Anthropic: `claude-opus-5-5`, output JSON strutturato, fallback automatico in caso di rifiuto e ritorno all’analisi integrata se manca la rete. La chiave resta solo sul dispositivo e non finisce nei backup.
- **Settimane miste**: più tipi di sessione con durata, luogo e attrezzi diversi (es. 2 × 60′ in palestra + 4 × 20′ a casa). Le sessioni lunghe portano la forza completa; quelle brevi completano con circuiti, intervalli, core, **postura per chi lavora seduto** e **focus sui punti deboli**, sempre con gli attrezzi disponibili in quel luogo.
- **Alimentazione per tipo di dieta** (onnivora, flessitariana, pescetariana, vegetariana, latto-vegetariana, vegana): proteine adeguate, **giornata tipo** con porzioni calcolate sul fabbisogno, integrazioni da valutare (B12, ferro, omega-3, creatina).
- **Il tuo piano in breve**: una relazione del coach che spiega come la settimana è costruita sulla tua situazione.

## Novità della versione 3: personalizzazione misurata

- **Punto di partenza reale**: circonferenze (vita, collo, fianchi) → massa grassa (formula U.S. Navy), massa magra e rapporto vita/altezza; frequenza cardiaca a riposo e pressione; **mappa dei dolori** per 8 zone del corpo.
- **Test fisici guidati** (con foto dimostrative) e strumenti integrati: piegamenti, alzate dalla sedia in 30 s (conto alla rovescia), plank e sospensione alla sbarra (cronometro), step test di 3 minuti (metronomo a 96 bpm + minuto di conteggio del polso), autovalutazione del fiato, flessibilità posteriore, mobilità di spalle e caviglia, squat profondo, equilibrio. I test non sicuri per la persona vengono saltati in automatico.
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

## Versione 2

- **Guide dettagliate**: per ogni esercizio perché farlo, posizione di partenza, esecuzione passo passo, respirazione, ritmo, errori comuni, versione più facile e più difficile, avvertenze di sicurezza.
- **Allenamento guidato** a schermo intero con timer, serie, recuperi e voce.

## Cosa fa

| Sezione | Contenuto |
|---|---|
| **Oggi** | La frase del coach, l’allenamento del giorno con le foto e il tasto per iniziare, il prossimo passo utile (uno solo), i pasti del giorno, le abitudini e la pesata settimanale. |
| **Allenamento** | Perché questo piano (la diagnosi), la settimana con tutti gli esercizi, la scheda di palestra, il traguardo, la libreria degli esercizi e il punto di partenza. |
| **Alimentazione** | Calorie e macronutrienti spiegati, menu del giorno con grammature per tutti i 7 giorni, regole personali, lista della spesa, integrazioni da valutare. |
| **Progressi** | Costanza, suggerimenti del coach applicabili con un tocco, traguardi misurabili, grafico del peso, storico. |
| **Profilo** | Ogni sezione dell’indagine si riapre e si modifica; copia e ripristino dei dati; installazione. |

### Come vengono costruiti i piani

- **Calorie**: Mifflin-St Jeor × livello di attività (lavoro + passi + allenamenti). Deficit pari allo 0,5–0,75% del peso a settimana, mai sotto il metabolismo basale; surplus moderato per la massa; niente deficit in gravidanza; peso obiettivo limitato a BMI ≥ 18,5.
- **Forza**: schemi motori fondamentali (squat, anca, affondi, spinta, tirata, core) scelti tra 135 esercizi filtrati per attrezzi, livello e controindicazioni. Serie, ripetizioni e recuperi dipendono da obiettivo e livello.
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

Dopo ogni modifica ai file, aggiorna `VERSION` in `sw.js` (e `APP_VERSION` in `js/app.js`) così i telefoni scaricano la nuova versione. Se la pubblicazione fallisce per un errore temporaneo di GitHub, non rilanciare la stessa esecuzione (crea artefatti doppi): serve un nuovo push su `main`.

## Struttura

```
index.html            shell dell'app
manifest.webmanifest  manifest PWA
sw.js                 service worker (offline; foto in una cache a parte)
css/style.css         tema caldo e chiaro
js/app.js             interfaccia, navigazione, salvataggio
js/flow.js            percorso guidato: le domande del coach
js/indagine.js        obiettivi, zone, diagnosi, regole alimentari
js/engine.js          motore: piano, alimentazione, tempi, abitudini, adattamento
js/exercises.js       database esercizi con controindicazioni
js/guide.js           guida tecnica dettagliata di ogni esercizio
js/guide-extra.js     guide degli esercizi complementari
js/demos.js           quale foto mostra quale esercizio
js/demo.js            riquadro con le due foto che si alternano, miniature
js/assessment.js      test, punteggi, composizione corporea, KPI, indice di precisione
js/assess-ui.js       valutazione guidata con cronometro e metronomo
js/narrative.js       relazione in testo libero: analisi offline e con Claude
js/gymreview.js       revisione della scheda di palestra
js/diet.js            tipi di dieta, menu settimanale e di coppia, ricette dalla dispensa, lista della spesa
js/giornata.js        giornata flessibile: opzioni per cambiare la settimana, applica e annulla
js/coppia.js          codice di coppia, settimana insieme, giorno migliore per allenarsi insieme
js/ai.js              AI (Gemini 3.8 Flash via REST o Claude via SDK): ricette dalla dispensa, scelta della giornata, racconto
js/player.js          allenamento guidato a schermo intero
js/sheet.js           scheda esercizio (foto + guida)
js/fx.js              icone, effetti, suoni, voce
media/ex/             foto degli esercizi (free-exercise-db, pubblico dominio)
vendor/               SDK Anthropic pre-impacchettato (MIT, caricato solo per l’analisi con Claude)
fonts/                Fraunces e Figtree (SIL OFL 1.1)
tests/                test (node --test)
```

### Foto degli esercizi

Le foto vengono da [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (pubblico dominio, Unlicense), ridimensionate in
`media/ex/<nome>_0.webp` (partenza) e `<nome>_1.webp` (arrivo). `js/demos.js` collega ogni esercizio alla sua coppia di foto e,
quando la foto usa un attrezzo diverso, a una nota che lo spiega. Per aggiungere una foto: metti i due file in `media/ex/` e
aggiungi la riga in `DEMOS`. Gli esercizi senza foto mostrano la descrizione e un collegamento a una ricerca di video.
