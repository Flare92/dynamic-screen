// Percorso iniziale guidato dal coach: una domanda per schermata.
// Ogni passo: { id, sez, coach, titolo, auto, quando(d), render(d, h), errore(d) }
//   sez: sezione mostrata nella barra di avanzamento · coach: frase del coach sopra la domanda
//   auto: una sola scelta → si va avanti da soli dopo il tocco
//   h: funzioni di disegno fornite da app.js (opts, multi, seg, chips, num, slotEditor, gymPicker, esc)

import { CONDITIONS, EQUIPMENT } from './engine.js';
import { MEASURES, PAIN_REGIONS, PAIN_LEVELS } from './assessment.js';
import { SOGNI, ZONE, goalFromSogni } from './indagine.js';
import { DIETS } from './narrative.js';
import { NON_CIBI, INTOLLERANZE } from './diet.js';

export const SEZIONI = ['Tu', 'Obiettivo', 'Il tuo corpo', 'Salute', 'La tua vita', 'Il tuo tempo', 'A tavola'];

const nome = (d) => (d.nome ? `, ${d.nome}` : '');
const pancia = (d) => (d.zone || []).includes('addome') || (d.sogni || []).some((s) => s === 'ventre' || s === 'peso');
const inPalestra = (d) => (d.sessioni || []).some((x) => x.luogo === 'palestra' && x.giorni > 0);
const VITA = MEASURES.find((m) => m.id === 'vita');
const FREQ = [['mai', 'Mai o quasi'], ['avolte', 'Ogni tanto'], ['spesso', 'Spesso'], ['ogni', 'Ogni giorno']];

export const PASSI = [
  // ------------------------------------------------------------ dopo il racconto a parole
  {
    id: 'riepilogo', sez: 0, quando: (d) => !!d._story, coach: 'Ho letto il tuo racconto. Controlla che abbia capito bene: tocca una riga per correggerla.',
    titolo: 'Ecco cosa ho capito', sotto: 'Poi ti faccio solo le domande che mancano.',
    render: (d, h) => h.recap(d),
    errore: () => null,
  },
  // ------------------------------------------------------------ Tu
  {
    id: 'nome', sez: 0, coach: 'Ciao! Sono il tuo coach. Prima di proporti qualsiasi esercizio voglio conoscerti bene: ci vogliono circa cinque minuti.',
    titolo: 'Come ti chiami?',
    render: (d, h) => `<label class="field"><input type="text" name="nome" value="${h.esc(d.nome)}" autocomplete="given-name" placeholder="Il tuo nome" enterkeyhint="next"></label>
      <p class="small muted">Tutto quello che mi racconti resta su questo telefono.</p>`,
    errore: () => null,
  },
  {
    id: 'base', sez: 0, coach: (d) => `Piacere${nome(d)}. Partiamo dalle basi: mi servono per calcolare quanto consumi ogni giorno.`,
    titolo: 'Parlami di te',
    render: (d, h) => `
      <div class="field"><span>Sesso</span>${h.seg('sesso', [['F', 'Donna'], ['M', 'Uomo']], d.sesso)}</div>
      <div class="grid-3">
        ${h.num('eta', 'Età', d.eta, 'min="14" max="100"')}
        ${h.num('altezza', 'Altezza (cm)', d.altezza, 'min="120" max="230"')}
        ${h.num('peso', 'Peso (kg)', d.peso, 'min="30" max="300" step="0.1"')}
      </div>`,
    errore: (d) => {
      if (!d.sesso) return 'Indica il sesso.';
      if (!(d.eta >= 14 && d.eta <= 100)) return 'Inserisci un’età tra 14 e 100 anni.';
      if (!(d.altezza >= 120 && d.altezza <= 230)) return 'Inserisci l’altezza in centimetri.';
      if (!(d.peso >= 30 && d.peso <= 300)) return 'Inserisci il peso in chili.';
      return null;
    },
  },
  // ------------------------------------------------------------ Obiettivo
  {
    id: 'sogni', sez: 1, coach: 'Adesso la cosa più importante. Immagina di essere tra tre mesi.',
    titolo: 'Cosa vorresti aver ottenuto?', sotto: 'Scegli fino a 3 cose, la prima è la più importante.',
    render: (d, h) => h.multi('sogni', SOGNI.map((s) => ({ id: s.id, label: s.label, icon: s.icon })), d.sogni, 3),
    errore: (d) => {
      if (!d.sogni?.length) return 'Scegli almeno una cosa.';
      const g = goalFromSogni(d.sogni);
      d.obiettivo = g.obiettivo;
      // le zone proposte seguono la scelta, finché la persona non le cambia
      if (!d._zoneScelte) d.zone = g.zone;
      return null;
    },
  },
  {
    id: 'zone', sez: 1, coach: 'Non si può dimagrire in un punto solo, ma posso dare più lavoro ai muscoli delle zone a cui tieni.',
    titolo: 'Dove vuoi vedere il cambiamento più grande?', sotto: 'Fino a 3 zone. Se non ne hai, vai avanti: lavoreremo su tutto in modo equilibrato.',
    render: (d, h) => h.multi('zone', ZONE.map((z) => ({ id: z.id, label: z.label, icon: z.icon })), d.zone, 3, 'grid'),
    errore: (d) => { d._zoneScelte = true; return null; },
  },
  {
    id: 'pesoObiettivo', sez: 1, quando: (d) => d.obiettivo === 'dimagrire' || d.obiettivo === 'massa',
    coach: (d) => (d.obiettivo === 'massa' ? 'Costruire muscolo richiede pazienza: circa 1–2 chili al mese all’inizio.' : 'Un ritmo sano è mezzo chilo a settimana, circa. Se la data è troppo vicina te lo dico.'),
    titolo: 'A che peso vorresti arrivare?', sotto: 'Puoi anche lasciare vuoto: te lo propongo io.',
    render: (d, h) => `<div class="grid-2">
        ${h.num('pesoObiettivo', 'Peso obiettivo (kg)', d.pesoObiettivo, 'min="35" max="250" step="0.5"')}
        <label class="field"><span>Entro quando</span><input type="date" name="dataObiettivo" value="${h.esc(d.dataObiettivo || '')}"></label>
      </div>`,
    errore: (d) => (d.pesoObiettivo && !(d.pesoObiettivo >= 35 && d.pesoObiettivo <= 250) ? 'Il peso obiettivo non sembra corretto.' : null),
  },
  // ------------------------------------------------------------ Il tuo corpo
  {
    id: 'vita', sez: 2, coach: 'Ora capiamo da dove parti davvero. Il girovita mi dice più della bilancia.',
    titolo: 'Quanto misura il tuo girovita?', sotto: VITA.how,
    render: (d, h) => `${h.num('mis_vita', 'Girovita (cm)', d.misure?.vita, 'min="40" max="220" step="0.5"')}
      <p class="small muted">Non hai un metro a portata di mano? Vai avanti: me lo dirai quando faremo i test.</p>`,
    errore: (d) => {
      const v = d.misure?.vita;
      return v !== undefined && v !== '' && !(v >= 40 && v <= 220) ? 'Il girovita non sembra corretto.' : null;
    },
  },
  {
    id: 'accumulo', sez: 2, auto: true, coach: 'Ognuno accumula in modo diverso: dipende dalla genetica e dagli ormoni.',
    titolo: 'Dove tendi ad accumulare di più?',
    render: (d, h) => h.opts('accumulo', [['addome', 'Pancia e fianchi', 'Il resto del corpo cambia poco'], ['fianchi', 'Glutei e cosce', 'La pancia resta abbastanza piatta'], ['ovunque', 'Un po’ dappertutto', ''], ['no', 'Non accumulo, sono asciutto', '']], d.accumulo),
    errore: (d) => (!d.accumulo ? 'Scegli la risposta che ti somiglia di più.' : null),
  },
  {
    id: 'plica', sez: 2, auto: true, quando: pancia, coach: 'Una prova semplice che uso con tutti: mi dice quanto grasso c’è sopra gli addominali.',
    titolo: 'Pizzica la pelle accanto all’ombelico', sotto: 'In piedi, prendi tra pollice e indice una piega verticale. Quanto è spessa?',
    render: (d, h) => h.opts('plica', [['bassa', 'Sottile', 'Meno di 2 cm: un dito'], ['media', 'Media', 'Tra 2 e 4 cm: due dita'], ['alta', 'Spessa', 'Più di 4 cm: tre dita o più']], d.plica),
    errore: (d) => (!d.plica ? 'Scegli la risposta più vicina.' : null),
  },
  {
    id: 'gonfiore', sez: 2, auto: true, quando: pancia, coach: 'Questo è importante: una pancia che cambia durante il giorno non è grasso.',
    titolo: 'La pancia è più gonfia la sera o dopo i pasti?', sotto: 'Rispetto al mattino appena sveglio.',
    render: (d, h) => h.opts('gonfiore', [['mai', 'No, è sempre uguale', ''], ['avolte', 'Ogni tanto', 'Dopo pasti abbondanti'], ['spesso', 'Spesso', 'Quasi ogni sera'], ['sempre', 'Sempre', 'Anche con dolore o fastidio']], d.gonfiore),
    errore: (d) => (!d.gonfiore ? 'Scegli una risposta.' : null),
  },
  {
    id: 'lordosi', sez: 2, auto: true, quando: (d) => pancia(d) || Number(d.dolori?.lombare) > 0,
    coach: 'Mettiti di profilo davanti a uno specchio, rilassato, senza tirare in dentro la pancia.',
    titolo: 'La schiena bassa è molto inarcata e la pancia va in avanti?', sotto: 'Come se il bacino fosse una bacinella che versa acqua in avanti.',
    render: (d, h) => h.opts('lordosi', [['si', 'Sì, è evidente', ''], ['unpo', 'Un po’', ''], ['no', 'No, sono abbastanza dritto', ''], ['nonso', 'Non riesco a capirlo', 'Lo vedremo con i test']], d.lordosi),
    errore: (d) => (!d.lordosi ? 'Scegli una risposta.' : null),
  },
  {
    id: 'parto', sez: 2, auto: true, quando: (d) => d.sesso === 'F' && d.eta < 55,
    coach: 'Te lo chiedo perché cambia completamente gli esercizi adatti per l’addome.',
    titolo: 'Sei in gravidanza o hai partorito da poco?',
    render: (d, h) => h.opts('parto', [['no', 'No', ''], ['gravidanza', 'Sono in gravidanza', ''], ['recente', 'Ho partorito negli ultimi 12 mesi', '']], d.parto),
    errore: (d) => {
      if (!d.parto) return 'Scegli una risposta.';
      const c = new Set(d.condizioni || []);
      if (d.parto === 'gravidanza') c.add('gravidanza'); else c.delete('gravidanza');
      d.condizioni = [...c];
      return null;
    },
  },
  // ------------------------------------------------------------ Salute
  {
    id: 'condizioni', sez: 3, coach: 'La sicurezza viene prima di tutto. Ogni esercizio che ti propongo terrà conto di quello che segni qui.',
    titolo: 'C’è qualcosa sulla tua salute che devo sapere?', sotto: 'Tocca tutto ciò che ti riguarda. Se non hai nulla, vai avanti.',
    render: (d, h) => `${h.chips('condizioni', CONDITIONS, d.condizioni)}
      <label class="field"><span>Farmaci, infortuni o operazioni (facoltativo)</span><textarea name="note" placeholder="Es. operato al menisco destro nel 2022">${h.esc(d.note)}</textarea></label>`,
    errore: () => null,
  },
  {
    id: 'dolori', sez: 3, coach: 'Anche un fastidio leggero conta: tolgo o rendo più facili gli esercizi che caricano quella zona.',
    titolo: 'Hai dolori o fastidi, anche a riposo?', sotto: 'Lieve: non limita. Medio: limita alcuni movimenti. Forte: limita la vita di tutti i giorni.',
    render: (d, h) => `<div class="pain-list">${PAIN_REGIONS.map((r) => `<div class="pain-row"><span>${r.label}</span>${h.seg('dol_' + r.id, PAIN_LEVELS, d.dolori?.[r.id] ?? 0)}</div>`).join('')}</div>`,
    errore: () => null,
  },
  // ------------------------------------------------------------ La tua vita
  {
    id: 'giornata', sez: 4, coach: 'Quello che fai nelle altre 23 ore conta quanto l’allenamento.',
    titolo: 'Com’è la tua giornata?',
    render: (d, h) => `
      <div class="field"><span>Il tuo lavoro è soprattutto</span>${h.seg('lavoro', [['sedentario', 'Seduto'], ['in_piedi', 'In piedi'], ['fisico', 'Fisico']], d.lavoro)}</div>
      <div class="field"><span>Passi al giorno (guarda il telefono, se li conta)</span>${h.seg('passi', [['<3000', 'Meno di 3.000'], ['3000-5000', '3–5.000'], ['5000-7500', '5–7.500'], ['7500-10000', '7.500–10.000'], ['>10000', 'Più di 10.000']], d.passi)}</div>`,
    errore: (d) => (!d.lavoro ? 'Indica il tipo di lavoro.' : !d.passi ? 'Indica più o meno quanti passi fai.' : null),
  },
  {
    id: 'recupero', sez: 4, coach: 'Sonno e stress decidono quanto recuperi e quanta fame hai. Nessun giudizio.',
    titolo: 'Come recuperi?',
    render: (d, h) => `
      <div class="field"><span>Ore di sonno per notte</span>${h.seg('sonno', [[5, '5 o meno'], [6, '6'], [7, '7'], [8, '8'], [9, '9 o più']], d.sonno)}</div>
      <div class="field"><span>Stress</span>${h.seg('stress', [['basso', 'Basso'], ['medio', 'Medio'], ['alto', 'Alto']], d.stress)}</div>
      <div class="grid-2">
        <div class="field"><span>Fumi?</span>${h.seg('fumo', [['no', 'No'], ['si', 'Sì']], d.fumo)}</div>
        <div class="field"><span>Alcol</span>${h.seg('alcol', [['mai', 'Mai'], ['occasionale', 'A volte'], ['spesso', 'Spesso']], d.alcol)}</div>
      </div>`,
    errore: (d) => (!d.sonno ? 'Indica le ore di sonno.' : !d.stress ? 'Indica il livello di stress.' : !d.fumo ? 'Indica se fumi.' : !d.alcol ? 'Indica quanto bevi.' : null),
  },
  {
    id: 'esperienza', sez: 4, auto: true, coach: 'Così parto dal livello giusto. Poi i test lo affineranno, capacità per capacità.',
    titolo: 'Che rapporto hai con l’allenamento?',
    render: (d, h) => h.opts('esperienza', [['principiante', 'Parto da zero o quasi', 'Mai allenato, o fermo da più di 6 mesi'], ['intermedio', 'Mi alleno con una certa regolarità', 'Da almeno 6 mesi, conosco gli esercizi base'], ['avanzato', 'Mi alleno da anni', 'Tecnica sicura anche con carichi importanti']], d.esperienza),
    errore: (d) => (!d.esperienza ? 'Scegli una risposta.' : null),
  },
  // ------------------------------------------------------------ Il tuo tempo
  {
    id: 'tempo', sez: 5, coach: 'Meglio poco ma sempre: dimmi quello che riesci davvero a mantenere, non quello che vorresti.',
    titolo: 'Quando e dove vuoi allenarti?', sotto: 'Puoi combinare sessioni diverse, per esempio 2 in palestra e 3 brevi a casa.',
    render: (d, h) => `${h.slotEditor(d)}
      <div class="field"><span>Attrezzi che hai a casa</span>${h.chips('attrezzi', EQUIPMENT.filter((e) => e.id !== 'palestra'), d.attrezzi)}<small>Il corpo libero è sempre incluso.</small></div>`,
    errore: (d, h) => h.slotError(d),
  },
  {
    id: 'scheda', sez: 5, quando: inPalestra, coach: 'Se hai già una scheda la guardo volentieri: ti dico cosa tenere, cosa cambiare e cosa manca.',
    titolo: 'Cosa fai di solito in palestra?', sotto: 'Tocca gli esercizi e i macchinari che usi. Se sei all’inizio, vai avanti.',
    render: (d, h) => h.gymPicker(d),
    errore: () => null,
  },
  // ------------------------------------------------------------ A tavola
  {
    id: 'dieta', sez: 6, auto: true, coach: 'Ultimo capitolo: la tavola. Il menu che ti preparo deve piacerti, altrimenti non lo seguirai.',
    titolo: 'Come mangi?',
    render: (d, h) => h.opts('dieta', DIETS.map((x) => [x.id, x.label, { onnivora: 'Mangio di tutto', flessitariana: 'Soprattutto vegetale, poca carne', pescetariana: 'Pesce sì, carne no', 'latto-ovo': 'Niente carne e pesce; uova e latticini sì', latto: 'Niente carne, pesce e uova; latticini sì', vegana: 'Solo alimenti vegetali' }[x.id]]), d.dieta),
    errore: (d) => (!d.dieta ? 'Scegli il tuo tipo di alimentazione.' : null),
  },
  {
    id: 'pasti', sez: 6, coach: 'Costruisco il menu attorno alle tue abitudini, non il contrario.',
    titolo: 'Come sono distribuiti i tuoi pasti?',
    render: (d, h) => `
      <div class="field"><span>Quante volte mangi al giorno, spuntini compresi</span>${h.seg('pasti', [[3, '3'], [4, '4'], [5, '5 o più']], d.pasti)}</div>
      <div class="field"><span>La colazione</span>${h.seg('colazione', [['dolce', 'Dolce'], ['salata', 'Salata'], ['salto', 'La salto']], d.colazione)}</div>`,
    errore: (d) => (!d.pasti ? 'Indica quanti pasti fai.' : !d.colazione ? 'Indica com’è la tua colazione.' : null),
  },
  {
    id: 'pranzo', sez: 6, coach: 'Un menu perfetto che non riesci a cucinare non serve a niente.',
    titolo: 'Come ti organizzi?',
    render: (d, h) => `
      <div class="field"><span>Il pranzo nei giorni di lavoro</span>${h.seg('pranzo', [['casa', 'A casa'], ['portato', 'Me lo porto'], ['fuori', 'Bar o mensa']], d.pranzo)}</div>
      <div class="field"><span>Tempo per cucinare</span>${h.seg('cucina', [['poco', 'Pochissimo'], ['medio', 'Mezz’ora'], ['tanto', 'Mi piace cucinare']], d.cucina)}</div>`,
    errore: (d) => (!d.pranzo ? 'Indica dove pranzi.' : !d.cucina ? 'Indica quanto tempo hai per cucinare.' : null),
  },
  {
    id: 'nocibi', sez: 6, coach: 'Così non ti propongo piatti che non mangeresti.',
    titolo: 'C’è qualcosa che non mangi?', sotto: 'Se mangi di tutto, vai avanti.',
    render: (d, h) => `
      <div class="field"><span>Intolleranze o allergie</span>${h.chips('intolleranze', INTOLLERANZE, d.intolleranze)}</div>
      <div class="field"><span>Non mi piace o non lo mangio</span>${h.chips('noncibi', NON_CIBI, d.noncibi)}</div>`,
    errore: () => null,
  },
  {
    id: 'sgarri', sez: 6, coach: 'Ultima domanda. Sii sincero: mi serve per darti regole che funzionano nella vita vera.',
    titolo: 'I tuoi punti deboli a tavola',
    render: (d, h) => `
      <div class="field"><span>Dolci e snack confezionati</span>${h.seg('dolci', FREQ, d.dolci)}</div>
      <div class="field"><span>Bibite zuccherate o succhi</span>${h.seg('bibite', FREQ, d.bibite)}</div>
      <div class="field"><span>Quando hai più fame</span>${h.seg('fame', [['mattina', 'Mattina'], ['pomeriggio', 'Pomeriggio'], ['sera', 'Sera'], ['notte', 'Dopo cena'], ['mai', 'Mai in particolare']], d.fame)}</div>`,
    errore: (d) => (!d.dolci ? 'Indica quanto spesso mangi dolci.' : !d.bibite ? 'Indica quanto spesso bevi bibite.' : !d.fame ? 'Indica quando hai più fame.' : null),
  },
];

/** i passi che riguardano questa persona, nell'ordine (senza quelli già coperti dal racconto) */
export const passiPer = (d) => PASSI.filter((p) => (!p.quando || p.quando(d)) && !(d._skip || []).includes(p.id));

/** dopo il racconto: i passi a cui il testo ha già risposto e che si possono saltare */
export function passiCoperti(d, found = {}) {
  const probe = JSON.parse(JSON.stringify(d));
  const facoltativi = {
    nome: true, condizioni: !!found.salute, dolori: !!found.salute, vita: !!d.misure?.vita,
    pesoObiettivo: !!d.pesoObiettivo, scheda: !!d.schedaPalestra, nocibi: false, sogni: false, zone: false, riepilogo: false,
  };
  return PASSI.filter((p) => (!p.quando || p.quando(probe)) && (p.id in facoltativi ? facoltativi[p.id] : !p.errore(probe, { slotError: () => null }))).map((p) => p.id);
}

/** valori di partenza del percorso */
export const BOZZA_VUOTA = () => ({
  nome: '', condizioni: [], attrezzi: [], misure: {}, dolori: {}, note: '', traguardo: '', pesoObiettivo: '', dataObiettivo: '',
  sogni: [], zone: [], intolleranze: [], noncibi: [], sessioni: [{ giorni: 3, minuti: 30, luogo: 'casa' }],
});
