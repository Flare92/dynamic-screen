// Valutazione del punto di partenza: test fisici, misure corporee, mappa dei dolori,
// punteggi rispetto a valori di riferimento per età e sesso, indicatori dell'obiettivo
// (KPI) e indice di precisione del piano.
//
// Riferimenti (valori approssimati, uso orientativo):
//  - Piegamenti: tabelle ACSM (uomini sulle punte, donne sulle ginocchia)
//  - Alzate dalla sedia in 30 s: Rikli & Jones (Senior Fitness Test), estese agli adulti
//  - Step test di 3 minuti: YMCA (gradino 30 cm, 96 battiti/min, FC nel minuto successivo)
//  - Massa grassa: formula della U.S. Navy (circonferenze)
//  - Rapporto vita/altezza: soglia di rischio 0,5

export const LEVEL_LABEL = ['', 'Molto basso', 'Basso', 'Nella media', 'Buono', 'Ottimo'];

export const AREAS = [
  { id: 'forzaSup', label: 'Forza parte alta', short: 'Parte alta' },
  { id: 'forzaInf', label: 'Forza gambe', short: 'Gambe' },
  { id: 'core', label: 'Core', short: 'Core' },
  { id: 'cardio', label: 'Resistenza cardio', short: 'Cardio' },
  { id: 'mobilita', label: 'Mobilità', short: 'Mobilità' },
  { id: 'equilibrio', label: 'Equilibrio', short: 'Equilibrio' },
  { id: 'composizione', label: 'Composizione corporea', short: 'Corpo' },
];

export const PAIN_REGIONS = [
  { id: 'collo', label: 'Collo', cond: 'collo' },
  { id: 'spalle', label: 'Spalle', cond: 'spalle' },
  { id: 'polsi', label: 'Gomiti e polsi', cond: 'polsi' },
  { id: 'dorsale', label: 'Schiena alta', cond: 'dorsale' },
  { id: 'lombare', label: 'Zona lombare', cond: 'schiena' },
  { id: 'anche', label: 'Anche e inguine', cond: 'anche' },
  { id: 'ginocchia', label: 'Ginocchia', cond: 'ginocchia' },
  { id: 'caviglie', label: 'Caviglie e piedi', cond: 'caviglie' },
];
export const PAIN_LEVELS = [[0, 'No'], [1, 'Lieve'], [2, 'Medio'], [3, 'Forte']];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = (v) => Math.round(v * 10) / 10;
const pain = (p, id) => Number(p.dolori?.[id] || 0);
const has = (p, c) => (p.condizioni || []).includes(c);

// ------------------------------------------------------------------
// Test
// ------------------------------------------------------------------

export const TESTS = [
  {
    id: 'pushup', area: 'forzaSup', title: 'Test dei piegamenti', ex: 'p_classici', kind: 'reps', unit: 'ripetizioni',
    variants: [['classici', 'Sulle punte'], ['ginocchia', 'Sulle ginocchia'], ['rialzo', 'Mani su un tavolo'], ['muro', 'Al muro']],
    setup: ['Scegli la versione più difficile che riesci a fare almeno 3 volte con buona tecnica.', 'Mani poco più larghe delle spalle, corpo dritto dalla testa ai piedi (o alle ginocchia).'],
    steps: ['Scendi finché il petto è a un pugno da terra (o dal tavolo/muro).', 'Risali a braccia distese. Conta solo le ripetizioni complete.', 'Vai a ritmo costante, senza fermarti.', 'Il test finisce quando la tecnica cede (bacino che cade) o ti fermi più di 2 secondi.'],
    when: (p) => (pain(p, 'spalle') >= 2 || pain(p, 'polsi') >= 2 ? 'Salto: hai indicato dolore a spalle o polsi.'
      : ['cuore', 'petto', 'intervento'].some((c) => has(p, c)) ? 'Salto: aspetta il via libera del medico.' : null),
  },
  {
    id: 'chair', area: 'forzaInf', title: 'Alzate dalla sedia in 30 secondi', ex: 's_sitstand', kind: 'count', timer: 30, unit: 'alzate',
    setup: ['Sedia stabile contro il muro, alta circa 43–45 cm.', 'Siediti al centro, piedi a terra, braccia incrociate sul petto.'],
    steps: ['Al via alzati completamente in piedi e risiediti, il più velocemente possibile con controllo.', 'Continua per 30 secondi.', 'Conta quante volte arrivi in piedi completamente.'],
    when: (p) => (pain(p, 'ginocchia') >= 3 || pain(p, 'anche') >= 3 ? 'Salto: dolore forte a ginocchia o anche.' : has(p, 'intervento') ? 'Salto: aspetta il via libera del medico.' : null),
  },
  {
    id: 'plank', area: 'core', title: 'Plank: tenuta massima', ex: 'c_plank', kind: 'hold', max: 240, unit: 'secondi',
    variants: [['avambracci', 'Sulle punte'], ['ginocchia', 'Sulle ginocchia']],
    setup: ['Avambracci a terra, gomiti sotto le spalle.', 'Scegli la versione sulle punte; usa le ginocchia solo se non riesci a tenerla 15 secondi.'],
    steps: ['Avvia il cronometro quando sei in posizione, corpo dritto.', 'Respira normalmente.', 'Fermalo quando il bacino cade o sale, o quando la schiena fa male.'],
    when: (p) => (pain(p, 'lombare') >= 2 ? 'Salto: dolore alla zona lombare.' : has(p, 'gravidanza') || has(p, 'cuore') || has(p, 'petto') ? 'Salto per sicurezza.' : null),
  },
  {
    id: 'hang', area: 'forzaSup', title: 'Sospensione alla sbarra', ex: 't_trazioni', kind: 'hold', max: 180, unit: 'secondi',
    setup: ['Sbarra stabile, presa prona alla larghezza delle spalle.', 'Usa una sedia per arrivare alla sbarra.'],
    steps: ['Togli i piedi dalla sedia e resta appeso a braccia distese.', 'Spalle leggermente attive, non completamente "appese".', 'Ferma il cronometro quando lasci la presa.'],
    when: (p) => (!(p.attrezzi || []).some((a) => a === 'sbarra' || a === 'palestra') ? 'Salto: non hai una sbarra.' : pain(p, 'spalle') >= 2 || pain(p, 'polsi') >= 2 ? 'Salto: dolore a spalle o polsi.' : null),
  },
  {
    id: 'cardioSelf', area: 'cardio', title: 'Come va il tuo fiato?', ex: 'x_cammino', kind: 'choice',
    options: [[1, 'Mi affanno già salendo 2 piani di scale'], [2, 'Cammino 30 minuti a passo svelto senza fermarmi'], [3, 'Corro 10 minuti di fila a ritmo tranquillo'], [4, 'Corro 30 minuti di fila'], [5, 'Corro più di 45 minuti o faccio gare']],
    setup: ['Scegli la frase più vicina a ciò che riesci a fare oggi, non a quello che facevi in passato.'],
    steps: [],
    when: () => null,
  },
  {
    id: 'step', area: 'cardio', title: 'Step test di 3 minuti', ex: 'l_step', kind: 'hr', timer: 180, metronome: 96, unit: 'battiti/min',
    setup: ['Gradino o scalino alto circa 30 cm.', 'Impara a sentire il polso: due dita sul lato del collo o sul polso.'],
    steps: ['Al via sali e scendi seguendo il bip: su-su-giù-giù (24 salite al minuto).', 'Continua per 3 minuti.', 'Alla fine siediti subito: parte un minuto in cui conti i battiti del polso.', 'Inserisci il numero di battiti contati in quel minuto.'],
    when: (p) => {
      if (['cuore', 'petto', 'gravidanza', 'intervento'].some((c) => has(p, c))) return 'Salto: test da sforzo da fare solo con il via libera medico.';
      if (pain(p, 'ginocchia') >= 2 || pain(p, 'caviglie') >= 2 || pain(p, 'anche') >= 2) return 'Salto: dolore a ginocchia, anche o caviglie.';
      if (p.eta >= 70) return 'Salto: oltre i 70 anni basta l’autovalutazione.';
      return null;
    },
  },
  {
    id: 'toetouch', area: 'mobilita', title: 'Flessibilità posteriore', ex: 'w_hinge', kind: 'choice',
    options: [[1, 'Arrivo alle ginocchia o poco sotto'], [2, 'Arrivo a metà tibia'], [3, 'Arrivo alle caviglie'], [4, 'Tocco le punte dei piedi'], [5, 'Appoggio i palmi a terra']],
    setup: ['In piedi, piedi uniti, ginocchia tese ma non bloccate.'],
    steps: ['Piegati lentamente in avanti lasciando scendere le mani.', 'Non molleggiare, non forzare.', 'Scegli fin dove arrivi.'],
    when: (p) => (pain(p, 'lombare') >= 2 || has(p, 'osteoporosi') ? 'Salto: flessione del busto sconsigliata per te.' : null),
  },
  {
    id: 'shoulder', area: 'mobilita', title: 'Mobilità delle spalle', ex: 'w_angeli', kind: 'choice',
    options: [[1, 'Mani distanti più di 15 cm'], [2, 'Distanti tra 5 e 15 cm'], [3, 'Si sfiorano (meno di 5 cm)'], [4, 'Le dita si sovrappongono'], [5, 'Si sovrappongono di oltre 5 cm']],
    setup: ['In piedi, schiena dritta.'],
    steps: ['Porta una mano dietro la testa verso la schiena, palmo verso la schiena.', 'Porta l’altra mano dietro la schiena dal basso, dorso verso la schiena.', 'Prova ad avvicinare le dita senza forzare.', 'Prova anche invertendo le braccia e scegli il risultato del lato peggiore.'],
    when: (p) => (pain(p, 'spalle') >= 3 ? 'Salto: dolore forte alle spalle.' : null),
  },
  {
    id: 'ankle', area: 'mobilita', title: 'Mobilità della caviglia', ex: 'w_caviglie', kind: 'cm', unit: 'cm',
    setup: ['Di fronte a un muro, a piedi nudi.', 'Tieni a portata un metro o un righello.'],
    steps: ['Metti un piede avanti, punta a qualche cm dal muro.', 'Porta il ginocchio a toccare il muro senza staccare il tallone.', 'Se ci riesci, allontana il piede di 1 cm e riprova.', 'Misura la distanza massima tra alluce e muro. Fallo per entrambi i lati e inserisci quella più bassa.'],
    when: (p) => (pain(p, 'caviglie') >= 3 || pain(p, 'ginocchia') >= 3 ? 'Salto: dolore forte.' : null),
  },
  {
    id: 'squatdeep', area: 'mobilita', title: 'Squat profondo', ex: 's_squat', kind: 'choice',
    options: [[1, 'Non arrivo con le cosce parallele al pavimento'], [2, 'Arrivo al parallelo ma i talloni si alzano'], [3, 'Arrivo al parallelo con i talloni giù, ma busto molto inclinato o ginocchia che entrano'], [5, 'Scendo sotto il parallelo con busto alto e talloni a terra']],
    setup: ['Piedi larghi come le spalle, braccia tese davanti.', 'Mettiti di lato a uno specchio o fatti guardare.'],
    steps: ['Scendi lentamente il più in basso possibile senza dolore.', 'Osserva talloni, ginocchia e busto.', 'Scegli la descrizione corretta.'],
    when: (p) => (pain(p, 'ginocchia') >= 2 || pain(p, 'anche') >= 2 ? 'Salto: dolore a ginocchia o anche.' : null),
  },
  {
    id: 'balance', area: 'equilibrio', title: 'Equilibrio su una gamba', ex: 'b_unagamba', kind: 'hold', max: 60, unit: 'secondi',
    setup: ['Vicino a un muro o una sedia, a piedi nudi.', 'Mani sui fianchi.'],
    steps: ['Solleva un piede da terra e avvia il cronometro.', 'Occhi aperti, sguardo su un punto fisso.', 'Ferma quando appoggi il piede o togli le mani dai fianchi (massimo 60 s).', 'Ripeti sull’altra gamba e inserisci il tempo più basso.'],
    when: () => null,
  },
  {
    id: 'balanceClosed', area: 'equilibrio', title: 'Equilibrio a occhi chiusi', ex: 'b_unagamba', kind: 'hold', max: 30, unit: 'secondi',
    setup: ['Solo se hai superato 45 secondi a occhi aperti.', 'Sempre vicino a un appoggio.'],
    steps: ['Come prima, ma chiudi gli occhi dopo aver sollevato il piede.', 'Ferma quando apri gli occhi o appoggi il piede (massimo 30 s).'],
    when: (p, vals) => (!(vals?.balance >= 45) ? 'Salto: serve almeno 45 s a occhi aperti.' : p.eta >= 70 ? 'Salto per sicurezza.' : null),
  },
];
export const TEST_BY_ID = Object.fromEntries(TESTS.map((t) => [t.id, t]));

export const MEASURES = [
  { id: 'vita', label: 'Circonferenza vita', unit: 'cm', how: 'All’altezza dell’ombelico, a fine espirazione, metro aderente ma non stretto.', min: 40, max: 220 },
  { id: 'collo', label: 'Circonferenza collo', unit: 'cm', how: 'Appena sotto il pomo d’Adamo, metro leggermente inclinato in avanti.', min: 20, max: 70 },
  { id: 'fianchi', label: 'Circonferenza fianchi', unit: 'cm', how: 'Nel punto più largo dei glutei, piedi uniti.', min: 50, max: 220, sex: 'F' },
  { id: 'fc', label: 'Frequenza cardiaca a riposo', unit: 'bpm', how: 'Al mattino, seduto da 5 minuti: conta i battiti del polso per 30 secondi e moltiplica per 2.', min: 30, max: 140 },
  { id: 'pas', label: 'Pressione massima', unit: 'mmHg', how: 'Facoltativa: con un misuratore, seduto da 5 minuti.', min: 70, max: 250, optional: true },
  { id: 'pad', label: 'Pressione minima', unit: 'mmHg', how: 'Facoltativa.', min: 40, max: 150, optional: true },
];

// ------------------------------------------------------------------
// Punteggi
// ------------------------------------------------------------------

function ageBand(age, bands) { for (const [lim, v] of bands) if (age < lim) return v; return bands[bands.length - 1][1]; }

// soglie [eccellente, molto buono, buono, discreto]
const PUSH_M = [[30, [36, 29, 22, 17]], [40, [30, 22, 17, 12]], [50, [25, 17, 13, 10]], [60, [21, 13, 10, 7]], [200, [18, 11, 8, 5]]];
const PUSH_F = [[30, [30, 21, 15, 10]], [40, [27, 20, 13, 8]], [50, [24, 15, 11, 5]], [60, [21, 11, 7, 2]], [200, [17, 12, 5, 2]]];

export function scorePushup(reps, variant, p) {
  const male = p.sesso === 'M';
  const k = male ? { classici: 1, ginocchia: 0.55, rialzo: 0.3, muro: 0.12 } : { classici: 1.7, ginocchia: 1, rialzo: 0.55, muro: 0.22 };
  const eq = reps * (k[variant] ?? 1);
  const th = ageBand(p.eta, male ? PUSH_M : PUSH_F);
  let lv = eq >= th[0] ? 5 : eq >= th[1] ? 4 : eq >= th[2] ? 3 : eq >= th[3] ? 2 : 1;
  if (variant === 'muro') lv = Math.min(lv, 2);
  if (variant === 'rialzo') lv = Math.min(lv, 3);
  return lv;
}

const CHAIR_MID = { M: [[40, 22], [60, 19], [70, 16], [80, 14], [200, 12]], F: [[40, 20], [60, 17], [70, 14], [80, 12.5], [200, 11.5]] };
export function scoreChair(n, p) {
  const mid = ageBand(p.eta, CHAIR_MID[p.sesso === 'M' ? 'M' : 'F']);
  const r = n / mid;
  return r < 0.7 ? 1 : r < 0.9 ? 2 : r < 1.1 ? 3 : r < 1.3 ? 4 : 5;
}

export function scorePlank(secs, variant, p) {
  const eq = variant === 'ginocchia' ? secs * 0.5 : secs;
  const f = p.eta >= 65 ? 0.6 : p.eta >= 50 ? 0.8 : 1;
  const th = [30, 60, 90, 120].map((x) => x * f);
  return eq < th[0] ? 1 : eq < th[1] ? 2 : eq < th[2] ? 3 : eq < th[3] ? 4 : 5;
}

export function scoreHang(secs, p) {
  const th = p.sesso === 'M' ? [10, 20, 40, 60] : [5, 12, 25, 45];
  return secs < th[0] ? 1 : secs < th[1] ? 2 : secs < th[2] ? 3 : secs < th[3] ? 4 : 5;
}

const STEP_AVG = { M: [[26, 105], [36, 107], [46, 111], [56, 115], [200, 115]], F: [[26, 113], [36, 115], [46, 117], [56, 120], [200, 121]] };
export function scoreStep(hr, p) {
  const avg = ageBand(p.eta, STEP_AVG[p.sesso === 'M' ? 'M' : 'F']);
  const d = hr - avg;
  return d <= -20 ? 5 : d <= -8 ? 4 : d <= 8 ? 3 : d <= 20 ? 2 : 1;
}

export function scoreAnkle(cm) { return cm < 5 ? 1 : cm < 8 ? 2 : cm < 10 ? 3 : cm < 12 ? 4 : 5; }

export function scoreBalance(open, closed, p) {
  const f = p.eta >= 65 ? 0.6 : 1;
  if (closed >= 20) return 5;
  if (open >= 45 * f) return 4;
  if (open >= 30 * f) return 3;
  if (open >= 10 * f) return 2;
  return 1;
}

export function scoreHrRest(hr) { return hr < 55 ? 5 : hr < 62 ? 4 : hr < 72 ? 3 : hr < 82 ? 2 : 1; }

// ------------------------------------------------------------------
// Composizione corporea
// ------------------------------------------------------------------

export function bodyFat(p, m) {
  if (!m?.vita || !m?.collo) return null;
  const inch = (cm) => cm / 2.54;
  const h = inch(p.altezza);
  let bf;
  if (p.sesso === 'M') {
    if (m.vita <= m.collo) return null;
    bf = 86.010 * Math.log10(inch(m.vita - m.collo)) - 70.041 * Math.log10(h) + 36.76;
  } else {
    if (!m.fianchi || m.vita + m.fianchi <= m.collo) return null;
    bf = 163.205 * Math.log10(inch(m.vita + m.fianchi - m.collo)) - 97.684 * Math.log10(h) - 78.387;
  }
  return r1(clamp(bf, 3, 60));
}

export function bfLevel(bf, sex) {
  const t = sex === 'M' ? [13, 17, 24, 29] : [20, 24, 31, 37];
  return bf <= t[0] ? 5 : bf <= t[1] ? 4 : bf <= t[2] ? 3 : bf <= t[3] ? 2 : 1;
}
const BF_LABEL = ['', 'Elevata', 'Sopra la media', 'Nella media', 'In forma', 'Atletica'];

export function whtrLevel(w) { return w < 0.4 ? 3 : w < 0.46 ? 5 : w < 0.5 ? 4 : w < 0.55 ? 3 : w < 0.6 ? 2 : 1; }

// ------------------------------------------------------------------
// Profilo completo dal punto di partenza
// ------------------------------------------------------------------

/**
 * entry: { date, results: { pushup, pushupVar, chair, plank, plankVar, hang, cardioSelf, step,
 *          toetouch, shoulder, ankle, squatdeep, balance, balanceClosed }, meas: { vita, collo, fianchi, fc, pas, pad } }
 * peso: peso attuale (se diverso da quello del profilo)
 */
export function computeProfile(p, entry = {}, peso = p.peso) {
  const R = entry.results || {};
  const M = { ...(p.misure || {}), ...(entry.meas || {}) };
  const t = {};
  const add = (id, value, level, extra = {}) => { t[id] = { value, level, label: LEVEL_LABEL[level], ...extra }; };
  const num = (v) => v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v));

  if (num(R.pushup)) add('pushup', +R.pushup, scorePushup(+R.pushup, R.pushupVar || 'classici', p), { variant: R.pushupVar || 'classici' });
  if (num(R.chair)) add('chair', +R.chair, scoreChair(+R.chair, p));
  if (num(R.plank)) add('plank', +R.plank, scorePlank(+R.plank, R.plankVar || 'avambracci', p), { variant: R.plankVar || 'avambracci' });
  if (num(R.hang)) add('hang', +R.hang, scoreHang(+R.hang, p));
  if (num(R.cardioSelf)) add('cardioSelf', +R.cardioSelf, +R.cardioSelf);
  if (num(R.step)) add('step', +R.step, scoreStep(+R.step, p));
  if (num(R.toetouch)) add('toetouch', +R.toetouch, +R.toetouch);
  if (num(R.shoulder)) add('shoulder', +R.shoulder, +R.shoulder);
  if (num(R.ankle)) add('ankle', +R.ankle, scoreAnkle(+R.ankle));
  if (num(R.squatdeep)) add('squatdeep', +R.squatdeep, +R.squatdeep);
  if (num(R.balance)) add('balance', +R.balance, scoreBalance(+R.balance, num(R.balanceClosed) ? +R.balanceClosed : 0, p));

  const h = p.altezza / 100;
  const bmi = peso / (h * h);
  const bf = bodyFat(p, M);
  const whtr = M.vita ? Math.round((M.vita / p.altezza) * 100) / 100 : null;
  const body = {
    bmi: r1(bmi), bf, whtr,
    fatMass: bf !== null ? r1(peso * bf / 100) : null,
    leanMass: bf !== null ? r1(peso * (1 - bf / 100)) : null,
    bfLevel: bf !== null ? bfLevel(bf, p.sesso) : null,
    bfLabel: bf !== null ? BF_LABEL[bfLevel(bf, p.sesso)] : null,
    whtrLevel: whtr ? whtrLevel(whtr) : null,
    whtrLabel: whtr ? (whtr < 0.5 ? 'Nella norma' : whtr < 0.6 ? 'Rischio aumentato' : 'Rischio elevato') : null,
    hrRest: num(M.fc) ? +M.fc : null,
    hrLevel: num(M.fc) ? scoreHrRest(+M.fc) : null,
    pas: num(M.pas) ? +M.pas : null, pad: num(M.pad) ? +M.pad : null,
    vita: M.vita || null,
  };

  const avg = (arr) => { const v = arr.filter((x) => x !== null && x !== undefined); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const L = (id) => t[id]?.level ?? null;
  let cardio = null;
  if (L('step') !== null && L('cardioSelf') !== null) cardio = 0.7 * L('step') + 0.3 * L('cardioSelf');
  else cardio = L('step') ?? L('cardioSelf');
  if (cardio !== null && body.hrLevel !== null) cardio = 0.85 * cardio + 0.15 * body.hrLevel;
  const areas = {
    forzaSup: avg([L('pushup'), L('hang')]),
    forzaInf: L('chair'),
    core: L('plank'),
    cardio,
    mobilita: avg([L('toetouch'), L('shoulder'), L('ankle'), L('squatdeep')]),
    equilibrio: L('balance'),
    composizione: body.bfLevel ?? body.whtrLevel ?? (bmi < 18.5 ? 2 : bmi < 25 ? 4 : bmi < 27.5 ? 3 : bmi < 30 ? 2 : 1),
  };
  for (const k in areas) if (areas[k] !== null) areas[k] = Math.round(areas[k] * 10) / 10;

  const flags = {
    anklesStiff: L('ankle') !== null && L('ankle') <= 2,
    hamstringsTight: L('toetouch') !== null && L('toetouch') <= 2,
    shouldersStiff: L('shoulder') !== null && L('shoulder') <= 2,
    squatLimited: L('squatdeep') !== null && L('squatdeep') <= 2,
    balancePoor: L('balance') !== null && L('balance') <= 2,
    coreWeak: L('plank') !== null && L('plank') <= 2,
  };

  const lv = (x) => (x === null || x === undefined ? null : Math.round(x));
  const levels = {
    push: lv(L('pushup') ?? areas.forzaSup),
    pull: lv(L('hang') ?? (L('pushup') !== null ? L('pushup') - 0.5 : null)),
    legs: lv(areas.forzaInf),
    core: lv(areas.core),
    cardio: lv(areas.cardio),
  };

  const scored = AREAS.filter((a) => areas[a.id] !== null).map((a) => ({ ...a, v: areas[a.id] }));
  const sorted = [...scored].sort((a, b) => a.v - b.v);
  const weak = sorted.filter((a) => a.v <= 2.5).slice(0, 2);
  const strong = [...sorted].reverse().filter((a) => a.v >= 3.5).slice(0, 2);

  return {
    tests: t, areas, body, flags, levels, weak, strong,
    maxes: { pushup: t.pushup ? { reps: t.pushup.value, variant: t.pushup.variant } : null, plank: t.plank ? { secs: t.plank.value, variant: t.plank.variant } : null, chair: t.chair?.value ?? null, hang: t.hang?.value ?? null },
    tested: Object.keys(t).length,
  };
}

// ------------------------------------------------------------------
// Indice di precisione del piano
// ------------------------------------------------------------------

const TEST_LABELS = {
  pushup: 'Test dei piegamenti', chair: 'Test alzate dalla sedia', plank: 'Test plank', cardioSelf: 'Fiato (autovalutazione)', step: 'Step test cardio',
  toetouch: 'Flessibilità posteriore', shoulder: 'Mobilità spalle', ankle: 'Mobilità caviglia', squatdeep: 'Squat profondo', balance: 'Equilibrio', hang: 'Sospensione alla sbarra',
};

export function precision(p, entry, extra = {}) {
  const R = entry?.results || {};
  const M = { ...(p.misure || {}), ...(entry?.meas || {}) };
  const items = [
    ['Corpo, obiettivo e tempo', 12, true],
    ['Storia clinica', 8, true],
    ['Abitudini', 8, true],
    ['Mappa dei dolori', 6, !!p.dolori],
    ['Circonferenza vita', 5, !!M.vita],
    ['Circonferenza collo', 3, !!M.collo],
    ...(p.sesso === 'F' ? [['Circonferenza fianchi', 3, !!M.fianchi]] : []),
    ['Frequenza cardiaca a riposo', 4, !!M.fc],
    ['Test dei piegamenti', 7, R.pushup !== undefined],
    ['Test alzate dalla sedia', 7, R.chair !== undefined],
    ['Test plank', 6, R.plank !== undefined],
    ['Fiato (autovalutazione)', 3, R.cardioSelf !== undefined],
    ['Step test cardio', 5, R.step !== undefined],
    ['Flessibilità posteriore', 3, R.toetouch !== undefined],
    ['Mobilità spalle', 3, R.shoulder !== undefined],
    ['Mobilità caviglia', 3, R.ankle !== undefined],
    ['Squat profondo', 3, R.squatdeep !== undefined],
    ['Equilibrio', 3, R.balance !== undefined],
    ['Feedback sugli esercizi', 4, (extra.feedbacks || 0) >= 5],
    ['Test di controllo (ogni 4 settimane)', 4, (extra.retests || 0) >= 1],
  ];
  if ((p.attrezzi || []).some((a) => a === 'sbarra' || a === 'palestra')) items.push(['Sospensione alla sbarra', 2, R.hang !== undefined]);
  const skip = new Set((extra.excludeTests || []).map((id) => TEST_LABELS[id]));
  const list = items.filter((i) => !skip.has(i[0]));
  items.length = 0; items.push(...list);
  const tot = items.reduce((a, i) => a + i[1], 0);
  const got = items.filter((i) => i[2]).reduce((a, i) => a + i[1], 0);
  return { pct: Math.round((got / tot) * 100), missing: items.filter((i) => !i[2]).map(([label, w]) => ({ label, gain: Math.round((w / tot) * 100) })) };
}

// ------------------------------------------------------------------
// Indicatori dell'obiettivo (KPI)
// ------------------------------------------------------------------

const KPI_DEF = {
  peso: { label: 'Peso', unit: 'kg', dec: 1, better: 'down' },
  vita: { label: 'Circonferenza vita', unit: 'cm', dec: 1, better: 'down' },
  grasso: { label: 'Massa grassa', unit: '%', dec: 1, better: 'down' },
  magra: { label: 'Massa magra', unit: 'kg', dec: 1, better: 'up' },
  whtr: { label: 'Rapporto vita/altezza', unit: '', dec: 2, better: 'down' },
  pushup: { label: 'Piegamenti', unit: 'rip.', dec: 0, better: 'up' },
  chair: { label: 'Alzate dalla sedia (30 s)', unit: '', dec: 0, better: 'up' },
  plank: { label: 'Plank', unit: 's', dec: 0, better: 'up' },
  step: { label: 'FC dopo lo step test', unit: 'bpm', dec: 0, better: 'down' },
  fc: { label: 'FC a riposo', unit: 'bpm', dec: 0, better: 'down' },
  cardioSelf: { label: 'Livello del fiato', unit: '/5', dec: 0, better: 'up' },
  toetouch: { label: 'Flessibilità posteriore', unit: '/5', dec: 0, better: 'up' },
  shoulder: { label: 'Mobilità spalle', unit: '/5', dec: 0, better: 'up' },
  ankle: { label: 'Mobilità caviglia', unit: 'cm', dec: 0, better: 'up' },
  squatdeep: { label: 'Squat profondo', unit: '/5', dec: 0, better: 'up' },
  balance: { label: 'Equilibrio su una gamba', unit: 's', dec: 0, better: 'up' },
};

/** valore attuale di un indicatore */
export function metric(id, p, entry, peso) {
  const R = entry?.results || {};
  const M = { ...(p.misure || {}), ...(entry?.meas || {}) };
  const cp = computeProfile(p, entry, peso);
  switch (id) {
    case 'peso': return peso;
    case 'vita': return M.vita ?? null;
    case 'grasso': return cp.body.bf;
    case 'magra': return cp.body.leanMass;
    case 'whtr': return cp.body.whtr;
    case 'fc': return M.fc ?? null;
    default: return R[id] !== undefined && R[id] !== '' ? Number(R[id]) : null;
  }
}

export function buildKpis(p, entry, nutri, timeline) {
  const cp = computeProfile(p, entry);
  const out = [];
  const push = (id, base, target, weeks, note) => {
    if (base === null || base === undefined || target === null || target === undefined) return;
    const d = KPI_DEF[id];
    if (Math.abs(target - base) < (d.dec === 0 ? 1 : 0.1)) return;
    out.push({ id, ...d, base, target: d.dec === 0 ? Math.round(target) : Math.round(target * 10 ** d.dec) / 10 ** d.dec, weeks, note });
  };
  const exp = { principiante: 1, intermedio: 0.6, avanzato: 0.35 }[p.esperienza] || 1;
  const goal = p.obiettivo;
  const wTarget = timeline?.hasWeight ? nutri.target : null;
  const wWeeks = timeline?.weeks || 12;
  const b = cp.body;
  const R = entry?.results || {};

  if (goal === 'dimagrire' || (wTarget && wTarget < p.peso)) {
    if (wTarget) push('peso', p.peso, wTarget, wWeeks);
    const lost = wTarget ? p.peso - wTarget : p.peso * 0.04;
    if (b.vita) push('vita', b.vita, b.vita - Math.max(2, lost * 0.9), wTarget ? wWeeks : 12, 'Circa 1 cm in meno ogni kg perso.');
    if (b.bf !== null) {
      const fatLost = lost * 0.8;
      const nb = ((b.fatMass - fatLost) / (p.peso - lost)) * 100;
      push('grasso', b.bf, Math.max(p.sesso === 'M' ? 10 : 18, nb), wTarget ? wWeeks : 12, 'Stima: l’80% del peso perso è grasso se mantieni forza e proteine.');
    }
    if (b.whtr && b.whtr >= 0.5) push('whtr', b.whtr, Math.max(0.49, (b.vita - Math.max(2, lost * 0.9)) / p.altezza), wTarget ? wWeeks : 12, 'Sotto 0,5 il rischio cardiometabolico si riduce.');
  }
  if (goal === 'massa') {
    const monthly = (p.sesso === 'M' ? 0.9 : 0.45) * exp;
    if (b.leanMass !== null) push('magra', b.leanMass, b.leanMass + monthly * 3, 12, 'Ritmo realistico di crescita muscolare per il tuo livello.');
    else push('peso', p.peso, p.peso + monthly * 3 * 1.2, 12);
  }
  if (goal === 'tonificare' && b.bf !== null) push('grasso', b.bf, b.bf - (p.sesso === 'M' ? 3 : 2.5) * Math.max(0.5, exp), 12);
  if (['massa', 'tonificare', 'salute', 'dimagrire'].includes(goal)) {
    if (cp.tests.pushup) push('pushup', cp.tests.pushup.value, cp.tests.pushup.value * (1 + 0.45 * exp) + 1, 8, `Stessa versione: ${R.pushupVar || 'classici'}.`);
    if (cp.tests.chair) push('chair', cp.tests.chair.value, cp.tests.chair.value * (1 + 0.25 * exp) + 1, 8);
    if (cp.tests.plank) push('plank', cp.tests.plank.value, Math.min(180, cp.tests.plank.value * (1 + 0.6 * exp) + 5), 8);
  }
  if (goal === 'resistenza' || goal === 'salute') {
    if (cp.tests.step) push('step', cp.tests.step.value, cp.tests.step.value - 12 * exp - 3, 8, 'Un recupero più rapido indica un cuore più allenato.');
    if (b.hrRest) push('fc', b.hrRest, Math.max(50, b.hrRest - 5 * exp - 1), 12);
    if (cp.tests.cardioSelf && cp.tests.cardioSelf.value < 5) push('cardioSelf', cp.tests.cardioSelf.value, cp.tests.cardioSelf.value + 1, 10);
  }
  if (goal === 'mobilita' || cp.flags.hamstringsTight || cp.flags.anklesStiff || cp.flags.shouldersStiff) {
    if (cp.tests.toetouch && (goal === 'mobilita' || cp.flags.hamstringsTight)) push('toetouch', cp.tests.toetouch.value, Math.min(5, cp.tests.toetouch.value + 1), 6);
    if (cp.tests.shoulder && (goal === 'mobilita' || cp.flags.shouldersStiff)) push('shoulder', cp.tests.shoulder.value, Math.min(5, cp.tests.shoulder.value + 1), 6);
    if (cp.tests.ankle && (goal === 'mobilita' || cp.flags.anklesStiff)) push('ankle', cp.tests.ankle.value, cp.tests.ankle.value + 3, 8);
    if (cp.tests.squatdeep && goal === 'mobilita') push('squatdeep', cp.tests.squatdeep.value, Math.min(5, cp.tests.squatdeep.value + 1), 8);
  }
  if (cp.flags.balancePoor && cp.tests.balance) push('balance', cp.tests.balance.value, Math.min(60, cp.tests.balance.value * 1.6 + 5), 8);
  if (goal === 'salute' && b.whtr && b.whtr >= 0.5 && b.vita) push('whtr', b.whtr, 0.49, 16);
  return out;
}

export function kpiProgress(k, current) {
  if (current === null || current === undefined) return null;
  const span = k.target - k.base;
  if (!span) return 1;
  return clamp((current - k.base) / span, -0.5, 1.2);
}
