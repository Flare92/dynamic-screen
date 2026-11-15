// Ritmo – interfaccia: percorso guidato dal coach, Oggi, Allenamento, Alimentazione, Progressi, Profilo.

import {
  CONDITIONS, GOALS, EQUIPMENT, WEEKDAYS, WEEKDAYS_LONG, TYPE_KIND,
  generatePlan, analyzeProgress, expectedWeight, buildSession, derive, allowedExercises, alternativesFor,
  toISO, fromISO, addDays, daysBetween, weekdayIndex, formatDate, resizeSession, coupleSession,
} from './engine.js';
import { EXERCISES } from './exercises.js';
import { guideFor, MUSCLE_LABELS } from './guide.js';
import { ICON, countUp, burst, haptic } from './fx.js';
import { openSheet, closeSheet } from './sheet.js';
import { openPlayer } from './player.js';
import {
  PAIN_REGIONS, AREAS, LEVEL_LABEL, TEST_BY_ID,
  computeProfile, precision, buildKpis, metric, kpiProgress,
} from './assessment.js';
import { QUESTIONS, EXAMPLE, parseNarrative, coverage, analyzeWithAI, mergeAI } from './narrative.js';
import { DIET_LABEL, DISPENSA, pantryRecipes, coupleMenu, foodLabel } from './diet.js';
import { dayOptions, applyOption, undoOption } from './giornata.js';
import { aiRicette, aiGiornata, aiError, aiConfig, aiProvider, setAiProvider, setAiKey, hasAiKey, PROVIDERS } from './ai.js';
import { buildCard, encodeCard, decodeCard, shareUrl, weekTogether, bestTogetherDay } from './coppia.js';
import { parseGymList, reviewGym, VERDICT_LABEL, VERDICT_COUNT, GYM_PICKS, lineIsPick } from './gymreview.js';
import { startAssessment, renderAssessment, mountAssessment, handleAssessmentClick, assessmentActive, cancelAssessment } from './assess-ui.js';
import { SOGNI, ZONE_LABEL, goalFromSogni } from './indagine.js';
import { SEZIONI, passiPer, passiCoperti, BOZZA_VUOTA } from './flow.js';
import { thumbHTML, warmDemos } from './demo.js';
import { demoFor } from './demos.js';

// ==================================================================
// Stato (salvato solo sul dispositivo)
// ==================================================================

const KEY = 'ritmo.v1';
const empty = () => ({ profile: null, planStart: null, calorieAdjust: 0, log: {}, weights: [], assess: [], swaps: {}, excluded: [], exAdj: {}, fbCount: 0 });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch { return empty(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast('Impossibile salvare sul dispositivo'); }
}

let state = load();
let draft = null;        // bozza del profilo durante il percorso guidato
let flowIdx = 0;         // passo corrente del percorso
let flowEdit = false;    // si sta modificando un profilo esistente
let justFinished = false;
let selectedDay = null;
let menuDay = null;
let showFeedback = false;
let libFilter = 'perte';
let libQuery = '';

const $app = document.getElementById('app');
const today = () => toISO(new Date());
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** cambio di schermata con dissolvenza, dove il browser lo permette */
function transition(go) {
  if (!document.startViewTransition || reduced()) { go(); return; }
  const t = document.startViewTransition(go);
  // una transizione interrotta da quella successiva non è un errore
  [t.ready, t.finished, t.updateCallbackDone].forEach((p) => p?.catch(() => {}));
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function currentWeek() {
  return Math.max(1, Math.floor(daysBetween(fromISO(state.planStart), new Date()) / 7) + 1);
}
// unisce tutte le valutazioni: i test più recenti sostituiscono quelli vecchi
function mergedAssess(upTo = state.assess.length) {
  const out = { results: {}, meas: { ...(state.profile?.misure || {}) } };
  for (const e of state.assess.slice(0, upTo)) { Object.assign(out.results, e.results || {}); Object.assign(out.meas, e.meas || {}); }
  return out;
}
const latestWeight = () => ([...state.weights].sort((a, b) => a.date.localeCompare(b.date)).pop()?.kg ?? state.profile.peso);
const hasGym = (p = state.profile) => !!p && ((p.sessioni || []).some((x) => x.luogo === 'palestra') || (p.attrezzi || []).includes('palestra'));
const planCtx = () => ({ cp: computeProfile(state.profile, mergedAssess()), swaps: state.swaps, excluded: state.excluded, exAdj: state.exAdj });
// esercizi della scheda personale da tenere: il piano li preferisce nelle sessioni in palestra
function gymReview(text = state.profile?.schedaPalestra) {
  const list = parseGymList(text);
  return list.length ? reviewGym(state.profile, list, planCtx()) : null;
}
let planCache = null;
function getPlan(week = currentWeek()) {
  const key = `${week}|${state.planStart}|${state.calorieAdjust}|${JSON.stringify([state.profile, state.assess.length, state.swaps, state.excluded, state.exAdj])}`;
  if (planCache?.key === key) return planCache.plan;
  const plan = generatePlan(state.profile, {
    startISO: state.planStart, week, calorieAdjust: state.calorieAdjust,
    assess: mergedAssess(), swaps: state.swaps, excluded: state.excluded, exAdj: state.exAdj,
    favorites: hasGym() ? gymReview()?.keep : undefined,
  });
  planCache = { key, plan };
  return plan;
}
const precisionNow = () => precision(state.profile, mergedAssess(), { feedbacks: state.fbCount || 0, retests: Math.max(0, state.assess.length - 1), excludeTests: Object.values(TEST_BY_ID).filter((t) => t.when(state.profile, mergedAssess().results)).map((t) => t.id) });
const daysSinceAssess = () => (state.assess.length ? daysBetween(fromISO(state.assess[state.assess.length - 1].date), new Date()) : null);
function dayLog(iso) {
  if (!state.log[iso]) state.log[iso] = { done: false, items: [], habits: {} };
  return state.log[iso];
}
/**
 * La sessione davvero prevista in un giorno, con le modifiche della giornata flessibile:
 * sessionFrom (-1 = riposo), short (versione corta), extra (doppio), couple (allenamento di coppia).
 */
function sessionFor(plan, iso) {
  const lg = state.log[iso] || {};
  const from = lg.sessionFrom;
  const wd = from ?? weekdayIndex(fromISO(iso));
  let session = wd >= 0 ? plan.schedule[wd].session : null;
  if (session && lg.couple && state.partner) session = coupleSession(state.profile, planCtx(), state.partner, session.minutes, session.luogo || 'casa', plan.week);
  else if (session && lg.short && lg.short < session.minutes) session = resizeSession(state.profile, planCtx(), session, lg.short, plan.week);
  const extra = lg.extra !== undefined && lg.extra !== null && lg.extra >= 0 ? plan.schedule[lg.extra].session : null;
  return { session, moved: from !== undefined && from !== null && from >= 0, rested: from === -1, recupero: !!lg.recupero, extra };
}
/** il registro di una sessione: quella principale o la seconda del giorno (doppio) */
function partLog(iso, which) {
  const lg = dayLog(iso);
  if (which !== 'x') return lg;
  if (!lg.x) lg.x = { done: false, items: [] };
  return lg.x;
}

// domande dell'indagine a cui un profilo (anche creato con una versione precedente) non ha ancora risposto
function domandeMancanti(p = state.profile) {
  if (!p) return [];
  const d = JSON.parse(JSON.stringify(p));
  return passiPer(d).filter((s) => s.id !== 'nome' && s.id !== 'scheda' && (s.errore(d, flowHelpers) || ({ sogni: !p.sogni?.length, accumulo: !p.accumulo, dieta: !p.pasti && false }[s.id])));
}

// ==================================================================
// Tab bar e router
// ==================================================================

const TAB_ICON = {
  oggi: ICON.today,
  allenamento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>',
  cibo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v7a2.5 2.5 0 0 0 5 0V3M9.5 3v18M17 3c-1.7 1.2-2.5 3.6-2.5 6.5 0 1.9.9 3 2.5 3.3V21"/></svg>',
  progressi: ICON.progress,
};
const TABS = [['oggi', 'Oggi'], ['allenamento', 'Allenamento'], ['cibo', 'Alimentazione'], ['progressi', 'Progressi']];
const $tabbar = document.getElementById('tabbar');
$tabbar.innerHTML = TABS.map(([id, l]) => `<a href="#/${id}" data-tab="${id}">${TAB_ICON[id]}<span>${l}</span></a>`).join('');

const ALIAS = { piano: 'allenamento', setup: 'inizio', capito: 'perche', alimentazione: 'cibo' };
const NO_PROFILE = ['benvenuto', 'inizio', 'racconto'];
const NO_TABS = ['benvenuto', 'inizio', 'racconto', 'valutazione', 'palestra', 'perche', 'partenza', 'esercizi', 'profilo', 'giornata', 'ricetta', 'coppia'];
const TAB_OF = { partenza: 'progressi', esercizi: 'allenamento', palestra: 'allenamento', perche: 'allenamento', giornata: 'oggi', ricetta: 'cibo', coppia: 'oggi' };

let routeQuery = new URLSearchParams();
function route() {
  let hash = location.hash.replace('#/', '') || 'oggi';
  [hash, routeQuery] = [hash.split('?')[0], new URLSearchParams(hash.split('?')[1] || '')];
  // un codice di coppia ricevuto prima di avere un profilo resta in attesa
  if (hash === 'coppia' && routeQuery.get('c') && !state.profile) { try { localStorage.setItem('ritmo.pendingPartner', routeQuery.get('c')); } catch { /* */ } toast('Prima crea il tuo profilo: poi ti collego'); }
  hash = ALIAS[hash] || hash;
  if (!state.profile && !NO_PROFILE.includes(hash)) { location.replace('#/benvenuto'); hash = 'benvenuto'; }
  const page = state.profile && hash === 'benvenuto' ? 'oggi' : hash;
  const withTabs = !NO_TABS.includes(page);
  if (page !== 'valutazione' && assessmentActive()) cancelAssessment();
  if (page === 'valutazione' && !assessmentActive()) beginAssessment();
  $tabbar.hidden = !withTabs;
  document.body.classList.toggle('no-tabs', !withTabs);
  $tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (TAB_OF[page] || page)));

  if (page === 'inizio' && !draft) startFlow(!!state.profile);
  const views = { benvenuto: viewWelcome, inizio: viewFlow, oggi: viewToday, allenamento: viewTraining, cibo: viewFood, esercizi: viewLibrary, progressi: viewProgress, profilo: viewProfile, valutazione: renderAssessment, partenza: viewStart, racconto: viewStory, perche: viewWhy, palestra: viewGym, giornata: viewDay, ricetta: viewRecipe, coppia: viewCouple };
  $app.innerHTML = (views[page] || viewToday)();
  $app.dataset.page = page;
  if (page === 'inizio') bindFlowInputs();
  if (page === 'valutazione') mountAssessment();
  if (page === 'racconto') bindStory();
  if (page === 'palestra') bindGym();
  if (page === 'coppia') mountCouple();
  countUp($app);
}

window.addEventListener('hashchange', () => {
  closeSheet();
  transition(() => { window.scrollTo(0, 0); route(); });
});

function rerender() {
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
}

const R = (i) => `reveal" style="--i:${i}`; // classe di ingresso sfalsato

// ------------------------------------------------------------------
// Pezzi ricorrenti
// ------------------------------------------------------------------

const COACH_AVA = '<span class="coach-ava" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="var(--accent)"/><circle cx="20" cy="16" r="6.5" fill="#fff"/><path d="M7.5 34c2-6.5 6.8-9.5 12.5-9.5S30.500 27.5 32.500 34" fill="#fff"/></svg></span>';
/** il coach che parla: una frase, in prima persona */
const coach = (text, cls = '') => `<div class="coach ${cls}">${COACH_AVA}<p>${text}</p></div>`;
const backBtn = (href) => (href ? `<a class="icon-btn" href="${href}" aria-label="Indietro">${ICON.prev}</a>` : `<button class="icon-btn" onclick="history.back()" aria-label="Indietro">${ICON.prev}</button>`);
/** intestazione delle schede principali, con l'accesso al profilo */
function hdr(title, kicker = '') {
  const ini = (state.profile?.nome || '').trim().charAt(0).toUpperCase();
  return `<header class="hdr ${R(0)}"><div>${kicker ? `<p class="kicker">${kicker}</p>` : ''}<h1>${title}</h1></div>
    <a class="avatar" href="#/profilo" aria-label="Profilo e impostazioni">${ini || ICON.profile}</a></header>`;
}
/** intestazione delle pagine interne, con il tasto indietro */
const subHdr = (title, back, kicker = '') => `<header class="sub-hdr ${R(0)}">${backBtn(back)}<div>${kicker ? `<p class="kicker">${kicker}</p>` : ''}<h1>${title}</h1></div></header>`;
const tips = (list) => list.map((f) => `<div class="tip"><span class="ti">${f.icon}</span><div><b>${esc(f.title)}</b><p class="small muted">${esc(f.text)}</p></div></div>`).join('');
const LUOGO_LABEL = { palestra: 'In palestra', casa: 'A casa', aperto: 'All’aperto' };
const KIND_LABEL = { forza: 'Forza', cardio: 'Cardio', mobilita: 'Mobilità' };
const sessionIds = (s) => s.blocks.flatMap((b) => b.items.map((i) => i.id));

// ==================================================================
// Benvenuto
// ==================================================================

function viewWelcome() {
  const pics = ['goblet_squat', 'one_arm_dumbbell_row', 'plank', 'dumbbell_lunges'];
  return `
  <section class="welcome">
    <div class="welcome-pics ${R(0)}" aria-hidden="true">${pics.map((f, i) => `<img src="media/ex/${f}_${i % 2 ? 0 : 1}.webp" alt="">`).join('')}</div>
    <div class="brand ${R(1)}"><img src="icons/icon.svg" alt=""> Ritmo</div>
    <h1 class="${R(2)}">Il tuo personal trainer e il tuo nutrizionista, in tasca.</h1>
    <p class="lead ${R(3)}">Prima ti ascolto, poi ti preparo un piano di allenamento e un menu fatti solo per te. E ti seguo giorno per giorno.</p>
    <ul class="promises ${R(4)}">
      <li><span>🩺</span>Parto da un’indagine vera: obiettivo, corpo, salute, abitudini.</li>
      <li><span>📸</span>Ogni esercizio con foto reali e spiegazione passo passo.</li>
      <li><span>🥗</span>Menu settimanale con le grammature, sui cibi che mangi.</li>
    </ul>
    <button class="btn primary wide ${R(5)}" data-action="start-flow">Iniziamo</button>
    <button class="link ${R(5)}" data-action="start-story">Preferisco raccontarmi a parole mie</button>
    <p class="disclaimer ${R(6)}">I tuoi dati restano su questo telefono · Non sostituisce il parere del medico</p>
  </section>`;
}

// ==================================================================
// Percorso guidato dal coach
// ==================================================================

const seg = (name, opts, val) => `<div class="seg" data-name="${name}">${opts.map(([v, l]) => `<button type="button" data-value="${v}" class="${String(val) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const chips = (name, opts, vals = []) => `<div class="chips" data-multi="${name}">${opts.map((o) => `<button type="button" data-value="${o.id}" class="${(vals || []).includes(o.id) ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div>`;
const num = (name, label, val, attrs = '') => `<label class="field"><span>${label}</span><input type="number" inputmode="decimal" name="${name}" value="${val ?? ''}" ${attrs}></label>`;
/** scelta singola a schede grandi: [valore, titolo, descrizione] */
const opts = (name, list, val) => `<div class="opts" data-name="${name}">${list.map(([v, l, s]) => `<button type="button" data-value="${v}" class="${String(val) === String(v) ? 'on' : ''}"><b>${esc(l)}</b>${s ? `<small>${esc(s)}</small>` : ''}</button>`).join('')}</div>`;
/** scelta multipla a schede con icona, con un numero massimo */
const multi = (name, list, vals = [], max = 3, layout = '') => `<div class="picks ${layout}" data-multi="${name}" data-max="${max}">${list.map((o) => `<button type="button" data-value="${o.id}" class="${(vals || []).includes(o.id) ? 'on' : ''}"><span class="pi">${o.icon || ''}</span><b>${esc(o.label)}</b></button>`).join('')}</div>`;

const slotTot = (d) => (d.sessioni || []).reduce((a, x) => ({ g: a.g + (x.giorni || 0), m: a.m + (x.giorni || 0) * x.minuti }), { g: 0, m: 0 });
const weekTotalText = (d) => { const t = slotTot(d); return `In tutto: ${t.g} allenamenti e ${t.m} minuti a settimana${t.m < 150 ? '. Le camminate completano il resto.' : '.'}`; };
const slotError = (d) => { const t = slotTot(d); return !t.g ? 'Indica almeno una sessione a settimana.' : t.g > 7 ? `In totale hai ${t.g} giorni: al massimo 7 a settimana.` : null; };
const LUOGHI = [['palestra', 'Palestra'], ['casa', 'Casa'], ['aperto', 'All’aperto']];
function slotEditor(d) {
  const S = d.sessioni || [];
  return `<div class="slots">${S.map((x, i) => `
    <div class="slot">
      <div class="row between"><b>${S.length > 1 ? `Sessione ${i + 1}` : 'Le tue sessioni'}</b>${S.length > 1 ? `<button type="button" class="link small" data-action="slot-del" data-i="${i}">Rimuovi</button>` : ''}</div>
      <div class="seg" data-slot="${i}" data-field="luogo">${LUOGHI.map(([v, l]) => `<button type="button" data-value="${v}" class="${x.luogo === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:12px">Giorni a settimana</p>
      <div class="seg seg-days" data-slot="${i}" data-field="giorni">${[1, 2, 3, 4, 5, 6, 7].map((v) => `<button type="button" data-value="${v}" class="${x.giorni === v ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="row between" style="margin-top:12px"><span class="small muted">Durata di ogni sessione</span><b id="slotmin-${i}">${x.minuti} min</b></div>
      <input type="range" min="10" max="120" step="5" name="slotmin_${i}" value="${x.minuti}" aria-label="Durata">
    </div>`).join('')}</div>
    ${S.length < 3 ? '<button type="button" class="btn soft wide" data-action="slot-add">+ Aggiungi un altro tipo di sessione</button>' : ''}
    <p class="small muted" id="week-total">${weekTotalText(d)}</p>`;
}
/** cosa ho capito dal racconto: ogni riga porta alla domanda corrispondente */
function recap(d) {
  const row = (step, label, value) => (value ? `<button type="button" class="set-row" data-action="flow-jump" data-step="${step}"><span class="grow"><span class="small muted">${label}</span><b>${esc(value)}</b></span>${ICON.next}</button>` : '');
  const pains = Object.entries(d.dolori || {}).filter(([, v]) => v > 0).map(([k, v]) => `${PAIN_REGIONS.find((x) => x.id === k)?.label.toLowerCase()} (${['', 'lieve', 'medio', 'forte'][v]})`);
  const rows = [
    row('base', 'Chi sei', [d.sesso ? (d.sesso === 'F' ? 'Donna' : 'Uomo') : '', d.eta ? `${d.eta} anni` : '', d.altezza ? `${d.altezza} cm` : '', d.peso ? `${fmt(d.peso, 1)} kg` : ''].filter(Boolean).join(' · ')),
    row('sogni', 'Obiettivo', [GOALS.find((g) => g.id === d.obiettivo)?.label, d.pesoObiettivo ? `${d.pesoObiettivo} kg` : '', d.dataObiettivo ? `entro il ${formatDate(d.dataObiettivo)}` : ''].filter(Boolean).join(' · ')),
    row('tempo', 'Allenamenti', (d.sessioni || []).map((x) => `${x.giorni} × ${x.minuti} min ${LUOGO_LABEL[x.luogo].toLowerCase()}`).join(' + ')),
    row('scheda', 'In palestra fai', gymLines(d.schedaPalestra).join(', ')),
    row('giornata', 'La tua giornata', [{ sedentario: 'lavoro da seduto', in_piedi: 'lavoro in piedi', fisico: 'lavoro fisico' }[d.lavoro], d.sonno ? `${d.sonno} ore di sonno` : ''].filter(Boolean).join(' · ')),
    row('dieta', 'A tavola', d.dieta ? DIET_LABEL[d.dieta] : ''),
    row('dolori', 'Salute', [...pains, ...(d.condizioni || []).map((c) => CONDITIONS.find((x) => x.id === c)?.label)].filter(Boolean).join(', ')),
  ].filter(Boolean);
  return `<section class="card">${rows.join('') || '<p class="muted">Non sono riuscito a ricavare molto: nessun problema, te lo chiedo io.</p>'}</section>`;
}
const flowHelpers = {
  esc, seg, chips, num, opts, multi, slotEditor, slotError, recap,
  gymPicker: (d) => `<div class="search">${ICON.search}<input type="text" id="gym-q" placeholder="Cerca esercizio o macchinario" autocomplete="off"></div><div id="gym-picker">${gymPickerHTML(d.schedaPalestra || '')}</div>`,
};

function startFlow(edit, fromStep = null) {
  const old = state.profile || {};
  if (!draft || !draft._story) draft = { ...BOZZA_VUOTA(), ...JSON.parse(JSON.stringify(old)) };
  draft.sessioni = draft.sessioni?.length ? draft.sessioni : (old.giorni ? [{ giorni: old.giorni, minuti: old.minuti, luogo: (old.attrezzi || []).includes('palestra') ? 'palestra' : 'casa' }] : BOZZA_VUOTA().sessioni);
  draft.attrezzi = (draft.attrezzi || []).filter((a) => a !== 'palestra');
  if (draft.zone?.length) draft._zoneScelte = true;
  flowEdit = edit;
  const steps = passiPer(draft);
  flowIdx = fromStep ? Math.max(0, steps.findIndex((s) => s.id === fromStep)) : 0;
}

function viewFlow() {
  const steps = passiPer(draft);
  flowIdx = Math.min(flowIdx, steps.length - 1);
  const s = steps[flowIdx];
  const txt = (v) => (typeof v === 'function' ? v(draft) : v);
  const inSez = steps.filter((x) => x.sez === s.sez);
  const pos = inSez.indexOf(s);
  return `
  <div class="flow-top ${R(0)}">
    <button class="icon-btn" data-action="flow-back" aria-label="Indietro">${ICON.prev}</button>
    <div class="flow-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="${flowIdx + 1}">
      ${SEZIONI.map((_, i) => `<i class="${i < s.sez ? 'done' : i === s.sez ? 'cur' : ''}" style="${i === s.sez ? `--p:${(pos + 1) / inSez.length}` : ''}"></i>`).join('')}
    </div>
    ${flowEdit ? '<button class="link small" data-action="flow-save">Salva ed esci</button>' : `<span class="small muted flow-count">${flowIdx + 1}/${steps.length}</span>`}
  </div>
  <form id="wizard" class="flow" onsubmit="return false" data-step="${s.id}">
    <p class="kicker ${R(1)}">${SEZIONI[s.sez]}</p>
    ${coach(esc(txt(s.coach)), R(1))}
    <div class="${R(2)}"><h1>${esc(txt(s.titolo))}</h1>${s.sotto ? `<p class="muted flow-sub">${esc(s.sotto)}</p>` : ''}</div>
    <div class="flow-body stack ${R(3)}">${s.render(draft, flowHelpers)}</div>
    <p class="error" id="wiz-error" hidden></p>
    <div class="wizard-actions"><button type="button" class="btn primary" data-action="flow-next">${flowIdx === steps.length - 1 ? (flowEdit ? 'Aggiorna il mio piano' : 'Prepara il mio piano') : 'Avanti'}</button></div>
  </form>`;
}

function bindFlowInputs() {
  const form = document.getElementById('wizard');
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'gym-q') { document.getElementById('gym-picker').innerHTML = gymPickerHTML(draft.schedaPalestra || '', el.value); return; }
    if (!el.name) return;
    if (el.name.startsWith('slotmin_')) {
      const i = Number(el.name.slice(8));
      draft.sessioni[i].minuti = Number(el.value);
      const lab = document.getElementById(`slotmin-${i}`); if (lab) lab.textContent = `${el.value} min`;
      updateWeekTotal();
      return;
    }
    if (el.name.startsWith('mis_')) {
      draft.misure = draft.misure || {};
      const k = el.name.slice(4);
      if (el.value === '') delete draft.misure[k]; else draft.misure[k] = Number(el.value);
      return;
    }
    draft[el.name] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
  });
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); flowNext(); } });
}
function updateWeekTotal() {
  const el = document.getElementById('week-total');
  if (el) el.textContent = weekTotalText(draft);
}

function flowGo(i) {
  flowIdx = i;
  transition(() => { route(); window.scrollTo(0, 0); });
}
function flowNext() {
  const steps = passiPer(draft);
  const s = steps[flowIdx];
  const err = s.errore(draft, flowHelpers);
  const box = document.getElementById('wiz-error');
  if (err) { if (box) { box.textContent = err; box.hidden = false; } haptic([10, 30, 10]); return; }
  // le risposte possono aggiungere o togliere domande: riallinea la posizione sul passo attuale
  const after = passiPer(draft);
  const i = after.findIndex((x) => x.id === s.id);
  if (i >= after.length - 1) finishFlow(); else flowGo(i + 1);
}

function finishFlow() {
  const p = { ...draft };
  const wasEdit = flowEdit && !!state.profile;
  ['_edit', '_story', '_skip', '_zoneScelte', 'assumed'].forEach((k) => delete p[k]);
  p.sessioni = (p.sessioni || []).filter((x) => x.giorni > 0);
  const tot = slotTot(p);
  p.giorni = Math.min(7, tot.g);
  p.minuti = Math.round(tot.m / Math.max(1, tot.g));
  p.attrezzi = [...new Set([...(p.attrezzi || []).filter((a) => a !== 'palestra'), ...(p.sessioni.some((x) => x.luogo === 'palestra') ? ['palestra'] : [])])];
  if (p.sogni?.length) p.obiettivo = goalFromSogni(p.sogni).obiettivo || p.obiettivo;
  p.obiettivo = p.obiettivo || 'salute';
  p.dieta = p.dieta || 'onnivora';
  p.alimentazione = p.alimentazione || (p.dolci === 'ogni' || p.bibite === 'ogni' ? 'disordinata' : p.dolci === 'mai' && p.bibite === 'mai' ? 'curata' : 'media');
  p.pesoObiettivo = p.pesoObiettivo === '' ? null : p.pesoObiettivo;
  p.dataObiettivo = p.dataObiettivo || null;
  const old = state.profile;
  const goalChanged = !old || old.obiettivo !== p.obiettivo || old.pesoObiettivo !== p.pesoObiettivo || old.peso !== p.peso;
  state.profile = p;
  if (!wasEdit || goalChanged) { state.planStart = state.planStart && wasEdit && !goalChanged ? state.planStart : today(); state.calorieAdjust = 0; }
  // la pesata di oggi si registra alla creazione del profilo o quando il peso viene cambiato
  if (!wasEdit || old.peso !== p.peso) {
    state.weights = state.weights.filter((w) => w.date !== today());
    state.weights.push({ date: today(), kg: p.peso });
  }
  save();
  draft = null; storyResult = null;
  justFinished = true;
  location.hash = '#/perche';
  setTimeout(() => burst(innerWidth / 2, innerHeight * 0.3), 350);
}

// ==================================================================
// Relazione a parole proprie (alternativa alle domande)
// ==================================================================

const STORY_KEY = 'ritmo.story';
let storyResult = null;
const storyText = () => { try { return localStorage.getItem(STORY_KEY) ?? state.profile?.relazione ?? ''; } catch { return state.profile?.relazione || ''; } };
const storySave = (v) => { try { localStorage.setItem(STORY_KEY, v); } catch { /* */ } };
/** il motore AI attivo ({ provider, key, label }) o null */
const aiKey = () => aiConfig();

/** scelta del motore AI e della chiave (profilo e racconto) */
function aiSettings() {
  const cur = aiProvider();
  const P = PROVIDERS[cur];
  const on = hasAiKey(cur);
  return `
    <div class="seg" style="margin-top:12px">${Object.entries(PROVIDERS).map(([id, x]) => `<button type="button" data-action="ai-provider" data-p="${id}" class="${id === cur ? 'on' : ''}">${x.label}${x.free ? ' · gratis' : ''}</button>`).join('')}</div>
    <p class="small muted" style="margin-top:10px">${cur === 'gemini'
      ? 'Gemini 3.8 Flash di Google ha un piano gratuito: crea la chiave su Google AI Studio con il tuo account Google. Sul piano gratuito Google può usare le richieste per migliorare i suoi prodotti: non scrivere dati che non vuoi condividere.'
      : 'Claude di Anthropic è a pagamento: ogni richiesta costa pochi centesimi sul tuo account. Crea la chiave sulla console di Anthropic.'}
      La chiave resta solo su questo telefono e non finisce nelle copie dei dati.</p>
    ${on ? `<div class="row between" style="margin-top:12px"><span class="chip ok">${P.label} attivo</span><button class="link small" data-action="ai-remove" data-p="${cur}">Rimuovi la chiave</button></div>`
      : `<div class="row" style="margin-top:12px"><input type="password" id="ai-key" placeholder="${P.keyHint}" autocomplete="off"><button type="button" class="btn soft small" data-action="ai-save" data-p="${cur}">Salva</button></div>
      <a class="link small" style="display:inline-block;margin-top:10px" href="${P.keyUrl}" target="_blank" rel="noopener">Crea la chiave ${cur === 'gemini' ? 'gratuita su Google AI Studio' : 'su Anthropic'} →</a>`}`;
}

function viewStory() {
  const text = storyText();
  const cov = coverage(parseNarrative(text));
  const hasKey = aiKey();
  const canDictate = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  return `
  ${subHdr('Raccontami di te', state.profile ? '#/profilo' : '#/benvenuto')}
  <section class="stack-lg">
    ${coach('Scrivi come parleresti a un personal trainer. Leggo quello che mi racconti e ti faccio solo le domande che mancano.', R(1))}
    <div class="qchips ${R(2)}" id="qchips">${qchips(cov)}</div>
    <div class="story-box ${R(3)}">
      <textarea id="story" placeholder="Es. Ho 34 anni, mi alleno 2 volte a settimana in palestra per un’ora, vorrei aggiungere 20 minuti a casa 3-4 giorni a settimana. Lavoro seduto al pc…">${esc(text)}</textarea>
      <div class="row between story-tools">
        ${canDictate ? '<button type="button" class="btn soft small" data-action="story-mic">🎙️ Detta</button>' : '<span class="small muted">Puoi usare la dettatura della tastiera</span>'}
        <span class="small muted" id="story-count">${wordCount(text)} parole</span>
      </div>
    </div>
    <button class="link small ${R(4)}" data-action="story-example">Vedi un esempio</button>
    <details class="card fold ${R(5)}">
      <summary><b>Analisi avanzata con l’AI</b><span class="chip ${hasKey ? 'ok' : ''}">${hasKey ? `${hasKey.label} attivo` : 'Facoltativa'}</span></summary>
      ${hasKey ? `<label class="row small" style="margin-top:10px"><input type="checkbox" id="use-ai" checked> Usa ${hasKey.label} per capire meglio il testo</label>
        <p class="small muted" style="margin-top:6px">Il testo viene inviato a ${hasKey.by} con la tua chiave. Senza connessione uso l’analisi integrata.</p>`
        : `<p class="small muted" style="margin-top:8px">L’analisi integrata funziona offline e riconosce le frasi più comuni. Con l’AI capisco qualsiasi modo di scrivere.</p>${aiSettings()}`}
    </details>
    <div class="wizard-actions"><button class="btn primary" data-action="story-analyze">Continua</button></div>
  </section>`;
}
const wordCount = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const qchips = (cov) => cov.map((q) => `<span class="qchip ${q.ok ? 'ok' : ''}"><i>${q.ok ? '✓' : '○'}</i><span><b>${q.label}${q.optional ? ' <em class="small muted">facoltativa</em>' : ''}</b><small>${q.hint}</small></span></span>`).join('');
let storyTimer = null;
function updateStoryCoverage() {
  const el = document.getElementById('story');
  if (!el) return;
  document.getElementById('qchips').innerHTML = qchips(coverage(parseNarrative(el.value)));
  document.getElementById('story-count').textContent = `${wordCount(el.value)} parole`;
}
function bindStory() {
  const el = document.getElementById('story');
  el.addEventListener('input', () => { storySave(el.value); clearTimeout(storyTimer); storyTimer = setTimeout(updateStoryCoverage, 250); });
}

let recog = null;
function toggleDictation(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  if (recog) { recog.stop(); recog = null; btn.textContent = '🎙️ Detta'; return; }
  recog = new SR();
  recog.lang = 'it-IT'; recog.continuous = true; recog.interimResults = false;
  const el = document.getElementById('story');
  recog.onresult = (ev) => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) el.value = `${el.value.trim()} ${ev.results[i][0].transcript.trim()}.`.trim();
    storySave(el.value); updateStoryCoverage();
  };
  recog.onend = () => { if (recog) { recog = null; btn.textContent = '🎙️ Detta'; } };
  recog.onerror = () => { toast('Dettatura non disponibile'); };
  recog.start();
  btn.textContent = '⏹ Stop';
}

async function analyzeStory(btn) {
  const text = document.getElementById('story').value.trim();
  if (wordCount(text) < 8) { toast('Scrivi qualche frase in più su di te'); return; }
  storySave(text);
  let result = parseNarrative(text);
  const useAI = document.getElementById('use-ai')?.checked && aiKey();
  if (useAI) {
    btn.disabled = true; btn.textContent = `${aiKey().label} sta leggendo…`;
    try { result = mergeAI(result, await analyzeWithAI(text, aiKey())); }
    catch (e) { toast(`Analisi avanzata non riuscita: uso quella integrata (${e?.status === 401 ? 'chiave non valida' : 'errore di rete'})`); }
    btn.disabled = false; btn.textContent = 'Continua';
  }
  storyResult = result;
  // la relazione precompila le risposte: il percorso riparte dalla prima domanda senza risposta
  const old = state.profile || {};
  draft = { ...BOZZA_VUOTA(), ...JSON.parse(JSON.stringify(old)), ...result.profile, relazione: text, _story: true };
  draft.sessioni = result.sessioni?.length ? result.sessioni.map((x) => ({ giorni: x.giorni, minuti: x.minuti, luogo: x.luogo })) : (old.sessioni || BOZZA_VUOTA().sessioni);
  draft.misure = { ...(old.misure || {}), ...(result.profile.misure || {}) };
  if (draft.obiettivo && !draft.sogni?.length) draft.sogni = SOGNI.filter((s) => s.goal === draft.obiettivo).slice(0, 1).map((s) => s.id);
  startFlow(!!state.profile);
  // le domande a cui il racconto ha già risposto si saltano: restano il riepilogo e quello che manca
  draft._skip = passiCoperti(draft, result.found);
  flowIdx = 0;
  location.hash = '#/inizio';
}

// ==================================================================
// Oggi
// ==================================================================

const saluto = () => { const h = new Date().getHours(); return h < 5 ? 'Buonanotte' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'; };

/** la frase del coach per oggi: una sola, legata a quello che sta succedendo */
function coachToday(plan, session, lg, an) {
  const p = state.profile;
  const done = Object.values(state.log).filter((l) => l.done).length;
  if (lg.done) return ['Allenamento fatto. Adesso recupera: bevi, mangia le tue proteine e dormi bene.', 'Ottimo lavoro oggi. È la costanza che cambia il corpo, e tu ci stai lavorando.'][done % 2];
  if (!done && session) return `Oggi cominciamo. ${session.minutes} minuti, ti guido io esercizio per esercizio: tu devi solo premere “Inizia”.`;
  if (!done) return 'Oggi è giorno di recupero. Se hai voglia di partire subito, puoi fare il primo allenamento anche adesso.';
  if (an.streak >= 3 && session) return `${an.streak} allenamenti di fila: stai costruendo un’abitudine. Oggi tocca a ${session.title.toLowerCase()}.`;
  if (an.missed >= 2 && session) return 'Qualche allenamento è saltato, capita. Non devi recuperare tutto: riparti da quello di oggi.';
  if (session) {
    const z = (plan.zones || []).map((x) => ZONE_LABEL[x].toLowerCase());
    return `Oggi ${session.title.toLowerCase()}, ${session.minutes} minuti${z.length && session.kind === 'forza' ? `: c’è lavoro in più per ${z.join(' e ')}` : ''}.`;
  }
  const steps = plan.habits.find((h) => h.key === 'passi');
  return `Oggi si recupera: i muscoli crescono a riposo. Una camminata${steps ? ` verso i tuoi ${steps.target.toLocaleString('it-IT')} passi` : ''} e sei a posto.${p.sonno < 7 ? ' E stasera prova ad andare a letto mezz’ora prima.' : ''}`;
}

/** il prossimo passo utile, uno solo alla volta */
function nextStepCard() {
  const since = daysSinceAssess();
  const miss = domandeMancanti();
  if (miss.length) return `<a class="card step-card ${R(3)}" href="#/inizio" data-action="complete-flow"><span class="step-ico">🩺</span><div><b>Completa la tua indagine</b><p class="small muted">Mi mancano ${miss.length} risposte per rendere allenamento e menu davvero tuoi. Due minuti.</p></div>${ICON.next}</a>`;
  if (since === null) return `<a class="card step-card ${R(3)}" href="#/valutazione"><span class="step-ico">📏</span><div><b>Misuriamo da dove parti</b><p class="small muted">10 minuti di test guidati: uso i tuoi risultati per livelli, serie e traguardi.</p></div>${ICON.next}</a>`;
  if (hasGym() && !state.profile.schedaPalestra?.trim()) return `<a class="card step-card ${R(3)}" href="#/palestra"><span class="step-ico">🏋️</span><div><b>Cosa fai di solito in palestra?</b><p class="small muted">Tocca i tuoi esercizi: ti dico quali tenere, cambiare o aggiungere.</p></div>${ICON.next}</a>`;
  if (since >= 28) return `<a class="card step-card ${R(3)}" href="#/valutazione"><span class="step-ico">📈</span><div><b>È ora di rimisurarci</b><p class="small muted">Sono passate ${Math.floor(since / 7)} settimane: rifai i test per vedere i progressi veri.</p></div>${ICON.next}</a>`;
  return '';
}

function viewToday() {
  const p = state.profile;
  const now = new Date();
  const weekStart = addDays(now, -weekdayIndex(now));
  if (selectedDay === null) selectedDay = weekdayIndex(now);
  const viewDate = addDays(weekStart, selectedDay);
  const iso = toISO(viewDate);
  const isToday = iso === today();
  const week = Math.max(1, Math.floor(daysBetween(fromISO(state.planStart), viewDate) / 7) + 1);
  const plan = getPlan(week);
  const { session, moved, rested, recupero, extra } = sessionFor(plan, iso);
  const lg = state.log[iso] || { done: false, items: [], habits: {} };
  const stops = plan.alerts.filter((a) => a.level === 'stop');
  const lastW = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const needWeigh = !lastW || daysBetween(fromISO(lastW.date), now) >= 7;
  const an = analyzeProgress(state, plan);
  warmDemos(plan.schedule.flatMap((d) => (d.session ? sessionIds(d.session) : [])));

  const movedDone = new Set();
  for (let i = 0; i < 7; i++) {
    const l = state.log[toISO(addDays(weekStart, i))];
    if (l?.done && l.sessionFrom !== undefined && l.sessionFrom !== null && l.sessionFrom >= 0) movedDone.add(l.sessionFrom);
    if (l?.x?.done && l.extra >= 0) movedDone.add(l.extra);
  }
  const strip = WEEKDAYS.map((l, i) => {
    const d = addDays(weekStart, i);
    const di = toISO(d);
    const s = sessionFor(plan, di).session;
    const done = state.log[di]?.done || movedDone.has(i);
    const past = d < fromISO(today()) && fromISO(di) >= fromISO(state.planStart);
    const dot = s ? (done ? 'done' : past ? 'miss' : 'train') : (done ? 'done' : '');
    return `<button data-action="pick-day" data-day="${i}" class="${di === today() ? 'today' : ''} ${i === selectedDay ? 'sel' : ''}" aria-label="${WEEKDAYS_LONG[i]}${s ? ', allenamento' : ', riposo'}${done ? ', fatto' : ''}"><span>${l}</span><b>${d.getDate()}</b><i class="${dot}">${done ? '✓' : ''}</i></button>`;
  }).join('');

  return `
  ${hdr(isToday ? `${saluto()}${p.nome ? `, ${esc(p.nome)}` : ''}` : WEEKDAYS_LONG[selectedDay], `${cap(viewDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))} · settimana ${week}`)}
  <nav class="weekstrip ${R(1)}" aria-label="Settimana">${strip}</nav>
  <div class="stack">
    ${isToday ? coach(esc(coachToday(plan, session, lg, an)), R(2)) : ''}
    ${stops.length ? `<a href="#/perche" class="alert stop ${R(2)}"><span>⚠️</span><span><b>Prima di iniziare:</b> ${esc(stops[0].text)}${stops.length > 1 ? ` (+${stops.length - 1})` : ''}</span></a>` : ''}
    ${isToday ? changedCard() : ''}
    ${session ? sessionCard(session, iso, lg, moved) : restCard(plan, iso, lg, { rested, recupero })}
    ${extra ? sessionCard(extra, iso, lg.x || { done: false, items: [] }, true, 'x') : ''}
    ${isToday && !lg.done ? `<a class="card step-card ${R(3)}" href="#/giornata"><span class="step-ico">🔀</span><div><b>Com’è la tua giornata?</b><p class="small muted">Poco tempo, stanchezza, imprevisti: ti propongo come cambiare la settimana.</p></div>${ICON.next}</a>` : ''}
    ${isToday ? partnerTodayCard(plan, selectedDay) : ''}
    ${isToday ? nextStepCard() : ''}
    ${mealsCard(plan, selectedDay)}
    ${isToday ? habitsCard(plan, iso) : ''}
    ${isToday && needWeigh ? `
      <div class="card ${R(6)}">
        <div class="row between"><h3>Pesata della settimana</h3>${lastW ? `<span class="small muted">l’ultima: ${fmt(lastW.kg, 1)} kg</span>` : ''}</div>
        <p class="small muted">Al mattino, a digiuno. Mi serve per regolare il tuo piano.</p>
        <form class="row" style="margin-top:12px" data-form="weight"><input type="number" name="kg" step="0.1" min="30" max="300" inputmode="decimal" placeholder="kg" required><button class="btn soft">Salva</button></form>
      </div>` : ''}
  </div>`;
}

/** elenco degli esercizi di una sessione, con miniatura */
function exList(s, iso, lg, { check = false, swap = false, which = '' } = {}) {
  const doneItems = new Set(lg?.items || []);
  return s.blocks.map((b, bi) => `
    <div class="block">
      <div class="block-head"><h4>${b.name}</h4><span class="small muted">${b.minutes} min</span></div>
      ${b.note ? `<p class="block-note">${esc(b.note)}</p>` : ''}
      ${b.items.map((it, ii) => {
        const key = `${bi}:${ii}`;
        const on = doneItems.has(key) || lg?.done;
        const pd = it.partnerDose ? `<span class="ex-basis">${esc(state.partner?.nome || 'Partner')}: ${esc(it.partnerDose)}</span>` : '';
        return `<div class="ex ${on ? 'done' : ''}">
          <button class="ex-main" data-action="open-ex" data-id="${it.id}" data-dose="${esc(it.dose)}" ${swap ? 'data-swap="1"' : ''}>
            ${thumbHTML(it.id)}
            <span class="ex-body"><span class="ex-name">${esc(it.name)}</span><span class="ex-dose">${esc(it.dose)}</span>
            ${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ''}${it.basis ? `<span class="ex-basis">${esc(it.basis)}</span>` : ''}${pd}</span>
          </button>
          ${check ? `<button class="check ${on ? 'on' : ''}" data-action="toggle-item" data-key="${key}" data-iso="${iso}" data-which="${which}" aria-label="Fatto">✓</button>` : ''}
        </div>`;
      }).join('')}
    </div>`).join('');
}

function sessionCard(s, iso, lg, moved, which = '') {
  const future = fromISO(iso) > fromISO(today()) || fromISO(iso) < fromISO(state.planStart);
  const ids = sessionIds(s);
  const total = ids.length;
  const nDone = lg.done ? total : (lg.items || []).length;
  const cover = [...new Set(s.blocks.filter((b) => !/Riscaldamento|Defaticamento|Sblocco|Respiro/.test(b.name)).flatMap((b) => b.items.map((i) => i.id)).filter((id) => demoFor(id)))].slice(0, 3);
  let footer = '';
  if (lg.done) {
    footer = `<div class="alert ok"><span>✓</span><span><b>Allenamento completato.</b>${lg.feedback ? ` L’hai trovato ${lg.feedback}.` : ''}</span></div>
      <button class="link small" data-action="undo-done" data-iso="${iso}" data-which="${which}">Annulla</button>`;
  } else if (!future) {
    footer = showFeedback === (which || 'main')
      ? `<p class="fb-q">Com’è andata?</p>
         <div class="feedback">
           <button data-action="done" data-iso="${iso}" data-which="${which}" data-fb="facile"><span>😌</span>Facile</button>
           <button data-action="done" data-iso="${iso}" data-which="${which}" data-fb="giusto"><span>💪</span>Giusto</button>
           <button data-action="done" data-iso="${iso}" data-which="${which}" data-fb="duro"><span>🥵</span>Duro</button>
         </div>`
      : `<button class="link small" data-action="ask-feedback" data-which="${which}">L’ho già fatto per conto mio</button>`;
  }
  return `
  <article class="card session ${lg.done ? 'is-done' : ''} ${R(3)}">
    ${cover.length ? `<div class="session-cover n${cover.length}">${cover.map((id) => `<img src="${demoFor(id).b}" alt="" decoding="async">`).join('')}</div>` : ''}
    <div class="session-body">
      <div class="meta"><span class="chip accent">${KIND_LABEL[s.kind] || 'Allenamento'}</span><span class="chip">${s.minutes} min</span>${s.luogo ? `<span class="chip">${LUOGO_LABEL[s.luogo]}</span>` : ''}</div>
      <h2>${esc(s.title)}</h2>
      <p class="small muted">${which ? 'Seconda sessione di oggi · ' : ''}${total} esercizi${nDone && !lg.done ? ` · ${nDone} già fatti` : ''}${moved && !which ? ' · spostato a oggi' : ''}</p>
      ${s.couple ? `<p class="small couple-note">Esercizi adatti a entrambi. Sotto ogni esercizio trovi anche la dose di ${esc(state.partner?.nome || 'chi si allena con te')}.</p>` : ''}
      ${!future && !lg.done ? `<button class="btn primary wide" data-action="play" data-iso="${iso}" data-which="${which}">${ICON.play} ${nDone ? 'Riprendi l’allenamento' : 'Inizia l’allenamento'}</button>` : ''}
      <details class="fold" ${lg.done || future ? '' : ''}>
        <summary>Guarda gli esercizi</summary>
        ${exList(s, iso, lg, { check: !future, swap: !s.couple && !s.resized, which })}
      </details>
      ${footer}
    </div>
  </article>`;
}

function restCard(plan, iso, lg, { rested = false, recupero = false } = {}) {
  const p = state.profile;
  const d = derive(p);
  const steps = plan.habits.find((h) => h.key === 'passi');
  const mini = buildSession('mobilita', 10, p, d, new Date().getDate(), 1);
  const items = mini.blocks[1].items.slice(0, 4);
  const weekStart = addDays(fromISO(iso), -weekdayIndex(fromISO(iso)));
  const planStart = fromISO(state.planStart);
  let missed = plan.schedule
    .filter((day) => day.session && day.weekday < weekdayIndex(fromISO(iso)))
    .filter((day) => addDays(weekStart, day.weekday) >= planStart)
    .filter((day) => !state.log[toISO(addDays(weekStart, day.weekday))]?.done)
    .filter((day) => ![0, 1, 2, 3, 4, 5, 6].some((i) => { const l = state.log[toISO(addDays(weekStart, i))]; return l?.done && l.sessionFrom === day.weekday; }));
  const isStart = iso === state.planStart;
  if (isStart && !missed.length) missed = plan.schedule.filter((day) => day.session).slice(0, 1);
  const canMove = fromISO(iso) <= fromISO(today()) && fromISO(iso) >= planStart;
  return `
  <article class="card session rest ${R(3)}">
    <div class="session-body">
      <div class="meta"><span class="chip">${recupero ? 'Recupero attivo' : 'Recupero'}</span></div>
      <h2>${recupero ? 'Oggi recupero attivo' : rested ? 'Oggi riposi' : 'Giorno di riposo'}</h2>
      <p class="small muted">${recupero ? 'Una camminata e 15 minuti di mobilità: muoviti senza caricare.' : rested ? 'Hai spostato l’allenamento di oggi: goditi la pausa.' : 'Il corpo si rinforza quando recupera. Muoviti comunque in modo leggero.'}</p>
      <div class="ex"><button class="ex-main" data-action="open-ex" data-id="x_cammino">${thumbHTML('x_cammino')}<span class="ex-body"><span class="ex-name">Una camminata</span><span class="ex-dose">20–30 minuti · ${steps ? steps.target.toLocaleString('it-IT') : '8.000'} passi nella giornata</span></span></button></div>
      <details class="fold" ${recupero ? 'open' : ''}><summary>${recupero ? 'La tua mobilità di oggi' : 'Se vuoi, 5 minuti di allungamento'}</summary>
        ${items.map((it) => `<div class="ex"><button class="ex-main" data-action="open-ex" data-id="${it.id}">${thumbHTML(it.id)}<span class="ex-body"><span class="ex-name">${esc(it.name)}</span><span class="ex-dose">${esc(it.dose)}</span></span></button></div>`).join('')}
      </details>
      ${canMove && missed.length && !lg.done && !rested ? `
        <p class="fb-q">${isStart ? 'Vuoi iniziare subito?' : 'Hai saltato un allenamento?'}</p>
        <p class="small muted">${isStart ? 'Puoi fare oggi il primo:' : 'Puoi recuperarlo oggi:'}</p>
        <div class="chips">${missed.map((m) => `<button data-action="move-session" data-from="${m.weekday}" data-iso="${iso}">${esc(m.session.title)} · ${m.session.minutes} min</button>`).join('')}</div>` : ''}
    </div>
  </article>`;
}

/** i pasti del giorno, in breve */
function mealsCard(plan, wd) {
  const day = currentMenu(plan).days[wd];
  if (!day?.meals.length) return '';
  return `
  <a class="card meals-card ${R(4)}" href="#/cibo" data-action="open-menu" data-day="${wd}">
    <div class="row between"><h3>A tavola</h3><span class="small muted">${fmt(plan.nutrition.kcal)} kcal · ${plan.nutrition.protein} g proteine</span></div>
    ${day.meals.map((m) => `<div class="meal-line"><span class="small muted">${m.label.replace(/ (di metà mattina|del pomeriggio)/, '')}</span><span>${esc(m.name)}</span></div>`).join('')}
    <span class="link small">Vedi le porzioni →</span>
  </a>`;
}

function habitsCard(plan, iso) {
  const h = (state.log[iso] || {}).habits || {};
  const steps = plan.habits.find((x) => x.key === 'passi');
  const list = [
    ['passi', '👟', `${steps.target.toLocaleString('it-IT')} passi`],
    ['acqua', '💧', `${fmt(plan.nutrition.water, 1)} litri d’acqua`],
    ['proteine', '🍳', 'Proteine a ogni pasto'],
    ['sonno', '😴', 'Almeno 7 ore di sonno'],
  ];
  const done = list.filter(([k]) => h[k]).length;
  return `
  <div class="card ${R(5)}">
    <div class="row between"><h3>Le piccole cose di oggi</h3><span class="small ${done === 4 ? 'ok-text' : 'muted'}">${done} di 4</span></div>
    <div class="habits">${list.map(([k, ic, l]) => `<button class="habit ${h[k] ? 'on' : ''}" data-action="habit" data-key="${k}" aria-pressed="${!!h[k]}"><span>${ic}</span>${l}</button>`).join('')}</div>
  </div>`;
}

// ==================================================================
// Allenamento: la settimana e il perché
// ==================================================================

const BLOCK_LABELS = { impatto: 'salti e corsa', supino: 'esercizi sdraiati sulla schiena', prono: 'esercizi a pancia in giù', valsalva: 'carichi massimali', testaGiu: 'posizioni a testa in giù', flessioneCarico: 'flessioni del busto sotto carico' };

function viewTraining() {
  const p = state.profile;
  const plan = getPlan();
  const t = plan.timeline;
  const n = plan.nutrition;
  const find = plan.diagnosi.findings.slice(0, 3);
  const todayWd = weekdayIndex(new Date());
  return `
  ${hdr('Il tuo allenamento', `Settimana ${plan.week} · ${plan.phase.label.toLowerCase()}`)}
  <div class="stack">
    <a class="card why-card ${R(1)}" href="#/perche">
      <div class="row between"><h3>Perché questo piano</h3>${ICON.next}</div>
      ${find.length ? find.map((f) => `<div class="why-line"><span>${f.icon}</span><span>${esc(f.title)}</span></div>`).join('') : `<p class="small muted">${esc(plan.summary?.[0]?.text || '')}</p>`}
      <span class="link small">Leggi l’analisi completa</span>
    </a>
    ${plan.alerts.filter((a) => a.level === 'stop').map((a) => `<div class="alert stop"><span>⚠️</span><span>${esc(a.text)}</span></div>`).join('')}
  </div>

  <div class="section-title"><h2>La tua settimana</h2></div>
  <p class="small muted section-note">${esc(plan.phase.note)}</p>
  <div class="week">
  ${plan.schedule.map((d, i) => (d.session ? `
    <details class="day ${i === todayWd ? 'is-today' : ''} ${R(Math.min(i, 5))}">
      <summary><span class="day-label">${d.label}</span><span class="grow"><b>${esc(d.session.title)}</b><span class="small muted">${d.session.minutes} min · ${sessionIds(d.session).length} esercizi${d.session.luogo ? ` · ${LUOGO_LABEL[d.session.luogo].toLowerCase()}` : ''}</span></span></summary>
      <div class="day-body">${exList(d.session, null, null)}</div>
    </details>` : `<div class="day-rest"><span class="day-label">${d.label}</span><span class="small muted">Riposo · una camminata</span></div>`)).join('')}
  </div>

  ${hasGym() ? `<div class="section-title"><h2>La tua palestra</h2></div>${gymCard()}` : ''}

  ${t.hasWeight ? `<div class="section-title"><h2>Il traguardo</h2></div>
  <section class="card">
    <div class="goal-line"><div><span class="small muted">Oggi</span><b>${fmt(latestWeight(), 1)} kg</b></div><span class="goal-arrow">→</span><div><span class="small muted">${formatDate(t.eta)}</span><b>${fmt(n.target, 1)} kg</b></div></div>
    <p class="small muted">${esc(t.message)}</p>
    ${t.warning ? `<div class="alert attenzione"><span>⏳</span><span>${esc(t.warning)}</span></div>` : ''}
  </section>` : ''}

  <div class="stack" style="margin-top:20px">
    <a class="card step-card" href="#/esercizi"><span class="step-ico">📚</span><div><b>Tutti gli esercizi</b><p class="small muted">${EXERCISES.length} esercizi spiegati passo passo, ${EXERCISES.filter((e) => demoFor(e.id)).length} con foto reali.</p></div>${ICON.next}</a>
    <a class="card step-card" href="#/partenza"><span class="step-ico">📏</span><div><b>Il tuo punto di partenza</b><p class="small muted">Test, composizione corporea e livelli.</p></div>${ICON.next}</a>
  </div>
  <p class="disclaimer">Ritmo dà indicazioni generali e non sostituisce medici, fisioterapisti o nutrizionisti. Se senti dolore, fermati.</p>`;
}

// ==================================================================
// Perché questo piano: cosa ho capito di te
// ==================================================================

function viewWhy() {
  const p = state.profile;
  const plan = getPlan();
  const dg = plan.diagnosi;
  const nuovo = justFinished;
  const sogni = SOGNI.filter((s) => (p.sogni || []).includes(s.id)).map((s) => s.label.toLowerCase());
  return `
  ${nuovo ? `<div class="why-hero ${R(0)}"><p class="kicker">Il tuo piano è pronto</p><h1>Ecco cosa ho capito di te${p.nome ? `, ${esc(p.nome)}` : ''}</h1></div>` : subHdr('Perché questo piano', '#/allenamento')}
  ${coach(esc(sogni.length ? `Vuoi ${sogni.join(', ')}. Ho guardato le tue risposte una per una: qui sotto trovi cosa ho trovato e cosa cambia, per questo, nel tuo piano.` : 'Ho guardato le tue risposte una per una: qui sotto trovi cosa ho trovato e cosa cambia, per questo, nel tuo piano.'), R(1))}

  <div class="stack" style="margin-top:16px">
    ${dg.findings.map((f, i) => `
      <section class="card finding ${R(Math.min(i + 2, 6))}">
        <div class="finding-head"><span class="ti">${f.icon}</span><h3>${esc(f.title)}</h3></div>
        <p class="small muted">${esc(f.text)}</p>
        <p class="finding-effect"><b>Nel tuo piano</b>${esc(f.effect)}</p>
      </section>`).join('')}
    ${plan.alerts.map((a) => `<div class="alert ${a.level}"><span>${a.level === 'stop' ? '⚠️' : 'ℹ️'}</span><span>${esc(a.text)}</span></div>`).join('')}
  </div>

  ${plan.summary?.length ? `<div class="section-title"><h2>Il piano in breve</h2></div><section class="card">${tips(plan.summary)}</section>` : ''}

  <div class="section-title"><h2>Come l’ho adattato a te</h2></div>
  <section class="card">${tips(plan.personal)}</section>
  ${precisionCard()}

  ${nuovo ? `<div class="wizard-actions"><button class="btn primary" data-action="why-go">Vediamo il piano</button></div>` : `
  <details class="card fold" style="margin-top:12px"><summary><b>Parametri tecnici</b></summary>
    <div class="list-row"><span>BMI</span><span>${fmt(plan.derived.bmi, 1)} · ${bmiLabel(plan.derived.bmi)}</span></div>
    <div class="list-row"><span>Livello degli esercizi</span><span>${['', 'Base', 'Intermedio', 'Avanzato'][plan.derived.level]}</span></div>
    <div class="list-row"><span>Frequenza cardiaca massima stimata</span><span>${plan.derived.hrMax} bpm</span></div>
    <div class="list-row"><span>Alta intensità</span><span>${plan.derived.hiitOk ? 'Sì' : 'No, solo moderata'}</span></div>
    ${plan.derived.blocked.length ? `<div class="list-row"><span>Esclusi per te</span><span>${plan.derived.blocked.map((b) => BLOCK_LABELS[b]).join(', ')}</span></div>` : ''}
  </details>`}
  <p class="disclaimer">Le mie sono indicazioni generali: non sostituiscono medico, fisioterapista o nutrizionista.</p>`;
}

// ==================================================================
// Alimentazione
// ==================================================================

/** il menu della settimana: personale o di coppia, con i piatti cambiati dalla persona */
function currentMenu(plan) {
  const n = plan.nutrition;
  const couple = !!(state.coupleMenu && state.partner);
  const menu = couple ? coupleMenu(state.profile, n, state.partner) : n.menu;
  const ws = toISO(addDays(new Date(), -weekdayIndex(new Date())));
  const days = menu.days.map((d, i) => ({
    ...d,
    meals: d.meals.map((m) => {
      const sw = state.mealSwaps?.[`${toISO(addDays(fromISO(ws), i))}|${m.id}`];
      return sw ? { ...m, ...sw, swapped: true, original: m.name, partner: null } : m;
    }),
  }));
  return { ...menu, days, couple };
}

function viewFood() {
  const plan = getPlan();
  const n = plan.nutrition;
  const menu = currentMenu(plan);
  if (menuDay === null) menuDay = weekdayIndex(new Date());
  const day = menu.days[menuDay];
  const pn = state.partner?.nome || 'l’altra persona';
  const diff = n.kcal - n.tdee;
  const modo = n.mode === 'deficit'
    ? `Circa ${fmt(Math.abs(diff), 0)} kcal in meno di quelle che consumi: abbastanza per perdere ${fmt(n.rate, 1)} kg a settimana senza soffrire la fame.`
    : n.mode === 'surplus' ? `Circa ${fmt(Math.abs(diff), 0)} kcal in più di quelle che consumi, per dare ai muscoli il materiale per crescere.`
      : 'Le stesse calorie che consumi: non serve mangiare meno, serve mangiare meglio e con più proteine.';
  const bar = (label, g, kcal, cls) => `<div class="macro"><div class="row between"><span>${label}</span><b>${g} g</b></div><div class="bar ${cls}"><i style="width:${Math.round((kcal / n.kcal) * 100)}%"></i></div></div>`;
  return `
  ${hdr('La tua alimentazione', DIET_LABEL[n.dieta] || 'Onnivora')}
  <div class="stack">
    <section class="card kcal-card ${R(1)}">
      <div class="kcal-num"><b data-count="${n.kcal}">${fmt(n.kcal)}</b><span>kcal al giorno</span></div>
      <p class="small muted">${modo}</p>
      <div class="macros">
        ${bar('Proteine', n.protein, n.protein * 4, 'p')}
        ${bar('Carboidrati', n.carbs, n.carbs * 4, 'c')}
        ${bar('Grassi', n.fat, n.fat * 9, 'f')}
      </div>
      ${state.calorieAdjust ? `<p class="small muted">Include un aggiustamento di ${state.calorieAdjust > 0 ? '+' : ''}${state.calorieAdjust} kcal dai tuoi progressi. <button class="link" data-action="reset-kcal">Azzera</button></p>` : ''}
    </section>
    ${coach('Non devi pesare tutto per sempre: segui le porzioni per due settimane e l’occhio impara da solo.', R(2))}
  </div>

  <div class="section-title"><h2>Il tuo menu</h2></div>
  <nav class="daypick ${R(3)}" aria-label="Giorno">${WEEKDAYS.map((l, i) => `<button data-action="menu-day" data-day="${i}" class="${i === menuDay ? 'on' : ''}">${l}</button>`).join('')}</nav>
  ${state.partner ? `<div class="seg couple-toggle ${R(3)}"><button data-action="couple-menu" data-on="0" class="${menu.couple ? '' : 'on'}">Solo per me</button><button data-action="couple-menu" data-on="1" class="${menu.couple ? 'on' : ''}">Con ${esc(state.partner.nome || 'il partner')}</button></div>` : ''}
  <div class="stack" id="menu-day">
    ${day.meals.map((m) => {
      const other = menu.couple && m.partner ? new Map(m.partner.items.map((i) => [i.food + (i.plus ? '+' : ''), i])) : null;
      return `
      <section class="card meal">
        <div class="row between"><span class="kicker">${m.label}${m.swapped ? ' · scelta da te' : ''}</span><span class="small muted">${fmt(m.kcal)} kcal · ${m.protein} g prot.</span></div>
        <h3>${esc(m.name)}</h3>
        ${m.items.length ? `<ul class="portions ${other ? 'two' : ''}">${other ? `<li class="ph"><span></span><b>Tu</b><b>${esc(pn)}</b></li>` : ''}${m.items.map((i) => `<li class="${i.plus ? 'plus' : ''}"><span>${i.plus ? '+ ' : ''}${esc(i.name)}${i.stima ? ' *' : ''}</span><b>${esc(other ? i.label.replace('porzione abbondante', 'abbondante').replace('una porzione', '1 porzione') : i.label)}</b>${other ? `<b>${esc((other.get(i.food + (i.plus ? '+' : ''))?.label || '–').replace('porzione abbondante', 'abbondante').replace('una porzione', '1 porzione'))}</b>` : ''}</li>`).join('')}${other ? m.partner.items.filter((i) => i.plus && !m.items.some((x) => x.plus && x.food === i.food)).map((i) => `<li class="plus"><span>+ ${esc(i.name)}</span><b>–</b><b>${esc(i.label)}</b></li>`).join('') : ''}</ul>` : ''}
        ${m.passi?.length ? `<details class="fold"><summary>Come si prepara</summary><ol class="steps-list">${m.passi.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>` : ''}
        ${m.fuori ? `<p class="small muted">${esc(m.nota)}</p>` : ''}
        <div class="meal-actions">
          ${m.swapped ? `<button class="link small" data-action="meal-restore" data-day="${menuDay}" data-meal="${m.id}">Torna a ${esc(m.original.toLowerCase())}</button>` : `<a class="link small" href="#/ricetta?day=${menuDay}&meal=${m.id}">🧺 Cucina con quello che hai</a>`}
        </div>
      </section>`;
    }).join('')}
    ${menu.couple ? `<p class="small muted" style="text-align:center">Per ${esc(pn)}: circa ${fmt(Math.round((day.partnerKcal || 0) / 10) * 10)} kcal e ${day.partnerProtein || 0} g di proteine. Il menu rispetta le esigenze di entrambi.</p>` : ''}
    <p class="small muted" style="text-align:center">Totale del giorno: circa ${fmt(Math.round(day.kcal / 10) * 10)} kcal e ${Math.round(day.protein)} g di proteine. Pasta, riso e cereali pesati a crudo; legumi già cotti.${day.meals.some((m) => m.items.some((i) => i.plus)) ? ' Le voci con “+” sono aggiunte che ti portano alle proteine del giorno.' : ''}</p>
  </div>

  ${n.regole.length ? `<div class="section-title"><h2>Le tue regole</h2></div><section class="card">${tips(n.regole)}</section>` : ''}

  <div class="section-title"><h2>Per organizzarti</h2></div>
  <div class="stack">
    <details class="card fold"><summary><b>Lista della spesa della settimana</b></summary>
      ${menu.couple ? '<p class="small muted">Per tutti e due.</p>' : ''}<ul class="portions">${menu.spesa.map((s) => `<li><span>${esc(s.name)}</span><b>${esc(s.qty)}</b></li>`).join('')}</ul>
    </details>
    <details class="card fold"><summary><b>Come ho fatto i conti</b></summary>
      <div class="list-row"><span>Metabolismo a riposo</span><span>${fmt(n.bmr)} kcal</span></div>
      <div class="list-row"><span>Consumo totale stimato</span><span>${fmt(n.tdee)} kcal</span></div>
      <div class="list-row"><span>Acqua</span><span>${fmt(n.water, 1)} litri, mezzo in più quando ti alleni</span></div>
      <div class="list-row"><span>Fibre</span><span>almeno ${n.fiber} g</span></div>
      ${n.notes.map((x) => `<p class="small muted" style="margin-top:8px">${esc(x)}</p>`).join('')}
    </details>
    ${n.dietTips.length ? `<details class="card fold"><summary><b>Integrazioni da valutare</b></summary>${tips(n.dietTips)}<p class="small muted">Per integratori e dosi confrontati con il medico.</p></details>` : ''}
    <a class="card step-card" href="#/inizio" data-action="edit-section" data-step="dieta"><span class="step-ico">✏️</span><div><b>Cambia le tue abitudini a tavola</b><p class="small muted">Tipo di dieta, pasti, cibi che non mangi.</p></div>${ICON.next}</a>
  </div>
  <p class="disclaimer">Menu indicativo per persone sane. Con patologie, gravidanza o allergie fatti seguire da un medico o da un dietista.</p>`;
}

// ==================================================================
// Valutazione e punto di partenza
// ==================================================================

function beginAssessment() {
  const retest = state.assess.length > 0;
  startAssessment({
    profile: state.profile, retest, withMeasures: retest,
    onDone: (entry) => {
      entry.date = today();
      if (!retest) entry.meas = { ...(state.profile.misure || {}), ...entry.meas };
      if (entry.meas.peso) {
        state.weights = state.weights.filter((w) => w.date !== today());
        state.weights.push({ date: today(), kg: entry.meas.peso });
        delete entry.meas.peso;
      }
      state.assess.push(entry);
      save();
      location.hash = '#/partenza';
      setTimeout(() => burst(innerWidth / 2, innerHeight * 0.3), 400);
    },
    onCancel: () => { location.hash = '#/oggi'; },
  });
}

function precisionCard() {
  const pr = precisionNow();
  const top = pr.missing.sort((a, b) => b.gain - a.gain).slice(0, 3);
  return `<section class="card" style="margin-top:12px">
    <div class="row between"><h3>Quanto ti conosco</h3><b class="accent-text">${pr.pct}%</b></div>
    <div class="bar" style="margin-top:8px"><i style="width:${pr.pct}%"></i></div>
    <p class="small muted">Quanto il piano si basa su dati misurati su di te e non su stime.</p>
    ${top.length ? `${top.map((m) => `<div class="list-row"><span>${esc(m.label)}</span><span class="accent-text">+${m.gain}%</span></div>`).join('')}
    <a class="btn soft wide" style="margin-top:12px" href="#/valutazione">${state.assess.length ? 'Completa i test' : 'Fai i test (10 minuti)'}</a>` : ''}
  </section>`;
}

function kpiSection(plan, progress = false) {
  if (!state.assess.length && !state.profile.misure?.vita) return '';
  const base = state.assess.length ? { results: state.assess[0].results, meas: { ...(state.profile.misure || {}), ...(state.assess[0].meas || {}) } } : { results: {}, meas: state.profile.misure || {} };
  const kpis = buildKpis(state.profile, base, plan.nutrition, plan.timeline);
  if (!kpis.length) return '';
  const cur = mergedAssess();
  const w = latestWeight();
  const f = (k, v) => (v === null || v === undefined ? '–' : Number(v).toLocaleString('it-IT', { minimumFractionDigits: k.dec, maximumFractionDigits: k.dec }));
  return `
  <div class="section-title"><h2>${progress ? 'Traguardi misurabili' : 'Traguardi misurabili'}</h2><span class="chip">${kpis.length} indicatori</span></div>
  <section class="card">
    ${kpis.map((k) => {
      const c = metric(k.id, state.profile, cur, w);
      const pg = kpiProgress(k, c);
      const eta = formatDate(toISO(addDays(fromISO(state.planStart), k.weeks * 7)));
      return `<div class="kpi">
        <div class="row between"><b>${k.label}</b><span class="small muted">entro ${eta}</span></div>
        <div class="kpi-vals"><span>${f(k, k.base)}</span><span class="kpi-arrow">→</span><span class="kpi-target">${f(k, k.target)} ${k.unit}</span>${progress && c !== null ? `<span class="kpi-now">oggi ${f(k, c)}</span>` : ''}</div>
        <div class="bar"><i style="width:${Math.max(0, Math.min(100, (pg ?? 0) * 100))}%"></i></div>
        ${k.note ? `<p class="small muted" style="margin-top:4px">${esc(k.note)}</p>` : ''}
      </div>`;
    }).join('')}
  </section>`;
}

function radar(areas, compare) {
  const N = AREAS.length, cx = 150, cy = 140, R0 = 96;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i / N) * Math.PI * 2; return [cx + Math.cos(a) * R0 * v, cy + Math.sin(a) * R0 * v]; };
  const poly = (vals) => vals.map((v, i) => pt(i, Math.max(0.04, (v ?? 0) / 5)).map((x) => x.toFixed(1)).join(',')).join(' ');
  const rings = [0.2, 0.4, 0.6, 0.8, 1].map((r) => `<polygon class="r-grid" points="${AREAS.map((_, i) => pt(i, r).join(',')).join(' ')}"/>`).join('');
  const axes = AREAS.map((_, i) => `<line class="r-grid" x1="${cx}" y1="${cy}" x2="${pt(i, 1)[0]}" y2="${pt(i, 1)[1]}"/>`).join('');
  const labels = AREAS.map((a, i) => {
    const [x, y] = pt(i, 1.2);
    const v = areas[a.id];
    return `<text class="r-lbl" x="${x}" y="${y}" text-anchor="${x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle'}">${a.short}</text><text class="r-val" x="${x}" y="${y + 12}" text-anchor="${x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle'}">${v === null ? 'da testare' : LEVEL_LABEL[Math.round(v)].toUpperCase()}</text>`;
  }).join('');
  const vals = AREAS.map((a) => areas[a.id]);
  return `<svg class="radar" viewBox="0 0 300 290" role="img" aria-label="Profilo delle capacità">
    ${rings}${axes}
    ${compare ? `<polygon class="r-old" points="${poly(AREAS.map((a) => compare[a.id]))}"/>` : ''}
    <polygon class="r-val-poly" points="${poly(vals)}"/>
    ${vals.map((v, i) => (v === null ? '' : `<circle class="r-dot" cx="${pt(i, v / 5)[0]}" cy="${pt(i, v / 5)[1]}" r="3.5"/>`)).join('')}
    ${labels}
  </svg>`;
}

function viewStart() {
  const p = state.profile;
  const plan = getPlan();
  const cp = plan.profile;
  const first = state.assess.length > 1 ? computeProfile(p, { results: state.assess[0].results, meas: { ...(p.misure || {}), ...state.assess[0].meas } }) : null;
  const b = cp.body;
  const TEST_ORDER = ['pushup', 'hang', 'chair', 'plank', 'cardioSelf', 'step', 'toetouch', 'shoulder', 'ankle', 'squatdeep', 'balance'];
  const unit = { pushup: 'rip.', hang: 's', chair: 'alzate', plank: 's', step: 'bpm', ankle: 'cm', balance: 's', cardioSelf: '/5', toetouch: '/5', shoulder: '/5', squatdeep: '/5' };
  const lvChip = (l) => `<span class="chip ${l >= 4 ? 'ok' : l === 3 ? '' : 'warn'}">${LEVEL_LABEL[l]}</span>`;
  const summary = [];
  if (cp.strong.length) summary.push(`I tuoi punti di forza: <b>${cp.strong.map((a) => a.label.toLowerCase()).join(' e ')}</b>.`);
  if (cp.weak.length) summary.push(`Da migliorare per primi: <b>${cp.weak.map((a) => a.label.toLowerCase()).join(' e ')}</b>.`);
  return `
  ${subHdr('Il tuo punto di partenza', '#/progressi', state.assess.length ? `Aggiornato al ${formatDate(state.assess[state.assess.length - 1].date)}` : 'Nessun test ancora')}
  <section class="card ${R(1)}">
    ${radar(cp.areas, first?.areas)}
    ${first ? '<div class="legend" style="justify-content:center"><span><i style="background:var(--accent)"></i>Oggi</span><span><i style="background:var(--ink-3)"></i>All’inizio</span></div>' : ''}
    ${summary.length ? `<p style="margin-top:12px">${summary.join(' ')}</p>` : '<p class="muted" style="margin-top:12px">Fai i test per completare il tuo profilo.</p>'}
  </section>
  ${precisionCard()}

  <div class="section-title"><h2>Composizione corporea</h2></div>
  <section class="card ${R(2)}">
    <div class="stats">
      <div class="stat"><b>${b.bf !== null ? fmt(b.bf, 1) : '–'}<small>${b.bf !== null ? '%' : ''}</small></b><span>massa grassa</span></div>
      <div class="stat"><b>${b.leanMass !== null ? fmt(b.leanMass, 1) : '–'}</b><span>kg magri</span></div>
      <div class="stat"><b>${b.whtr ? b.whtr.toLocaleString('it-IT') : '–'}</b><span>vita/altezza</span></div>
    </div>
    <div style="margin-top:10px">
      ${b.bfLabel ? `<div class="list-row"><span>Massa grassa</span><span>${b.bfLabel} · ${fmt(b.fatMass, 1)} kg</span></div>` : `<div class="list-row"><span>Massa grassa</span><span>servono vita e collo${p.sesso === 'F' ? ' e fianchi' : ''}</span></div>`}
      ${b.whtrLabel ? `<div class="list-row"><span>Grasso addominale</span><span>${b.whtrLabel}</span></div>` : ''}
      <div class="list-row"><span>BMI</span><span>${fmt(b.bmi, 1)} · ${bmiLabel(b.bmi)}</span></div>
      ${b.hrRest ? `<div class="list-row"><span>Battiti a riposo</span><span>${b.hrRest} bpm · ${['', 'alti', 'da migliorare', 'nella media', 'buoni', 'ottimi'][b.hrLevel]}</span></div>` : ''}
      ${b.pas ? `<div class="list-row"><span>Pressione</span><span>${b.pas}/${b.pad ?? '–'} mmHg</span></div>` : ''}
    </div>
  </section>

  <div class="section-title"><h2>Risultati dei test</h2></div>
  <section class="card ${R(3)}">
    ${TEST_ORDER.filter((id) => cp.tests[id]).map((id) => {
      const t = cp.tests[id];
      const T = TEST_BY_ID[id];
      const old = first?.tests[id];
      return `<div class="test-row">
        <div class="grow"><b>${T.title}</b><p class="small muted">${t.value} ${unit[id] || ''}${t.variant ? ' · ' + t.variant : ''}${old && old.value !== t.value ? ` · prima ${old.value}` : ''}</p>
        <div class="lvl-dots">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= t.level ? 'on' : ''}"></i>`).join('')}</div></div>
        ${lvChip(t.level)}
      </div>`;
    }).join('') || '<p class="muted">Ancora nessun test.</p>'}
    <a class="btn primary wide" style="margin-top:14px" href="#/valutazione">${state.assess.length ? 'Rifai o completa i test' : 'Inizia i test'}</a>
  </section>
  ${kpiSection(plan)}
  <p class="disclaimer">I valori di riferimento sono indicativi (ACSM, YMCA, Senior Fitness Test, formula U.S. Navy) e servono a orientare il piano, non a fare diagnosi.</p>`;
}

function bmiLabel(b) {
  if (b < 18.5) return 'sottopeso';
  if (b < 25) return 'normopeso';
  if (b < 30) return 'sovrappeso';
  return 'obesità';
}

// ==================================================================
// La tua scheda di palestra: cosa tenere, cambiare, togliere, aggiungere
// ==================================================================

const GYM_PLACEHOLDER = 'Un esercizio per riga, anche con serie e carichi:\nPanca piana 4x8 60 kg\nLat machine 3x10\nLeg press';
const VERDICT_CLASS = { tieni: 'ok', cautela: '', cambia: 'warn', riduci: '', togli: 'warn', sconosciuto: '' };

function gymAnalysisHTML(text) {
  const r = gymReview(text);
  if (!r) return '<p class="small muted">Scegli i tuoi esercizi: l’analisi compare qui mentre li aggiungi.</p>';
  const ex = (id, name) => (id ? `<button type="button" class="link" data-action="open-ex" data-id="${id}">${esc(name)}</button>` : esc(name));
  const counts = r.items.reduce((a, x) => { a[x.verdict] = (a[x.verdict] || 0) + 1; return a; }, {});
  return `
    <div class="row between"><b>Analisi della tua scheda</b><span class="chip ${r.coverage >= 80 ? 'ok' : r.coverage >= 50 ? '' : 'warn'}">Copertura ${r.coverage}%</span></div>
    <p class="small muted" style="margin-top:6px">${Object.entries(counts).map(([k, n]) => `${n} ${VERDICT_COUNT[k]}`).join(' · ')}${r.add.length ? ` · ${r.add.length} da aggiungere` : ''}</p>
    <div class="gym-list">${r.items.map((x) => `
      <div class="gym-item v-${x.verdict}">
        <div class="row between"><b>${x.entry?.id ? ex(x.entry.id, x.name) : esc(x.name)}</b><span class="chip ${VERDICT_CLASS[x.verdict]}">${VERDICT_LABEL[x.verdict]}</span></div>
        ${x.sets || x.kg ? `<p class="small muted">${x.sets ? `${x.sets}×${x.reps}` : ''}${x.kg ? ` · ${fmt(x.kg, x.kg % 1 ? 1 : 0)} kg` : ''}</p>` : ''}
        ${x.reason ? `<p class="small muted" style="margin-top:4px">${esc(x.reason)}</p>` : x.verdict === 'tieni' ? `<p class="small muted" style="margin-top:4px">Va bene per il tuo obiettivo${x.entry?.mus ? ` (${esc(x.entry.mus)})` : ''}.</p>` : ''}
        ${x.alt ? `<p class="small" style="margin-top:6px">→ Al suo posto: ${ex(x.alt.id, x.alt.name)}</p>` : ''}
      </div>`).join('')}
    </div>
    ${r.add.length ? `<h3 style="margin-top:18px">Da aggiungere</h3>
      <div class="gym-list">${r.add.map((a) => `<div class="gym-item v-add"><div class="row between"><b>${ex(a.id, a.name)}</b><span class="chip ok">Aggiungi</span></div><p class="small muted" style="margin-top:4px">${esc(a.reason)}</p></div>`).join('')}</div>` : ''}
    ${r.notes.length ? `<div class="stack" style="margin-top:14px">${r.notes.map((n) => `<div class="alert info"><span>ℹ︎</span><span>${esc(n)}</span></div>`).join('')}</div>` : ''}
    <p class="small muted" style="margin-top:14px">Gli esercizi da tenere entrano nelle tue sessioni in palestra con l’etichetta “Dalla tua scheda”; quelli da cambiare vengono sostituiti dall’alternativa.</p>`;
}

function viewGym() {
  const text = state.profile.schedaPalestra || '';
  return `
  ${subHdr('Cosa fai in palestra?', '#/allenamento')}
  <section class="stack-lg">
    ${coach('Tocca gli esercizi e i macchinari che usi di solito. Li confronto con il tuo obiettivo, la tua salute e i tuoi test.', R(1))}
    <div class="search ${R(2)}">${ICON.search}<input type="text" id="gym-q" placeholder="Cerca esercizio o macchinario" autocomplete="off"></div>
    <div id="gym-picker" class="${R(2)}">${gymPickerHTML(text)}</div>
    <div class="${R(3)}">
      <div class="row between"><b>La tua lista</b><span class="small muted" id="gym-count">${gymLines(text).length} esercizi</span></div>
      <p class="small muted">Se vuoi, aggiungi serie e carichi (es. “Panca piana 4x8 60 kg”) o esercizi che non trovi nell’elenco.</p>
      <div class="story-box" style="margin-top:8px"><textarea id="gym-text" placeholder="${esc(GYM_PLACEHOLDER)}">${esc(text)}</textarea></div>
    </div>
    <section class="card ${R(3)}" id="gym-out">${gymAnalysisHTML(text)}</section>
    <div class="wizard-actions"><button class="btn primary" data-action="gym-done">Aggiorna il mio piano</button></div>
  </section>`;
}
const gymLines = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
function gymPickerHTML(text, q = '') {
  const lines = gymLines(text);
  const qq = q.trim().toLowerCase();
  const groups = GYM_PICKS.map((g) => ({ ...g, items: g.items.filter((it) => !qq || it.name.toLowerCase().includes(qq) || g.label.toLowerCase().includes(qq)) })).filter((g) => g.items.length);
  if (!groups.length) return '<p class="small muted">Nessun esercizio trovato: scrivilo nella tua lista qui sotto.</p>';
  return groups.map((g) => {
    const n = g.items.filter((it) => lines.some((l) => lineIsPick(l, it.name))).length;
    return `<details class="pick-group" data-g="${g.id}" ${qq || n || g.id === 'gambe' ? 'open' : ''}>
      <summary><span>${g.icon} ${g.label}</span>${n ? `<span class="chip ok">${n}</span>` : ''}</summary>
      <div class="pick-grid">${g.items.map((it) => `<button type="button" data-action="gym-pick" data-name="${esc(it.name)}" class="${lines.some((l) => lineIsPick(l, it.name)) ? 'on' : ''}" aria-pressed="${lines.some((l) => lineIsPick(l, it.name))}"><span>${lines.some((l) => lineIsPick(l, it.name)) ? '✓ ' : ''}${esc(it.name)}</span>${it.machine ? '<small>macchina</small>' : ''}</button>`).join('')}</div>
    </details>`;
  }).join('');
}
function gymRefresh(text) {
  state.profile.schedaPalestra = text; save();
  document.getElementById('gym-out').innerHTML = gymAnalysisHTML(text);
  document.getElementById('gym-count').textContent = `${gymLines(text).length} esercizi`;
  gymPickerRedraw(text);
}
function gymPickerRedraw(text) {
  const box = document.getElementById('gym-picker');
  const open = new Set([...box.querySelectorAll('details[open]')].map((d) => d.dataset.g));
  box.innerHTML = gymPickerHTML(text, document.getElementById('gym-q')?.value || '');
  box.querySelectorAll('details').forEach((d) => { if (open.has(d.dataset.g)) d.open = true; });
}
function toggleGymPick(name) {
  const toggle = (text) => {
    const lines = gymLines(text);
    return (lines.some((l) => lineIsPick(l, name)) ? lines.filter((l) => !lineIsPick(l, name)) : [...lines, name]).join('\n');
  };
  haptic(8);
  // nel percorso guidato la lista vive nella bozza; nella pagina dedicata nel profilo
  if (draft && $app.dataset.page === 'inizio') { draft.schedaPalestra = toggle(draft.schedaPalestra || ''); gymPickerRedraw(draft.schedaPalestra); return; }
  const el = document.getElementById('gym-text');
  el.value = toggle(el.value);
  gymRefresh(el.value);
}
let gymTimer = null;
function bindGym() {
  const el = document.getElementById('gym-text');
  el.addEventListener('input', () => { clearTimeout(gymTimer); gymTimer = setTimeout(() => gymRefresh(el.value), 300); });
  const q = document.getElementById('gym-q');
  q.addEventListener('input', () => { document.getElementById('gym-picker').innerHTML = gymPickerHTML(el.value, q.value); });
}
function gymCard() {
  if (!hasGym()) return '';
  const r = gymReview();
  if (!r) return `<a class="card step-card" href="#/palestra"><span class="step-ico">🏋️</span><div><b>Cosa fai di solito in palestra?</b><p class="small muted">Tocca i tuoi esercizi: ti dico quali tenere, cambiare o aggiungere.</p></div>${ICON.next}</a>`;
  const change = r.items.filter((x) => ['cambia', 'togli', 'riduci'].includes(x.verdict)).length;
  return `<a class="card step-card" href="#/palestra"><span class="step-ico">🏋️</span><div><b>La tua scheda di palestra</b><p class="small muted">${r.keep.length} esercizi nel piano${change ? ` · ${change} da rivedere` : ''}${r.add.length ? ` · ${r.add.length} da aggiungere` : ''}</p></div>${ICON.next}</a>`;
}

// ==================================================================
// Tutti gli esercizi
// ==================================================================

const LIB_FILTERS = [['perte', 'Adatti a te'], ['tutti', 'Tutti'], ['strength', 'Forza'], ['cardio', 'Cardio'], ['mobility', 'Mobilità'], ['warmup', 'Riscaldamento']];
const CAT_LABEL = { warmup: 'Riscaldamento', strength: 'Forza', cardio: 'Cardio', mobility: 'Mobilità', balance: 'Equilibrio' };

function viewLibrary() {
  const ok = new Set(allowedExercises(state.profile, planCtx()).map((e) => e.id));
  return `
  ${subHdr('Tutti gli esercizi', '#/allenamento', `${EXERCISES.length} esercizi · ${ok.size} adatti a te`)}
  <div class="search ${R(1)}">${ICON.search}<input type="text" id="lib-q" placeholder="Cerca esercizio o muscolo" value="${esc(libQuery)}" autocomplete="off"></div>
  <div class="filters ${R(2)}">${LIB_FILTERS.map(([id, l]) => `<button data-action="lib-filter" data-f="${id}" class="${libFilter === id ? 'on' : ''}">${l}</button>`).join('')}</div>
  <div class="lib-grid" id="lib-grid">${libCards(ok)}</div>`;
}

function libCards(ok = new Set(allowedExercises(state.profile, planCtx()).map((e) => e.id))) {
  const q = libQuery.trim().toLowerCase();
  const list = EXERCISES.filter((e) => {
    if (libFilter === 'perte' && !ok.has(e.id)) return false;
    if (!['tutti', 'perte'].includes(libFilter) && e.cat !== libFilter) return false;
    if (!q) return true;
    const g = guideFor(e.id);
    return e.n.toLowerCase().includes(q) || g?.mm.some((m) => MUSCLE_LABELS[m].toLowerCase().includes(q));
  });
  if (!list.length) return '<p class="muted">Nessun esercizio trovato.</p>';
  return list.map((e) => {
    const g = guideFor(e.id);
    const yes = ok.has(e.id);
    const d = demoFor(e.id);
    return `<button class="lib-card ${yes ? '' : 'locked'}" data-action="open-ex" data-id="${e.id}">
      <span class="lib-pic">${d ? `<img src="${d.b}" alt="" loading="lazy" decoding="async">` : '<span>🎬</span>'}</span>
      <b>${esc(e.n)}</b>
      <span class="small muted">${g ? g.mm.slice(0, 2).map((m) => MUSCLE_LABELS[m]).join(' · ') : CAT_LABEL[e.cat]}${yes ? '' : ' · non adatto a te ora'}</span>
    </button>`;
  }).join('');
}

// ==================================================================
// Progressi
// ==================================================================

function viewProgress() {
  const p = state.profile;
  const plan = getPlan();
  const an = analyzeProgress(state, plan);
  const totalDone = Object.values(state.log).filter((l) => l.done).length;
  const weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = weights[weights.length - 1];
  const diff = last ? last.kg - p.peso : 0;
  const sugg = suggestions(an);
  return `
  ${hdr('I tuoi progressi', `Dal ${formatDate(state.planStart)}`)}
  <div class="stats ${R(1)}">
    <div class="stat"><b data-count="${totalDone}">${totalDone}</b><span>allenamenti</span></div>
    <div class="stat"><b data-count="${an.streak}">${an.streak}</b><span>di fila</span></div>
    <div class="stat"><b>${an.adherence ?? '–'}${an.adherence !== null ? '<small>%</small>' : ''}</b><span>costanza</span></div>
  </div>

  <div class="stack" style="margin-top:14px">
    ${sugg.length ? sugg.map((s, i) => `
      <div class="coach-card ${R(i + 2)}">${coach(esc(s.text))}
        ${s.action ? `<button class="btn soft small" data-action="apply" data-i="${i}">${esc(s.action.label)}</button>` : ''}
      </div>`).join('') : coach(totalDone ? 'Stai andando bene. Continua così: tra qualche settimana rifacciamo i test e vediamo i numeri.' : 'Qui vedrai i tuoi progressi. Il primo allenamento è il più importante: fallo oggi.', R(2))}
  </div>

  ${kpiSection(plan, true)}

  <div class="section-title"><h2>Peso</h2>${last ? `<span class="small muted">${fmt(last.kg, 1)} kg · ${diff > 0 ? '+' : ''}${fmt(diff, 1)}</span>` : ''}</div>
  <section class="card ${R(3)}">
    ${weightChart(weights, plan)}
    <form class="row" style="margin-top:14px" data-form="weight">
      <input type="number" name="kg" step="0.1" min="30" max="300" inputmode="decimal" placeholder="Peso di oggi (kg)" required>
      <button class="btn soft">Aggiungi</button>
    </form>
  </section>

  <div class="stack" style="margin-top:20px">
    <a class="card step-card" href="#/partenza"><span class="step-ico">📏</span><div><b>Il tuo punto di partenza</b><p class="small muted">${state.assess.length ? `${state.assess.length} ${state.assess.length === 1 ? 'valutazione' : 'valutazioni'} · test, composizione corporea, livelli` : 'Non hai ancora fatto i test.'}</p></div>${ICON.next}</a>
    <a class="card step-card" href="#/valutazione"><span class="step-ico">⏱️</span><div><b>${state.assess.length ? 'Rifai i test' : 'Fai i test iniziali'}</b><p class="small muted">10 minuti guidati, a casa, senza attrezzi.</p></div>${ICON.next}</a>
  </div>

  <div class="section-title"><h2>Gli ultimi allenamenti</h2></div>
  <section class="card ${R(4)}">${historyList(plan)}</section>`;
}

function suggestions(an) {
  const p = state.profile;
  const weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = weights[weights.length - 1];
  const out = [...an.suggestions];
  if (last && Math.abs(last.kg - p.peso) >= 2 && daysBetween(fromISO(state.planStart), new Date()) >= 14) {
    out.push({ text: `Il tuo peso è cambiato di ${fmt(Math.abs(last.kg - p.peso), 1)} kg dall’inizio del piano. Ricalcola calorie e tempi sul peso attuale.`, action: { type: 'repeso', label: 'Ricalcola dal peso attuale' } });
  }
  return out;
}

function weightChart(weights, plan) {
  if (weights.length < 1) return '<p class="muted">Nessuna pesata ancora.</p>';
  const p = state.profile;
  const n = plan.nutrition;
  const W = 320, H = 170, L = 30, Rr = 8, T = 12, B = 22;
  const start = fromISO(state.planStart);
  const first = fromISO(weights[0].date) < start ? fromISO(weights[0].date) : start;
  const lastDate = fromISO(weights[weights.length - 1].date);
  const end = addDays(new Date(Math.max(lastDate, new Date())), 21);
  const span = Math.max(7, daysBetween(first, end));
  const proj = [];
  if (n.rate && n.target) for (let i = 0; i <= span; i += 7) { const dt = toISO(addDays(first, i)); if (fromISO(dt) >= start) proj.push({ d: dt, kg: expectedWeight(p, n, state.planStart, dt) }); }
  const all = [...weights.map((w) => w.kg), ...proj.map((x) => x.kg), ...(n.target ? [n.target] : [])];
  let lo = Math.floor(Math.min(...all) - 1), hi = Math.ceil(Math.max(...all) + 1);
  if (hi - lo < 4) { lo -= 2; hi += 2; }
  const x = (iso) => L + (daysBetween(first, fromISO(iso)) / span) * (W - L - Rr);
  const y = (kg) => T + ((hi - kg) / (hi - lo)) * (H - T - B);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const path = weights.map((w, i) => `${i ? 'L' : 'M'}${x(w.date).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ');
  const area = weights.length > 1 ? `${path} L${x(weights[weights.length - 1].date).toFixed(1)},${H - B} L${x(weights[0].date).toFixed(1)},${H - B} Z` : '';
  const pPath = proj.map((q, i) => `${i ? 'L' : 'M'}${x(q.d).toFixed(1)},${y(q.kg).toFixed(1)}`).join(' ');
  return `
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento del peso">
    ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - Rr}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${t}</text>`).join('')}
    <text class="axis" x="${L}" y="${H - 6}">${first.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).toUpperCase()}</text>
    <text class="axis" x="${W - Rr}" y="${H - 6}" text-anchor="end">${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).toUpperCase()}</text>
    ${n.target && n.rate ? `<line class="target" x1="${L}" x2="${W - Rr}" y1="${y(n.target)}" y2="${y(n.target)}"/>` : ''}
    ${pPath ? `<path class="proj" d="${pPath}"/>` : ''}
    ${area ? `<path class="area" d="${area}"/>` : ''}
    <path class="line" d="${path}"/>
    ${weights.map((w) => `<circle class="dot" cx="${x(w.date)}" cy="${y(w.kg)}" r="3.5"><title>${formatDate(w.date)}: ${fmt(w.kg, 1)} kg</title></circle>`).join('')}
  </svg>
  <div class="legend"><span><i style="background:var(--accent)"></i>Peso</span>${pPath ? '<span><i style="background:var(--ink-3)"></i>Previsto</span>' : ''}${n.target && n.rate ? '<span><i style="background:var(--ok)"></i>Obiettivo</span>' : ''}</div>`;
}

function historyList(plan) {
  const done = Object.entries(state.log).filter(([, l]) => l.done).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  if (!done.length) return '<p class="muted">Ancora nessun allenamento completato. Il primo è il più importante.</p>';
  return done.map(([iso, l]) => {
    const wd = l.sessionFrom ?? weekdayIndex(fromISO(iso));
    const s = wd >= 0 ? plan.schedule[wd].session : null;
    const fb = { facile: '😌', giusto: '💪', duro: '🥵' }[l.feedback] || '';
    return `<div class="list-row"><span>${fromISO(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} · ${esc(s ? s.title : 'Allenamento')}</span><span>${fb}</span></div>`;
  }).join('');
}

// ==================================================================
// Profilo
// ==================================================================

let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

function viewProfile() {
  const p = state.profile;
  const goal = GOALS.find((g) => g.id === p.obiettivo);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const sogni = SOGNI.filter((s) => (p.sogni || []).includes(s.id)).map((s) => s.label);
  const sez = [
    ['base', '👤', 'Chi sei', `${p.eta} anni · ${p.altezza} cm · ${fmt(latestWeight(), 1)} kg`],
    ['sogni', '🎯', 'Obiettivo', `${sogni.length ? sogni.join(', ') : goal.label}${(p.zone || []).length ? ` · zone: ${p.zone.map((z) => ZONE_LABEL[z].toLowerCase()).join(', ')}` : ''}`],
    ['vita', '📏', 'Il tuo corpo', p.misure?.vita ? `Girovita ${p.misure.vita} cm` : 'Girovita non ancora misurato'],
    ['condizioni', '🩺', 'Salute e dolori', p.condizioni?.length ? p.condizioni.map((c) => CONDITIONS.find((x) => x.id === c)?.label).join(', ') : 'Nessuna condizione indicata'],
    ['giornata', '🌙', 'La tua vita', `${{ sedentario: 'Lavoro da seduto', in_piedi: 'Lavoro in piedi', fisico: 'Lavoro fisico' }[p.lavoro] || ''} · ${p.sonno} ore di sonno`],
    ['tempo', '🗓️', 'Il tuo tempo', `${p.giorni} allenamenti a settimana · attrezzi: ${['corpo libero', ...(p.attrezzi || []).map((a) => EQUIPMENT.find((e) => e.id === a)?.label.toLowerCase())].join(', ')}`],
    ['dieta', '🥗', 'A tavola', `${DIET_LABEL[p.dieta] || 'Onnivora'}${p.pasti ? ` · ${p.pasti} pasti` : ''}`],
  ];
  return `
  ${subHdr(p.nome ? esc(p.nome) : 'Il tuo profilo', '#/oggi', 'Profilo e impostazioni')}
  <section class="card ${R(1)}">
    ${sez.map(([step, ic, t, v]) => `<a class="set-row" href="#/inizio" data-action="edit-section" data-step="${step}"><span class="ti">${ic}</span><span class="grow"><b>${t}</b><span class="small muted">${esc(v)}</span></span>${ICON.next}</a>`).join('')}
  </section>
  <p class="small muted" style="margin:10px 4px 0">Tocca una voce per cambiarla: il piano si aggiorna da solo.</p>

  <div class="section-title"><h2>Raccontati a parole tue</h2></div>
  <section class="card">
    ${p.relazione ? `<p class="small muted story-quote">“${esc(p.relazione.length > 220 ? p.relazione.slice(0, 220) + '…' : p.relazione)}”</p>` : '<p class="small muted">Se preferisci scrivere invece di rispondere alle domande, posso leggere il tuo racconto.</p>'}
    <a class="btn soft wide" style="margin-top:12px" href="#/racconto">${p.relazione ? 'Aggiorna il racconto' : 'Scrivi il tuo racconto'}</a>
  </section>

  <div class="section-title"><h2>In coppia</h2></div>
  <a class="card step-card" href="#/coppia"><span class="step-ico">💞</span><div><b>${state.partner ? `Collegato con ${esc(state.partner.nome || 'il tuo partner')}` : 'Allenati e mangia in coppia'}</b><p class="small muted">${state.partner ? `Aggiornato al ${formatDate(state.partner.at)}` : 'Menu da cucinare insieme, allenamenti di coppia, sfida della settimana.'}</p></div>${ICON.next}</a>

  <div class="section-title"><h2>Intelligenza artificiale</h2></div>
  <section class="card">
    <p class="small muted">Con l’AI, Ritmo inventa ricette con quello che hai in casa, ti consiglia come cambiare la giornata e capisce il tuo racconto. Senza chiave tutto funziona lo stesso con i calcoli integrati.</p>
    ${aiSettings()}
  </section>

  ${!standalone ? `
  <div class="section-title"><h2>Installa l’app</h2></div>
  <section class="card">
    ${installEvt ? '<p class="muted small">Aggiungi Ritmo alla schermata Home: funziona anche senza connessione.</p><button class="btn soft wide" style="margin-top:12px" data-action="install">Installa</button>'
      : isIOS ? '<p class="muted small">Su iPhone: tocca <b>Condividi</b> in Safari e poi <b>Aggiungi alla schermata Home</b>.</p>'
        : '<p class="muted small">Dal menu del browser scegli <b>Installa app</b> o <b>Aggiungi a schermata Home</b>.</p>'}
  </section>` : ''}

  <div class="section-title"><h2>I tuoi dati</h2></div>
  <section class="card stack">
    <p class="small muted">Tutto è salvato solo su questo telefono. Esporta una copia per non perderla o per cambiare telefono.</p>
    <div class="grid-2">
      <button class="btn soft" data-action="export">Esporta</button>
      <label class="btn soft" style="cursor:pointer">Importa<input type="file" accept="application/json" data-action="import" hidden></label>
    </div>
    ${Object.keys(state.swaps).length || state.excluded.length || Object.keys(state.exAdj).length ? `<button class="btn line wide" data-action="reset-choices">Ripristina gli esercizi sostituiti ed esclusi (${Object.keys(state.swaps).length + state.excluded.length})</button>` : ''}
    <button class="btn line wide" data-action="restart-plan">Ricomincia il piano da oggi</button>
    <button class="btn danger wide" data-action="reset">Cancella tutti i dati</button>
  </section>
  <p class="disclaimer">Ritmo non è un dispositivo medico e non sostituisce il parere di un professionista.<br>Foto degli esercizi: free-exercise-db, pubblico dominio.</p>`;
}

// ==================================================================
// Giornata flessibile
// ==================================================================

const WDL = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
let dayForm = null;    // risposte di oggi
let dayAI = null;      // { loading, pick, error }

/** i 7 giorni della settimana corrente con sessione e registro */
function weekDays(plan) {
  const ws = addDays(new Date(), -weekdayIndex(new Date()));
  return plan.schedule.map((d, i) => { const iso = toISO(addDays(ws, i)); return { weekday: i, iso, session: d.session, log: state.log[iso] }; });
}

function viewDay() {
  const plan = getPlan();
  const ti = weekdayIndex(new Date());
  const { session } = sessionFor(plan, today());
  if (!dayForm || dayForm.date !== today()) dayForm = { date: today(), energia: 'media', sonno: 'ok', tempo: session?.minutes || 30, dolore: false, impegni: [], nota: '' };
  const f = dayForm;
  const opts = dayOptions(weekDays(plan), ti, f);
  const pick = dayAI?.pick && opts.find((o) => o.id === dayAI.pick.scelta);
  const best = pick || opts[0];
  const later = [0, 1, 2, 3, 4, 5, 6].filter((i) => i > ti);
  const tempi = [10, 15, 20, 30, 45, 60, 75, 90];
  return `
  ${subHdr('Com’è la tua giornata?', '#/oggi')}
  ${coach(session ? `Oggi era previsto: <b>${esc(session.title.toLowerCase())}</b>, ${session.minutes} minuti. Dimmi come stai e ti propongo cosa fare.` : 'Oggi era riposo. Se hai energia o se nei prossimi giorni sei pieno di impegni, possiamo riorganizzare la settimana.', R(1))}
  <form id="day-form" class="stack-lg" onsubmit="return false" style="margin-top:16px">
    <div class="field ${R(2)}"><span>Energia</span>${seg('d_energia', [['bassa', 'Scarico'], ['media', 'Normale'], ['alta', 'Carico']], f.energia)}</div>
    <div class="field ${R(2)}"><span>Stanotte hai dormito</span>${seg('d_sonno', [['poco', 'Poco'], ['ok', 'Abbastanza']], f.sonno)}</div>
    <div class="field ${R(3)}"><span>Tempo che hai oggi</span>${seg('d_tempo', tempi.map((m) => [m, `${m}′`]), f.tempo)}</div>
    <div class="field ${R(3)}"><span>Dolori o fastidi nuovi?</span>${seg('d_dolore', [['0', 'No'], ['1', 'Sì']], f.dolore ? '1' : '0')}</div>
    ${later.length ? `<div class="field ${R(4)}"><span>Nei prossimi giorni sei pieno di impegni?</span><div class="chips" data-day-multi="impegni">${later.map((i) => `<button type="button" data-value="${i}" class="${f.impegni.includes(i) ? 'on' : ''}">${WEEKDAYS[i]}</button>`).join('')}</div></div>` : ''}
  </form>

  <div class="section-title"><h2>Cosa ti propongo</h2></div>
  <div class="stack" id="day-opts">
    ${opts.map((o) => `
      <section class="card option ${o === best ? 'best' : ''}">
        ${o === best ? `<span class="chip accent">${pick ? 'Consigliato dal coach AI' : 'Il mio consiglio'}</span>` : ''}
        <h3>${esc(o.title)}</h3>
        <p class="small muted">${esc(o.text)}</p>
        ${o === best && pick ? `<p class="finding-effect"><b>Perché</b>${esc(dayAI.pick.perche)}</p><p class="small" style="margin-top:8px">💡 ${esc(dayAI.pick.consiglio)}</p>` : ''}
        ${o.apply.length ? `<button class="btn ${o === best ? 'primary' : 'soft'} wide" style="margin-top:12px" data-action="day-apply" data-id="${o.id}">Scelgo questa</button>` : `<a class="btn ${o === best ? 'primary' : 'soft'} wide" style="margin-top:12px" href="#/oggi">Va bene così</a>`}
      </section>`).join('')}
  </div>

  <div class="section-title"><h2>Chiedi al coach AI</h2></div>
  <section class="card">
    <p class="small muted">Raccontami la tua giornata con parole tue: l’AI sceglie tra queste opzioni e ti spiega perché.</p>
    <textarea id="day-note" style="margin-top:10px" placeholder="Es. stasera ho una cena fuori e domani mi alzo presto">${esc(f.nota)}</textarea>
    ${aiKey() ? `<button class="btn soft wide" style="margin-top:10px" data-action="day-ai" ${dayAI?.loading ? 'disabled' : ''}>${dayAI?.loading ? 'Il coach sta pensando…' : '✨ Chiedi al coach AI'}</button>` : '<a class="btn soft wide" style="margin-top:10px" href="#/profilo">Attiva l’AI nel profilo</a>'}
    ${dayAI?.error ? `<p class="error" style="margin-top:10px">${esc(dayAI.error)}</p>` : ''}
  </section>`;
}

async function askDayAI(btn) {
  const plan = getPlan();
  const ti = weekdayIndex(new Date());
  dayForm.nota = document.getElementById('day-note')?.value || '';
  const opts = dayOptions(weekDays(plan), ti, dayForm);
  if (!opts.length) return;
  dayAI = { loading: true };
  rerender();
  const settimana = weekDays(plan).map((d) => {
    const sf = sessionFor(plan, d.iso);
    const s = sf.session;
    return `${WDL[d.weekday]}${d.weekday === ti ? ' (oggi)' : ''}: ${s ? `${s.title}, ${s.minutes} min${s.luogo ? `, ${LUOGO_LABEL[s.luogo].toLowerCase()}` : ''}` : 'riposo'}${sf.extra ? ` + ${sf.extra.title}` : ''}${d.log?.done ? ' (fatto)' : ''}`;
  });
  try {
    const r = await aiGiornata(aiKey(), { opzioni: opts, settimana, risposte: { ...dayForm, impegni: dayForm.impegni.map((i) => WDL[i]) }, nota: dayForm.nota, obiettivo: GOALS.find((g) => g.id === state.profile.obiettivo)?.label || '' });
    dayAI = { pick: r };
  } catch (e) { dayAI = { error: `Non sono riuscito a chiedere al coach AI: ${aiError(e)}. Il mio consiglio resta quello in cima.` }; }
  rerender();
}

/** in Oggi: la giornata è stata cambiata, con la possibilità di annullare */
function changedCard() {
  const c = state.lastChange;
  if (!c || c.date !== today()) return '';
  return `<div class="alert info ${R(2)}"><span>🔀</span><span>Hai scelto: <b>${esc(c.title.toLowerCase())}</b>. <button class="link small" data-action="day-undo">Annulla</button></span></div>`;
}

// ==================================================================
// Ricette con quello che hai in casa
// ==================================================================

let recipeState = null; // { key, results, loading, error, altro }

function viewRecipe() {
  const plan = getPlan();
  const menu = currentMenu(plan);
  const di = Number(routeQuery.get('day') ?? weekdayIndex(new Date()));
  const mid = routeQuery.get('meal') || 'pranzo';
  const meal = menu.days[di]?.meals.find((m) => m.id === mid) || menu.days[di]?.meals[0];
  if (!meal) return `${subHdr('Ricette', '#/cibo')}<p class="muted">Pasto non trovato.</p>`;
  const key = `${di}|${meal.id}`;
  if (!recipeState || recipeState.key !== key) recipeState = { key, results: null, altro: '' };
  const have = state.pantry || [];
  const target = { kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat };
  const r = recipeState;
  return `
  ${subHdr('Cucina con quello che hai', '#/cibo', `${meal.label} di ${WDL[di]}`)}
  ${coach(`Al posto di <b>${esc(meal.name.toLowerCase())}</b> ti serve un piatto da circa ${fmt(meal.kcal)} kcal e ${meal.protein} g di proteine. Dimmi cosa hai in casa.`, R(1))}
  <div class="stack" style="margin-top:16px">
    ${DISPENSA.map((g) => `<details class="pick-group" ${g.id === 'proteine' || g.id === 'carboidrati' ? 'open' : ''}>
      <summary><span>${g.label}</span>${g.items.filter((x) => have.includes(x.id)).length ? `<span class="chip ok">${g.items.filter((x) => have.includes(x.id)).length}</span>` : ''}</summary>
      <div class="pick-grid">${g.items.map((x) => `<button type="button" data-action="pantry" data-id="${x.id}" class="${have.includes(x.id) ? 'on' : ''}">${esc(x.label)}</button>`).join('')}</div>
    </details>`).join('')}
    <label class="field"><span>Altro che hai (facoltativo)</span><input type="text" id="pantry-altro" value="${esc(r.altro)}" placeholder="Es. zucchine, funghi, mezzo limone, curry"></label>
    <div class="grid-2">
      <button class="btn soft" data-action="recipe-find">Trova ricette</button>
      ${aiKey() ? `<button class="btn primary" data-action="recipe-ai" ${r.loading ? 'disabled' : ''}>${r.loading ? 'Sto cucinando…' : '✨ Inventa con l’AI'}</button>` : '<a class="btn primary" href="#/profilo">✨ Attiva l’AI</a>'}
    </div>
    ${r.error ? `<p class="error">${esc(r.error)}</p>` : ''}
  </div>
  ${r.results ? `<div class="section-title"><h2>${r.results.length ? 'Le tue ricette' : 'Nessuna ricetta'}</h2></div>
  <div class="stack">
    ${r.results.length ? r.results.map((x, i) => recipeCard(x, i, target)).join('') : '<p class="muted">Con questi ingredienti non riesco a comporre un pasto completo: aggiungi almeno una fonte di proteine.</p>'}
  </div>` : ''}`;
}

function recipeCard(x, i, target) {
  const dk = Math.round(((x.kcal - target.kcal) / target.kcal) * 100);
  const ok = Math.abs(dk) <= 12 && x.protein >= target.protein * 0.85;
  return `<section class="card meal">
    <div class="row between"><span class="kicker">${x.fonte === 'ai' ? '✨ Ricetta dell’AI' : 'Ricetta calcolata'} · ${x.tempo} min</span><span class="chip ${ok ? 'ok' : 'warn'}">${ok ? 'In linea' : dk > 0 ? `+${dk}% kcal` : `${dk}% kcal`}</span></div>
    <h3>${esc(x.name)}</h3>
    <p class="small muted">${fmt(x.kcal)} kcal · ${x.protein} g proteine · ${x.carbs} g carboidrati · ${x.fat} g grassi</p>
    <ul class="portions">${x.items.map((it) => `<li><span>${esc(it.name)}${it.stima ? ' *' : ''}</span><b>${esc(it.label)}</b></li>`).join('')}</ul>
    ${x.items.some((it) => it.stima) ? '<p class="small muted">* valori stimati dall’AI: l’ingrediente non è nella tabella di Ritmo.</p>' : ''}
    ${x.perche ? `<p class="small" style="margin-top:8px">${esc(x.perche)}</p>` : ''}
    <details class="fold"><summary>Come si prepara</summary><ol class="steps-list">${x.passi.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></details>
    <button class="btn primary wide" style="margin-top:12px" data-action="recipe-use" data-i="${i}">Mangio questo</button>
  </section>`;
}

async function findRecipes(ai) {
  const plan = getPlan();
  const menu = currentMenu(plan);
  const [di, mid] = recipeState.key.split('|');
  const meal = menu.days[Number(di)].meals.find((m) => m.id === mid);
  recipeState.altro = document.getElementById('pantry-altro')?.value || '';
  const pasto = mid.startsWith('spuntino') ? 'spuntino' : mid;
  const target = { kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat };
  if (!ai) {
    recipeState.results = pantryRecipes(state.pantry || [], pasto, target, state.profile);
    recipeState.error = null;
    rerender();
    return;
  }
  recipeState.loading = true; recipeState.error = null; rerender();
  try {
    recipeState.results = await aiRicette(aiKey(), { have: state.pantry || [], altro: recipeState.altro, pasto: meal.label.toLowerCase(), target, p: state.profile, dietaLabel: DIET_LABEL[state.profile.dieta] || 'onnivora' });
  } catch (e) {
    recipeState.results = pantryRecipes(state.pantry || [], pasto, target, state.profile);
    recipeState.error = `L’AI non ha risposto (${aiError(e)}): ti mostro le ricette calcolate.`;
  }
  recipeState.loading = false;
  rerender();
}

// ==================================================================
// Coppia
// ==================================================================

let myCode = null;      // codice da condividere (calcolato quando serve)
let incoming = null;    // { card, error } da un link ricevuto

function partnerStats() {
  const plan = getPlan();
  const an = analyzeProgress(state, plan);
  const ws = addDays(new Date(), -weekdayIndex(new Date()));
  let week = 0;
  for (let i = 0; i < 7; i++) { const l = state.log[toISO(addDays(ws, i))]; if (l?.done) week++; if (l?.x?.done) week++; }
  return { done: Object.values(state.log).filter((l) => l.done).length, streak: an.streak, week };
}

function viewCouple() {
  const P = state.partner;
  const code = routeQuery.get('c');
  if (code && (!incoming || incoming.code !== code)) {
    incoming = { code, loading: true };
    decodeCard(code).then((card) => { incoming = { code, card }; rerender(); }).catch(() => { incoming = { code, error: 'Il codice non è valido o è incompleto: fattelo rimandare.' }; rerender(); });
  }
  const inc = code && incoming?.code === code ? incoming : null;
  if (inc && !inc.loading && inc.card && inc.card.id === state.coupleId) return `${subHdr('In coppia', '#/oggi')}${coach('Questo è il tuo codice: mandalo all’altra persona, non aprirlo tu.')}`;
  if (inc && !inc.loading) {
    if (inc.error) return `${subHdr('In coppia', '#/oggi')}<p class="error">${esc(inc.error)}</p>`;
    const c = inc.card;
    return `${subHdr('Collegati', '#/oggi')}
      ${coach(`<b>${esc(c.nome || 'Qualcuno')}</b> ti ha mandato il suo codice: se vi collegate potete cucinare gli stessi piatti con porzioni diverse e allenarvi insieme.`, R(1))}
      <section class="card ${R(2)}" style="margin-top:16px">
        <div class="list-row"><span>Alimentazione</span><span>${esc(DIET_LABEL[c.dieta] || c.dieta)}</span></div>
        <div class="list-row"><span>Allenamenti</span><span>${c.w.length} a settimana</span></div>
        <div class="list-row"><span>Aggiornato al</span><span>${formatDate(c.at)}</span></div>
        <p class="small muted" style="margin-top:10px">Il codice non contiene diagnosi né dolori: solo cosa evitare negli esercizi, il livello e i gusti a tavola.</p>
      </section>
      <div class="wizard-actions"><button class="btn primary" data-action="couple-link">${P && P.id === c.id ? 'Aggiorna i dati' : `Collegati con ${esc(c.nome || 'questa persona')}`}</button></div>`;
  }
  if (!P) {
    return `${subHdr('In coppia', '#/oggi')}
      ${coach('Allenarsi e mangiare con qualcuno aiuta a essere costanti. Vi scambiate un codice e vi collego: niente account, niente server.', R(1))}
      <section class="card ${R(2)}" style="margin-top:16px">
        <h3>1. Manda il tuo codice</h3>
        <p class="small muted">Con un messaggio su WhatsApp, Telegram o email. Chi lo apre sul telefono con Ritmo si collega a te.</p>
        <button class="btn primary wide" style="margin-top:12px" data-action="couple-share">Condividi il mio codice</button>
      </section>
      <section class="card ${R(3)}" style="margin-top:12px">
        <h3>2. Apri il suo</h3>
        <p class="small muted">Tocca il link che ti ha mandato, oppure incollalo qui.</p>
        <div class="row" style="margin-top:10px"><input type="text" id="couple-code" placeholder="Incolla il link o il codice" autocomplete="off"><button class="btn soft small" data-action="couple-paste">Apri</button></div>
      </section>
      <section class="card ${R(4)}" style="margin-top:12px">${tips([
        { icon: '🥗', title: 'Menu di coppia', text: 'Gli stessi piatti per tutti e due, ciascuno con le sue porzioni, una sola lista della spesa. Rispetta dieta e intolleranze di entrambi.' },
        { icon: '🏋️', title: 'Allenamenti insieme', text: 'Ti indico il giorno migliore per allenarvi insieme e preparo una sessione con esercizi adatti a entrambi, ognuno con la sua dose.' },
        { icon: '🏆', title: 'Sfida della settimana', text: 'Chi completa più allenamenti? Ogni volta che vi rimandate il codice, il conteggio si aggiorna.' },
      ])}</section>`;
  }
  const plan = getPlan();
  const tog = weekTogether(plan.schedule, P);
  const ti = weekdayIndex(new Date());
  // il giorno migliore da oggi in avanti; se questa settimana non ce n'è più, la prossima
  let best = bestTogetherDay(tog, ti);
  const nextWeek = !best;
  if (!best) best = bestTogetherDay(tog, 0);
  const ws = addDays(new Date(), -weekdayIndex(new Date()) + (nextWeek ? 7 : 0));
  const me = partnerStats();
  const stale = daysBetween(fromISO(P.at), new Date());
  const coupleSet = (i) => state.log[toISO(addDays(ws, i))]?.couple;
  return `
  ${subHdr(`Tu e ${esc(P.nome || 'il tuo partner')}`, '#/oggi', `Dati aggiornati al ${formatDate(P.at)}`)}
  ${stale >= 7 ? `<div class="alert attenzione ${R(1)}"><span>⏳</span><span>I dati di ${esc(P.nome || 'chi è collegato con te')} hanno più di una settimana: chiedigli di rimandarti il codice.</span></div>` : ''}

  <section class="card ${R(1)}" style="margin-top:12px">
    <h3>Sfida della settimana</h3>
    <div class="vs"><div><b>${me.week}</b><span>Tu</span></div><span class="small muted">allenamenti fatti</span><div><b>${P.s?.week ?? 0}</b><span>${esc(P.nome || 'Partner')}</span></div></div>
    <p class="small muted">${me.week > (P.s?.week ?? 0) ? 'Sei in vantaggio: non mollare.' : me.week < (P.s?.week ?? 0) ? 'Sei indietro: oggi è un buon giorno per recuperare.' : 'Siete pari.'} Il conteggio di ${esc(P.nome || 'chi è collegato con te')} si aggiorna quando ti rimanda il codice.</p>
  </section>

  <div class="section-title"><h2>La vostra settimana</h2></div>
  <section class="card ${R(2)}">
    ${tog.map((d) => `<div class="together ${d.weekday === ti ? 'is-today' : ''}"><span class="day-label">${d.label}</span>
      <span class="grow"><span class="small"><b>Tu</b> ${d.me ? `${esc(d.me.title)} · ${d.me.minutes}′` : 'riposo'}</span><span class="small muted"><b>${esc(P.nome || 'Partner')}</b> ${d.them ? `${esc(d.them.title)} · ${d.them.minutes}′` : 'riposo'}</span></span>
      ${d.me && d.them && coupleSet(d.weekday) ? '<span class="chip ok">Insieme</span>' : ''}</div>`).join('')}
  </section>
  ${best ? `<section class="card ${R(3)}" style="margin-top:12px">
    <h3>Allenatevi insieme ${WDL[best.weekday]}${nextWeek ? ' prossimo' : ''}</h3>
    <p class="small muted">Vi allenate entrambi${best.me.luogo && best.me.luogo === best.them.luogo ? `, tutti e due ${LUOGO_LABEL[best.me.luogo].toLowerCase()}` : ''}. Preparo una sessione da ${best.me.minutes} minuti con esercizi adatti a entrambi, ognuno con la sua dose.</p>
    ${coupleSet(best.weekday) ? `<button class="btn soft wide" style="margin-top:12px" data-action="couple-day" data-day="${best.weekday + (nextWeek ? 7 : 0)}" data-on="0">Torna al mio allenamento</button>` : `<button class="btn primary wide" style="margin-top:12px" data-action="couple-day" data-day="${best.weekday + (nextWeek ? 7 : 0)}" data-on="1">Sì, alleniamoci insieme</button>`}
  </section>` : ''}

  <div class="section-title"><h2>A tavola insieme</h2></div>
  <a class="card step-card ${R(4)}" href="#/cibo" data-action="couple-menu-go"><span class="step-ico">🥗</span><div><b>${state.coupleMenu ? 'Menu di coppia attivo' : 'Attiva il menu di coppia'}</b><p class="small muted">Stessi piatti, porzioni per ciascuno, una lista della spesa. Rispetta ${esc(DIET_LABEL[P.dieta]?.toLowerCase() || P.dieta)} e le esclusioni di entrambi.</p></div>${ICON.next}</a>

  <div class="section-title"><h2>Tenetevi aggiornati</h2></div>
  <section class="card stack">
    <p class="small muted">Quando cambi qualcosa o finisci un allenamento, rimanda il tuo codice: così l’altra persona vede i tuoi progressi.</p>
    <button class="btn primary wide" data-action="couple-share">Manda il mio codice aggiornato</button>
    <button class="btn line wide" data-action="couple-unlink">Scollega</button>
  </section>`;
}

function mountCouple() { /* il codice si crea al momento della condivisione */ }

async function shareMyCode() {
  const plan = getPlan();
  const card = buildCard(state, plan, planCtx(), partnerStats());
  save();
  const code = await encodeCard(card);
  const url = shareUrl(code, `${location.origin}${location.pathname}`);
  myCode = url;
  const text = `${state.profile.nome || 'Ciao'}: alleniamoci e mangiamo insieme con Ritmo. Apri questo link dal telefono:`;
  try {
    if (navigator.share) { await navigator.share({ title: 'Ritmo in coppia', text, url }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Link copiato: incollalo in un messaggio'); } catch { prompt('Copia questo link e mandalo:', url); }
}

/** in Oggi: cosa fa oggi la persona collegata */
function partnerTodayCard(plan, wd) {
  const P = state.partner;
  if (!P) {
    let pending = null; try { pending = localStorage.getItem('ritmo.pendingPartner'); } catch { /* */ }
    return pending ? `<a class="card step-card ${R(4)}" href="#/coppia?c=${pending}"><span class="step-ico">💞</span><div><b>Qualcuno vuole collegarsi a te</b><p class="small muted">Hai aperto un codice di coppia: tocca per collegarti.</p></div>${ICON.next}</a>` : '';
  }
  const them = P.w.find((x) => x[0] === wd);
  const together = state.log[today()]?.couple;
  return `<a class="card step-card ${R(4)}" href="#/coppia"><span class="step-ico">💞</span><div><b>${together ? `Oggi vi allenate insieme` : them ? `Oggi si allena anche ${esc(P.nome || 'il tuo partner')}` : `${esc(P.nome || 'Il tuo partner')} oggi riposa`}</b><p class="small muted">${them ? `${esc(them[4])} · ${them[1]} min` : 'Sfida della settimana, menu e allenamenti di coppia'}</p></div>${ICON.next}</a>`;
}

// ==================================================================
// Azioni
// ==================================================================

function applyAction(a) {
  if (a.type === 'kcal') state.calorieAdjust += a.value;
  if (a.type === 'giorni') state.profile.giorni = a.value;
  if (a.type === 'esperienza') state.profile.esperienza = a.value;
  if (a.type === 'repeso') {
    const last = [...state.weights].sort((x, y) => x.date.localeCompare(y.date)).pop();
    state.profile.peso = last.kg;
    state.planStart = today();
    state.calorieAdjust = 0;
  }
  save();
  toast('Piano aggiornato');
  rerender();
}

function markDone(iso, fb, which = '') {
  const lg = partLog(iso, which);
  lg.done = true; lg.feedback = fb; lg.doneAt = new Date().toISOString();
  showFeedback = false;
  save(); rerender();
  burst(innerWidth / 2, innerHeight * 0.35);
  haptic([20, 40, 20]);
  toast(['Grande lavoro', 'Un passo in più verso l’obiettivo', 'Fatto: la costanza paga'][Math.floor(Math.random() * 3)]);
}

function startPlayer(iso, which = '') {
  const week = Math.max(1, Math.floor(daysBetween(fromISO(state.planStart), fromISO(iso)) / 7) + 1);
  const sf = sessionFor(getPlan(week), iso);
  const session = which === 'x' ? sf.extra : sf.session;
  if (!session) return;
  const lg = partLog(iso, which);
  openPlayer(session, {
    doneKeys: lg.items,
    onItemDone: (key) => { const l = partLog(iso, which); if (!l.items.includes(key)) l.items.push(key); save(); },
    onFinish: (fb) => markDone(iso, fb, which),
    onExFeedback: (exId, fb) => {
      state.fbCount = (state.fbCount || 0) + 1;
      if (fb === 'dolore') {
        if (!state.excluded.includes(exId)) state.excluded.push(exId);
        delete state.exAdj[exId];
      } else {
        const d = { facile: 1, giusto: 0, duro: -1 }[fb];
        state.exAdj[exId] = Math.max(-2, Math.min(2, (state.exAdj[exId] || 0) + d));
        if (!state.exAdj[exId]) delete state.exAdj[exId];
      }
      save();
    },
    onClose: () => rerender(),
  });
}

document.addEventListener('click', (e) => {
  if (location.hash === '#/valutazione' && handleAssessmentClick(e, rerender)) return;
  const t = e.target.closest('[data-action], .seg button, .opts button, .chips[data-multi] button, .picks[data-multi] button');
  if (!t || t.closest('#player') || t.closest('.sheet')) return;

  // giornata flessibile: le risposte aggiornano subito le opzioni
  const dSeg = t.closest('button')?.parentElement?.closest('#day-form .seg[data-name]');
  if (dSeg && dayForm) {
    const k = dSeg.dataset.name.slice(2);
    dayForm[k] = k === 'tempo' ? Number(t.dataset.value) : k === 'dolore' ? t.dataset.value === '1' : t.dataset.value;
    dayAI = null; haptic(8); rerender(); return;
  }
  const dMulti = t.parentElement?.closest('[data-day-multi]');
  if (dMulti && dayForm) {
    const v = Number(t.dataset.value);
    dayForm.impegni = dayForm.impegni.includes(v) ? dayForm.impegni.filter((x) => x !== v) : [...dayForm.impegni, v];
    dayAI = null; haptic(8); rerender(); return;
  }

  const slotSeg = t.parentElement?.closest('.seg[data-slot]');
  if (slotSeg && draft && !t.dataset.action) {
    const i = Number(slotSeg.dataset.slot), f = slotSeg.dataset.field;
    draft.sessioni[i][f] = f === 'giorni' ? Number(t.dataset.value) : t.dataset.value;
    slotSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t));
    updateWeekTotal(); haptic(8);
    return;
  }
  const segEl = t.closest('button')?.parentElement?.closest('.seg[data-name], .opts[data-name]');
  if (segEl && draft && !t.dataset.action) {
    const name = segEl.dataset.name;
    if (name.startsWith('dol_')) { draft.dolori = draft.dolori || {}; draft.dolori[name.slice(4)] = Number(t.dataset.value); }
    else draft[name] = ['sonno', 'pasti'].includes(name) ? Number(t.dataset.value) : t.dataset.value;
    segEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t));
    haptic(8);
    // una sola domanda a scelta singola: si va avanti da soli
    if (segEl.classList.contains('opts') && passiPer(draft)[flowIdx]?.auto) setTimeout(flowNext, 260);
    return;
  }
  const multiEl = t.parentElement?.closest('[data-multi]');
  if (multiEl && draft && !t.dataset.action) {
    const name = multiEl.dataset.multi;
    const max = Number(multiEl.dataset.max) || 99;
    const list = [...(draft[name] || [])];
    const i = list.indexOf(t.dataset.value);
    if (i >= 0) list.splice(i, 1);
    else if (list.length >= max) { toast(`Al massimo ${max}: togline una per cambiarla`); haptic([10, 30, 10]); return; }
    else list.push(t.dataset.value);
    draft[name] = list;
    t.classList.toggle('on', i < 0);
    haptic(8);
    return;
  }

  const a = t.dataset.action;
  switch (a) {
    case 'start-flow': draft = null; startFlow(false); location.hash = '#/inizio'; break;
    case 'start-story': location.hash = '#/racconto'; break;
    case 'complete-flow': {
      e.preventDefault();
      draft = null; startFlow(true);
      const first = domandeMancanti()[0];
      flowIdx = Math.max(0, passiPer(draft).findIndex((s) => s.id === first?.id));
      location.hash = '#/inizio';
      break;
    }
    case 'edit-section': e.preventDefault(); draft = null; startFlow(true, t.dataset.step); if (location.hash === '#/inizio') route(); else location.hash = '#/inizio'; break;
    case 'flow-next': flowNext(); break;
    case 'flow-jump': {
      // dal riepilogo: riapre una domanda che il racconto aveva già coperto
      draft._skip = (draft._skip || []).filter((id) => id !== t.dataset.step);
      flowGo(Math.max(0, passiPer(draft).findIndex((x) => x.id === t.dataset.step)));
      break;
    }
    case 'flow-back':
      if (flowIdx > 0) flowGo(flowIdx - 1);
      else { draft = null; location.hash = state.profile ? '#/profilo' : '#/benvenuto'; }
      break;
    case 'flow-save': {
      const err = passiPer(draft)[flowIdx].errore(draft, flowHelpers);
      if (err) { const box = document.getElementById('wiz-error'); box.textContent = err; box.hidden = false; return; }
      flowEdit = true; finishFlow(); justFinished = false; location.hash = '#/oggi'; toast('Piano aggiornato');
      break;
    }
    case 'why-go': justFinished = false; location.hash = '#/oggi'; break;
    case 'slot-add': draft.sessioni.push({ giorni: 3, minuti: 20, luogo: 'casa' }); rerender(); break;
    case 'slot-del': draft.sessioni.splice(Number(t.dataset.i), 1); rerender(); break;
    case 'story-example': { const el = document.getElementById('story'); el.value = EXAMPLE; storySave(EXAMPLE); updateStoryCoverage(); break; }
    case 'story-mic': toggleDictation(t); break;
    case 'story-analyze': analyzeStory(t); break;
    case 'ai-save': {
      const P = PROVIDERS[t.dataset.p];
      // via spazi, a capo e virgolette che a volte si copiano insieme alla chiave
      const v = document.getElementById('ai-key').value.replace(/[\s"'`]/g, '');
      if (!P.keyRe.test(v)) { toast('La chiave sembra incompleta: copiala di nuovo per intero'); return; }
      setAiKey(t.dataset.p, v); toast(`${P.label} attivo`); rerender();
      break;
    }
    case 'ai-remove': setAiKey(t.dataset.p, null); toast('Chiave rimossa'); rerender(); break;
    case 'ai-provider': setAiProvider(t.dataset.p); rerender(); break;
    case 'pick-day': selectedDay = Number(t.dataset.day); showFeedback = false; rerender(); break;
    case 'open-menu': menuDay = Number(t.dataset.day); break;
    case 'menu-day': menuDay = Number(t.dataset.day); rerender(); break;
    case 'gym-pick': toggleGymPick(t.dataset.name); break;
    case 'gym-done': clearTimeout(gymTimer); { const el = document.getElementById('gym-text'); if (el) { state.profile.schedaPalestra = el.value; save(); } } location.hash = '#/allenamento'; toast('Piano aggiornato con la tua scheda'); break;
    case 'open-ex': {
      const id = t.dataset.id;
      const o = { dose: t.dataset.dose };
      if (t.dataset.swap) {
        o.alternatives = alternativesFor(id, state.profile, planCtx()).map((x) => ({ id: x.id, name: x.n }));
        o.onSwap = (from, to) => {
          const k = Object.keys(state.swaps).find((x) => state.swaps[x] === from);
          if (k) state.swaps[k] = to; else state.swaps[from] = to;
          save(); rerender(); toast('Esercizio sostituito nel tuo piano');
        };
        o.onExclude = (exId) => {
          if (!state.excluded.includes(exId)) state.excluded.push(exId);
          for (const k of Object.keys(state.swaps)) if (state.swaps[k] === exId) delete state.swaps[k];
          save(); rerender(); toast('Escluso: il piano usa un’alternativa');
        };
      }
      openSheet(id, o);
      break;
    }
    case 'reset-choices':
      if (confirm('Annullare tutte le sostituzioni, le esclusioni e gli adattamenti dei singoli esercizi?')) { state.swaps = {}; state.excluded = []; state.exAdj = {}; save(); rerender(); toast('Scelte ripristinate'); }
      break;
    case 'play': startPlayer(t.dataset.iso, t.dataset.which); break;
    case 'day-ai': askDayAI(t); break;
    case 'day-apply': {
      const plan = getPlan();
      const o = dayOptions(weekDays(plan), weekdayIndex(new Date()), dayForm).find((x) => x.id === t.dataset.id);
      if (!o) return;
      if (state.lastChange?.date === today()) undoOption(state.log, state.lastChange.undo);
      state.lastChange = { date: today(), title: o.title, undo: applyOption(state.log, o) };
      save(); dayAI = null; haptic([10, 30, 10]); location.hash = '#/oggi'; toast('Settimana aggiornata');
      break;
    }
    case 'day-undo': undoOption(state.log, state.lastChange?.undo); state.lastChange = null; save(); rerender(); toast('Giornata ripristinata'); break;
    case 'pantry': {
      const set = new Set(state.pantry || []);
      set.has(t.dataset.id) ? set.delete(t.dataset.id) : set.add(t.dataset.id);
      state.pantry = [...set]; save(); haptic(8);
      t.classList.toggle('on');
      break;
    }
    case 'recipe-find': findRecipes(false); break;
    case 'recipe-ai': findRecipes(true); break;
    case 'recipe-use': {
      const x = recipeState?.results?.[Number(t.dataset.i)];
      if (!x) return;
      const [di, mid] = recipeState.key.split('|');
      const ws = addDays(new Date(), -weekdayIndex(new Date()));
      state.mealSwaps = state.mealSwaps || {};
      state.mealSwaps[`${toISO(addDays(ws, Number(di)))}|${mid}`] = { name: x.name, items: x.items, passi: x.passi, kcal: x.kcal, protein: x.protein, carbs: x.carbs, fat: x.fat };
      save(); menuDay = Number(di); location.hash = '#/cibo'; toast('Pasto aggiornato');
      break;
    }
    case 'meal-restore': {
      const ws = addDays(new Date(), -weekdayIndex(new Date()));
      delete state.mealSwaps?.[`${toISO(addDays(ws, Number(t.dataset.day)))}|${t.dataset.meal}`];
      save(); rerender();
      break;
    }
    case 'couple-menu': state.coupleMenu = t.dataset.on === '1'; save(); rerender(); break;
    case 'couple-menu-go': state.coupleMenu = true; save(); break;
    case 'couple-share': shareMyCode(); break;
    case 'couple-paste': {
      const v = document.getElementById('couple-code').value.trim();
      const c = v.replace(/^.*[?&]c=/, '');
      if (c.length < 10) { toast('Incolla il link completo'); return; }
      location.hash = `#/coppia?c=${c}`;
      break;
    }
    case 'couple-link': {
      if (!incoming?.card) return;
      const first = !state.partner || state.partner.id !== incoming.card.id;
      state.partner = incoming.card;
      if (first) state.coupleMenu = true;
      try { localStorage.removeItem('ritmo.pendingPartner'); } catch { /* */ }
      save(); incoming = null; location.hash = '#/coppia';
      toast(first ? 'Collegati! Ora mandagli il tuo codice' : 'Dati aggiornati');
      break;
    }
    case 'couple-unlink':
      if (confirm('Scollegarti? Il menu e gli allenamenti tornano solo tuoi.')) {
        state.partner = null; state.coupleMenu = false;
        for (const l of Object.values(state.log)) delete l.couple;
        save(); rerender();
      }
      break;
    case 'couple-day': {
      const ws = addDays(new Date(), -weekdayIndex(new Date()));
      const lg = dayLog(toISO(addDays(ws, Number(t.dataset.day))));
      if (t.dataset.on === '1') lg.couple = true; else delete lg.couple;
      save(); rerender(); toast(t.dataset.on === '1' ? 'Allenamento di coppia in programma' : 'Torna il tuo allenamento');
      break;
    }
    case 'toggle-item': {
      const lg = partLog(t.dataset.iso, t.dataset.which);
      const set = new Set(lg.items);
      set.has(t.dataset.key) ? set.delete(t.dataset.key) : set.add(t.dataset.key);
      lg.items = [...set];
      haptic(10);
      save();
      t.classList.toggle('on'); t.closest('.ex')?.classList.toggle('done');
      break;
    }
    case 'ask-feedback': showFeedback = t.dataset.which || 'main'; rerender(); break;
    case 'done': markDone(t.dataset.iso, t.dataset.fb, t.dataset.which); break;
    case 'undo-done': { const lg = partLog(t.dataset.iso, t.dataset.which); lg.done = false; delete lg.feedback; save(); rerender(); break; }
    case 'move-session': { const lg = dayLog(t.dataset.iso); lg.sessionFrom = Number(t.dataset.from); save(); rerender(); break; }
    case 'habit': {
      const lg = dayLog(today());
      lg.habits = lg.habits || {};
      lg.habits[t.dataset.key] = !lg.habits[t.dataset.key];
      haptic(10);
      save(); rerender();
      if (Object.values(lg.habits).filter(Boolean).length === 4 && lg.habits[t.dataset.key]) { burst(innerWidth / 2, innerHeight * 0.7); toast('Tutte le piccole cose di oggi fatte'); }
      break;
    }
    case 'lib-filter': libFilter = t.dataset.f; rerender(); break;
    case 'reset-kcal': state.calorieAdjust = 0; save(); rerender(); break;
    case 'apply': {
      const s = suggestions(analyzeProgress(state, getPlan()))[Number(t.dataset.i)];
      if (s?.action) applyAction(s.action);
      break;
    }
    case 'install': if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; rerender(); }); } break;
    case 'export': {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: `ritmo-backup-${today()}.json` });
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      break;
    }
    case 'restart-plan':
      if (confirm('Ricominciare il piano da oggi? Lo storico resta, il conteggio delle settimane riparte.')) {
        const last = [...state.weights].sort((x, y) => x.date.localeCompare(y.date)).pop();
        if (last) state.profile.peso = last.kg;
        state.planStart = today(); state.calorieAdjust = 0; save(); toast('Piano ripartito da oggi'); location.hash = '#/oggi';
      }
      break;
    case 'reset':
      if (confirm('Cancellare tutti i dati? L’operazione non si può annullare.')) {
        state = empty(); save(); selectedDay = null; draft = null; location.hash = '#/benvenuto'; route();
      }
      break;
    default: break;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'lib-q') return;
  libQuery = e.target.value;
  document.getElementById('lib-grid').innerHTML = libCards();
});

document.addEventListener('change', (e) => {
  if (e.target.dataset.action !== 'import') return;
  const file = e.target.files[0];
  if (!file) return;
  file.text().then((txt) => {
    const data = JSON.parse(txt);
    if (!data.profile || !data.planStart) throw new Error('formato');
    state = { ...empty(), ...data };
    save(); toast('Copia importata'); location.hash = '#/oggi'; rerender();
  }).catch(() => toast('File non valido'));
});

document.addEventListener('submit', (e) => {
  const f = e.target;
  if (f.dataset.form !== 'weight') return;
  e.preventDefault();
  const kg = Number(new FormData(f).get('kg'));
  if (!(kg >= 30 && kg <= 300)) { toast('Peso non valido'); return; }
  state.weights = state.weights.filter((w) => w.date !== today());
  state.weights.push({ date: today(), kg });
  save(); toast('Peso salvato'); rerender();
});

// ==================================================================
// Toast, avvio, service worker
// ==================================================================

let toastId = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastId);
  toastId = setTimeout(() => { el.hidden = true; }, 2600);
}

route();

// aggiornamenti: il service worker si controlla a ogni apertura e quando l'app torna in primo piano;
// quando una versione nuova prende il controllo, la pagina si ricarica una volta da sola
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    const check = () => reg.update().catch(() => {});
    check();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch(() => {});
}
