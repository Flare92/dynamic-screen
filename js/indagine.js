// Indagine iniziale: cosa vuole ottenere la persona, su quali zone, e da cosa dipende davvero
// il risultato (grasso, gonfiore, postura, tenuta del core, abitudini).
// Da qui il motore del piano ricava priorità, protocollo e regole alimentari.

// Cosa vuoi ottenere → obiettivo del piano e zone prioritarie
export const SOGNI = [
  { id: 'ventre', icon: '🎯', label: 'Ventre piatto', goal: 'tonificare', zone: ['addome'] },
  { id: 'peso', icon: '⚖️', label: 'Perdere peso', goal: 'dimagrire', zone: [] },
  { id: 'tono', icon: '✨', label: 'Tonificare tutto il corpo', goal: 'tonificare', zone: [] },
  { id: 'glutei', icon: '🍑', label: 'Glutei e gambe sodi', goal: 'tonificare', zone: ['glutei', 'gambe'] },
  { id: 'braccia', icon: '💪', label: 'Braccia e spalle definite', goal: 'tonificare', zone: ['braccia', 'spalle'] },
  { id: 'massa', icon: '🏋️', label: 'Più muscoli', goal: 'massa', zone: [] },
  { id: 'fiato', icon: '🫁', label: 'Più fiato ed energia', goal: 'resistenza', zone: [] },
  { id: 'dolori', icon: '🧘', label: 'Meno dolori e rigidità', goal: 'mobilita', zone: [] },
  { id: 'salute', icon: '❤️', label: 'Stare in salute', goal: 'salute', zone: [] },
];
const GOAL_ORDER = ['dimagrire', 'massa', 'tonificare', 'resistenza', 'mobilita', 'salute'];

export const ZONE = [
  { id: 'addome', label: 'Addome', icon: '🎯' },
  { id: 'glutei', label: 'Glutei', icon: '🍑' },
  { id: 'gambe', label: 'Gambe', icon: '🦵' },
  { id: 'braccia', label: 'Braccia', icon: '💪' },
  { id: 'petto', label: 'Petto', icon: '🫁' },
  { id: 'schiena', label: 'Schiena', icon: '🔙' },
  { id: 'spalle', label: 'Spalle', icon: '🏔️' },
];
export const ZONE_LABEL = Object.fromEntries(ZONE.map((z) => [z.id, z.label]));

// schemi motori di ogni zona: main = esercizi fondamentali portati in apertura, acc = complementari aggiunti
export const ZONE_PATTERNS = {
  addome: { main: [], acc: ['core', 'core'] },
  glutei: { main: ['hinge', 'glutei'], acc: ['glutei', 'lunge'] },
  gambe: { main: ['squat', 'lunge'], acc: ['quad_iso', 'ham_iso', 'adduttori', 'calf'] },
  braccia: { main: [], acc: ['bicipiti', 'tricipiti'] },
  petto: { main: ['push_h'], acc: ['petto_iso'] },
  schiena: { main: ['pull_h', 'pull_v'], acc: ['post_iso', 'dorso_iso', 'lombari'] },
  spalle: { main: ['push_v'], acc: ['spalle_iso', 'post_iso'] },
};
// zone allenabili in ogni tipo di sessione
export const ZONE_BY_SESSION = {
  full: ['addome', 'glutei', 'gambe', 'braccia', 'petto', 'schiena', 'spalle'],
  circuito: ['addome', 'glutei', 'gambe', 'braccia', 'petto', 'schiena', 'spalle'],
  focus: ['addome', 'glutei', 'gambe', 'braccia', 'petto', 'schiena', 'spalle'],
  core: ['addome', 'glutei'],
  upper: ['braccia', 'petto', 'schiena', 'spalle', 'addome'],
  lower: ['glutei', 'gambe', 'addome'],
  push: ['petto', 'spalle', 'braccia', 'addome'],
  pull: ['schiena', 'braccia', 'addome'],
  legs: ['glutei', 'gambe', 'addome'],
};

/** obiettivo del piano e zone a partire da "cosa vuoi ottenere" */
export function goalFromSogni(sogni = []) {
  const sel = SOGNI.filter((s) => sogni.includes(s.id));
  if (!sel.length) return { obiettivo: null, zone: [] };
  const obiettivo = GOAL_ORDER.find((g) => sel.some((s) => s.goal === g));
  return { obiettivo, zone: [...new Set(sel.flatMap((s) => s.zone))].slice(0, 3) };
}

const n1 = (v, d = 1) => Number(v).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: d });

/**
 * Diagnosi: da cosa dipende il risultato che la persona cerca.
 * p: profilo · cp: profilo dalla valutazione (facoltativo)
 */
export function diagnosi(p, cp = null) {
  const h = p.altezza / 100;
  const bmi = p.peso && h ? p.peso / (h * h) : null;
  // il girovita più recente: dalla valutazione se c'è, altrimenti dal profilo
  const vita = (cp?.body?.whtr ? Math.round(cp.body.whtr * p.altezza) : Number(p.misure?.vita || 0)) || null;
  const whtr = vita && p.altezza ? vita / p.altezza : null;
  const zone = (p.zone || []).filter((z) => ZONE_PATTERNS[z]);
  const sogni = p.sogni || [];
  const belly = zone.includes('addome') || sogni.includes('ventre');
  const plankLevel = cp?.tests?.plank?.level ?? null;

  // quanto pesa il grasso addominale: 0 nessuno, 1 lieve, 2 moderato, 3 alto
  let fat = 0;
  if (whtr !== null) fat = whtr >= 0.6 ? 3 : whtr >= 0.53 ? 2 : whtr >= 0.5 ? 1 : 0;
  else if (bmi !== null) fat = bmi >= 30 ? 3 : bmi >= 27 ? 2 : bmi >= 25 ? 1 : 0;
  if (p.plica === 'alta') fat = Math.max(fat, 2);
  else if (p.plica === 'media') fat = Math.max(fat, 1);
  else if (p.plica === 'bassa' && whtr === null) fat = Math.min(fat, 1);
  if (p.accumulo === 'addome' && fat === 0 && p.plica !== 'bassa' && bmi >= 24) fat = 1;

  const bloat = p.gonfiore === 'sempre' ? 2 : p.gonfiore === 'spesso' ? 1 : 0;
  const posture = p.lordosi === 'si' ? 2 : p.lordosi === 'unpo' ? 1 : 0;
  const coreWeak = !!cp?.flags?.coreWeak || (plankLevel !== null && plankLevel <= 2);
  const postpartum = p.sesso === 'F' && p.parto === 'recente';
  const drivers = { fat, bloat, posture, coreWeak, postpartum };

  const findings = [];
  const add = (id, icon, title, text, effect) => findings.push({ id, icon, title, text, effect });

  if (belly || p.obiettivo === 'dimagrire') {
    if (fat >= 1) {
      const dati = [whtr !== null ? `girovita ${n1(vita)} cm, cioè ${n1(whtr * 100, 0)}% dell’altezza (la soglia è 50%)` : null, p.plica === 'alta' ? 'plica addominale spessa' : p.plica === 'media' ? 'plica addominale media' : null].filter(Boolean).join(' e ');
      add('grasso', '📏', fat >= 2 ? 'La pancia dipende soprattutto dal grasso addominale' : 'C’è un po’ di grasso addominale da togliere',
        `${dati ? dati.charAt(0).toUpperCase() + dati.slice(1) + '. ' : ''}Gli addominali da soli non tolgono il grasso sopra di loro: serve consumare un po’ più di quanto mangi.`,
        'Calorie leggermente sotto il tuo consumo, più passi ogni giorno e forza su tutto il corpo. Gli esercizi per l’addome servono a dare tono, non a “bruciare” la pancia.');
    } else if (belly) {
      add('nograsso', '📏', 'Il grasso addominale non è il tuo problema',
        `${whtr !== null ? `Il tuo girovita (${n1(vita)} cm) è sotto la metà dell’altezza. ` : ''}Mettersi a dieta non servirebbe: la pancia piatta per te passa da tono, postura e digestione.`,
        'Nessun taglio di calorie: mangi quanto consumi, con più proteine. Il lavoro è su addome profondo e postura.');
    }
    if (bloat) add('gonfiore', '🎈', bloat === 2 ? 'La pancia è gonfia quasi sempre' : 'La pancia si gonfia spesso durante la giornata',
      'Se la pancia è piatta al mattino e gonfia la sera, non è grasso: è aria, digestione lenta o ritenzione. Si lavora a tavola, non con gli addominali.',
      'Regole anti-gonfiore nella tua alimentazione e respirazione diaframmatica a fine allenamento. Se il gonfiore è quotidiano e fastidioso, parlane con il medico.');
    if (posture) add('postura', '🧍', 'La postura fa sporgere la pancia',
      'Con la schiena bassa molto inarcata il bacino ruota in avanti e la pancia sporge anche se non c’è grasso. Succede spesso a chi sta seduto molte ore.',
      'In ogni sessione: allungamento dei flessori dell’anca, ponte glutei e dead bug per riportare il bacino in posizione neutra.');
    if (belly && postpartum) add('postparto', '🤱', 'Dopo il parto l’addome va recuperato per gradi',
      'Nei mesi dopo il parto i muscoli retti dell’addome possono essere ancora separati (diastasi). Crunch e plank frontali possono peggiorarla.',
      'Niente crunch, torsioni o plank frontali: solo attivazione profonda (vacuum, dead bug, bird dog). Fai controllare la diastasi da un’ostetrica o un fisioterapista.');
    else if (belly && coreWeak) add('core', '🧱', 'Il core è il tuo anello debole',
      `${cp?.tests?.plank ? `Nel test del plank hai tenuto ${cp.tests.plank.value} secondi. ` : ''}Un addome profondo debole non riesce a “tenere dentro” la pancia quando sei in piedi.`,
      'Progressione in tre tappe: prima attivazione profonda (vacuum, dead bug), poi tenute (plank), poi addominali dinamici.');
    else if (belly && plankLevel === null) add('coretest', '🧱', 'Devo ancora misurare la tenuta del tuo core',
      'Il test del plank mi dice da quale livello far partire il lavoro per l’addome.',
      'Per ora parto dagli esercizi di attivazione profonda. Fai il test del plank nella valutazione: bastano 2 minuti.');
  }

  if (zone.length) {
    const altre = zone.filter((z) => z !== 'addome');
    if (altre.length) add('zone', '🎯', `Zone prioritarie: ${zone.map((z) => ZONE_LABEL[z].toLowerCase()).join(', ')}`,
      'Non si può dimagrire in un punto solo, ma si può dare più tono e forma ai muscoli di una zona allenandola di più.',
      `Gli esercizi per ${altre.map((z) => ZONE_LABEL[z].toLowerCase()).join(' e ')} aprono le sessioni, hanno una serie in più e un esercizio complementare dedicato.`);
  }

  if (p.lavoro === 'sedentario' && !posture) add('seduto', '🪑', 'Passi molte ore seduto',
    'Stare seduti accorcia i flessori dell’anca, “spegne” i glutei e chiude le spalle in avanti.',
    'Mobilità di anche e torace in ogni riscaldamento, più tirate che spinte, e una pausa attiva ogni ora.');
  if (Number(p.sonno) && Number(p.sonno) < 7) add('sonno', '😴', `Dormi circa ${p.sonno} ore`,
    'Sotto le 7 ore aumentano la fame e la voglia di dolci, e il corpo trattiene più facilmente grasso sull’addome.',
    'Il sonno entra tra le tue abitudini quotidiane. Nelle settimane con poco sonno il volume di allenamento resta moderato.');
  if (p.stress === 'alto') add('stress', '🌬️', 'Il tuo stress è alto',
    'Lo stress prolungato alza il cortisolo: più fame nervosa, sonno peggiore, recupero più lento.',
    'Ogni sessione si chiude con 2 minuti di respirazione lenta. Meglio sessioni brevi e costanti che allenamenti estenuanti.');

  return { whtr, vita, bmi, drivers, findings, zone, belly };
}

/** regole alimentari su misura ricavate dalle abitudini dichiarate */
export function regoleCibo(p, dg = diagnosi(p)) {
  const out = [];
  const add = (icon, title, text) => out.push({ icon, title, text });
  if (dg.drivers.bloat) {
    add('🎈', 'Contro il gonfiore', 'Mangia lentamente e a bocca chiusa, mastica a lungo. Per due settimane riduci bibite gassate, gomme da masticare e dolcificanti (sorbitolo, xilitolo). Legumi in piccole porzioni, ben cotti o decorticati.');
    add('📓', 'Trova i tuoi cibi “gonfianti”', 'Segna per due settimane quando la pancia si gonfia e cosa hai mangiato prima. I responsabili più comuni: latte, cipolla e aglio, cavoli, legumi, mele e pere, pane e pizza poco lievitati.');
  }
  if (p.bibite === 'spesso' || p.bibite === 'ogni') add('🥤', 'Bibite zuccherate', `Una lattina sono circa 140 kcal e 35 g di zucchero. ${p.bibite === 'ogni' ? 'Bevendone ogni giorno arrivi a quasi 1.000 kcal a settimana' : 'Sono calorie che non saziano'}: passa ad acqua frizzante con limone o alla versione senza zucchero.`);
  if (p.dolci === 'spesso' || p.dolci === 'ogni') add('🍫', 'Voglia di dolce', 'Non toglierlo: programmalo. Un dolce piccolo dopo un pasto completo (2 quadratini di fondente, uno yogurt con miele) fa meno danni di uno mangiato a stomaco vuoto. Tenere i dolci fuori da casa aiuta più della forza di volontà.');
  if (p.alcol === 'spesso') add('🍷', 'Alcol', 'Un bicchiere di vino sono 90–120 kcal, una birra media 170. L’alcol blocca il consumo di grassi per alcune ore e peggiora il sonno: tienilo per 1–2 occasioni a settimana.');
  if (p.fame === 'sera' || p.fame === 'notte') add('🌙', 'Fame la sera', 'Arrivi a sera con troppa fame perché di giorno mangi poco. Il tuo piano sposta più proteine a colazione e pranzo e mette uno spuntino nel pomeriggio.');
  if (p.fame === 'pomeriggio') add('🕔', 'Fame nel pomeriggio', 'Lo spuntino del pomeriggio è già nel tuo piano: preparalo in anticipo, così non finisci alle macchinette.');
  if (p.colazione === 'salto') add('☕', 'Salti la colazione', 'Va bene se non hai fame al mattino: le calorie vengono spostate sugli altri pasti. Se a metà mattina arrivi affamato, prova con uno yogurt o un frutto.');
  if (p.pranzo === 'fuori') add('🍽️', 'Pranzo fuori casa', 'Scegli sempre un piatto con una proteina ben visibile (pollo, pesce, uova, legumi, bresaola) e una verdura. Pane sì, ma al posto della pasta, non in aggiunta. Condimenti a parte quando puoi.');
  if (p.cucina === 'poco') add('⏱️', 'Poco tempo per cucinare', 'I tuoi menu usano piatti pronti in 10–15 minuti. Cuoci cereali e legumi una volta per 3 giorni e tieni in casa uova, tonno, legumi in barattolo e verdure surgelate.');
  if (dg.drivers.fat >= 1 && !out.some((x) => x.icon === '🥤')) add('🥗', 'Volume nel piatto', 'Inizia pranzo e cena con una porzione abbondante di verdure: riempiono lo stomaco con poche calorie e rendono più facile restare nel tuo fabbisogno.');
  return out;
}
