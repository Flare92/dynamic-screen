// Motore di raccomandazione: dal profilo genera piano settimanale,
// alimentazione, tempi stimati, abitudini e avvisi di sicurezza.
// È una funzione pura: stesso profilo => stesso piano.

import { EXERCISES, BY_ID } from './exercises.js';

// ------------------------------------------------------------------
// Opzioni usate dall'interfaccia
// ------------------------------------------------------------------

export const CONDITIONS = [
  { id: 'ipertensione', label: 'Pressione alta' },
  { id: 'cuore', label: 'Problemi cardiaci' },
  { id: 'petto', label: 'Dolore al petto, svenimenti o vertigini sotto sforzo' },
  { id: 'diabete', label: 'Diabete' },
  { id: 'asma', label: 'Asma' },
  { id: 'schiena', label: 'Mal di schiena / ernia' },
  { id: 'ginocchia', label: 'Problemi alle ginocchia' },
  { id: 'spalle', label: 'Problemi alle spalle' },
  { id: 'anche', label: 'Problemi alle anche' },
  { id: 'osteoporosi', label: 'Osteoporosi' },
  { id: 'reni', label: 'Malattia renale' },
  { id: 'gravidanza', label: 'Gravidanza' },
  { id: 'intervento', label: 'Intervento o infortunio recente (< 6 mesi)' },
  { id: 'betabloccanti', label: 'Assumo betabloccanti' },
];

export const GOALS = [
  { id: 'dimagrire', label: 'Perdere peso', icon: '🔥', desc: 'Ridurre grasso corporeo mantenendo i muscoli' },
  { id: 'massa', label: 'Aumentare massa muscolare', icon: '💪', desc: 'Diventare più forte e più grosso' },
  { id: 'tonificare', label: 'Tonificare', icon: '✨', desc: 'Meno grasso, più muscolo, linea più definita' },
  { id: 'resistenza', label: 'Resistenza / corsa', icon: '🏃', desc: 'Più fiato, correre più a lungo' },
  { id: 'mobilita', label: 'Mobilità e postura', icon: '🧘', desc: 'Meno rigidità, meno dolori, più scioltezza' },
  { id: 'salute', label: 'Salute e benessere', icon: '❤️', desc: 'Stare meglio, più energia, prevenzione' },
];

export const EQUIPMENT = [
  { id: 'manubri', label: 'Manubri' },
  { id: 'elastici', label: 'Elastici' },
  { id: 'sbarra', label: 'Sbarra per trazioni' },
  { id: 'bici', label: 'Bici / cyclette' },
  { id: 'tapis', label: 'Tapis roulant' },
  { id: 'corda', label: 'Corda per saltare' },
  { id: 'piscina', label: 'Piscina' },
  { id: 'palestra', label: 'Palestra attrezzata' },
];

export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const WEEKDAYS_LONG = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

const STEPS_MAP = { '<3000': 2500, '3000-5000': 4000, '5000-7500': 6250, '7500-10000': 8750, '>10000': 11000 };

// ------------------------------------------------------------------
// Utilità
// ------------------------------------------------------------------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, step = 1) => Math.round(v / step) * step;

export function toISO(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
export function daysBetween(a, b) {
  return Math.round((fromISO(toISO(b)) - fromISO(toISO(a))) / 86400000);
}
export const weekdayIndex = (d) => (d.getDay() + 6) % 7; // lun = 0

// ------------------------------------------------------------------
// Dati derivati dal profilo
// ------------------------------------------------------------------

export function derive(p) {
  const h = p.altezza / 100;
  const bmi = p.peso / (h * h);
  const cond = new Set(p.condizioni || []);
  const equip = new Set(['corpo', ...(p.attrezzi || [])]);
  if (equip.has('palestra')) ['manubri', 'elastici', 'sbarra', 'tapis', 'bici'].forEach((e) => equip.add(e));

  let level = { principiante: 1, intermedio: 2, avanzato: 3 }[p.esperienza] || 1;
  if (cond.has('intervento') || cond.has('cuore') || cond.has('petto') || p.eta >= 70) level = 1;
  if (p.eta >= 60 || bmi >= 35 || cond.has('gravidanza')) level = Math.min(level, 2);

  const blocked = new Set();
  if (['ginocchia', 'anche', 'gravidanza', 'osteoporosi', 'cuore', 'petto', 'intervento'].some((c) => cond.has(c)) || bmi >= 30 || p.eta >= 65) blocked.add('impatto');
  if (cond.has('gravidanza')) { blocked.add('supino'); blocked.add('prono'); }
  if (['ipertensione', 'cuore', 'petto', 'gravidanza'].some((c) => cond.has(c))) { blocked.add('valsalva'); }
  if (cond.has('ipertensione') || cond.has('gravidanza')) blocked.add('testaGiu');
  if (cond.has('osteoporosi') || cond.has('schiena')) blocked.add('flessioneCarico');

  const hiitOk = !['cuore', 'petto', 'ipertensione', 'gravidanza', 'intervento'].some((c) => cond.has(c)) && bmi < 35 && p.eta < 70;

  const hrMax = Math.round(208 - 0.7 * p.eta);
  const steps = STEPS_MAP[p.passi] ?? 5000;

  return { bmi, cond, equip, level, blocked, hiitOk, hrMax, steps, age: p.eta };
}

function allowed(ex, d) {
  return ex.eq.some((e) => d.equip.has(e))
    && ex.lvl <= d.level
    && !ex.contra.some((c) => d.cond.has(c))
    && !ex.tags.some((t) => d.blocked.has(t));
}

export function allowedExercises(p) {
  const d = derive(p);
  return EXERCISES.filter((e) => allowed(e, d));
}

// Sceglie l'esercizio migliore per uno schema motorio.
// variant ruota tra le alternative per non ripetere sempre lo stesso.
function pickPattern(pat, d, variant, used, preferLoad) {
  const list = EXERCISES.filter((e) => e.cat === 'strength' && e.pat === pat && allowed(e, d) && !used.has(e.id));
  if (!list.length) return null;
  const score = (e) => e.lvl * 2 + (e.eq.includes('corpo') ? 0 : preferLoad ? 1.5 : 0.5);
  list.sort((a, b) => score(b) - score(a));
  const top = list.slice(0, Math.min(3, list.length));
  return top[variant % top.length];
}

function pickMany(cat, d, n, variant = 0, exclude = []) {
  const list = EXERCISES.filter((e) => e.cat === cat && allowed(e, d) && !exclude.includes(e.id));
  if (!list.length) return [];
  const out = [];
  for (let i = 0; i < Math.min(n, list.length); i++) out.push(list[(i + variant * 2) % list.length]);
  return [...new Set(out)];
}

// ------------------------------------------------------------------
// Dosaggio: serie, ripetizioni, recuperi
// ------------------------------------------------------------------

const DOSE = {
  massa:      { 1: [3, '10–12', 90], 2: [4, '8–12', 90], 3: [4, '6–10', 120] },
  tonificare: { 1: [2, '12', 60], 2: [3, '10–12', 60], 3: [4, '8–12', 60] },
  dimagrire:  { 1: [2, '12–15', 45], 2: [3, '12–15', 45], 3: [3, '10–15', 45] },
  resistenza: { 1: [2, '12–15', 45], 2: [3, '12–15', 45], 3: [3, '15', 45] },
  mobilita:   { 1: [2, '10', 45], 2: [2, '12', 45], 3: [3, '12', 45] },
  salute:     { 1: [2, '10–12', 60], 2: [3, '10–12', 60], 3: [3, '10–12', 60] },
};
const SECS = { 1: 20, 2: 30, 3: 45 };

export function mesoPhase(week) {
  const ph = ((week - 1) % 4) + 1;
  return {
    phase: ph,
    label: ['Adattamento', 'Costruzione', 'Spinta', 'Scarico'][ph - 1],
    note: [
      'Settimana di adattamento: carichi leggeri, concentrati sulla tecnica. Fatica percepita 6/10.',
      'Costruzione: aggiungi 1–2 ripetizioni o un po’ di carico rispetto alla settimana scorsa. Fatica 7/10.',
      'Spinta: una serie in più sugli esercizi principali. Fatica 8/10, mai a cedimento.',
      'Scarico: una serie in meno e carichi più leggeri per recuperare e consolidare. Fatica 6/10.',
    ][ph - 1],
  };
}

function dose(ex, goal, d, phase) {
  let [sets, reps, rest] = DOSE[goal][d.level];
  if (phase === 3) sets = Math.min(sets + 1, 5);
  if (phase === 4) sets = Math.max(sets - 1, 1);
  if (ex.unit === 'sec') {
    const s = ex.id === 'c_farmer' ? 40 : SECS[d.level];
    return { sets, text: `${sets} × ${s} s`, rest };
  }
  const perSide = ['l_step', 'l_affind', 'l_laterale', 'l_affman', 'l_bulgaro', 'r_man', 'h_ponte1', 'g_clam', 'g_kick', 'c_birddog', 'c_deadbug'].includes(ex.id);
  return { sets, text: `${sets} × ${reps}${perSide ? ' per lato' : ''}`, rest };
}

// ------------------------------------------------------------------
// Struttura della settimana
// ------------------------------------------------------------------

const TEMPLATES = {
  dimagrire: {
    2: ['full', 'full'], 3: ['full', 'cardio', 'full'], 4: ['full', 'cardio', 'full', 'intervalli'],
    5: ['full', 'cardio', 'full', 'intervalli', 'circuito'], 6: ['full', 'cardio', 'full', 'intervalli', 'full', 'mobilita'],
    7: ['full', 'cardio', 'full', 'intervalli', 'full', 'lungo', 'mobilita'],
  },
  massa: {
    2: ['full', 'full'], 3: ['full', 'full', 'full'], 4: ['upper', 'lower', 'upper', 'lower'],
    5: ['upper', 'lower', 'upper', 'lower', 'full'], 6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
    7: ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'mobilita'],
  },
  tonificare: {
    2: ['full', 'full'], 3: ['full', 'cardio', 'full'], 4: ['full', 'cardio', 'full', 'full'],
    5: ['full', 'cardio', 'full', 'intervalli', 'full'], 6: ['upper', 'lower', 'cardio', 'upper', 'lower', 'mobilita'],
    7: ['upper', 'lower', 'cardio', 'upper', 'lower', 'intervalli', 'mobilita'],
  },
  resistenza: {
    2: ['cardio', 'lungo'], 3: ['cardio', 'full', 'lungo'], 4: ['cardio', 'intervalli', 'full', 'lungo'],
    5: ['cardio', 'intervalli', 'full', 'cardio', 'lungo'], 6: ['cardio', 'intervalli', 'full', 'cardio', 'full', 'lungo'],
    7: ['cardio', 'intervalli', 'full', 'cardio', 'full', 'lungo', 'mobilita'],
  },
  mobilita: {
    2: ['mobilita', 'full'], 3: ['mobilita', 'full', 'mobilita'], 4: ['mobilita', 'full', 'mobilita', 'cardio'],
    5: ['mobilita', 'full', 'mobilita', 'cardio', 'mobilita'], 6: ['mobilita', 'full', 'mobilita', 'cardio', 'full', 'mobilita'],
    7: ['mobilita', 'full', 'mobilita', 'cardio', 'full', 'mobilita', 'cardio'],
  },
  salute: {
    2: ['full', 'full'], 3: ['full', 'cardio', 'full'], 4: ['full', 'cardio', 'full', 'cardio'],
    5: ['full', 'cardio', 'full', 'cardio', 'mobilita'], 6: ['full', 'cardio', 'full', 'cardio', 'full', 'mobilita'],
    7: ['full', 'cardio', 'full', 'cardio', 'full', 'cardio', 'mobilita'],
  },
};

const DAY_SLOTS = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

const PATTERNS = {
  full: ['squat', 'pull_h', 'push_h', 'hinge', 'core', 'lunge', 'pull_v', 'push_v', 'glutei'],
  upper: ['push_h', 'pull_h', 'push_v', 'pull_v', 'core', 'push_h', 'pull_h'],
  lower: ['squat', 'hinge', 'lunge', 'core', 'glutei', 'calf', 'squat'],
  push: ['push_h', 'push_v', 'push_h', 'core', 'push_v'],
  pull: ['pull_v', 'pull_h', 'hinge', 'core', 'pull_h'],
  legs: ['squat', 'hinge', 'lunge', 'calf', 'glutei', 'core'],
};

const TITLES = {
  full: 'Forza total body', upper: 'Forza parte alta', lower: 'Forza parte bassa',
  push: 'Forza: spinta', pull: 'Forza: tirata', legs: 'Forza: gambe',
  circuito: 'Circuito metabolico', cardio: 'Cardio aerobico', intervalli: 'Intervalli',
  lungo: 'Cardio lungo', mobilita: 'Mobilità e allungamento',
};

export const TYPE_KIND = {
  full: 'forza', upper: 'forza', lower: 'forza', push: 'forza', pull: 'forza', legs: 'forza',
  circuito: 'forza', cardio: 'cardio', intervalli: 'cardio', lungo: 'cardio', mobilita: 'mobilita',
};

// ------------------------------------------------------------------
// Costruzione della singola sessione
// ------------------------------------------------------------------

const item = (ex, doseText, rest) => ({ id: ex.id, name: ex.n, how: ex.how, dose: doseText, rest: rest || 0 });

function splitTime(min) {
  if (min <= 12) return { warm: 2, cool: 0 };
  if (min < 20) return { warm: 3, cool: 2 };
  return { warm: clamp(Math.round(min * 0.15), 4, 10), cool: clamp(Math.round(min * 0.1), 3, 10) };
}

function warmupBlock(min, d, variant, extraBalance) {
  const n = clamp(Math.round((min * 60) / 60), 2, 6);
  const exs = pickMany('warmup', d, n, variant);
  const secs = Math.round((min * 60) / Math.max(exs.length, 1));
  const items = exs.map((e) => item(e, `${secs} s`));
  if (extraBalance) {
    const b = pickMany('balance', d, 1, variant)[0];
    if (b) items.push(item(b, '2 × 30 s'));
  }
  return { name: 'Riscaldamento', minutes: min, items };
}

function cooldownBlock(min, d, variant, p) {
  if (min <= 0) return null;
  const want = p.stress === 'alto' || d.cond.has('ipertensione');
  const n = clamp(Math.floor(min * 60 / 50), 1, 6) - (want ? 1 : 0);
  const exs = pickMany('mobility', d, Math.max(n, 1), variant + 1, ['m_respiro']);
  const items = exs.map((e) => item(e, '40 s'));
  if (want) items.push(item(BY_ID.m_respiro, '2 min'));
  return { name: 'Defaticamento', minutes: min, items };
}

function cardioModality(d, goal, variant, forInterval) {
  const list = EXERCISES.filter((e) => e.cat === 'cardio' && allowed(e, d));
  const pref = (e) => {
    let s = 0;
    if (goal === 'resistenza' && e.id === 'x_corsa') s += 5;
    if (!e.eq.includes('corpo')) s += 2; // ha attrezzi dedicati
    if (forInterval && ['x_bici', 'x_salita', 'x_corsa', 'x_ellittica', 'x_vogatore'].includes(e.id)) s += 1;
    if (e.id === 'x_basso') s -= 1;
    if (e.id === 'x_corsa' && goal !== 'resistenza' && (d.level === 1 || d.bmi >= 27)) s -= 4;
    return s;
  };
  list.sort((a, b) => pref(b) - pref(a));
  if (goal === 'resistenza' && list[0]?.id === 'x_corsa') return list[0];
  return list[variant % Math.min(list.length, 3)] || BY_ID.x_cammino;
}

function zone(d, lo, hi) {
  if (d.cond.has('betabloccanti')) return '';
  return ` (${Math.round(d.hrMax * lo)}–${Math.round(d.hrMax * hi)} bpm)`;
}

function strengthSession(type, minutes, p, d, variant, phase) {
  const goal = p.obiettivo;
  const { warm, cool } = splitTime(minutes);
  let main = minutes - warm - cool;
  let finisher = 0;
  if ((goal === 'dimagrire' || goal === 'tonificare') && main >= 35 && type !== 'circuito') { finisher = 8; main -= finisher; }

  const circuit = type === 'circuito' || minutes < 25;
  const preferLoad = goal === 'massa' || goal === 'tonificare';
  const patterns = PATTERNS[type === 'circuito' ? 'full' : type];
  const used = new Set();
  const chosen = [];

  let perEx;
  if (circuit) perEx = 1.1; // minuti per esercizio per giro
  else {
    const [sets, , rest] = DOSE[goal][d.level];
    perEx = (sets * (40 + rest)) / 60 + 0.5;
  }
  const target = circuit ? clamp(Math.floor(main / 3 / perEx), 3, 8) : clamp(Math.floor(main / perEx), 2, 8);

  for (let i = 0; i < patterns.length && chosen.length < target; i++) {
    const ex = pickPattern(patterns[i], d, variant + Math.floor(i / 5), used, preferLoad);
    if (ex) { used.add(ex.id); chosen.push(ex); }
  }
  // se mancano esercizi (molte limitazioni), riempi con quelli sicuri rimasti
  if (chosen.length < Math.min(target, 3)) {
    EXERCISES.filter((e) => e.cat === 'strength' && allowed(e, d) && !used.has(e.id))
      .slice(0, target - chosen.length).forEach((e) => { used.add(e.id); chosen.push(e); });
  }

  let mainBlock;
  if (circuit) {
    const rounds = clamp(Math.floor(main / (chosen.length * 1 + 1)), 1, 6);
    mainBlock = {
      name: 'Circuito', minutes: main,
      note: `${rounds} giri: 40 s di lavoro e 20 s di pausa per esercizio, 1 minuto di pausa tra un giro e l’altro.`,
      items: chosen.map((e) => item(e, e.unit === 'sec' ? '40 s' : '40 s · ritmo controllato', 20)),
    };
  } else {
    mainBlock = {
      name: 'Parte principale', minutes: main,
      note: 'Esegui tutte le serie di un esercizio prima di passare al successivo. Ultime 2 ripetizioni impegnative ma con tecnica pulita.',
      items: chosen.map((e) => { const ds = dose(e, goal, d, phase); return item(e, ds.text + ` · recupero ${ds.rest} s`, ds.rest); }),
    };
  }

  const blocks = [warmupBlock(warm, d, variant, d.age >= 65 || d.cond.has('osteoporosi')), mainBlock];
  if (finisher) {
    const mod = cardioModality(d, goal, variant, true);
    blocks.push({
      name: 'Finisher cardio', minutes: finisher,
      items: [item(mod, d.hiitOk ? `${finisher} min: 30 s forte / 30 s facile` : `${finisher} min a ritmo sostenuto`)],
    });
  }
  const cb = cooldownBlock(cool, d, variant, p);
  if (cb) blocks.push(cb);

  const letter = String.fromCharCode(65 + (variant % 3));
  return { type, kind: 'forza', title: `${TITLES[type]}${['full', 'upper', 'lower', 'circuito'].includes(type) ? ' ' + letter : ''}`, minutes, blocks };
}

function cardioSession(type, minutes, p, d, variant, phase) {
  const goal = p.obiettivo;
  const { warm, cool } = splitTime(minutes);
  const main = minutes - warm - cool;
  let effType = type;
  if (type === 'intervalli' && !d.hiitOk) effType = 'intervalli_moderati';
  const mod = cardioModality(d, goal, variant, effType.startsWith('intervalli'));
  let text;
  let note = '';

  if (effType === 'intervalli') {
    const [w, r] = { 1: [30, 90], 2: [60, 60], 3: [120, 60] }[d.level];
    const reps = Math.max(2, Math.floor((main * 60) / (w + r)) - (phase === 4 ? 1 : 0));
    text = `${reps} × ${w < 60 ? w + ' s' : w / 60 + ' min'} forte${zone(d, 0.8, 0.9)} + ${r < 60 ? r + ' s' : r / 60 + ' min'} facile`;
    note = 'Nella parte "forte" fatica 7–8/10: parli a fatica. Nella parte facile recupera bene.';
  } else if (effType === 'intervalli_moderati') {
    const reps = Math.max(2, Math.floor(main / 4));
    text = `${reps} × 2 min a ritmo sostenuto + 2 min facile`;
    note = 'Intervalli moderati: nella parte sostenuta fatica 5–6/10, riesci ancora a dire frasi brevi.';
  } else if (mod.id === 'x_corsa' && d.level < 3) {
    const [run, walk] = d.level === 1 ? [1 + Math.min(phase, 3) - 1, 2] : [3 + Math.min(phase, 3), 1];
    const reps = Math.max(2, Math.floor(main / (run + walk)));
    text = `${reps} × (${run} min corsa leggera + ${walk} min camminata)`;
    note = 'Metodo corsa-cammino: ogni settimana i tratti di corsa si allungano. Devi riuscire a parlare mentre corri.';
  } else {
    text = `${main} min continui${zone(d, 0.6, 0.7)}`;
    note = 'Zona 2: respiro più veloce ma riesci a parlare in frasi complete. Fatica 4–5/10.';
  }
  if (type === 'lungo') note += ' Se nel weekend hai più tempo, allunga di 10–15 minuti: è l’allenamento che più migliora la resistenza.';
  if (d.cond.has('betabloccanti')) note += ' Con i betabloccanti la frequenza cardiaca non è affidabile: usa la fatica percepita.';

  const blocks = [
    { name: 'Riscaldamento', minutes: warm, items: [item(mod.tags.includes('impatto') ? BY_ID.x_cammino : mod, `${warm} min a ritmo molto facile`)] },
    { name: effType.startsWith('intervalli') ? 'Intervalli' : 'Parte principale', minutes: main, note, items: [item(mod, text)] },
  ];
  const cb = cooldownBlock(cool, d, variant, p);
  if (cb) blocks.push(cb);
  const title = effType === 'intervalli_moderati' ? 'Intervalli moderati' : TITLES[type];
  return { type, kind: 'cardio', title: `${title} · ${mod.n.toLowerCase()}`, minutes, blocks };
}

function mobilitySession(minutes, p, d, variant) {
  const warm = minutes >= 20 ? 3 : 2;
  const main = minutes - warm;
  const exs = pickMany('mobility', d, 20, variant, ['m_respiro']);
  const bal = (d.age >= 60 || d.cond.has('osteoporosi') || p.obiettivo === 'mobilita') ? pickMany('balance', d, 2, variant) : [];
  const per = 1; // minuti per esercizio
  const slots = Math.max(3, Math.floor((main - 2) / per));
  const flow = [];
  const pool = [...exs, ...bal];
  for (let i = 0; i < slots && pool.length; i++) flow.push(pool[i % pool.length]);
  const items = [...new Map(flow.map((e) => [e.id, e])).values()].map((e) => item(e, e.cat === 'balance' ? '2 × 30 s per lato' : '60 s'));
  const rounds = Math.max(1, Math.round(slots / items.length));
  return {
    type: 'mobilita', kind: 'mobilita', title: TITLES.mobilita, minutes,
    blocks: [
      { name: 'Attivazione', minutes: warm, items: pickMany('warmup', d, 3, variant).map((e) => item(e, '45 s')) },
      { name: 'Sequenza', minutes: main - 2, note: rounds > 1 ? `Ripeti la sequenza ${rounds} volte. Movimenti lenti, mai dolore.` : 'Movimenti lenti, respiro profondo, mai dolore.', items },
      { name: 'Respiro', minutes: 2, items: [item(BY_ID.m_respiro, '2 min')] },
    ],
  };
}

export function buildSession(type, minutes, p, d, variant, phase) {
  if (TYPE_KIND[type] === 'cardio') return cardioSession(type, minutes, p, d, variant, phase);
  if (type === 'mobilita') return mobilitySession(minutes, p, d, variant);
  return strengthSession(type, minutes, p, d, variant, phase);
}

export function weekSchedule(p, week = 1) {
  const d = derive(p);
  const days = clamp(p.giorni, 2, 7);
  let tpl = [...TEMPLATES[p.obiettivo][days]];
  if (!d.hiitOk) tpl = tpl.map((t) => (t === 'circuito' && d.blocked.has('impatto') ? 'full' : t));
  const slots = DAY_SLOTS[days];
  const { phase } = mesoPhase(week);
  const counters = {};
  const out = WEEKDAYS.map((label, i) => ({ weekday: i, label, session: null }));
  tpl.forEach((type, i) => {
    counters[type] = (counters[type] || 0);
    const variant = counters[type]++;
    out[slots[i]].session = buildSession(type, p.minuti, p, d, variant, phase);
  });
  return out;
}

// ------------------------------------------------------------------
// Alimentazione e tempi
// ------------------------------------------------------------------

export function nutrition(p, opts = {}) {
  const d = derive(p);
  const w = p.peso;
  const bmr = 10 * w + 6.25 * p.altezza - 5 * p.eta + (p.sesso === 'M' ? 5 : -161);
  let pal = d.steps < 3000 ? 1.2 : d.steps < 5000 ? 1.25 : d.steps < 7500 ? 1.3 : d.steps < 10000 ? 1.4 : 1.5;
  if (p.lavoro === 'fisico') pal += 0.1; else if (p.lavoro === 'in_piedi') pal += 0.05;
  pal += clamp(p.giorni * p.minuti * 0.00035, 0, 0.3);
  const tdee = bmr * pal;

  const notes = [];
  const goal = p.obiettivo;
  const minHealthy = 18.5 * (p.altezza / 100) ** 2;
  let target = p.pesoObiettivo ? Number(p.pesoObiettivo) : null;
  if (target && target < minHealthy) {
    notes.push(`Il peso obiettivo corrisponde a un BMI sotto 18,5. Il piano usa ${minHealthy.toFixed(1)} kg come limite minimo sano.`);
    target = round(minHealthy, 0.5);
  }

  let mode = 'mantenimento';
  let rate = 0; // kg/settimana
  if (d.cond.has('gravidanza')) {
    mode = 'mantenimento';
    notes.push('In gravidanza non si fa deficit calorico: il fabbisogno aumenta con i trimestri. Segui le indicazioni del ginecologo o di un nutrizionista.');
  } else if (goal === 'dimagrire') {
    if (d.bmi < 20) {
      mode = 'mantenimento';
      notes.push('Il tuo peso è già nella fascia bassa: meglio puntare a tonificare (più muscolo) che a scendere ancora di peso.');
    } else {
      mode = 'deficit';
      rate = clamp(w * (d.bmi >= 30 ? 0.0075 : 0.005), 0.25, 1.0);
    }
  } else if (goal === 'massa') {
    if (d.bmi >= 27) {
      mode = 'mantenimento';
      notes.push('Con un BMI sopra 27 conviene prima ricomporre (calorie di mantenimento e tante proteine): costruirai muscolo perdendo grasso.');
    } else {
      mode = 'surplus';
      rate = w * { 1: 0.003, 2: 0.002, 3: 0.0012 }[d.level];
    }
  } else if (goal === 'tonificare') {
    if (d.bmi >= 25 || (target && target < w - 1)) { mode = 'deficit'; rate = clamp(w * 0.0035, 0.2, 0.5); }
  } else if (target && target < w - 1) {
    mode = 'deficit'; rate = clamp(w * 0.0035, 0.2, 0.5);
  } else if (target && target > w + 1 && d.bmi < 25) {
    mode = 'surplus'; rate = w * 0.002;
  }

  const floor = Math.max(p.sesso === 'M' ? 1500 : 1200, bmr);
  let kcal = tdee;
  if (mode === 'deficit') kcal = tdee - rate * 1100;
  if (mode === 'surplus') kcal = tdee + Math.max(150, rate * 1100);
  kcal += opts.calorieAdjust || 0;
  if (kcal < floor) {
    kcal = floor;
    if (mode === 'deficit') {
      rate = Math.max(0.1, (tdee - floor) / 1100);
      notes.push('Le calorie sono state tenute sopra il tuo metabolismo basale per sicurezza: il ritmo di dimagrimento sarà un po’ più lento, ma sostenibile.');
    }
  }
  kcal = round(kcal, 10);

  const refW = d.bmi >= 30 ? 25 * (p.altezza / 100) ** 2 : w;
  let gkg = { deficit: 1.8, surplus: 1.8, mantenimento: goal === 'tonificare' || goal === 'massa' ? 1.8 : goal === 'resistenza' ? 1.5 : 1.3 }[mode];
  if (d.cond.has('reni')) { gkg = 0.8; notes.push('Con una malattia renale le proteine vanno concordate con il nefrologo: il valore indicato è prudenziale.'); }
  if (d.cond.has('gravidanza')) gkg = Math.max(gkg, 1.2);
  const protein = round(refW * gkg, 5);
  const fat = round((kcal * 0.28) / 9, 5);
  const carbs = Math.max(0, round((kcal - protein * 4 - fat * 9) / 4, 5));
  const water = round(w * 0.035, 0.1);
  if (d.cond.has('diabete')) notes.push('Con il diabete distribuisci i carboidrati nei pasti, preferisci quelli integrali e controlla la glicemia prima e dopo l’allenamento.');

  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carbs, water, fiber: Math.round(kcal / 1000 * 14), mode, rate, target, notes };
}

export function timeline(p, nutri, startISO) {
  const start = fromISO(startISO);
  const w = p.peso;
  const t = nutri.target;
  const res = { hasWeight: false, milestones: [], message: '', feasible: true };
  const goalMilestones = {
    dimagrire: 'I primi cambiamenti visibili arrivano di solito dopo 4–6 settimane di costanza.',
    massa: 'Aumenti di forza già nelle prime 3–4 settimane; cambiamenti visibili della massa dopo 8–12 settimane.',
    tonificare: 'Più forza in 3–4 settimane; una forma più definita dopo 8–12 settimane.',
    resistenza: 'Con 3 uscite a settimana, partendo da zero, si arriva a correre 5 km di fila in circa 8–10 settimane.',
    mobilita: 'Rigidità e dolori migliorano di solito già in 3–4 settimane; la mobilità continua a crescere per mesi.',
    salute: 'Pressione, glicemia, sonno ed energia migliorano già in 4–8 settimane di attività regolare.',
  };
  res.message = goalMilestones[p.obiettivo];

  if (t && nutri.rate > 0 && Math.abs(t - w) >= 0.5 && ((nutri.mode === 'deficit' && t < w) || (nutri.mode === 'surplus' && t > w))) {
    const delta = Math.abs(w - t);
    const weeks = Math.ceil(delta / nutri.rate);
    const sign = t < w ? -1 : 1;
    res.hasWeight = true;
    res.weeks = weeks;
    res.rate = nutri.rate;
    res.direction = sign;
    res.eta = toISO(addDays(start, weeks * 7));
    for (let k = 4; k < weeks; k += 4) res.milestones.push({ week: k, kg: +(w + sign * nutri.rate * k).toFixed(1) });
    res.milestones.push({ week: weeks, kg: t });
    if (p.dataObiettivo) {
      const avail = daysBetween(start, fromISO(p.dataObiettivo)) / 7;
      if (avail <= 0) res.feasible = false;
      else if (delta / avail > nutri.rate * 1.15) {
        res.feasible = false;
        res.warning = `Per arrivare a ${t} kg entro il ${formatDate(p.dataObiettivo)} servirebbe un ritmo di ${(delta / avail).toFixed(2)} kg/settimana: troppo veloce per farlo in modo sano. Con il piano attuale ci arrivi intorno al ${formatDate(res.eta)}.`;
      }
    }
  }
  return res;
}

export function expectedWeight(p, nutri, startISO, dateISO) {
  if (!nutri.rate || !nutri.target) return null;
  const weeks = daysBetween(fromISO(startISO), fromISO(dateISO)) / 7;
  const sign = nutri.target < p.peso ? -1 : 1;
  const v = p.peso + sign * nutri.rate * Math.max(0, weeks);
  return sign < 0 ? Math.max(v, nutri.target) : Math.min(v, nutri.target);
}

export function formatDate(iso) {
  return fromISO(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ------------------------------------------------------------------
// Abitudini e sicurezza
// ------------------------------------------------------------------

export function habits(p) {
  const d = derive(p);
  const out = [];
  const stepsTarget = d.steps >= 10000 ? d.steps : clamp(round(d.steps + 2000, 500), 6000, 10000);
  out.push({
    icon: '👟', title: `Obiettivo passi: ${stepsTarget.toLocaleString('it-IT')} al giorno`,
    text: d.steps >= 10000 ? 'Ottimo livello di movimento: mantienilo anche nei giorni di riposo.' : 'Aumenta di circa 1.000 passi a settimana fino all’obiettivo. Telefonate camminando, scale invece dell’ascensore, parcheggia più lontano.',
    priority: d.steps < 5000 ? 1 : 2, key: 'passi', target: stepsTarget,
  });
  if (p.sonno < 7) out.push({ icon: '😴', title: 'Dormi almeno 7 ore', text: `Ora dormi circa ${p.sonno} ore. Sotto le 7 ore aumentano fame e voglia di dolci, e i muscoli recuperano peggio. Orari regolari, niente schermi nell’ultima mezz’ora, camera fresca e buia.`, priority: 1, key: 'sonno' });
  else out.push({ icon: '😴', title: 'Mantieni il sonno regolare', text: 'Dormi già abbastanza: cerca di andare a letto e svegliarti sempre alla stessa ora, anche nel weekend.', priority: 3, key: 'sonno' });
  if (p.lavoro === 'sedentario') out.push({ icon: '🪑', title: 'Spezza le ore da seduto', text: 'Ogni 45–60 minuti alzati per 2–3 minuti: qualche passo, mobilità di collo e spalle, 10 mezzi squat.', priority: 2 });
  if (p.fumo === 'si') out.push({ icon: '🚭', title: 'Riduci o smetti di fumare', text: 'È la scelta che più migliora fiato e salute. Puoi chiedere supporto al medico o al Telefono Verde contro il Fumo dell’ISS: 800 554 088.', priority: 1 });
  if (p.alcol === 'spesso') out.push({ icon: '🍷', title: 'Limita l’alcol', text: 'L’alcol aggiunge calorie, peggiora il sonno e il recupero. Prova a limitarlo al weekend e non oltre 1 bicchiere.', priority: 1 });
  if (p.alimentazione === 'disordinata') out.push({ icon: '🥗', title: 'Sistema i pasti base', text: 'Metà piatto di verdure, un quarto di proteine (carne, pesce, uova, legumi, latticini), un quarto di carboidrati integrali. Pochi snack confezionati e bibite zuccherate.', priority: 1 });
  else out.push({ icon: '🥗', title: 'Proteine a ogni pasto', text: 'Distribuisci le proteine su 3–4 pasti: aiuta a mantenere i muscoli e a controllare la fame.', priority: 3 });
  if (p.stress === 'alto') out.push({ icon: '🌬️', title: 'Gestisci lo stress', text: '5 minuti al giorno di respirazione lenta (4 secondi dentro, 6 fuori) e camminate all’aperto. Il movimento è uno dei migliori anti-stress.', priority: 2 });
  if (p.giorni * p.minuti < 150) out.push({ icon: '⏱️', title: 'Arriva a 150 minuti a settimana', text: `Con il tempo scelto fai ${p.giorni * p.minuti} minuti a settimana di allenamento. L’OMS consiglia almeno 150 minuti di attività moderata: completa con camminate veloci.`, priority: 2 });
  if (d.cond.has('diabete')) out.push({ icon: '🩸', title: 'Cammina dopo i pasti', text: 'Una camminata di 10–15 minuti dopo i pasti principali aiuta molto a tenere sotto controllo la glicemia.', priority: 1 });
  if (d.age >= 65) out.push({ icon: '⚖️', title: 'Allena l’equilibrio', text: 'Gli esercizi di equilibrio sono inclusi nei tuoi allenamenti: riducono il rischio di cadute. Falli sempre vicino a un appoggio.', priority: 2 });
  out.push({ icon: '💧', title: 'Bevi a sufficienza', text: `Circa ${round(p.peso * 0.035, 0.1).toFixed(1)} litri al giorno, mezzo litro in più nei giorni di allenamento.`, priority: 3, key: 'acqua' });
  return out.sort((a, b) => a.priority - b.priority);
}

export function alerts(p) {
  const d = derive(p);
  const out = [];
  const stop = (text) => out.push({ level: 'stop', text });
  const warn = (text) => out.push({ level: 'attenzione', text });
  if (d.cond.has('petto')) stop('Dolore al petto, svenimenti o vertigini durante lo sforzo vanno valutati dal medico PRIMA di iniziare qualsiasi allenamento.');
  if (d.cond.has('cuore')) stop('Con problemi cardiaci serve il via libera del cardiologo (meglio con test da sforzo). Il piano usa solo intensità moderate.');
  if (d.cond.has('intervento')) stop('Dopo un intervento o un infortunio recente fatti autorizzare dal medico o dal fisioterapista. Il piano parte dal livello più semplice.');
  if (d.cond.has('gravidanza')) stop('In gravidanza chiedi conferma al ginecologo. Il piano evita esercizi sdraiati, salti e carichi massimali.');
  if (d.cond.has('ipertensione')) warn('Pressione alta: non trattenere mai il respiro sotto sforzo. Se a riposo la pressione supera 160/100 non allenarti e senti il medico.');
  if (d.cond.has('diabete')) warn('Diabete: misura la glicemia prima di allenarti e tieni sempre a portata zuccheri semplici. Se usi insulina, concorda con il diabetologo eventuali aggiustamenti.');
  if (d.cond.has('asma')) warn('Asma: tieni con te l’inalatore, fai un riscaldamento lungo e graduale, evita l’aria molto fredda.');
  if (d.cond.has('osteoporosi')) warn('Osteoporosi: niente salti né flessioni del busto sotto carico. Gli esercizi di forza e di equilibrio inclusi aiutano le ossa.');
  if (d.cond.has('schiena')) warn('Schiena: mantieni sempre la schiena neutra. Se il dolore si irradia a una gamba o peggiora durante un esercizio, fermati.');
  if (['ginocchia', 'spalle', 'anche'].some((c) => d.cond.has(c))) warn('Articolazioni: un lieve fastidio (fino a 3/10) che passa entro 24 ore è accettabile; un dolore più forte o che peggiora no — sostituisci l’esercizio.');
  if (d.bmi >= 35) warn('Con un BMI sopra 35 è consigliabile una visita medica prima di iniziare. Il piano evita esercizi ad alto impatto.');
  if (d.age >= 65 && d.steps < 5000) warn('Sopra i 65 anni e partendo da sedentario, una visita medica prima di iniziare è una buona idea.');
  return out;
}

// ------------------------------------------------------------------
// Piano completo
// ------------------------------------------------------------------

export function generatePlan(p, opts = {}) {
  const startISO = opts.startISO || toISO(new Date());
  const week = opts.week || 1;
  const d = derive(p);
  const nutri = nutrition(p, opts);
  return {
    derived: { bmi: +d.bmi.toFixed(1), level: d.level, hrMax: d.hrMax, hiitOk: d.hiitOk, blocked: [...d.blocked] },
    week,
    phase: mesoPhase(week),
    schedule: weekSchedule(p, week),
    nutrition: nutri,
    timeline: timeline(p, nutri, startISO),
    habits: habits(p),
    alerts: alerts(p),
  };
}

// ------------------------------------------------------------------
// Analisi dei progressi e adattamento
// ------------------------------------------------------------------

function slope(points) {
  // regressione lineare: kg al giorno
  const n = points.length;
  if (n < 2) return null;
  const xs = points.map((q) => q.x), ys = points.map((q) => q.y);
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : null;
}

export function analyzeProgress(state, plan, todayISO = toISO(new Date())) {
  const p = state.profile;
  const today = fromISO(todayISO);
  const start = fromISO(state.planStart);
  const out = { suggestions: [] };

  // aderenza ultimi 14 giorni
  let planned = 0, done = 0;
  for (let i = 1; i <= 14; i++) {
    const day = addDays(today, -i);
    if (day < start) break;
    const ses = plan.schedule[weekdayIndex(day)].session;
    if (ses) { planned++; if (state.log[toISO(day)]?.done) done++; }
  }
  out.planned = planned;
  out.done = done;
  out.adherence = planned ? Math.round((done / planned) * 100) : null;

  if (planned >= 4 && out.adherence < 60) {
    const fewerDays = Math.max(2, p.giorni - 1);
    out.suggestions.push({
      text: `Negli ultimi 14 giorni hai completato ${done} allenamenti su ${planned}. Meglio un piano più leggero che riesci a seguire: prova ${fewerDays} giorni a settimana.`,
      action: { type: 'giorni', value: fewerDays, label: `Passa a ${fewerDays} giorni` },
    });
  }

  // tendenza del peso ultime 3 settimane
  const recent = (state.weights || []).filter((w) => daysBetween(fromISO(w.date), today) <= 21 && fromISO(w.date) >= addDays(start, -1));
  const s = slope(recent.map((w) => ({ x: daysBetween(start, fromISO(w.date)), y: w.kg })));
  const span = recent.length >= 2 ? daysBetween(fromISO(recent[0].date), fromISO(recent[recent.length - 1].date)) : 0;
  if (s !== null && span >= 10) {
    out.actualRate = +(s * 7).toFixed(2);
    const n = plan.nutrition;
    if (n.mode === 'deficit') {
      const expected = -n.rate;
      out.expectedRate = expected;
      if (out.actualRate > expected * 0.5) {
        out.suggestions.push({
          text: `Stai perdendo ${Math.abs(out.actualRate).toFixed(2)} kg a settimana, meno della metà del previsto (${n.rate.toFixed(2)}). Riduci di 150 kcal al giorno o aggiungi 1.500 passi.`,
          action: { type: 'kcal', value: -150, label: 'Togli 150 kcal' },
        });
      } else if (out.actualRate < expected * 1.6) {
        out.suggestions.push({
          text: `Stai perdendo ${Math.abs(out.actualRate).toFixed(2)} kg a settimana: più veloce del previsto. Rischi di perdere muscolo: aggiungi 150 kcal al giorno.`,
          action: { type: 'kcal', value: 150, label: 'Aggiungi 150 kcal' },
        });
      } else out.suggestions.push({ text: 'Il peso scende al ritmo previsto. Continua così!', ok: true });
    } else if (n.mode === 'surplus') {
      out.expectedRate = n.rate;
      if (out.actualRate < n.rate * 0.4) out.suggestions.push({ text: 'Il peso non sta salendo come previsto: aggiungi 150 kcal al giorno (es. uno spuntino con yogurt e frutta secca).', action: { type: 'kcal', value: 150, label: 'Aggiungi 150 kcal' } });
      else if (out.actualRate > n.rate * 2) out.suggestions.push({ text: 'Il peso sale troppo in fretta: rischi di accumulare grasso. Togli 150 kcal al giorno.', action: { type: 'kcal', value: -150, label: 'Togli 150 kcal' } });
      else out.suggestions.push({ text: 'L’aumento di peso è nel range ideale. Continua così!', ok: true });
    }
  }

  // feedback di fatica sugli ultimi allenamenti
  const fb = Object.entries(state.log).filter(([k, v]) => v.done && v.feedback && fromISO(k) >= addDays(today, -14)).map(([, v]) => v.feedback);
  if (fb.length >= 3) {
    const last = fb.slice(-3);
    if (last.every((f) => f === 'facile') && p.esperienza !== 'avanzato') {
      const next = p.esperienza === 'principiante' ? 'intermedio' : 'avanzato';
      out.suggestions.push({ text: 'Gli ultimi allenamenti ti sono sembrati facili: è il momento di passare al livello successivo.', action: { type: 'esperienza', value: next, label: `Passa a ${next}` } });
    }
    if (last.every((f) => f === 'duro') && p.esperienza !== 'principiante') {
      const prev = p.esperienza === 'avanzato' ? 'intermedio' : 'principiante';
      out.suggestions.push({ text: 'Gli ultimi allenamenti sono stati molto duri: abbassa il livello per qualche settimana e recupera meglio.', action: { type: 'esperienza', value: prev, label: `Torna a ${prev}` } });
    }
  }

  // serie consecutiva
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const day = addDays(today, -i);
    if (day < start) break;
    const ses = plan.schedule[weekdayIndex(day)].session;
    if (!ses) continue;
    if (state.log[toISO(day)]?.done) streak++;
    else if (i > 0) break;
  }
  out.streak = streak;
  return out;
}
