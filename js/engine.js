// Motore di raccomandazione: dal profilo genera piano settimanale,
// alimentazione, tempi stimati, abitudini e avvisi di sicurezza.
// È una funzione pura: stesso profilo => stesso piano.

import { EXERCISES, BY_ID } from './exercises.js';
import { computeProfile, PAIN_REGIONS, LEVEL_LABEL, AREAS } from './assessment.js';
import { PROTEIN_FACTOR, DIET_LABEL, mealPlan, dietNotes } from './diet.js';

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

// esercizi pensati per casa: in palestra si preferiscono le alternative con attrezzi
const HOME_ONLY = ['r_tavolo', 'r_towel', 's_sitstand', 'p_muro', 'p_rialzo', 'p_dip'];
// esercizi che caricano i polsi (appoggio sulle mani)
const HAND_LOADED = ['p_muro', 'p_rialzo', 'p_ginocchia', 'p_classici', 'p_dip', 'v_pike', 'c_birddog', 'g_kick', 'w_gatto', 'm_gatto', 'r_tavolo'];
const NECK_LOADED = ['c_crunch', 'c_hollow', 'v_pike', 'h_superman'];
const UPPER_BACK_LOADED = ['r_bil', 'h_stacco', 's_backsquat'];

// livello del test (1–5) → livello degli esercizi (1–3)
const toExLevel = (L, fallback) => (L === null || L === undefined ? fallback : L <= 2 ? 1 : L === 3 ? 2 : 3);

/**
 * ctx (facoltativo): { cp: profilo dalla valutazione, swaps, excluded, exAdj }
 */
export function derive(p, ctx = {}) {
  const h = p.altezza / 100;
  const bmi = p.peso / (h * h);
  const cond = new Set(p.condizioni || []);
  const sensitive = new Set();
  const pains = [];
  for (const r of PAIN_REGIONS) {
    const v = Number(p.dolori?.[r.id] || 0);
    if (v >= 2) cond.add(r.cond);
    else if (v === 1) sensitive.add(r.cond);
    if (v > 0) pains.push({ ...r, v });
  }
  const equip = new Set(['corpo', ...(p.attrezzi || [])]);
  if (equip.has('palestra')) ['manubri', 'elastici', 'sbarra', 'tapis', 'bici'].forEach((e) => equip.add(e));
  const cp = ctx.cp || null;
  const flags = cp?.flags || {};

  // livello massimo consentito dalla sicurezza
  let safety = 3;
  if (cond.has('intervento') || cond.has('cuore') || cond.has('petto') || p.eta >= 70) safety = 1;
  if (p.eta >= 60 || bmi >= 35 || cond.has('gravidanza')) safety = Math.min(safety, 2);
  const expLvl = { principiante: 1, intermedio: 2, avanzato: 3 }[p.esperienza] || 1;

  // livello per schema motorio, dai test se disponibili
  const lv = cp?.levels || {};
  const push = toExLevel(lv.push, expLvl), pull = toExLevel(lv.pull ?? lv.push, expLvl);
  const legs = toExLevel(lv.legs, expLvl), core = toExLevel(lv.core, expLvl);
  // chi completa almeno 5 piegamenti sulle punte può farli nel piano
  const pu = cp?.maxes?.pushup;
  const pushH = pu && pu.variant === 'classici' && pu.reps >= 5 ? Math.max(push, 2) : push;
  const pl = { push_h: pushH, push_v: push, pull_h: pull, pull_v: pull, squat: legs, lunge: legs, glutei: legs, calf: legs, hinge: legs, core };
  // fastidio lieve: un livello in meno sugli schemi che caricano quella zona
  if (sensitive.has('spalle')) ['push_h', 'push_v', 'pull_h', 'pull_v'].forEach((k) => pl[k]--);
  if (sensitive.has('ginocchia')) ['squat', 'lunge'].forEach((k) => pl[k]--);
  if (sensitive.has('anche')) ['lunge', 'hinge'].forEach((k) => pl[k]--);
  if (sensitive.has('schiena')) ['hinge', 'core'].forEach((k) => pl[k]--);
  if (sensitive.has('polsi')) ['push_h'].forEach((k) => pl[k]--);
  for (const k in pl) pl[k] = clamp(Math.min(pl[k], safety), 1, 3);
  const testLv = [lv.push, lv.legs, lv.core, lv.cardio].filter((x) => x !== null && x !== undefined);
  const level = Math.min(safety, testLv.length ? toExLevel(Math.round(testLv.reduce((a, b) => a + b, 0) / testLv.length), expLvl) : expLvl);

  const blocked = new Set();
  if (['ginocchia', 'anche', 'gravidanza', 'osteoporosi', 'cuore', 'petto', 'intervento', 'caviglie'].some((c) => cond.has(c)) || bmi >= 30 || p.eta >= 65) blocked.add('impatto');
  if (cond.has('gravidanza')) { blocked.add('supino'); blocked.add('prono'); }
  if (['ipertensione', 'cuore', 'petto', 'gravidanza'].some((c) => cond.has(c))) { blocked.add('valsalva'); }
  if (cond.has('ipertensione') || cond.has('gravidanza')) blocked.add('testaGiu');
  if (cond.has('osteoporosi') || cond.has('schiena')) blocked.add('flessioneCarico');
  if (cp?.body?.pas >= 160 || cp?.body?.pad >= 100) { blocked.add('valsalva'); blocked.add('testaGiu'); }

  const exclude = new Set(ctx.excluded || []);
  if (cond.has('polsi')) HAND_LOADED.forEach((id) => exclude.add(id));
  if (cond.has('collo')) NECK_LOADED.forEach((id) => exclude.add(id));
  if (cond.has('dorsale')) UPPER_BACK_LOADED.forEach((id) => exclude.add(id));
  if (flags.shouldersStiff) ['v_lento', 'v_pike', 's_backsquat'].forEach((id) => exclude.add(id));

  // preferenze tra esercizi equivalenti, in base ai limiti misurati
  const prefer = {};
  const bump = (ids, v) => ids.forEach((id) => { prefer[id] = (prefer[id] || 0) + v; });
  if (flags.anklesStiff || flags.squatLimited) { bump(['s_squat_talloni'], 3); bump(['s_sitstand', 's_legpress', 's_goblet'], 1.5); bump(['s_squat', 's_squat_el', 's_backsquat'], -2.5); }
  if (flags.shouldersStiff) { bump(['v_wallslide'], 3); bump(['r_ytw', 'r_el'], 1); }
  if (flags.hamstringsTight) { bump(['h_ponte', 'h_hipthrust', 'h_ponte1'], 1.5); bump(['h_stacco', 'h_rdl'], -1.5); }
  if (flags.coreWeak || sensitive.has('schiena') || cond.has('schiena')) { bump(['c_birddog', 'c_deadbug', 'c_curlup', 'c_pallof'], 1.5); bump(['c_hollow', 'c_crunch'], -2); }
  if (cond.has('ginocchia') || sensitive.has('ginocchia')) bump(['s_sitstand', 'l_step', 'g_abd_el', 'g_clam', 'h_ponte'], 1);
  if (ctx.favorites?.length) bump(ctx.favorites, 6);

  const hiitOk = !['cuore', 'petto', 'ipertensione', 'gravidanza', 'intervento'].some((c) => cond.has(c)) && bmi < 35 && p.eta < 70;
  const hrMax = Math.round(208 - 0.7 * p.eta);
  const steps = STEPS_MAP[p.passi] ?? 5000;

  return {
    bmi, cond, sensitive, pains, equip, level, pl, safety, blocked, hiitOk, hrMax, steps, age: p.eta,
    cp, flags, exclude, prefer, hrRest: cp?.body?.hrRest || null, cardioL: lv.cardio ?? null,
    maxes: cp?.maxes || {}, weakAreas: (cp?.weak || []).map((a) => a.id),
    swaps: ctx.swaps || {}, exAdj: ctx.exAdj || {}, favorites: ctx.favorites || [],
  };
}

function allowed(ex, d, slack = 0) {
  const cap = (ex.cat === 'strength' && ex.pat && d.pl ? d.pl[ex.pat] : d.level) + slack;
  return ex.eq.some((e) => d.equip.has(e))
    && ex.lvl <= Math.min(cap, slack ? (d.safety ?? 3) : cap)
    && !ex.contra.some((c) => d.cond.has(c))
    && !ex.tags.some((t) => d.blocked.has(t))
    && !(d.exclude && d.exclude.has(ex.id));
}

export function allowedExercises(p, ctx = {}) {
  const d = derive(p, ctx);
  return EXERCISES.filter((e) => allowed(e, d));
}

// Sceglie l'esercizio migliore per uno schema motorio.
// variant ruota tra le alternative per non ripetere sempre lo stesso.
function pickPattern(pat, d, variant, used, preferLoad) {
  const list = EXERCISES.filter((e) => e.cat === 'strength' && e.pat === pat && allowed(e, d) && !used.has(e.id));
  if (!list.length) return null;
  const inGym = d.equip.has('palestra');
  // in palestra: macchine, bilancieri e manubri prima di elastici e corpo libero
  const gymScore = (e) => {
    if (!inGym) return 0;
    if (HOME_ONLY.includes(e.id)) return -6;
    if (e.eq.includes('palestra') || e.eq.includes('manubri') || e.eq.includes('sbarra')) return 4;
    if (e.eq.includes('elastici')) return -3;
    return ['core', 'calf', 'glutei'].includes(pat) ? 0 : -2;
  };
  const score = (e) => e.lvl * 2 + (e.eq.includes('corpo') ? 0 : preferLoad ? 1.5 : 0.5) + (d.prefer?.[e.id] || 0) + gymScore(e);
  list.sort((a, b) => score(b) - score(a));
  const pool = inGym && list.some((e) => gymScore(e) >= 0) ? list.filter((e) => gymScore(e) >= 0) : list;
  const top = pool.slice(0, Math.min(3, pool.length));
  let e = top[variant % top.length];
  // sostituzione scelta dall'utente
  const sw = d.swaps?.[e.id];
  if (sw && BY_ID[sw] && !used.has(sw) && allowed(BY_ID[sw], d, 1)) e = BY_ID[sw];
  // progressione / regressione del singolo esercizio in base al feedback
  const adj = d.exAdj?.[e.id] || 0;
  if (adj >= 2) {
    const h = EXERCISES.filter((x) => x.cat === 'strength' && x.pat === pat && x.lvl > e.lvl && !used.has(x.id) && allowed(x, d, 1)).sort((a, b) => a.lvl - b.lvl)[0];
    if (h) e = h;
  } else if (adj <= -2) {
    const lo = EXERCISES.filter((x) => x.cat === 'strength' && x.pat === pat && x.lvl < e.lvl && !used.has(x.id) && allowed(x, d)).sort((a, b) => b.lvl - a.lvl)[0];
    if (lo) e = lo;
  }
  return e;
}

/** perché un esercizio è o non è adatto all'utente (in palestra) */
export function checkExercise(id, p, ctx = {}) {
  const ex = BY_ID[id];
  if (!ex) return { ok: false, kind: 'sconosciuto', reason: '' };
  const d = { ...derive(p, ctx), equip: new Set(['corpo', 'palestra', 'manubri', 'elastici', 'sbarra', 'tapis', 'bici']) };
  const c = ex.contra.find((x) => d.cond.has(x));
  if (c) return { ok: false, kind: 'salute', reason: `Sconsigliato con ${{ schiena: 'mal di schiena', ginocchia: 'problemi alle ginocchia', spalle: 'problemi alle spalle', anche: 'problemi alle anche', polsi: 'dolore ai polsi' }[c] || c}.` };
  const t = ex.tags.find((x) => d.blocked.has(x));
  if (t) return { ok: false, kind: 'salute', reason: { valsalva: 'Carichi massimali sconsigliati con la tua pressione o condizione cardiaca.', impatto: 'Esercizio ad alto impatto, sconsigliato per te.', supino: 'Sdraiati sulla schiena: da evitare in gravidanza.', prono: 'A pancia in giù: da evitare in gravidanza.', testaGiu: 'Testa in giù: sconsigliato con la pressione alta.', flessioneCarico: 'Flessione della schiena sotto carico: sconsigliata per te.' }[t] };
  if (d.exclude.has(id)) return { ok: false, kind: 'salute', reason: 'Carica una zona in cui hai indicato dolore.' };
  const cap = ex.pat ? d.pl[ex.pat] : d.level;
  if (ex.lvl > cap + 1) return { ok: false, kind: 'livello', reason: 'Più avanzato del tuo livello attuale: cura la tecnica e i carichi, o inizia da una variante più semplice.' };
  return { ok: true };
}

/** miglior esercizio da palestra per uno schema motorio */
export function suggestForPattern(pat, p, ctx = {}, exclude = []) {
  if (pat === 'cardio') return BY_ID.x_bici;
  const d = { ...derive(p, ctx), equip: new Set(['corpo', 'palestra', 'manubri', 'elastici', 'sbarra', 'tapis', 'bici']) };
  return pickPattern(pat, d, 0, new Set(exclude), p.obiettivo === 'massa' || p.obiettivo === 'tonificare');
}

/** alternative possibili per un esercizio (stesso schema motorio o categoria), adatte all'utente */
export function alternativesFor(id, p, ctx = {}) {
  const ex = BY_ID[id];
  if (!ex) return [];
  const d = derive(p, { ...ctx, excluded: [] });
  return EXERCISES.filter((e) => e.id !== id && e.cat === ex.cat && (ex.pat ? e.pat === ex.pat : true) && allowed(e, d, 1));
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

const PUSH_TEST_EX = { classici: 'p_classici', ginocchia: 'p_ginocchia', rialzo: 'p_rialzo', muro: 'p_muro' };
const round5 = (v) => Math.round(v / 5) * 5;

function shiftReps(reps, delta) {
  return reps.replace(/(\d+)(?:–(\d+))?/, (_, a, b) => {
    const x = Math.max(3, +a + delta);
    return b ? `${x}–${Math.max(x + 1, +b + delta)}` : String(x);
  });
}

function dose(ex, goal, d, phase) {
  const L = ex.cat === 'strength' && ex.pat && d.pl ? d.pl[ex.pat] : d.level;
  let [sets, reps, rest] = DOSE[goal][L];
  if (phase === 3) sets = Math.min(sets + 1, 5);
  if (phase === 4) sets = Math.max(sets - 1, 1);
  const adj = clamp(d.exAdj?.[ex.id] || 0, -2, 2);
  const m = d.maxes || {};
  let basis = '';
  if (ex.unit === 'sec') {
    let s = ex.id === 'c_farmer' ? 40 : SECS[L];
    const pm = m.plank;
    if (pm) {
      if ((ex.id === 'c_plank' && pm.variant === 'avambracci') || (ex.id === 'c_plank_g' && pm.variant === 'ginocchia')) { s = clamp(round5(pm.secs * 0.55), 10, 90); basis = `55% del tuo massimo (${pm.secs} s)`; }
      else if (ex.id === 'c_plank_g' && pm.variant === 'avambracci') s = clamp(round5(pm.secs * 0.8), 15, 90);
      else if (ex.id === 'c_side') s = clamp(round5(pm.secs * 0.35), 10, 60);
    }
    if (ex.id === 'r_towel' && m.hang) s = clamp(round5(m.hang * 0.5), 10, 45);
    s = clamp(s + adj * 10, 10, 120);
    return { sets, text: `${sets} × ${s} s`, rest, basis };
  }
  const pu = m.pushup;
  if (pu && PUSH_TEST_EX[pu.variant] === ex.id && pu.reps >= 3) {
    const a = Math.max(3, Math.round(pu.reps * 0.5)), b = Math.max(a + 1, Math.round(pu.reps * 0.7));
    reps = `${a}–${b}`; basis = `50–70% del tuo massimo (${pu.reps})`;
  }
  if (ex.id === 's_sitstand' && m.chair) {
    const a = Math.max(5, Math.round(m.chair * 0.45)), b = Math.max(a + 2, Math.round(m.chair * 0.65));
    reps = `${a}–${b}`; basis = `calibrato sulle tue ${m.chair} alzate in 30 s`;
  }
  if (adj) reps = shiftReps(reps, adj * 2);
  if (adj >= 2) sets = Math.min(sets + 1, 5);
  if (adj <= -2) sets = Math.max(sets - 1, 1);
  const perSide = ['l_step', 'l_affind', 'l_laterale', 'l_affman', 'l_bulgaro', 'r_man', 'h_ponte1', 'g_clam', 'g_kick', 'c_birddog', 'c_deadbug'].includes(ex.id);
  return { sets, text: `${sets} × ${reps}${perSide ? ' per lato' : ''}`, rest, basis };
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
  core: ['core', 'core', 'glutei', 'core', 'core', 'hinge'],
  focus: ['push_h', 'pull_h', 'squat', 'core', 'lunge', 'pull_v'],
};

// sessione "focus": gli schemi dei punti deboli misurati
function focusPatterns(d, variant) {
  const w = d.weakAreas || [];
  const map = { forzaSup: ['push_h', 'pull_h', 'push_v', 'pull_v'], forzaInf: ['squat', 'lunge', 'glutei', 'hinge'], core: ['core', 'core', 'glutei'], equilibrio: ['lunge', 'glutei', 'core'], mobilita: ['glutei', 'core', 'hinge'] };
  const pats = w.flatMap((a) => map[a] || []);
  if (pats.length >= 3) return [...pats, 'core'];
  return variant % 2 ? ['squat', 'lunge', 'glutei', 'core', 'hinge'] : ['push_h', 'pull_h', 'push_v', 'core', 'pull_v'];
}

const TITLES = {
  full: 'Forza total body', upper: 'Forza parte alta', lower: 'Forza parte bassa',
  push: 'Forza: spinta', pull: 'Forza: tirata', legs: 'Forza: gambe',
  circuito: 'Circuito metabolico', cardio: 'Cardio aerobico', intervalli: 'Intervalli',
  lungo: 'Cardio lungo', mobilita: 'Mobilità e allungamento',
  postura: 'Postura e anti-sedentarietà', core: 'Core e stabilità', focus: 'Focus punti deboli',
};

export const TYPE_KIND = {
  full: 'forza', upper: 'forza', lower: 'forza', push: 'forza', pull: 'forza', legs: 'forza',
  circuito: 'forza', cardio: 'cardio', intervalli: 'cardio', lungo: 'cardio', mobilita: 'mobilita',
  postura: 'mobilita', core: 'forza', focus: 'forza',
};

// ------------------------------------------------------------------
// Costruzione della singola sessione
// ------------------------------------------------------------------

const item = (ex, doseText, rest, tag) => ({ id: ex.id, name: ex.n, how: ex.how, dose: doseText, rest: rest || 0, ...(tag ? { tag } : {}) });

function splitTime(min) {
  if (min <= 12) return { warm: 2, cool: 0 };
  if (min < 20) return { warm: 3, cool: 2 };
  return { warm: clamp(Math.round(min * 0.15), 4, 10), cool: clamp(Math.round(min * 0.1), 3, 10) };
}

// esercizi correttivi scelti in base ai limiti misurati
function correctives(d, extraBalance) {
  const f = d.flags || {};
  const ids = [];
  if (f.anklesStiff) ids.push('w_caviglie');
  if (f.shouldersStiff) ids.push('w_angeli');
  if (f.hamstringsTight) ids.push('w_hinge');
  if (f.squatLimited) ids.push('w_squatmob');
  if (f.coreWeak) ids.push('c_birddog');
  if (f.balancePoor || extraBalance) ids.push('b_unagamba');
  return [...new Set(ids)].map((id) => BY_ID[id]).filter((e) => e && allowed(e, d, 1));
}

function warmupBlock(min, d, variant, extraBalance) {
  const n = clamp(Math.round((min * 60) / 60), 2, 6);
  const cor = correctives(d, extraBalance).slice(0, min >= 6 ? 3 : min >= 4 ? 2 : 1);
  const generic = pickMany('warmup', d, Math.max(1, n - cor.length), variant, cor.map((e) => e.id));
  const secs = Math.round((min * 60) / Math.max(generic.length + cor.length, 1));
  const items = [
    ...generic.map((e) => item(e, `${secs} s`)),
    ...cor.map((e) => item(e, e.cat === 'balance' ? '2 × 20 s per lato' : `${Math.max(30, secs)} s`, 0, 'Correttivo')),
  ];
  return { name: 'Riscaldamento', minutes: min, items };
}

function targetedStretches(d, p) {
  const f = d.flags || {};
  const ids = [];
  if (f.hamstringsTight) ids.push('m_femorali');
  if (f.anklesStiff) ids.push('m_polpacci');
  if (f.shouldersStiff) ids.push('m_pett', 'm_openbook');
  if (f.squatLimited) ids.push('m_flessori', 'm_9090');
  if (p.lavoro === 'sedentario') ids.push('m_flessori');
  if (d.sensitive?.has('schiena') || d.cond.has('schiena')) ids.push('m_bambino');
  if (d.sensitive?.has('collo') || d.cond.has('collo')) ids.push('m_collo');
  return [...new Set(ids)].map((id) => BY_ID[id]).filter((e) => e && allowed(e, d, 1));
}

function cooldownBlock(min, d, variant, p) {
  if (min <= 0) return null;
  const want = p.stress === 'alto' || d.cond.has('ipertensione');
  const n = Math.max(1, clamp(Math.floor(min * 60 / 50), 1, 6) - (want ? 1 : 0));
  const tgt = targetedStretches(d, p).slice(0, n);
  const exs = pickMany('mobility', d, Math.max(n - tgt.length, 0), variant + 1, ['m_respiro', ...tgt.map((e) => e.id)]);
  const items = [...tgt.map((e) => item(e, '45 s', 0, 'Mirato')), ...exs.slice(0, n - tgt.length).map((e) => item(e, '40 s'))];
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
    if (e.id === 'x_corsa' && goal !== 'resistenza' && (d.level === 1 || d.bmi >= 27 || (d.cardioL !== null && d.cardioL <= 2))) s -= 4;
    return s;
  };
  list.sort((a, b) => pref(b) - pref(a));
  if (goal === 'resistenza' && list[0]?.id === 'x_corsa') return list[0];
  return list[variant % Math.min(list.length, 3)] || BY_ID.x_cammino;
}

// zone di frequenza cardiaca: Karvonen (con FC a riposo misurata) oppure % della FC massima
function zone(d, kind) {
  if (d.cond.has('betabloccanti')) return '';
  if (d.hrRest) {
    const [lo, hi] = kind === 'hard' ? [0.8, 0.9] : [0.55, 0.7];
    const r = d.hrMax - d.hrRest;
    return ` (${Math.round(d.hrRest + r * lo)}–${Math.round(d.hrRest + r * hi)} bpm)`;
  }
  const [lo, hi] = kind === 'hard' ? [0.8, 0.9] : [0.6, 0.7];
  return ` (${Math.round(d.hrMax * lo)}–${Math.round(d.hrMax * hi)} bpm)`;
}

function strengthSession(type, minutes, p, d, variant, phase) {
  const goal = p.obiettivo;
  const { warm, cool } = splitTime(minutes);
  let main = minutes - warm - cool;
  let finisher = 0;
  if ((goal === 'dimagrire' || goal === 'tonificare') && main >= 35 && !['circuito', 'core', 'focus'].includes(type)) { finisher = 8; main -= finisher; }

  const circuit = type === 'circuito' || minutes < 25;
  const preferLoad = goal === 'massa' || goal === 'tonificare';
  let patterns = type === 'focus' ? focusPatterns(d, variant) : [...PATTERNS[type === 'circuito' ? 'full' : type]];
  const weak = d.weakAreas || [];
  if (['full', 'circuito'].includes(type)) {
    if (weak.includes('forzaSup')) patterns = ['push_h', 'pull_h', ...patterns.filter((x) => x !== 'push_h' && x !== 'pull_h')];
    if (weak.includes('forzaInf')) patterns.splice(2, 0, 'lunge');
    if (weak.includes('core')) patterns.splice(3, 0, 'core');
  } else if (type === 'upper' && weak.includes('core')) patterns.splice(4, 0, 'core');
  else if (type === 'lower' && weak.includes('core')) patterns.splice(3, 0, 'core');
  const used = new Set();
  const chosen = [];

  let perEx;
  if (circuit) perEx = 1.1; // minuti per esercizio per giro
  else {
    const [sets, , rest] = DOSE[goal][Math.max(...Object.values(d.pl || { a: d.level }))];
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
      items: chosen.map((e) => {
        const ds = dose(e, goal, d, phase);
        const it = item(e, ds.text + ` · recupero ${ds.rest} s`, ds.rest);
        if (ds.basis) it.basis = ds.basis;
        if (d.exAdj?.[e.id]) it.tag = d.exAdj[e.id] > 0 ? 'Progressione' : 'Regressione';
        if (d.swaps && Object.values(d.swaps).includes(e.id)) it.tag = 'Scelto da te';
        else if (d.favorites?.includes(e.id) && d.equip.has('palestra')) it.tag = 'Dalla tua scheda';
        return it;
      }),
    };
  }

  const blocks = [warmupBlock(warm, d, variant, d.age >= 65 || d.cond.has('osteoporosi')), mainBlock];
  const prio = weak.map((w) => AREAS.find((a) => a.id === w)?.label).filter(Boolean);
  if (prio.length && !circuit) mainBlock.note += ` Priorità per te: ${prio.join(' e ').toLowerCase()}.`;
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
  const title = type === 'focus' && weak.length ? `Focus: ${weak.map((w) => AREAS.find((a) => a.id === w)?.short.toLowerCase()).join(' e ')}` : `${TITLES[type]}${['full', 'upper', 'lower', 'circuito'].includes(type) ? ' ' + letter : ''}`;
  return { type, kind: 'forza', title, minutes, blocks };
}

function cardioSession(type, minutes, p, d, variant, phase) {
  const goal = p.obiettivo;
  const { warm, cool } = splitTime(minutes);
  const main = minutes - warm - cool;
  let effType = type;
  if (type === 'intervalli' && (!d.hiitOk || d.cardioL === 1)) effType = 'intervalli_moderati';
  const mod = cardioModality(d, goal, variant, effType.startsWith('intervalli'));
  let text;
  let note = '';

  if (effType === 'intervalli') {
    const [w, r] = d.cardioL !== null ? { 2: [30, 90], 3: [60, 60], 4: [120, 60], 5: [180, 60] }[clamp(d.cardioL, 2, 5)] : { 1: [30, 90], 2: [60, 60], 3: [120, 60] }[d.level];
    const reps = Math.max(2, Math.floor((main * 60) / (w + r)) - (phase === 4 ? 1 : 0));
    text = `${reps} × ${w < 60 ? w + ' s' : w / 60 + ' min'} forte${zone(d, 'hard')} + ${r < 60 ? r + ' s' : r / 60 + ' min'} facile`;
    note = 'Nella parte "forte" fatica 7–8/10: parli a fatica. Nella parte facile recupera bene.';
  } else if (effType === 'intervalli_moderati') {
    const [w, r] = d.cardioL !== null && d.cardioL <= 2 ? [1, 2] : [2, 2];
    const reps = Math.max(2, Math.floor(main / (w + r)));
    text = `${reps} × ${w} min a ritmo sostenuto + ${r} min facile`;
    note = 'Intervalli moderati: nella parte sostenuta fatica 5–6/10, riesci ancora a dire frasi brevi.';
  } else if (mod.id === 'x_corsa' && (d.cardioL !== null ? d.cardioL <= 3 : d.level < 3)) {
    const beginner = d.cardioL !== null ? d.cardioL <= 2 : d.level === 1;
    const [run, walk] = beginner ? [1 + Math.min(phase, 3) - 1, 2] : [3 + Math.min(phase, 3), 1];
    const reps = Math.max(2, Math.floor(main / (run + walk)));
    text = `${reps} × (${run} min corsa leggera + ${walk} min camminata)`;
    note = 'Metodo corsa-cammino: ogni settimana i tratti di corsa si allungano. Devi riuscire a parlare mentre corri.';
  } else {
    text = `${main} min continui${zone(d, 'z2')}`;
    note = 'Zona 2: respiro più veloce ma riesci a parlare in frasi complete. Fatica 4–5/10.';
  }
  if (type === 'lungo') note += ' Se nel weekend hai più tempo, allunga di 10–15 minuti: è l’allenamento che più migliora la resistenza.';
  if (d.hrRest && !d.cond.has('betabloccanti')) note += ` Zone calcolate sulla tua FC a riposo di ${d.hrRest} bpm.`;
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
  const tgt = targetedStretches(d, p);
  const pool = [...tgt, ...exs.filter((e) => !tgt.includes(e)), ...bal];
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

// postura: per chi passa la giornata seduto (dorsale, anche, glutei, spalle)
const POSTURE_FLOW = ['m_openbook', 'm_gatto', 'm_flessori', 'h_ponte', 'g_clam', 'w_angeli', 'r_ytw', 'c_birddog', 'm_pett', 'v_wallslide', 'm_9090', 'c_deadbug', 'm_collo'];
function postureSession(minutes, p, d, variant) {
  const warm = minutes >= 15 ? 2 : 1;
  const main = minutes - warm - 2;
  const pool = POSTURE_FLOW.map((id) => BY_ID[id]).filter((e) => e && allowed(e, d, 1));
  const tgt = targetedStretches(d, p).filter((e) => !pool.includes(e));
  const all = [...tgt, ...pool];
  const n = clamp(Math.floor(main / 1.8), 4, Math.min(9, all.length));
  const start = (variant * 3) % Math.max(1, all.length - n + 1);
  const chosen = all.slice(start, start + n);
  return {
    type: 'postura', kind: 'mobilita', title: TITLES.postura, minutes,
    blocks: [
      { name: 'Sblocco', minutes: warm, items: pickMany('warmup', d, 2, variant).map((e) => item(e, '45 s')) },
      { name: 'Sequenza postura', minutes: main, note: 'Pensata per chi lavora seduto: apre petto e anche, riattiva glutei e muscoli tra le scapole. Movimenti lenti e controllati.', items: chosen.map((e) => item(e, e.cat === 'strength' ? (e.unit === 'sec' ? '2 × 30 s' : '2 × 10–12') : '60 s', e.cat === 'strength' ? 20 : 0)) },
      { name: 'Respiro', minutes: 2, items: [item(BY_ID.m_respiro, '2 min')] },
    ],
  };
}

export function buildSession(type, minutes, p, d, variant, phase) {
  if (TYPE_KIND[type] === 'cardio') return cardioSession(type, minutes, p, d, variant, phase);
  if (type === 'mobilita') return mobilitySession(minutes, p, d, variant);
  if (type === 'postura') return postureSession(minutes, p, d, variant);
  return strengthSession(type, minutes, p, d, variant, phase);
}

export function slotsOf(p) {
  if (p.sessioni?.length) return p.sessioni.filter((s) => s.giorni > 0);
  return [{ giorni: p.giorni, minuti: p.minuti, luogo: (p.attrezzi || []).includes('palestra') ? 'palestra' : 'casa' }];
}
export const weeklyMinutes = (p) => slotsOf(p).reduce((a, s) => a + s.giorni * s.minuti, 0);
export const weeklyDays = (p) => Math.min(7, slotsOf(p).reduce((a, s) => a + s.giorni, 0));

// attrezzi disponibili per luogo
function equipFor(p, luogo) {
  const home = (p.attrezzi || []).filter((a) => a !== 'palestra');
  if (luogo === 'palestra') return new Set(['corpo', 'palestra', 'manubri', 'elastici', 'sbarra', 'tapis', 'bici', ...home]);
  if (luogo === 'aperto') return new Set(['corpo', ...home.filter((a) => ['bici', 'corda', 'piscina', 'elastici'].includes(a))]);
  return new Set(['corpo', ...home.filter((a) => a !== 'piscina')]);
}

const SHORT_TYPES = {
  dimagrire: ['circuito', 'intervalli', 'core', 'circuito', 'cardio'],
  massa: ['focus', 'core', 'focus', 'mobilita', 'core'],
  tonificare: ['circuito', 'core', 'focus', 'intervalli', 'circuito'],
  resistenza: ['cardio', 'intervalli', 'core', 'cardio', 'mobilita'],
  mobilita: ['mobilita', 'core', 'mobilita', 'postura', 'mobilita'],
  salute: ['cardio', 'core', 'mobilita', 'cardio', 'focus'],
};

function mixedSchedule(p, d, week) {
  const slots = slotsOf(p).map((s, i) => ({ ...s, i }));
  const main = slots.filter((s) => s.minuti >= 30).sort((a, b) => b.minuti - a.minuti);
  const short = slots.filter((s) => s.minuti < 30);
  const { phase } = mesoPhase(week);
  const out = WEEKDAYS.map((label, i) => ({ weekday: i, label, session: null }));
  const counters = {};
  const make = (type, slot) => {
    counters[type] = counters[type] || 0;
    const variant = counters[type]++;
    const dd = { ...d, equip: equipFor(p, slot.luogo) };
    if (!dd.hiitOk && type === 'circuito' && dd.blocked.has('impatto')) type = 'full';
    const ses = buildSession(type, slot.minuti, p, dd, variant, phase);
    ses.luogo = slot.luogo;
    return ses;
  };
  // sessioni principali (le più lunghe) distribuite nella settimana
  const mainDays = Math.min(7, main.reduce((a, s) => a + s.giorni, 0));
  const mainTpl = mainDays >= 2 ? [...TEMPLATES[p.obiettivo][mainDays]] : mainDays === 1 ? ['full'] : [];
  const mainSlots = DAY_SLOTS[mainDays] || [];
  let k = 0;
  for (const s of main) for (let j = 0; j < s.giorni && k < mainSlots.length; j++, k++) out[mainSlots[k]].session = make(mainTpl[k], s);
  // sessioni brevi nei giorni liberi, ben distribuite
  const free = out.filter((x) => !x.session).map((x) => x.weekday);
  const shortDays = Math.min(free.length, short.reduce((a, s) => a + s.giorni, 0));
  const pick = shortDays >= free.length ? free : Array.from({ length: shortDays }, (_, i) => free[Math.floor((i + 0.5) * free.length / shortDays)]);
  let types = [...(SHORT_TYPES[p.obiettivo] || SHORT_TYPES.salute)];
  if (p.lavoro === 'sedentario' && !types.slice(0, shortDays).includes('postura')) types.splice(Math.min(2, shortDays - 1), 0, 'postura');
  if (!d.hiitOk) types = types.map((x) => (x === 'intervalli' ? 'cardio' : x));
  let q = 0;
  for (const s of short) for (let j = 0; j < s.giorni && q < pick.length; j++, q++) out[pick[q]].session = make(types[q % types.length], s);
  return out;
}

export function weekSchedule(p, week = 1, ctx = {}) {
  const d = derive(p, ctx);
  if (p.sessioni?.filter((x) => x.giorni > 0).length > 1) return mixedSchedule(p, d, week);
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
  const d = derive(p, opts.ctx || {});
  const w = p.peso;
  const body = d.cp?.body || {};
  const lean = body.leanMass || null;
  const bf = body.bf ?? null;
  // con la massa magra misurata uso Katch-McArdle, più preciso di Mifflin-St Jeor
  const bmr = lean ? 370 + 21.6 * lean : 10 * w + 6.25 * p.altezza - 5 * p.eta + (p.sesso === 'M' ? 5 : -161);
  let pal = d.steps < 3000 ? 1.2 : d.steps < 5000 ? 1.25 : d.steps < 7500 ? 1.3 : d.steps < 10000 ? 1.4 : 1.5;
  if (p.lavoro === 'fisico') pal += 0.1; else if (p.lavoro === 'in_piedi') pal += 0.05;
  pal += clamp(weeklyMinutes(p) * 0.00035, 0, 0.3);
  const tdee = bmr * pal;

  const notes = [];
  if (lean) notes.push(`Metabolismo calcolato sulla tua massa magra (${lean.toLocaleString('it-IT', { maximumFractionDigits: 1 })} kg, massa grassa ${bf.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%) con la formula di Katch-McArdle.`);
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
      let pct = d.bmi >= 30 ? 0.0075 : 0.005;
      if (bf !== null) pct = bf >= (p.sesso === 'M' ? 25 : 32) ? 0.0075 : bf <= (p.sesso === 'M' ? 15 : 23) ? 0.0035 : 0.005;
      rate = clamp(w * pct, 0.2, 1.0);
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

  let refW = d.bmi >= 30 ? 25 * (p.altezza / 100) ** 2 : w;
  let gkg = { deficit: 1.8, surplus: 1.8, mantenimento: goal === 'tonificare' || goal === 'massa' ? 1.8 : goal === 'resistenza' ? 1.5 : 1.3 }[mode];
  if (lean) { refW = lean; gkg = { deficit: 2.3, surplus: 2.2, mantenimento: goal === 'tonificare' || goal === 'massa' ? 2.2 : goal === 'resistenza' ? 1.9 : 1.7 }[mode]; }
  gkg *= PROTEIN_FACTOR[p.dieta] || 1;
  if (PROTEIN_FACTOR[p.dieta] > 1) notes.push(`Con un’alimentazione ${DIET_LABEL[p.dieta].toLowerCase()} le proteine sono aumentate del ${Math.round((PROTEIN_FACTOR[p.dieta] - 1) * 100)}%: quelle vegetali sono un po’ meno digeribili.`);
  if (d.cond.has('reni')) { gkg = 0.8; notes.push('Con una malattia renale le proteine vanno concordate con il nefrologo: il valore indicato è prudenziale.'); }
  if (d.cond.has('gravidanza')) gkg = Math.max(gkg, 1.2);
  const protein = round(refW * gkg, 5);
  const fat = round((kcal * 0.28) / 9, 5);
  const carbs = Math.max(0, round((kcal - protein * 4 - fat * 9) / 4, 5));
  const water = round(w * 0.035, 0.1);
  if (d.cond.has('diabete')) notes.push('Con il diabete distribuisci i carboidrati nei pasti, preferisci quelli integrali e controlla la glicemia prima e dopo l’allenamento.');

  const dieta = p.dieta || 'onnivora';
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carbs, water, fiber: Math.round(kcal / 1000 * 14), mode, rate, target, notes, dieta, meals: mealPlan(protein, dieta), dietTips: dietNotes(dieta, p) };
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

export function habits(p, ctx = {}) {
  const d = derive(p, ctx);
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
  if (weeklyMinutes(p) < 150) out.push({ icon: '⏱️', title: 'Arriva a 150 minuti a settimana', text: `Con il tempo scelto fai ${weeklyMinutes(p)} minuti a settimana di allenamento. L’OMS consiglia almeno 150 minuti di attività moderata: completa con camminate veloci.`, priority: 2 });
  if (d.cond.has('diabete')) out.push({ icon: '🩸', title: 'Cammina dopo i pasti', text: 'Una camminata di 10–15 minuti dopo i pasti principali aiuta molto a tenere sotto controllo la glicemia.', priority: 1 });
  if (d.age >= 65) out.push({ icon: '⚖️', title: 'Allena l’equilibrio', text: 'Gli esercizi di equilibrio sono inclusi nei tuoi allenamenti: riducono il rischio di cadute. Falli sempre vicino a un appoggio.', priority: 2 });
  out.push({ icon: '💧', title: 'Bevi a sufficienza', text: `Circa ${round(p.peso * 0.035, 0.1).toFixed(1)} litri al giorno, mezzo litro in più nei giorni di allenamento.`, priority: 3, key: 'acqua' });
  return out.sort((a, b) => a.priority - b.priority);
}

export function alerts(p, ctx = {}) {
  const d = derive(p, ctx);
  const out = [];
  const stop = (text) => out.push({ level: 'stop', text });
  const warn = (text) => out.push({ level: 'attenzione', text });
  for (const r of d.pains.filter((x) => x.v >= 3)) stop(`Dolore forte a: ${r.label.toLowerCase()}. Fallo valutare da un medico o fisioterapista prima di allenare quella zona. Nel frattempo il piano la esclude.`);
  const mid = d.pains.filter((x) => x.v === 2).map((x) => x.label.toLowerCase());
  if (mid.length) warn(`Dolore medio a: ${mid.join(', ')}. Ho escluso gli esercizi che caricano queste zone e scelto alternative più sicure.`);
  const low = d.pains.filter((x) => x.v === 1).map((x) => x.label.toLowerCase());
  if (low.length) warn(`Fastidio lieve a: ${low.join(', ')}. Per gli esercizi che coinvolgono queste zone parto da un livello più facile: se il fastidio supera 3/10, sostituisci l’esercizio.`);
  const b = d.cp?.body || {};
  if (b.pas >= 160 || b.pad >= 100) stop(`Pressione misurata ${b.pas}/${b.pad} mmHg: troppo alta per allenarsi in sicurezza. Ripeti la misura a riposo e senti il medico prima di iniziare.`);
  else if (b.pas >= 140 || b.pad >= 90) warn(`Pressione misurata ${b.pas}/${b.pad} mmHg: sopra la norma. Misurala in giorni diversi e parlane con il medico; intanto niente carichi massimali.`);
  if (b.hrRest >= 100) warn(`Frequenza cardiaca a riposo di ${b.hrRest} bpm: è alta. Ripeti la misura al mattino da seduto e, se resta sopra 100, consulta il medico.`);
  if (b.whtr >= 0.6) warn(`Rapporto vita/altezza ${b.whtr.toFixed(2)}: indica grasso addominale elevato, il fattore di rischio più importante. È il primo indicatore che seguiremo.`);
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

/**
 * opts: { startISO, week, calorieAdjust, assess (ultima valutazione), swaps, excluded, exAdj }
 */
export function generatePlan(p, opts = {}) { return generatePlanFull(p, opts); }

function generatePlanBase(p, opts = {}) {
  const startISO = opts.startISO || toISO(new Date());
  const week = opts.week || 1;
  const cp = computeProfile(p, opts.assess || {});
  const ctx = { cp, swaps: opts.swaps, excluded: opts.excluded, exAdj: opts.exAdj, favorites: opts.favorites };
  const d = derive(p, ctx);
  const nutri = nutrition(p, { ...opts, ctx });
  return {
    derived: { bmi: +d.bmi.toFixed(1), level: d.level, pl: d.pl, hrMax: d.hrMax, hrRest: d.hrRest, hiitOk: d.hiitOk, blocked: [...d.blocked], excluded: [...d.exclude] },
    week,
    phase: mesoPhase(week),
    schedule: weekSchedule(p, week, ctx),
    nutrition: nutri,
    timeline: timeline(p, nutri, startISO),
    habits: habits(p, ctx),
    alerts: alerts(p, ctx),
    profile: cp,
    _d: d,
    personal: null,
  };
}

export function generatePlanFull(p, opts = {}) {
  const plan = generatePlanBase(p, opts);
  const used = new Set(plan.schedule.flatMap((x) => (x.session ? x.session.blocks.flatMap((b) => b.items.map((i) => i.id)) : [])));
  plan.personal = personalFactors(p, plan._d, plan.profile, plan.nutrition, used);
  plan.summary = coachSummary(p, plan);
  delete plan._d;
  return plan;
}

// ------------------------------------------------------------------
// Il piano in breve: relazione del coach
// ------------------------------------------------------------------

const LUOGO = { palestra: 'in palestra', casa: 'a casa', aperto: 'all’aperto' };
export function coachSummary(p, plan) {
  const out = [];
  const days = plan.schedule.filter((x) => x.session);
  const slots = slotsOf(p);
  const goal = { dimagrire: 'perdere grasso mantenendo i muscoli', massa: 'aumentare la massa muscolare', tonificare: 'tonificare', resistenza: 'migliorare la resistenza', mobilita: 'migliorare mobilità e postura', salute: 'stare meglio e prevenire' }[p.obiettivo];
  const wm = weeklyMinutes(p);
  out.push({ icon: '🗓️', title: 'La tua settimana', text: `${days.length} allenamenti, ${wm} minuti in tutto, per ${goal}. ${wm >= 150 ? 'Sei sopra i 150 minuti consigliati dall’OMS.' : 'Le camminate completano i 150 minuti consigliati dall’OMS.'}` });
  if (slots.length > 1) {
    for (const s of slots) {
      const ds = days.filter((x) => x.session.luogo === s.luogo && x.session.minutes === s.minuti);
      if (!ds.length) continue;
      const names = [...new Set(ds.map((x) => x.session.title.replace(/ [ABC]$/, '').toLowerCase()))];
      const role = s.minuti >= 30
        ? 'sono il cuore del piano: lavoro di forza completo su tutto il corpo con carichi progressivi'
        : 'completano le sessioni lunghe senza affaticarti: brevi, mirate e facili da incastrare nella giornata';
      out.push({ icon: s.luogo === 'palestra' ? '🏋️' : s.luogo === 'casa' ? '🏠' : '🌳', title: `${ds.length} × ${s.minuti} minuti ${LUOGO[s.luogo]} (${ds.map((x) => x.label).join(', ')})`, text: `Queste sessioni ${role}. Contenuto: ${names.join(', ')}.` });
    }
  }
  if (p.lavoro === 'sedentario') {
    const steps = plan.habits.find((h) => h.key === 'passi');
    out.push({ icon: '🪑', title: 'Lavori seduto', text: `${days.some((x) => x.session.type === 'postura') ? 'Una sessione a settimana è dedicata alla postura (dorsale, anche, glutei, spalle). ' : ''}Ogni riscaldamento e defaticamento include mobilità di anche e torace. Fuori dall’allenamento: alzati ogni 45–60 minuti e punta a ${steps?.target?.toLocaleString('it-IT') || '8.000'} passi al giorno, perché il movimento quotidiano conta quanto l’allenamento.` });
  }
  if (p.dieta && p.dieta !== 'onnivora') {
    out.push({ icon: '🥗', title: `Alimentazione ${DIET_LABEL[p.dieta].toLowerCase()}`, text: `${plan.nutrition.kcal.toLocaleString('it-IT')} kcal e ${plan.nutrition.protein} g di proteine al giorno, con una giornata tipo costruita sui tuoi alimenti e le integrazioni da valutare (B12, omega-3).` });
  }
  if (plan.timeline.hasWeight) out.push({ icon: '🎯', title: 'Traguardo', text: `${plan.nutrition.target} kg intorno al ${formatDate(plan.timeline.eta)}, a ${plan.timeline.rate.toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg a settimana.${plan.timeline.warning ? ' La data che avevi indicato è troppo vicina per farlo in modo sano.' : ''}` });
  return out;
}

// ------------------------------------------------------------------
// Spiegazione di come il piano è stato personalizzato
// ------------------------------------------------------------------

const EX_LVL = ['', 'base', 'intermedio', 'avanzato'];
const it1 = (v) => Number(v).toLocaleString('it-IT', { maximumFractionDigits: 1 });

export function personalFactors(p, d, cp, nutri, used = new Set()) {
  const out = [];
  const L = cp.levels;
  const t = cp.tests;
  if (cp.tested) {
    const parts = [];
    if (L.push !== null) parts.push(`spinta ${LEVEL_LABEL[L.push].toLowerCase()} → esercizi di livello ${EX_LVL[d.pl.push_h]}`);
    if (L.pull !== null) parts.push(`tirata → livello ${EX_LVL[d.pl.pull_h]}`);
    if (L.legs !== null) parts.push(`gambe ${LEVEL_LABEL[L.legs].toLowerCase()} → livello ${EX_LVL[d.pl.squat]}`);
    if (L.core !== null) parts.push(`core ${LEVEL_LABEL[L.core].toLowerCase()} → livello ${EX_LVL[d.pl.core]}`);
    if (L.cardio !== null) parts.push(`fiato ${LEVEL_LABEL[L.cardio].toLowerCase()}`);
    out.push({ icon: '🎚️', title: 'Un livello per ogni capacità', text: `Dai tuoi test: ${parts.join('; ')}.` });
  } else {
    out.push({ icon: '🎚️', title: 'Livello stimato dall’esperienza', text: 'Fai la valutazione iniziale: ogni capacità avrà il suo livello e le dosi saranno calcolate sui tuoi risultati.' });
  }
  const doses = [];
  const PT = { classici: 'p_classici', ginocchia: 'p_ginocchia', rialzo: 'p_rialzo', muro: 'p_muro' };
  if (t.pushup && used.has(PT[t.pushup.variant])) doses.push(`piegamenti (${t.pushup.variant}) da ${Math.max(3, Math.round(t.pushup.value * 0.5))}–${Math.max(4, Math.round(t.pushup.value * 0.7))} ripetizioni, il 50–70% del tuo massimo di ${t.pushup.value}`);
  if (t.plank && (used.has('c_plank') || used.has('c_plank_g'))) doses.push(`plank da ${Math.max(10, Math.round(t.plank.value * 0.55 / 5) * 5)} s, il 55% dei tuoi ${t.plank.value} s`);
  if (t.chair && used.has('s_sitstand')) doses.push(`alzate dalla sedia calibrate sulle tue ${t.chair.value} in 30 s`);
  if (doses.length) out.push({ icon: '🎯', title: 'Dosi calcolate sui tuoi test', text: doses.join('; ') + '.' });
  if (cp.weak.length) out.push({ icon: '📌', title: `Punti deboli: ${cp.weak.map((a) => a.label.toLowerCase()).join(' e ')}`, text: 'Ricevono più lavoro: esercizi in apertura di sessione o un esercizio in più.' });
  const f = cp.flags;
  const fx = [];
  if (f.anklesStiff) fx.push(`caviglie rigide (${t.ankle.value} cm al muro): mobilità della caviglia nel riscaldamento e squat con talloni rialzati`);
  if (f.hamstringsTight) fx.push('femorali corti: cerniera d’anca nel riscaldamento, ponte glutei preferito allo stacco, allungamento dei femorali a fine sessione');
  if (f.shouldersStiff) fx.push('spalle rigide: niente spinte pesanti sopra la testa, angeli al muro e allungamento dei pettorali');
  if (f.squatLimited) fx.push('squat limitato: mezzo squat lento e mobilità delle anche (90/90, flessori)');
  if (f.balancePoor) fx.push(`equilibrio da allenare (${t.balance.value} s su una gamba): esercizio di equilibrio in ogni riscaldamento`);
  if (f.coreWeak) fx.push('core da rinforzare: attivazione con bird dog prima della parte principale');
  if (fx.length) out.push({ icon: '🛠️', title: 'Correttivi su misura', text: fx.join('; ') + '.' });
  if (d.pains.length) out.push({ icon: '🩹', title: 'Mappa dei dolori applicata', text: d.pains.map((r) => `${r.label.toLowerCase()} (${['', 'lieve', 'medio', 'forte'][r.v]})`).join(', ') + `: ${d.exclude.size} esercizi esclusi, livello ridotto dove c’è fastidio lieve.` });
  if (d.hrRest) out.push({ icon: '❤️', title: 'Zone cardio sulla tua frequenza a riposo', text: `Con FC a riposo ${d.hrRest} bpm e massima stimata ${d.hrMax} bpm (metodo Karvonen): zona 2 ${Math.round(d.hrRest + (d.hrMax - d.hrRest) * 0.55)}–${Math.round(d.hrRest + (d.hrMax - d.hrRest) * 0.7)} bpm.` });
  if (cp.levels.cardio !== null) out.push({ icon: '🫁', title: 'Intervalli adatti al tuo fiato', text: cp.levels.cardio <= 1 ? 'Solo intervalli moderati: 1 minuto sostenuto e 2 facili.' : cp.levels.cardio <= 2 ? 'Intervalli brevi: 30 secondi forti e 90 di recupero.' : cp.levels.cardio <= 3 ? 'Intervalli da 1 minuto forte e 1 di recupero.' : 'Intervalli lunghi da 2–3 minuti.' });
  if (cp.body.leanMass) out.push({ icon: '⚖️', title: 'Calorie sulla tua massa magra', text: `${it1(cp.body.leanMass)} kg di massa magra (${it1(cp.body.bf)}% di grasso): metabolismo basale ${nutri.bmr} kcal, proteine ${nutri.protein} g calcolate sulla massa magra.` });
  const nSw = Object.keys(d.swaps || {}).length, nEx = (d.exclude?.size || 0), nAdj = Object.values(d.exAdj || {}).filter(Boolean).length;
  if (nSw || nAdj) out.push({ icon: '🔁', title: 'Il piano impara da te', text: `${nSw} esercizi sostituiti da te, ${nAdj} esercizi con difficoltà adattata in base al tuo feedback.` });
  return out;
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
    const fewerDays = Math.max(2, weeklyDays(p) - 1);
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
