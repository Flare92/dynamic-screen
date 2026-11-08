# Ritmo – la tua routine fisica su misura

PWA (installabile sul telefono, funziona offline) che crea un piano di allenamento personalizzato in base a:

- **corporatura**: sesso, età, altezza, peso
- **storia clinica**: pressione alta, cuore, diabete, asma, schiena, ginocchia, spalle, anche, osteoporosi, reni, gravidanza, interventi recenti, betabloccanti
- **abitudini**: lavoro, passi, sonno, esperienza, alimentazione, fumo, alcol, stress
- **obiettivo**: perdere peso, massa muscolare, tonificare, resistenza, mobilità, salute (con peso e data obiettivo facoltativi)
- **tempo**: minuti al giorno (10–120) e giorni a settimana (2–7), attrezzi disponibili

## Cosa fa

| Sezione | Contenuto |
|---|---|
| **Oggi** | Allenamento del giorno con checklist, spiegazione di ogni esercizio, timer di recupero, feedback (facile/giusto/duro), abitudini quotidiane, pesata settimanale. Nei giorni di riposo: recupero attivo e possibilità di recuperare un allenamento saltato. |
| **Piano** | Settimana completa, data stimata per raggiungere l’obiettivo con le tappe, calorie e macronutrienti, abitudini prioritarie, avvisi di sicurezza, spiegazione di cosa è stato escluso e perché. |
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
tests/                test del motore (node --test)
```
