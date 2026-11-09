import {
  CONDITIONS, GOALS, EQUIPMENT, WEEKDAYS, WEEKDAYS_LONG, TYPE_KIND,
  generatePlan, analyzeProgress, expectedWeight, buildSession, derive, allowedExercises, alternativesFor,
  toISO, fromISO, addDays, daysBetween, weekdayIndex, formatDate,
} from './engine.js';
import { EXERCISES } from './exercises.js';
import { guideFor, MUSCLE_LABELS } from './guide.js';
import { ICON, load3D, countUp, burst, haptic } from './fx.js';
import { openSheet, closeSheet } from './sheet.js';
import { openPlayer } from './player.js';
import {
  MEASURES, PAIN_REGIONS, PAIN_LEVELS, AREAS, LEVEL_LABEL, TEST_BY_ID,
  computeProfile, precision, buildKpis, metric, kpiProgress,
} from './assessment.js';
import { QUESTIONS, EXAMPLE, DIETS, parseNarrative, coverage, analyzeWithClaude, mergeAI } from './narrative.js';
import { DIET_LABEL } from './diet.js';
import { parseGymList, reviewGym, VERDICT_LABEL, VERDICT_COUNT, pickerGroups, pickedFromText, togglePick, setPickDetail } from './gymreview.js';
import { startAssessment, renderAssessment, mountAssessment, handleAssessmentClick, assessmentActive, cancelAssessment } from './assess-ui.js';

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
let draft = null;
let wizardStep = 0;
let selectedDay = null;
let showFeedback = false;
let libFilter = 'tutti';
let libQuery = '';

const $app = document.getElementById('app');
const today = () => toISO(new Date());
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
function getPlan(week = currentWeek()) {
  return generatePlan(state.profile, {
    startISO: state.planStart, week, calorieAdjust: state.calorieAdjust,
    assess: mergedAssess(), swaps: state.swaps, excluded: state.excluded, exAdj: state.exAdj,
    favorites: hasGym() ? gymReview()?.keep : undefined,
  });
}
const precisionNow = () => precision(state.profile, mergedAssess(), { feedbacks: state.fbCount || 0, retests: Math.max(0, state.assess.length - 1), excludeTests: Object.values(TEST_BY_ID).filter((t) => t.when(state.profile, mergedAssess().results)).map((t) => t.id) });
const daysSinceAssess = () => (state.assess.length ? daysBetween(fromISO(state.assess[state.assess.length - 1].date), new Date()) : null);
function dayLog(iso) {
  if (!state.log[iso]) state.log[iso] = { done: false, items: [], habits: {} };
  return state.log[iso];
}

// ==================================================================
// Tab bar e router
// ==================================================================

const TABS = [['oggi', 'Oggi', ICON.today], ['piano', 'Piano', ICON.plan], ['esercizi', 'Esercizi', ICON.lib], ['progressi', 'Progressi', ICON.progress], ['profilo', 'Profilo', ICON.profile]];
const $tabbar = document.getElementById('tabbar');
$tabbar.innerHTML = TABS.map(([id, l, ic]) => `<a href="#/${id}" data-tab="${id}">${ic}<span>${l}</span></a>`).join('');

let heroViewer = null;
let heroTimer = null;

function route() {
  const hash = location.hash.replace('#/', '') || 'oggi';
  if (!state.profile && !['setup', 'benvenuto', 'racconto', 'capito'].includes(hash)) { location.replace('#/benvenuto'); }
  if (hash === 'capito' && !draft) { location.replace('#/racconto'); return; }
  const page = state.profile ? (hash === 'benvenuto' ? 'oggi' : hash) : (['setup', 'racconto', 'capito'].includes(hash) ? hash : 'benvenuto');
  const withTabs = !['setup', 'benvenuto', 'valutazione', 'racconto', 'capito', 'palestra'].includes(page);
  if (page !== 'valutazione' && assessmentActive()) cancelAssessment();
  if (page === 'valutazione' && !assessmentActive()) beginAssessment();
  $tabbar.hidden = !withTabs;
  document.body.classList.toggle('no-tabs', !withTabs);
  $tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.tab === page));

  if (page !== 'benvenuto') disposeHero();
  if (page === 'setup' && !draft) initDraft(!!state.profile);
  const views = { benvenuto: viewWelcome, setup: viewWizard, oggi: viewToday, piano: viewPlan, esercizi: viewLibrary, progressi: viewProgress, profilo: viewProfile, valutazione: renderAssessment, partenza: viewStart, racconto: viewStory, capito: viewReview, palestra: viewGym };
  $app.innerHTML = (views[page] || viewToday)();
  if (page === 'setup') bindWizardInputs();
  if (page === 'valutazione') mountAssessment();
  if (page === 'racconto') bindStory();
  if (page === 'capito') bindWizardInputs();
  if (page === 'palestra') bindGym();
  if (page === 'benvenuto') mountHero();
  countUp($app);
}

window.addEventListener('hashchange', () => {
  closeSheet();
  const go = () => { window.scrollTo(0, 0); route(); };
  if (document.startViewTransition && !reduced()) document.startViewTransition(go);
  else go();
});

function rerender() {
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
}

const R = (i) => `reveal" style="--i:${i}`; // classe di ingresso sfalsato

// ==================================================================
// Benvenuto con manichino 3D
// ==================================================================

const HERO_LOOP = ['s_squat', 'x_corsa', 'p_classici', 'h_rdl', 'w_jj', 'l_affind'];

function viewWelcome() {
  return `
  <section class="welcome">
    <div class="welcome-stage"><div class="viewer" id="hero-viewer"></div></div>
    <div class="brand ${R(0)}"><img src="icons/icon.svg" alt=""> RITMO</div>
    <h1 class="${R(1)}">La tua routine,<br><span class="grad-text">costruita su di te.</span></h1>
    <p class="muted ${R(2)}" style="font-size:17px">Corpo, salute, abitudini e tempo a disposizione: un piano che si adatta a te, con ogni esercizio in 3D e guidato passo passo.</p>
    <div class="feat ${R(3)}">
      <div><span class="fi">🧬</span><b>Su misura</b><span>Esclude ciò che non è adatto alla tua salute.</span></div>
      <div><span class="fi">🧊</span><b>Esercizi in 3D</b><span>Ruotali, rallentali, guarda i muscoli.</span></div>
      <div><span class="fi">⏱️</span><b>Guidato</b><span>Timer, serie, recuperi e voce.</span></div>
      <div><span class="fi">📈</span><b>Si adatta</b><span>Corregge il piano con i tuoi progressi.</span></div>
    </div>
    <button class="btn primary wide ${R(4)}" data-action="start-story">✍️ Raccontami di te</button>
    <button class="btn ghost wide ${R(4)}" data-action="start-setup" style="margin-top:-10px">Preferisco rispondere a domande guidate</button>
    <p class="disclaimer ${R(5)}" style="margin-top:0">Dati salvati solo su questo dispositivo · Non sostituisce il parere medico</p>
  </section>`;
}

async function mountHero() {
  try {
    const m = await load3D();
    const el = document.getElementById('hero-viewer');
    if (!el || !m.webglAvailable()) return;
    disposeHero();
    let i = 0;
    const g = (id) => guideFor(id)?.mm || [];
    heroViewer = m.createViewer(el, { exercise: HERO_LOOP[0], muscles: g(HERO_LOOP[0]) });
    heroTimer = setInterval(() => { i = (i + 1) % HERO_LOOP.length; heroViewer?.setMotion(HERO_LOOP[i], g(HERO_LOOP[i])); }, 5200);
  } catch { /* 3D non disponibile */ }
}
function disposeHero() {
  clearInterval(heroTimer); heroTimer = null;
  heroViewer?.dispose(); heroViewer = null;
}

// ==================================================================
// Relazione iniziale (testo libero)
// ==================================================================

const STORY_KEY = 'ritmo.story';
const AI_KEY = 'ritmo.aikey';
let storyResult = null;
const storyText = () => { try { return localStorage.getItem(STORY_KEY) ?? state.profile?.relazione ?? ''; } catch { return state.profile?.relazione || ''; } };
const storySave = (v) => { try { localStorage.setItem(STORY_KEY, v); } catch { /* */ } };
function aiKey(v) {
  try {
    if (v === undefined) return localStorage.getItem(AI_KEY);
    if (v === null) localStorage.removeItem(AI_KEY); else localStorage.setItem(AI_KEY, v);
  } catch { return null; }
  return v;
}

function viewStory() {
  const text = storyText();
  const cov = coverage(parseNarrative(text));
  const hasKey = !!aiKey();
  const canDictate = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  return `
  <div class="wizard-top ${R(0)}">
    <button class="icon-btn" onclick="history.back()" aria-label="Indietro">${ICON.prev}</button>
    <div class="grow"></div><span class="chip cyan"><i></i>Relazione iniziale</span>
  </div>
  <section class="stack-lg">
    <div class="${R(1)}"><h1>Raccontami di te</h1>
      <p class="muted" style="margin-top:8px">Scrivi come parleresti a un personal trainer. Le domande qui sotto sono una traccia: si accendono quando le hai coperte.</p></div>
    <div class="qchips ${R(2)}" id="qchips">${qchips(cov)}</div>
    <div class="story-box ${R(3)}">
      <textarea id="story" placeholder="Es. Ho 34 anni, mi alleno 2 volte a settimana in palestra per un’ora, vorrei aggiungere 20 minuti a casa 3-4 giorni a settimana. Lavoro seduto al pc…">${esc(text)}</textarea>
      <div class="row between story-tools">
        ${canDictate ? `<button type="button" class="btn ghost small" data-action="story-mic">🎙️ Detta</button>` : '<span class="small muted">Puoi usare la dettatura della tastiera 🎙️</span>'}
        <span class="mono small muted" id="story-count">${wordCount(text)} parole</span>
      </div>
    </div>
    <button class="link small ${R(4)}" data-action="story-example">Vedi un esempio di relazione</button>
    <div class="card ${R(5)}">
      <div class="row between"><b>Analisi avanzata con Claude</b>${hasKey ? '<span class="chip volt"><i></i>Attiva</span>' : '<span class="chip">Facoltativa</span>'}</div>
      ${hasKey ? `<label class="row small" style="margin-top:10px"><input type="checkbox" id="use-ai" checked> Usa Claude per capire meglio il testo</label>
        <p class="small muted" style="margin-top:6px">Il testo viene inviato ad Anthropic con la tua chiave. Senza connessione si usa l’analisi integrata.</p>`
        : `<p class="small muted" style="margin-top:6px">L’analisi integrata funziona offline e riconosce le frasi più comuni. Con una tua chiave API di Anthropic Claude capisce qualsiasi modo di scrivere. La chiave resta solo su questo telefono.</p>
        <div class="row" style="margin-top:10px"><input type="password" id="ai-key" placeholder="sk-ant-…" autocomplete="off"><button type="button" class="btn ghost small" data-action="ai-save">Salva</button></div>`}
    </div>
    <div class="wizard-actions"><button class="btn primary" data-action="story-analyze">Analizza la mia relazione</button></div>
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
    btn.disabled = true; btn.textContent = 'Claude sta leggendo…';
    try { result = mergeAI(result, await analyzeWithClaude(text, aiKey())); }
    catch (e) { toast(`Analisi avanzata non riuscita: uso quella integrata (${e?.status === 401 ? 'chiave non valida' : 'errore di rete'})`); }
    btn.disabled = false; btn.textContent = 'Analizza la mia relazione';
  }
  storyResult = result;
  draftFromStory(result, text);
  location.hash = '#/capito';
}

const DEFAULTS = { fumo: 'no', alcol: 'occasionale', stress: 'medio', sonno: 7, alimentazione: 'media', esperienza: 'principiante', lavoro: 'sedentario', passi: '5000-7500', dieta: 'onnivora' };
function draftFromStory(r, text) {
  const old = state.profile || {};
  const base = { nome: '', condizioni: [], attrezzi: [], misure: {}, dolori: {}, note: '', traguardo: '', pesoObiettivo: '', dataObiettivo: '' };
  draft = { ...base, ...old, ...r.profile, relazione: text };
  draft.assumed = [];
  for (const [k, v] of Object.entries(DEFAULTS)) if (r.profile[k] === undefined && old[k] === undefined) { draft[k] = v; draft.assumed.push(k); }
  draft.sessioni = r.sessioni?.length ? r.sessioni.map((x) => ({ giorni: x.giorni, minuti: x.minuti, luogo: x.luogo })) : (old.sessioni || [{ giorni: 3, minuti: 30, luogo: 'casa' }]);
  draft.misure = { ...(old.misure || {}), ...(r.profile.misure || {}) };
  draft._edit = !!state.profile;
  wizardStep = STEPS.length - 1;
}
function reviewError() {
  const d = draft;
  if (!d.sesso) return 'Indica il sesso.';
  if (!(d.eta >= 14 && d.eta <= 100)) return 'Inserisci la tua età.';
  if (!(d.altezza >= 120 && d.altezza <= 230)) return 'Inserisci la tua altezza in cm.';
  if (!(d.peso >= 30 && d.peso <= 300)) return 'Inserisci il tuo peso in kg.';
  if (!d.obiettivo) return 'Scegli il tuo obiettivo principale.';
  return slotError(d);
}

function viewReview() {
  const d = draft;
  const r = storyResult || { found: {}, evidence: {} };
  const ok = (k) => (r.found[k] ? '<span class="found">✓ dal testo</span>' : '<span class="missing">da completare</span>');
  const as = (k) => (d.assumed?.includes(k) ? '<span class="assumed">ipotesi</span>' : '<span class="found">✓</span>');
  const pains = Object.entries(d.dolori || {}).filter(([, v]) => v > 0);
  return `
  <div class="wizard-top ${R(0)}">
    <button class="icon-btn" onclick="location.hash='#/racconto'" aria-label="Indietro">${ICON.prev}</button>
    <div class="grow"></div><span class="chip volt"><i></i>${r.ai ? 'Analizzato con Claude' : 'Analisi integrata'}</span>
  </div>
  <form id="wizard" class="stack-lg" onsubmit="return false">
    <div class="${R(1)}"><h1>Ecco cosa ho capito</h1><p class="muted" style="margin-top:8px">Controlla, completa quello che manca e genera il piano.</p></div>
    ${r.sintesi ? `<div class="card glow ${R(2)}"><p>${esc(r.sintesi)}</p>${r.noteCoach?.length ? `<ul class="coach-notes">${r.noteCoach.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div>` : ''}

    <section class="card ${R(2)}"><div class="row between"><h3>Chi sei</h3></div>
      <div class="field" style="margin-top:12px"><span>Sesso ${ok('sesso')}</span>${seg('sesso', [['F', 'Donna'], ['M', 'Uomo']], d.sesso)}</div>
      <div class="grid-3" style="margin-top:12px">
        ${num('eta', `Età`, d.eta, 'min="14" max="100"')}${num('altezza', 'Altezza cm', d.altezza, 'min="120" max="230"')}${num('peso', 'Peso kg', d.peso, 'min="30" max="300" step="0.1"')}
      </div>
    </section>

    <section class="card ${R(3)}"><div class="row between"><h3>Obiettivo</h3>${ok('obiettivo')}</div>
      <div class="seg" data-name="obiettivo" style="margin-top:12px">${GOALS.map((g) => `<button type="button" data-value="${g.id}" class="${d.obiettivo === g.id ? 'on' : ''}">${g.icon} ${g.label}</button>`).join('')}</div>
      <div class="grid-2" style="margin-top:12px">${num('pesoObiettivo', 'Peso obiettivo', d.pesoObiettivo, 'step="0.5" placeholder="kg"')}
        <label class="field"><span>Entro</span><input type="date" name="dataObiettivo" value="${esc(d.dataObiettivo || '')}"></label></div>
    </section>

    <section class="card ${R(4)}"><div class="row between"><h3>La tua settimana</h3>${ok('sessioni')}</div>
      <div style="margin-top:12px">${slotEditor(d)}</div>
      <div class="field" style="margin-top:12px"><span>Attrezzi a casa</span>${chips('attrezzi', EQUIPMENT.filter((e) => e.id !== 'palestra'), d.attrezzi)}</div>
    </section>

    ${d.sessioni?.some((x) => x.luogo === 'palestra') ? `<section class="card ${R(5)}"><div class="row between"><h3>I tuoi esercizi in palestra</h3>${d.schedaPalestra?.trim() ? (r.found.scheda ? '<span class="found">✓ dal testo</span>' : '<span class="found">✓</span>') : '<span class="assumed">facoltativo</span>'}</div>
      <p class="small muted" style="margin-top:6px">Scrivi cosa fai di solito, uno per riga: dopo ti dico cosa tenere, cambiare o aggiungere.</p>
      <textarea name="schedaPalestra" style="margin-top:10px" placeholder="${esc(GYM_PLACEHOLDER)}">${esc(d.schedaPalestra || '')}</textarea>
    </section>` : ''}

    <section class="card ${R(5)}"><div class="row between"><h3>Alimentazione</h3>${ok('dieta')}</div>
      <div style="margin-top:12px">${seg('dieta', DIETS.map((x) => [x.id, x.label]), d.dieta)}</div>
    </section>

    <section class="card ${R(6)}"><div class="row between"><h3>Salute</h3>${ok('salute')}</div>
      <p class="small muted" style="margin-top:8px">${pains.length ? 'Dolori riconosciuti: ' + pains.map(([k, v]) => `${PAIN_REGIONS.find((x) => x.id === k)?.label.toLowerCase()} (${['', 'lieve', 'medio', 'forte'][v]})`).join(', ') : 'Nessun dolore indicato.'}${d.condizioni?.length ? ' · Condizioni: ' + d.condizioni.map((c) => CONDITIONS.find((x) => x.id === c)?.label).filter(Boolean).join(', ') : ''}</p>
      <div class="pain-list" style="margin-top:10px">${PAIN_REGIONS.map((x) => `<div class="pain-row"><span>${x.label}</span>${seg('dol_' + x.id, PAIN_LEVELS, d.dolori?.[x.id] ?? 0)}</div>`).join('')}</div>
      <div class="field" style="margin-top:12px"><span>Condizioni</span>${chips('condizioni', CONDITIONS, d.condizioni)}</div>
    </section>

    <section class="card ${R(7)}"><h3>Giornata e abitudini</h3>
      <div class="field" style="margin-top:12px"><span>Lavoro ${as('lavoro')}</span>${seg('lavoro', [['sedentario', 'Seduto'], ['in_piedi', 'In piedi'], ['fisico', 'Fisico']], d.lavoro)}</div>
      <div class="field" style="margin-top:12px"><span>Passi al giorno ${as('passi')}</span>${seg('passi', [['<3000', '< 3k'], ['3000-5000', '3–5k'], ['5000-7500', '5–7,5k'], ['7500-10000', '7,5–10k'], ['>10000', '> 10k']], d.passi)}</div>
      <div class="field" style="margin-top:12px"><span>Ore di sonno ${as('sonno')}</span>${seg('sonno', [[5, '≤ 5'], [6, '6'], [7, '7'], [8, '8'], [9, '9+']], d.sonno)}</div>
      <div class="field" style="margin-top:12px"><span>Esperienza ${as('esperienza')}</span>${seg('esperienza', [['principiante', 'Principiante'], ['intermedio', 'Intermedio'], ['avanzato', 'Avanzato']], d.esperienza)}</div>
      <div class="grid-2" style="margin-top:12px">
        <div class="field"><span>Fumo ${as('fumo')}</span>${seg('fumo', [['no', 'No'], ['si', 'Sì']], d.fumo)}</div>
        <div class="field"><span>Stress ${as('stress')}</span>${seg('stress', [['basso', 'Basso'], ['medio', 'Medio'], ['alto', 'Alto']], d.stress)}</div>
      </div>
    </section>
    <p class="error" id="wiz-error" hidden></p>
    <div class="wizard-actions"><button type="button" class="btn primary" data-action="story-generate">Genera il mio piano</button></div>
    <button type="button" class="link small" data-action="story-edit-all" style="display:block;margin:0 auto">Rivedi tutto passo per passo</button>
  </form>`;
}

// ==================================================================
// Wizard
// ==================================================================

const seg = (name, opts, val) => `<div class="seg" data-name="${name}">${opts.map(([v, l]) => `<button type="button" data-value="${v}" class="${String(val) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const chips = (name, opts, vals = []) => `<div class="chips" data-multi="${name}">${opts.map((o) => `<button type="button" data-value="${o.id}" class="${vals.includes(o.id) ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div>`;
const num = (name, label, val, attrs = '') => `<label class="field"><span>${label}</span><input type="number" inputmode="decimal" name="${name}" value="${val ?? ''}" ${attrs}></label>`;

const STEPS = [
  {
    title: 'Il tuo corpo', sub: 'Servono per calcolare metabolismo e fabbisogno.',
    render: (d) => `
      <label class="field"><span>Come ti chiami?</span><input type="text" name="nome" value="${esc(d.nome)}" autocomplete="given-name" placeholder="Nome"></label>
      <div class="field"><span>Sesso biologico</span>${seg('sesso', [['F', 'Donna'], ['M', 'Uomo']], d.sesso)}</div>
      <div class="grid-3">
        ${num('eta', 'Età', d.eta, 'min="14" max="100"')}
        ${num('altezza', 'Altezza cm', d.altezza, 'min="120" max="230"')}
        ${num('peso', 'Peso kg', d.peso, 'min="30" max="300" step="0.1"')}
      </div>`,
    validate: (d) => {
      if (!d.sesso) return 'Seleziona il sesso.';
      if (!(d.eta >= 14 && d.eta <= 100)) return 'Inserisci un’età tra 14 e 100 anni.';
      if (!(d.altezza >= 120 && d.altezza <= 230)) return 'Inserisci un’altezza tra 120 e 230 cm.';
      if (!(d.peso >= 30 && d.peso <= 300)) return 'Inserisci un peso tra 30 e 300 kg.';
      return null;
    },
  },
  {
    title: 'Le tue misure', sub: 'Con un metro da sarta. Servono per stimare massa grassa e massa magra e per misurare i progressi meglio della bilancia. Puoi lasciarle vuote e farle dopo.',
    render: (d) => MEASURES.filter((m) => !m.sex || m.sex === d.sesso).map((m) => `<label class="field"><span>${m.label} (${m.unit})${m.optional ? ' · facoltativa' : ''}</span><input type="number" inputmode="decimal" name="mis_${m.id}" value="${esc(d.misure?.[m.id] ?? '')}"><small>${m.how}</small></label>`).join(''),
    validate: (d) => {
      for (const m of MEASURES) {
        const v = d.misure?.[m.id];
        if (v !== undefined && v !== '' && !(v >= m.min && v <= m.max)) return `${m.label}: il valore non sembra corretto (${m.min}–${m.max} ${m.unit}).`;
      }
      if (d.misure?.vita && d.misure?.collo && d.misure.vita <= d.misure.collo) return 'La vita deve essere più grande del collo: ricontrolla le misure.';
      return null;
    },
  },
  {
    title: 'La tua salute', sub: 'Seleziona tutto ciò che ti riguarda. Se non hai nulla, vai avanti.',
    render: (d) => `
      ${chips('condizioni', CONDITIONS, d.condizioni)}
      <label class="field"><span>Farmaci, infortuni o altro (facoltativo)</span><textarea name="note" placeholder="Es. operato al menisco destro nel 2022">${esc(d.note)}</textarea><small>Resta sul tuo telefono. Parlane anche con il medico.</small></label>`,
    validate: () => null,
  },
  {
    title: 'Dolori e fastidi', sub: 'Dove senti dolore oggi, anche fuori dall’allenamento? Il piano esclude o rende più facili gli esercizi che caricano quella zona.',
    render: (d) => `<div class="pain-list">${PAIN_REGIONS.map((r) => `<div class="pain-row"><span>${r.label}</span>${seg('dol_' + r.id, PAIN_LEVELS, d.dolori?.[r.id] ?? 0)}</div>`).join('')}</div>
      <p class="small muted">Lieve: fastidio che non limita. Medio: limita alcuni movimenti. Forte: limita la vita quotidiana.</p>`,
    validate: () => null,
  },
  {
    title: 'Le tue abitudini', sub: 'Come vivi oggi, senza giudizi.',
    render: (d) => `
      <div class="field"><span>Il tuo lavoro</span>${seg('lavoro', [['sedentario', 'Seduto'], ['in_piedi', 'In piedi'], ['fisico', 'Fisico']], d.lavoro)}</div>
      <div class="field"><span>Passi al giorno</span>${seg('passi', [['<3000', '< 3k'], ['3000-5000', '3–5k'], ['5000-7500', '5–7,5k'], ['7500-10000', '7,5–10k'], ['>10000', '> 10k']], d.passi)}</div>
      <div class="field"><span>Ore di sonno</span>${seg('sonno', [[5, '≤ 5'], [6, '6'], [7, '7'], [8, '8'], [9, '9+']], d.sonno)}</div>
      <div class="field"><span>Esperienza di allenamento</span>${seg('esperienza', [['principiante', 'Principiante'], ['intermedio', 'Intermedio'], ['avanzato', 'Avanzato']], d.esperienza)}<small>Principiante: mai allenato o fermo da più di 6 mesi.</small></div>
      <div class="field"><span>Alimentazione</span>${seg('alimentazione', [['disordinata', 'Disordinata'], ['media', 'Nella media'], ['curata', 'Curata']], d.alimentazione)}</div>
      <div class="grid-2">
        <div class="field"><span>Fumi?</span>${seg('fumo', [['no', 'No'], ['si', 'Sì']], d.fumo)}</div>
        <div class="field"><span>Alcol</span>${seg('alcol', [['mai', 'Mai'], ['occasionale', 'A volte'], ['spesso', 'Spesso']], d.alcol)}</div>
      </div>
      <div class="field"><span>Stress</span>${seg('stress', [['basso', 'Basso'], ['medio', 'Medio'], ['alto', 'Alto']], d.stress)}</div>
      <div class="field"><span>Tipo di alimentazione</span>${seg('dieta', DIETS.map((x) => [x.id, x.label]), d.dieta || 'onnivora')}</div>`,
    validate: (d) => {
      for (const [k, l] of [['lavoro', 'il lavoro'], ['passi', 'i passi'], ['sonno', 'le ore di sonno'], ['esperienza', 'l’esperienza'], ['alimentazione', 'l’alimentazione'], ['fumo', 'il fumo'], ['alcol', 'l’alcol'], ['stress', 'lo stress']]) if (d[k] === undefined || d[k] === '') return `Indica ${l}.`;
      return null;
    },
  },
  {
    title: 'Il tuo obiettivo', sub: 'Scegli quello principale: il piano ruoterà attorno a questo.',
    render: (d) => `
      <div class="goal-grid" data-name="obiettivo">${GOALS.map((g) => `<button type="button" data-value="${g.id}" class="${d.obiettivo === g.id ? 'on' : ''}"><span class="gi">${g.icon}</span><b>${g.label}</b><small>${g.desc}</small></button>`).join('')}</div>
      <div class="grid-2">
        ${num('pesoObiettivo', 'Peso obiettivo kg', d.pesoObiettivo, 'min="35" max="250" step="0.5" placeholder="facoltativo"')}
        <label class="field"><span>Entro quando?</span><input type="date" name="dataObiettivo" value="${esc(d.dataObiettivo)}" min="${toISO(addDays(new Date(), 14))}"></label>
      </div>
      <label class="field"><span>Un traguardo concreto (facoltativo)</span><input type="text" name="traguardo" value="${esc(d.traguardo)}" placeholder="Es. correre 10 km, fare 10 trazioni"></label>`,
    validate: (d) => (!d.obiettivo ? 'Scegli un obiettivo.' : d.pesoObiettivo && !(d.pesoObiettivo >= 35 && d.pesoObiettivo <= 250) ? 'Il peso obiettivo non sembra corretto.' : null),
  },
  {
    title: 'Il tuo tempo', sub: 'Meglio poco ma costante: scegli un impegno che riesci davvero a mantenere.',
    render: (d) => `
      <p class="small muted">Puoi combinare sessioni diverse: per esempio 2 da un’ora in palestra e 4 da 20 minuti a casa.</p>
      ${slotEditor(d)}
      <div class="field"><span>Attrezzi che hai a casa</span>${chips('attrezzi', EQUIPMENT.filter((e) => e.id !== 'palestra'), d.attrezzi)}<small>Il corpo libero è sempre incluso. In palestra trovi già tutto.</small></div>`,
    validate: (d) => slotError(d),
  },
];

function minutesHint(m) {
  if (m <= 15) return 'Allenamenti brevi a circuito: pochi minuti, ma intensi e regolari.';
  if (m <= 30) return 'Ottimo compromesso: abbastanza per risultati concreti.';
  if (m <= 60) return 'Sessioni complete: riscaldamento, lavoro e defaticamento.';
  return 'Tanto tempo: più volume. Ricordati di recuperare.';
}
const slotTot = (d) => (d.sessioni || []).reduce((a, x) => ({ g: a.g + (x.giorni || 0), m: a.m + (x.giorni || 0) * x.minuti }), { g: 0, m: 0 });
const weekTotalText = (d) => { const t = slotTot(d); return `Totale: ${t.g} allenamenti e ${t.m} minuti a settimana${t.m < 150 ? ' · le camminate completeranno il resto' : ''}.`; };
const slotError = (d) => { const t = slotTot(d); return !t.g ? 'Indica almeno una sessione a settimana.' : t.g > 7 ? `In totale hai ${t.g} giorni: al massimo 7 a settimana.` : null; };
const LUOGHI = [['palestra', 'Palestra'], ['casa', 'Casa'], ['aperto', 'All’aperto']];
function slotEditor(d) {
  const S = d.sessioni || [];
  return `<div class="slots">${S.map((x, i) => `
    <div class="slot card flat">
      <div class="row between"><span class="kicker">Sessione ${S.length > 1 ? i + 1 : ''}</span>${S.length > 1 ? `<button type="button" class="link small" data-action="slot-del" data-i="${i}">Rimuovi</button>` : ''}</div>
      <div class="seg" data-slot="${i}" data-field="luogo">${LUOGHI.map(([v, l]) => `<button type="button" data-value="${v}" class="${x.luogo === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:12px">Giorni a settimana</p>
      <div class="seg seg-days" data-slot="${i}" data-field="giorni">${[1, 2, 3, 4, 5, 6, 7].map((v) => `<button type="button" data-value="${v}" class="${x.giorni === v ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="row between" style="margin-top:12px"><span class="small muted">Durata di ogni sessione</span><b class="mono" id="slotmin-${i}">${x.minuti} min</b></div>
      <input type="range" min="10" max="120" step="5" name="slotmin_${i}" value="${x.minuti}" aria-label="Durata">
    </div>`).join('')}</div>
    ${S.length < 3 ? '<button type="button" class="btn ghost wide" data-action="slot-add">+ Aggiungi un altro tipo di sessione</button>' : ''}
    <p class="small muted" id="week-total">${weekTotalText(d)}</p>`;
}

function viewWizard() {
  const step = STEPS[wizardStep];
  return `
  <div class="wizard-top ${R(0)}">
    <button class="icon-btn" data-action="wiz-back" aria-label="Indietro">${ICON.prev}</button>
    <div class="steps">${STEPS.map((_, i) => `<i class="${i < wizardStep ? 'on' : i === wizardStep ? 'cur' : ''}"></i>`).join('')}</div>
    <span class="mono small muted">${String(wizardStep + 1).padStart(2, '0')}/${String(STEPS.length).padStart(2, '0')}</span>
  </div>
  <form id="wizard" class="stack-lg" onsubmit="return false">
    <div class="${R(1)}"><p class="kicker">Passo ${wizardStep + 1}</p><h1 style="margin-top:6px">${step.title}</h1><p class="muted" style="margin-top:8px">${step.sub}</p></div>
    <div class="stack-lg ${R(2)}">${step.render(draft)}</div>
    <p class="error" id="wiz-error" hidden></p>
    <div class="wizard-actions">
      <button type="button" class="btn primary" data-action="wiz-next">${wizardStep === STEPS.length - 1 ? 'Genera il mio piano' : 'Avanti'}</button>
    </div>
  </form>`;
}

function bindWizardInputs() {
  document.getElementById('wizard').addEventListener('input', (e) => {
    const el = e.target;
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
    draft[el.name] = el.type === 'number' || el.type === 'range' ? (el.value === '' ? '' : Number(el.value)) : el.value;
    if (el.name === 'minuti') {
      document.getElementById('min-out').textContent = el.value;
      document.getElementById('min-hint').textContent = minutesHint(Number(el.value));
      updateWeekTotal();
    }
  });
}
function updateWeekTotal() {
  const el = document.getElementById('week-total');
  if (el) el.textContent = weekTotalText(draft);
}

function initDraft(edit) {
  draft = edit && state.profile ? structuredClone(state.profile) : {
    nome: '', condizioni: [], attrezzi: [], misure: {}, dolori: {}, minuti: 30, giorni: 3, sonno: '', note: '', traguardo: '', pesoObiettivo: '', dataObiettivo: '',
  };
  if (!draft.sessioni?.length) draft.sessioni = [{ giorni: draft.giorni || 3, minuti: draft.minuti || 30, luogo: (draft.attrezzi || []).includes('palestra') ? 'palestra' : 'casa' }];
  draft._edit = edit;
  wizardStep = 0;
}
function startWizard(edit = false) {
  initDraft(edit);
  if (location.hash === '#/setup') route();
  else location.hash = '#/setup';
}

function finishWizard() {
  const p = { ...draft };
  const wasEdit = p._edit;
  delete p._edit;
  p.sessioni = (p.sessioni || []).filter((x) => x.giorni > 0);
  const tot = slotTot(p);
  p.giorni = Math.min(7, tot.g);
  p.minuti = Math.round(tot.m / Math.max(1, tot.g));
  p.attrezzi = [...new Set([...(p.attrezzi || []).filter((a) => a !== 'palestra'), ...(p.sessioni.some((x) => x.luogo === 'palestra') ? ['palestra'] : [])])];
  p.dieta = p.dieta || 'onnivora';
  delete p.assumed;
  storyResult = null;
  p.pesoObiettivo = p.pesoObiettivo === '' ? null : p.pesoObiettivo;
  p.dataObiettivo = p.dataObiettivo || null;
  const old = state.profile;
  const goalChanged = !old || old.obiettivo !== p.obiettivo || old.pesoObiettivo !== p.pesoObiettivo || old.peso !== p.peso;
  state.profile = p;
  if (!wasEdit || goalChanged) { state.planStart = today(); state.calorieAdjust = 0; }
  if (!state.weights.some((w) => w.date === today())) state.weights.push({ date: today(), kg: p.peso });
  else state.weights = state.weights.map((w) => (w.date === today() ? { ...w, kg: p.peso } : w));
  save();
  draft = null;
  if (!wasEdit && !state.assess.length) { location.hash = '#/valutazione'; toast('Profilo creato: ora misuriamo il tuo punto di partenza'); return; }
  location.hash = '#/piano';
  setTimeout(() => burst(innerWidth / 2, innerHeight * 0.3), 350);
  toast(wasEdit ? 'Piano aggiornato' : 'Il tuo piano è pronto');
}

// ==================================================================
// Oggi
// ==================================================================

function sessionFor(plan, iso) {
  const from = state.log[iso]?.sessionFrom;
  const wd = from ?? weekdayIndex(fromISO(iso));
  return { session: plan.schedule[wd].session, moved: from !== undefined && from !== null };
}

const ECG = '<svg class="ecg" viewBox="0 0 520 34" preserveAspectRatio="none" aria-hidden="true"><path d="M0 20 H120 L130 20 L138 6 L148 30 L156 12 L162 20 H300 L310 20 L318 4 L328 32 L336 14 L342 20 H520"/></svg>';

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
  const { session, moved } = sessionFor(plan, iso);
  const lg = state.log[iso] || { done: false, items: [], habits: {} };
  const stops = plan.alerts.filter((a) => a.level === 'stop');
  const lastW = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const needWeigh = !lastW || daysBetween(fromISO(lastW.date), now) >= 7;

  const movedDone = new Set();
  for (let i = 0; i < 7; i++) {
    const l = state.log[toISO(addDays(weekStart, i))];
    if (l?.done && l.sessionFrom !== undefined && l.sessionFrom !== null) movedDone.add(l.sessionFrom);
  }
  const strip = WEEKDAYS.map((l, i) => {
    const d = addDays(weekStart, i);
    const di = toISO(d);
    const s = sessionFor(plan, di).session;
    const done = state.log[di]?.done || movedDone.has(i);
    const past = d < fromISO(today()) && fromISO(di) >= fromISO(state.planStart);
    const dot = s ? (done ? 'done' : past ? 'miss' : 'train') : (done ? 'done' : '');
    return `<button data-action="pick-day" data-day="${i}" class="${di === today() ? 'today' : ''} ${i === selectedDay ? 'sel' : ''}"><span>${l}</span><b>${d.getDate()}</b><i class="${dot}"></i></button>`;
  }).join('');

  return `
  <header class="hdr ${R(0)}">
    <div>
      <p class="kicker">${viewDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} · sett ${week} · ${plan.phase.label}</p>
      <h1>${isToday ? `Ciao${p.nome ? ' ' + esc(p.nome) : ''}` : WEEKDAYS_LONG[selectedDay]}</h1>
    </div>
    <span class="chip volt live"><i></i>${isToday ? 'Live' : 'Anteprima'}</span>
  </header>
  <div class="${R(1)}">${ECG}</div>
  <nav class="weekstrip ${R(2)}" aria-label="Settimana">${strip}</nav>
  <div class="stack">
    ${stops.length ? `<a href="#/piano" class="alert stop ${R(3)}" style="text-decoration:none"><span>⚠︎</span><span><b>Prima di iniziare:</b> ${esc(stops[0].text)}${stops.length > 1 ? ` (+${stops.length - 1})` : ''}</span></a>` : ''}
    ${isToday ? assessCard() : ''}
    ${session ? sessionCard(session, iso, lg, moved) : restCard(plan, iso, lg)}
    ${isToday ? habitsCard(plan, iso) : ''}
    ${isToday && !state.profile.schedaPalestra?.trim() ? gymCard(R(5)) : ''}
    ${isToday && needWeigh ? `
      <div class="card ${R(6)}">
        <div class="row between"><h3>Check-in settimanale</h3><span class="mono small muted">${lastW ? fmt(lastW.kg, 1) + ' KG' : ''}</span></div>
        <p class="small muted" style="margin-top:4px">Pesati al mattino, a digiuno. Serve per adattare il piano.</p>
        <form class="row" style="margin-top:12px" data-form="weight"><input type="number" name="kg" step="0.1" min="30" max="300" inputmode="decimal" placeholder="kg" required><button class="btn ghost">Salva</button></form>
      </div>` : ''}
  </div>`;
}

function ring(pct, big, small) {
  const C = 2 * Math.PI * 40;
  return `<div class="ring"><svg viewBox="0 0 92 92"><circle class="track" cx="46" cy="46" r="40"/><circle class="val" cx="46" cy="46" r="40" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg><div class="lbl"><div><b>${big}</b><small>${small}</small></div></div></div>`;
}

function sessionCard(s, iso, lg, moved) {
  const future = fromISO(iso) > fromISO(today()) || fromISO(iso) < fromISO(state.planStart);
  const kind = TYPE_KIND[s.type];
  const kindLabel = { forza: 'Forza', cardio: 'Cardio', mobilita: 'Mobilità' }[kind];
  const kindChip = { forza: 'volt', cardio: 'cyan', mobilita: 'violet' }[kind];
  const doneItems = new Set(lg.items || []);
  const total = s.blocks.reduce((a, b) => a + b.items.length, 0);
  const pct = lg.done ? 1 : doneItems.size / total;
  let n = 0;
  const blocks = s.blocks.map((b, bi) => `
    <div class="block">
      <div class="block-head"><h3>${b.name}</h3><span class="mono small muted">${b.minutes}′</span></div>
      ${b.note ? `<p class="block-note">${esc(b.note)}</p>` : ''}
      ${b.items.map((it, ii) => {
        const key = `${bi}:${ii}`;
        const on = doneItems.has(key) || lg.done;
        n++;
        return `<div class="ex ${on ? 'done' : ''}">
          <span class="ex-idx">${String(n).padStart(2, '0')}</span>
          <div class="ex-body" data-action="open-ex" data-id="${it.id}" data-dose="${esc(it.dose)}" data-swap="1">
            <div class="ex-name">${esc(it.name)}</div>
            <div class="ex-dose">${esc(it.dose)}</div>
            ${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ''}${it.basis ? `<div class="ex-basis">◎ ${esc(it.basis)}</div>` : ''}
          </div>
          <div class="ex-tools">
            <button class="icon-btn three" data-action="open-ex" data-id="${it.id}" data-dose="${esc(it.dose)}" data-swap="1" aria-label="Guarda in 3D">${ICON.cube}</button>
            ${future ? '' : `<button class="check ${on ? 'on' : ''}" data-action="toggle-item" data-key="${key}" data-iso="${iso}" aria-label="Fatto">✓</button>`}
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');

  let footer = '';
  if (lg.done) {
    footer = `<div class="alert ok" style="margin-top:16px"><span>✓</span><span><b>Allenamento completato.</b> ${lg.feedback ? 'Sensazione: ' + lg.feedback + '.' : ''}</span></div>
      <button class="link small" style="margin-top:10px" data-action="undo-done" data-iso="${iso}">Annulla</button>`;
  } else if (!future) {
    footer = showFeedback
      ? `<p style="margin-top:18px;font-weight:650">Com’è andata?</p>
         <div class="feedback" style="margin-top:8px">
           <button data-action="done" data-iso="${iso}" data-fb="facile"><span>😌</span>Facile</button>
           <button data-action="done" data-iso="${iso}" data-fb="giusto"><span>💪</span>Giusto</button>
           <button data-action="done" data-iso="${iso}" data-fb="duro"><span>🥵</span>Duro</button>
         </div>`
      : `<button class="link small" style="margin-top:16px" data-action="ask-feedback">Ho fatto l’allenamento senza la guida</button>`;
  }

  return `
  <article class="card glow ${R(4)}">
    <div class="session-hero">
      ${ring(pct, lg.done ? '✓' : `${Math.round(pct * 100)}<span style="font-size:12px">%</span>`, lg.done ? 'FATTO' : `${doneItems.size}/${total}`)}
      <div>
        <div class="meta" style="margin-top:0"><span class="chip ${kindChip}">${kindLabel}</span><span class="chip">${s.minutes} min</span>${s.luogo ? `<span class="chip">${LUOGO_LABEL[s.luogo]}</span>` : ''}</div>
        <h2 style="margin-top:10px">${esc(s.title)}</h2>
        ${moved ? '<p class="small muted" style="margin-top:4px">Allenamento spostato a oggi</p>' : ''}
      </div>
    </div>
    ${!future && !lg.done ? `<button class="btn primary wide" style="margin-top:18px" data-action="play" data-iso="${iso}">${ICON.play} Avvia allenamento guidato</button>` : ''}
    ${blocks}
    ${footer}
  </article>`;
}

function restCard(plan, iso, lg) {
  const p = state.profile;
  const d = derive(p);
  const steps = plan.habits.find((h) => h.key === 'passi');
  const mini = buildSession('mobilita', 10, p, d, new Date().getDate(), 1);
  const items = mini.blocks[1].items.slice(0, 5);
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
  <article class="card ${R(4)}">
    <span class="chip violet">Recupero attivo</span>
    <h2 style="margin-top:12px">Giorno di riposo</h2>
    <p class="muted" style="margin-top:6px">Il recupero fa parte dell’allenamento: è qui che il corpo si rinforza. Muoviti comunque in modo leggero.</p>
    <div class="block">
      <div class="block-head"><h3>Oggi</h3></div>
      <div class="ex"><span class="ex-idx">01</span><div class="ex-body" data-action="open-ex" data-id="x_cammino"><div class="ex-name">Camminata all’aperto</div><div class="ex-dose">20–30 min · ${steps ? steps.target.toLocaleString('it-IT') : '8.000'} passi</div></div><div class="ex-tools"><button class="icon-btn three" data-action="open-ex" data-id="x_cammino" aria-label="3D">${ICON.cube}</button></div></div>
      ${items.map((it, i) => `<div class="ex"><span class="ex-idx">${String(i + 2).padStart(2, '0')}</span><div class="ex-body" data-action="open-ex" data-id="${it.id}"><div class="ex-name">${esc(it.name)}</div><div class="ex-dose">${esc(it.dose)} · facoltativo</div></div><div class="ex-tools"><button class="icon-btn three" data-action="open-ex" data-id="${it.id}" aria-label="3D">${ICON.cube}</button></div></div>`).join('')}
    </div>
    ${canMove && missed.length && !lg.done ? `
      <div class="block">
        <div class="block-head"><h3>${isStart ? 'Vuoi iniziare subito?' : 'Hai saltato un allenamento?'}</h3></div>
        <p class="small muted">${isStart ? 'Puoi fare oggi il primo allenamento:' : 'Puoi recuperarlo oggi:'}</p>
        <div class="chips" style="margin-top:10px">${missed.map((m) => `<button data-action="move-session" data-from="${m.weekday}" data-iso="${iso}">${m.label} · ${esc(m.session.title)}</button>`).join('')}</div>
      </div>` : ''}
  </article>`;
}

function habitsCard(plan, iso) {
  const h = (state.log[iso] || {}).habits || {};
  const steps = plan.habits.find((x) => x.key === 'passi');
  const list = [
    ['passi', '👟', `${steps.target.toLocaleString('it-IT')} passi`],
    ['acqua', '💧', `${fmt(plan.nutrition.water, 1)} litri d’acqua`],
    ['proteine', '🍳', `${plan.nutrition.protein} g di proteine`],
    ['sonno', '😴', 'Almeno 7 ore di sonno'],
  ];
  const done = list.filter(([k]) => h[k]).length;
  return `
  <div class="card ${R(5)}">
    <div class="row between"><h3>Abitudini di oggi</h3><span class="mono small ${done === 4 ? 'grad-text' : 'muted'}">${done}/4</span></div>
    <div style="margin-top:6px">
      ${list.map(([k, ic, l]) => `<div class="habit"><button class="check ${h[k] ? 'on' : ''}" data-action="habit" data-key="${k}" aria-label="${l}">✓</button><span class="grow">${l}</span><span>${ic}</span></div>`).join('')}
    </div>
  </div>`;
}

// ==================================================================
// Piano
// ==================================================================

const LUOGO_LABEL = { palestra: 'Palestra', casa: 'Casa', aperto: 'All’aperto' };
const BLOCK_LABELS = { impatto: 'salti e corsa', supino: 'esercizi sdraiati sulla schiena', prono: 'esercizi a pancia in giù', valsalva: 'carichi massimali', testaGiu: 'posizioni a testa in giù', flessioneCarico: 'flessioni del busto sotto carico' };

function viewPlan() {
  const p = state.profile;
  const plan = getPlan();
  const goal = GOALS.find((g) => g.id === p.obiettivo);
  const t = plan.timeline;
  const n = plan.nutrition;
  const weekly = plan.schedule.filter((d) => d.session).length * p.minuti;

  const pctP = Math.round((n.protein * 4 / n.kcal) * 100);
  const pctC = Math.round((n.carbs * 4 / n.kcal) * 100);
  const pctF = 100 - pctP - pctC;
  const donut = `conic-gradient(var(--volt) 0 ${pctP}%, var(--cyan) ${pctP}% ${pctP + pctC}%, var(--violet) ${pctP + pctC}% 100%)`;
  const modeLabel = { deficit: 'Deficit moderato', surplus: 'Leggero surplus', mantenimento: 'Mantenimento' }[n.mode];

  return `
  <header class="hdr ${R(0)}"><div><p class="kicker">Il tuo piano · sett ${plan.week}</p><h1>${goal.icon} ${goal.label}</h1></div></header>
  <div class="stack" style="margin-top:16px">
    <section class="card glow hero-plan ${R(1)}">
      <div class="orbit"></div>
      ${t.hasWeight ? `
        <p class="kicker">Traguardo stimato</p>
        <div class="big-num" style="margin-top:8px"><span data-count="${n.target}" data-dec="1">${fmt(n.target, 1)}</span><small>kg</small></div>
        <p style="margin-top:8px">intorno al <b class="grad-text">${formatDate(t.eta)}</b></p>
        <p class="mono small muted" style="margin-top:4px">${t.weeks} SETTIMANE · ${fmt(t.rate, 2)} KG/SETT</p>
        <div class="milestones">${t.milestones.slice(0, 8).map((m) => `<div>sett ${m.week}<b>${fmt(m.kg, 1)}</b></div>`).join('')}</div>`
      : `<p class="kicker">Ogni settimana</p>
        <div class="big-num" style="margin-top:8px"><span data-count="${weekly}">${weekly}</span><small>min</small></div>`}
      <div class="meta" style="margin-top:16px"><span class="chip volt">${p.giorni} allenamenti</span><span class="chip cyan">${p.minuti} min l’uno</span>${p.traguardo ? `<span class="chip violet">${esc(p.traguardo)}</span>` : ''}</div>
      <p class="small muted" style="margin-top:14px">${esc(t.message)}</p>
    </section>
    ${t.warning ? `<div class="alert attenzione ${R(2)}"><span>⏳</span><span>${esc(t.warning)}</span></div>` : ''}
    ${plan.alerts.map((a, i) => `<div class="alert ${a.level} ${R(2 + i)}"><span>${a.level === 'stop' ? '⚠︎' : 'ℹ︎'}</span><span>${esc(a.text)}</span></div>`).join('')}
  </div>

  ${plan.summary?.length ? `<div class="section-title"><h2>Il tuo piano in breve</h2></div>
  <section class="card">${plan.summary.map((f) => `<div class="tip"><span class="ti">${f.icon}</span><div><b>${esc(f.title)}</b><p class="small muted" style="margin-top:2px">${esc(f.text)}</p></div></div>`).join('')}</section>` : ''}

  ${hasGym() ? `<div class="section-title"><h2>La tua palestra</h2></div>${gymCard()}` : ''}

  <div class="section-title"><h2>La settimana</h2><span class="chip cyan">${plan.phase.label}</span></div>
  <p class="small muted" style="margin:0 2px 12px">${esc(plan.phase.note)}</p>
  ${plan.schedule.map((d, i) => d.session ? `
    <details class="day ${R(i)}">
      <summary><span class="day-label">${d.label}</span><span class="grow"><b>${esc(d.session.title)}</b><br><span class="small muted">${d.session.minutes} min · ${d.session.blocks.reduce((a, b) => a + b.items.length, 0)} esercizi${d.session.luogo ? ' · ' + LUOGO_LABEL[d.session.luogo] : ''}</span></span></summary>
      <div class="day-body">${d.session.blocks.map((b) => `
        <div class="block"><div class="block-head"><h3>${b.name}</h3><span class="mono small muted">${b.minutes}′</span></div>
        ${b.note ? `<p class="block-note">${esc(b.note)}</p>` : ''}
        ${b.items.map((it) => `<div class="ex"><div class="ex-body" data-action="open-ex" data-id="${it.id}" data-dose="${esc(it.dose)}"><div class="ex-name">${esc(it.name)}</div><div class="ex-dose">${esc(it.dose)}</div>${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ''}</div><div class="ex-tools"><button class="icon-btn three" data-action="open-ex" data-id="${it.id}" data-dose="${esc(it.dose)}" aria-label="3D">${ICON.cube}</button></div></div>`).join('')}</div>`).join('')}
      </div>
    </details>` : `<div class="day-rest ${R(i)}"><span class="day-label">${d.label}</span><span>Riposo attivo · camminata</span></div>`).join('')}

  <div class="section-title"><h2>Alimentazione</h2><span class="chip">${modeLabel}</span></div>
  <section class="card">
    <div class="macro-wrap">
      <div class="donut" style="background:${donut}"><div class="c"><div><b data-count="${n.kcal}">${n.kcal}</b><small>KCAL/GIORNO</small></div></div></div>
      <div class="legend-list">
        <div><span><i style="background:var(--volt)"></i>Proteine</span><b>${n.protein} g</b></div>
        <div><span><i style="background:var(--cyan)"></i>Carboidrati</span><b>${n.carbs} g</b></div>
        <div><span><i style="background:var(--violet)"></i>Grassi</span><b>${n.fat} g</b></div>
        <div class="muted small"><span>${pctP}% · ${pctC}% · ${pctF}%</span></div>
      </div>
    </div>
    ${state.calorieAdjust ? `<p class="small muted" style="margin-top:10px">Include un aggiustamento di ${state.calorieAdjust > 0 ? '+' : ''}${state.calorieAdjust} kcal dai tuoi progressi. <button class="link" data-action="reset-kcal">Azzera</button></p>` : ''}
    <div style="margin-top:14px">
      <div class="list-row"><span>Metabolismo basale</span><span>${n.bmr.toLocaleString('it-IT')} kcal</span></div>
      <div class="list-row"><span>Consumo totale stimato</span><span>${n.tdee.toLocaleString('it-IT')} kcal</span></div>
      <div class="list-row"><span>Acqua</span><span>${fmt(n.water, 1)} L (+0,5 nei giorni di allenamento)</span></div>
      <div class="list-row"><span>Fibre</span><span>almeno ${n.fiber} g</span></div>
    </div>
    ${n.notes.map((x) => `<div class="alert info" style="margin-top:10px"><span>💡</span><span>${esc(x)}</span></div>`).join('')}
  </section>

  <div class="section-title"><h2>Giornata tipo</h2><span class="chip">${DIET_LABEL[n.dieta] || 'Onnivora'}</span></div>
  <section class="card">
    ${n.meals.meals.map((m) => `<div class="meal"><div class="row between"><b>${m.label}</b><span class="mono small" style="color:var(--volt)">${m.protein} g prot.</span></div>
      <ul>${m.items.map((i) => `<li><span>${esc(i.name)}</span><span class="mono small muted">${i.grams} g</span></li>`).join('')}</ul></div>`).join('')}
    <p class="small muted" style="margin-top:10px">Porzioni calcolate per arrivare a ~${n.meals.total} g di proteine. Carboidrati e condimenti (olio extravergine) da regolare sulle calorie del giorno.</p>
  </section>
  ${n.dietTips.length ? `<section class="card" style="margin-top:12px">${n.dietTips.map((t) => `<div class="tip"><span class="ti">${t.icon}</span><div><b>${esc(t.title)}</b><p class="small muted" style="margin-top:2px">${esc(t.text)}</p></div></div>`).join('')}
    <p class="small muted" style="margin-top:6px">Indicazioni generali: per integratori e dosi confrontati con il medico.</p></section>` : ''}

  <div class="section-title"><h2>Abitudini</h2></div>
  <section class="card">
    ${plan.habits.map((h) => `<div class="tip"><span class="ti">${h.icon}</span><div><b>${esc(h.title)}</b><p class="small muted" style="margin-top:2px">${esc(h.text)}</p></div></div>`).join('')}
  </section>

  <div class="section-title"><h2>Personalizzazione</h2><a class="link small" href="#/partenza">Punto di partenza →</a></div>
  ${precisionCard()}
  <section class="card" style="margin-top:12px">
    ${plan.personal.map((f) => `<div class="tip"><span class="ti">${f.icon}</span><div><b>${esc(f.title)}</b><p class="small muted" style="margin-top:2px">${esc(f.text)}</p></div></div>`).join('')}
  </section>
  ${kpiSection(plan)}

  <div class="section-title"><h2>Parametri di base</h2></div>
  <section class="card">
    <div class="list-row"><span>BMI</span><span>${fmt(plan.derived.bmi, 1)} · ${bmiLabel(plan.derived.bmi)}</span></div>
    <div class="list-row"><span>Livello esercizi</span><span>${['', 'Base', 'Intermedio', 'Avanzato'][plan.derived.level]}</span></div>
    <div class="list-row"><span>FC massima stimata</span><span>${plan.derived.hrMax} bpm</span></div>
    <div class="list-row"><span>Alta intensità</span><span>${plan.derived.hiitOk ? 'Sì' : 'No, solo moderata'}</span></div>
    ${plan.derived.blocked.length ? `<div class="list-row"><span>Esclusi per te</span><span>${plan.derived.blocked.map((b) => BLOCK_LABELS[b]).join(', ')}</span></div>` : ''}
    ${p.condizioni?.length ? `<div class="list-row"><span>Condizioni</span><span>${p.condizioni.map((c) => CONDITIONS.find((x) => x.id === c)?.label).join(', ')}</span></div>` : ''}
  </section>
  <p class="disclaimer">Ritmo fornisce indicazioni generali e non sostituisce medici, fisioterapisti o nutrizionisti. Se senti dolore, fermati.</p>`;
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

function assessCard() {
  const since = daysSinceAssess();
  const pr = precisionNow();
  if (since === null) {
    return `<a href="#/valutazione" class="card glow ${R(3)}" style="display:block;text-decoration:none">
      <div class="row between"><span class="chip cyan live"><i></i>Da fare</span><span class="mono small muted">PRECISIONE ${pr.pct}%</span></div>
      <h2 style="margin-top:12px">Misura il tuo punto di partenza</h2>
      <p class="muted small" style="margin-top:6px">15 minuti di test guidati in 3D: il piano userà i tuoi risultati per livelli, dosi, correttivi e traguardi. Precisione stimata dopo i test: oltre 85%.</p>
      <div class="prec-bar" style="margin-top:14px"><i style="width:${pr.pct}%"></i><b style="left:88%"></b></div>
    </a>`;
  }
  if (since >= 28) {
    return `<a href="#/valutazione" class="card glow ${R(3)}" style="display:block;text-decoration:none">
      <span class="chip volt live"><i></i>Test di controllo</span>
      <h2 style="margin-top:12px">Sono passate ${Math.floor(since / 7)} settimane</h2>
      <p class="muted small" style="margin-top:6px">Rifai i test per misurare i progressi reali e aggiornare livelli e dosi.</p>
    </a>`;
  }
  return '';
}

function precisionCard() {
  const pr = precisionNow();
  const top = pr.missing.sort((a, b) => b.gain - a.gain).slice(0, 4);
  return `<section class="card glow">
    <div class="session-hero">
      ${ring(pr.pct / 100, `${pr.pct}<span style="font-size:12px">%</span>`, 'PRECISIONE')}
      <div>
        <h3>Precisione del piano</h3>
        <p class="small muted" style="margin-top:4px">Quanto il piano si basa su dati misurati su di te invece che su stime generiche.</p>
      </div>
    </div>
    ${top.length ? `<p class="sub-h">Per aumentarla</p>${top.map((m) => `<div class="list-row"><span>${esc(m.label)}</span><span class="mono" style="color:var(--volt)">+${m.gain}%</span></div>`).join('')}
    <a class="btn ghost wide" style="margin-top:12px" href="#/valutazione">${state.assess.length ? 'Completa i test' : 'Fai la valutazione'}</a>` : ''}
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
        <div class="row between"><b>${k.label}</b><span class="mono small muted">entro ${eta}</span></div>
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
  const lvChip = (l) => `<span class="chip ${l >= 4 ? 'volt' : l === 3 ? 'cyan' : 'hot'}">${LEVEL_LABEL[l]}</span>`;
  const summary = [];
  if (cp.strong.length) summary.push(`I tuoi punti di forza: <b>${cp.strong.map((a) => a.label.toLowerCase()).join(' e ')}</b>.`);
  if (cp.weak.length) summary.push(`Da migliorare per primi: <b>${cp.weak.map((a) => a.label.toLowerCase()).join(' e ')}</b>.`);
  return `
  <header class="hdr ${R(0)}"><div><p class="kicker">${state.assess.length ? 'Aggiornato al ' + formatDate(state.assess[state.assess.length - 1].date) : 'Nessun test ancora'}</p><h1>Punto di partenza</h1></div></header>
  <section class="card glow ${R(1)}" style="margin-top:16px">
    ${radar(cp.areas, first?.areas)}
    ${first ? '<div class="legend" style="justify-content:center"><span><i style="background:var(--volt)"></i>Oggi</span><span><i style="background:var(--ink-3)"></i>Valutazione iniziale</span></div>' : ''}
    ${summary.length ? `<p style="margin-top:12px">${summary.join(' ')}</p>` : '<p class="muted" style="margin-top:12px">Fai i test per completare il tuo profilo.</p>'}
  </section>
  ${precisionCard()}

  <div class="section-title"><h2>Composizione corporea</h2></div>
  <section class="card ${R(2)}">
    <div class="stats">
      <div class="stat"><b>${b.bf !== null ? fmt(b.bf, 1) : '–'}<small style="font-size:14px">${b.bf !== null ? '%' : ''}</small></b><span>massa grassa</span></div>
      <div class="stat"><b>${b.leanMass !== null ? fmt(b.leanMass, 1) : '–'}</b><span>kg magri</span></div>
      <div class="stat"><b>${b.whtr ? b.whtr.toLocaleString('it-IT') : '–'}</b><span>vita/altezza</span></div>
    </div>
    <div style="margin-top:10px">
      ${b.bfLabel ? `<div class="list-row"><span>Massa grassa</span><span>${b.bfLabel} · ${fmt(b.fatMass, 1)} kg</span></div>` : '<div class="list-row"><span>Massa grassa</span><span>servono vita e collo' + (p.sesso === 'F' ? ' e fianchi' : '') + '</span></div>'}
      ${b.whtrLabel ? `<div class="list-row"><span>Grasso addominale</span><span>${b.whtrLabel}</span></div>` : ''}
      <div class="list-row"><span>BMI</span><span>${fmt(b.bmi, 1)} · ${bmiLabel(b.bmi)}</span></div>
      ${b.hrRest ? `<div class="list-row"><span>FC a riposo</span><span>${b.hrRest} bpm · ${['', 'alta', 'da migliorare', 'nella media', 'buona', 'ottima'][b.hrLevel]}</span></div>` : ''}
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

  <div class="section-title"><h2>Cosa cambia nel tuo piano</h2></div>
  <section class="card ${R(4)}">
    ${plan.personal.map((f) => `<div class="tip"><span class="ti">${f.icon}</span><div><b>${esc(f.title)}</b><p class="small muted" style="margin-top:2px">${esc(f.text)}</p></div></div>`).join('')}
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

const GYM_PLACEHOLDER = 'Un esercizio per riga, anche con serie e carichi:\nPanca piana 4x8 60 kg\nLat machine 3x10\nLeg press\nCurl bicipiti\nCrunch';
const VERDICT_CLASS = { tieni: 'ok', cautela: 'cyan', cambia: 'hot', riduci: 'violet', togli: 'hot', sconosciuto: '' };

function gymAnalysisHTML(text) {
  const r = gymReview(text);
  if (!r) return '<p class="small muted">Scrivi i tuoi esercizi: l’analisi compare qui mentre scrivi.</p>';
  const ex = (id, name) => (id ? `<button type="button" class="link" data-action="open-ex" data-id="${id}">${esc(name)}</button>` : esc(name));
  const counts = r.items.reduce((a, x) => { a[x.verdict] = (a[x.verdict] || 0) + 1; return a; }, {});
  return `
    <div class="row between"><b>Analisi della tua scheda</b><span class="chip ${r.coverage >= 80 ? 'volt' : r.coverage >= 50 ? 'cyan' : 'hot'}">Copertura ${r.coverage}%</span></div>
    <p class="small muted" style="margin-top:6px">${Object.entries(counts).map(([k, n]) => `${n} ${VERDICT_COUNT[k]}`).join(' · ')}${r.add.length ? ` · ${r.add.length} da aggiungere` : ''}</p>
    <div class="gym-list">${r.items.map((x) => `
      <div class="gym-item v-${x.verdict}">
        <div class="row between"><b>${x.entry?.id ? ex(x.entry.id, x.name) : esc(x.name)}</b><span class="chip ${VERDICT_CLASS[x.verdict]}">${VERDICT_LABEL[x.verdict]}</span></div>
        ${x.sets || x.kg ? `<p class="mono small muted">${x.sets ? `${x.sets}×${x.reps}` : ''}${x.kg ? ` · ${fmt(x.kg, x.kg % 1 ? 1 : 0)} kg` : ''}</p>` : ''}
        ${x.reason ? `<p class="small muted" style="margin-top:4px">${esc(x.reason)}</p>` : x.verdict === 'tieni' ? `<p class="small muted" style="margin-top:4px">Va bene per il tuo obiettivo${x.entry?.mus ? ` (${esc(x.entry.mus)})` : ''}.</p>` : ''}
        ${x.alt ? `<p class="small" style="margin-top:6px">→ Al suo posto: ${ex(x.alt.id, x.alt.name)}</p>` : ''}
      </div>`).join('')}
    </div>
    ${r.add.length ? `<h3 style="margin-top:18px">Da aggiungere</h3>
      <div class="gym-list">${r.add.map((a) => `<div class="gym-item v-add"><div class="row between"><b>${ex(a.id, a.name)}</b><span class="chip volt">Aggiungi</span></div><p class="small muted" style="margin-top:4px">${esc(a.reason)}</p></div>`).join('')}</div>` : ''}
    ${r.notes.length ? `<div class="stack" style="margin-top:14px">${r.notes.map((n) => `<div class="alert info"><span>ℹ︎</span><span>${esc(n)}</span></div>`).join('')}</div>` : ''}
    <p class="small muted" style="margin-top:14px">Gli esercizi da tenere entrano nelle tue sessioni in palestra con l’etichetta “Dalla tua scheda”; quelli da cambiare vengono sostituiti dall’alternativa.</p>`;
}

const SET_SCHEMES = [[3, 8], [3, 10], [3, 12], [3, 15], [4, 6], [4, 8], [4, 10], [4, 12], [5, 5]];
const GYM_GROUPS_UI = pickerGroups();
const PICK_LABELS = Object.fromEntries(GYM_GROUPS_UI.flatMap((g) => g.items.map((x) => [x.key, x])));

// esercizi scelti, con serie × ripetizioni e kg modificabili senza scrivere
function gymChosenHTML(text) {
  const picked = pickedFromText(text);
  const keys = Object.keys(picked);
  if (!keys.length) return '<p class="small muted">Tocca gli esercizi e i macchinari che usi: compaiono qui.</p>';
  return keys.map((k) => {
    const d = picked[k], it = PICK_LABELS[k] || { label: k };
    const cur = d.sets ? `${d.sets}x${d.reps}` : '';
    const opts = SET_SCHEMES.map(([a, b]) => `${a}x${b}`);
    if (cur && !opts.includes(cur)) opts.unshift(cur);
    return `<div class="gym-chosen" data-key="${esc(k)}">
      <b>${esc(it.label)}</b>
      ${it.cardio ? '<span class="small muted">cardio</span>' : `
      <select class="gym-sets" aria-label="Serie per ripetizioni"><option value="">serie × rip</option>${opts.map((o) => `<option value="${o}"${o === cur ? ' selected' : ''}>${o.replace('x', ' × ')}</option>`).join('')}</select>
      <label class="gym-kg"><input type="number" inputmode="decimal" min="0" step="0.5" placeholder="—" value="${d.kg ?? ''}" aria-label="Carico in kg"><span>kg</span></label>`}
      <button type="button" class="icon-btn gym-x" data-action="gym-pick" data-key="${esc(k)}" aria-label="Togli ${esc(it.label)}">✕</button>
    </div>`;
  }).join('');
}

function gymPickerHTML(text) {
  const picked = pickedFromText(text);
  return GYM_GROUPS_UI.map((g) => `
    <div class="gym-group" data-group="${g.id}">
      <p class="small muted">${g.label}</p>
      <div class="chips">${g.items.map((x) => `<button type="button" class="${picked[x.key] ? 'on' : ''}" data-action="gym-pick" data-key="${esc(x.key)}" data-search="${esc(`${x.label} ${x.key}`.toLowerCase())}">${esc(x.label)}</button>`).join('')}</div>
    </div>`).join('');
}

function viewGym() {
  const text = state.profile.schedaPalestra || '';
  const unknown = parseGymList(text).some((x) => !x.key);
  return `
  <div class="wizard-top ${R(0)}">
    <button class="icon-btn" onclick="history.back()" aria-label="Indietro">${ICON.prev}</button>
    <div class="grow"></div><span class="chip cyan"><i></i>La tua scheda</span>
  </div>
  <section class="stack-lg">
    <div class="${R(1)}"><h1>Cosa fai in palestra?</h1>
      <p class="muted" style="margin-top:8px">Tocca gli esercizi e i macchinari che usi di solito. Li confronto con il tuo obiettivo, la tua salute e i tuoi test: ti dico cosa tenere, cosa cambiare, cosa togliere e cosa manca.</p></div>
    <section class="card ${R(2)}">
      <div class="row between"><h3>La tua scheda</h3><span class="chip" id="gym-count">${Object.keys(pickedFromText(text)).length} scelti</span></div>
      <div class="gym-list" id="gym-chosen">${gymChosenHTML(text)}</div>
    </section>
    <section class="card ${R(3)}">
      <h3>Esercizi e macchinari</h3>
      <input type="text" enterkeyhint="search" id="gym-search" placeholder="Cerca: panca, lat, tapis…" autocomplete="off" style="margin-top:10px">
      <div id="gym-picker">${gymPickerHTML(text)}</div>
      <p class="small muted" id="gym-none" hidden style="margin-top:10px">Nessun risultato: aggiungilo scrivendolo qui sotto.</p>
    </section>
    <details class="day ${R(4)}"${unknown ? ' open' : ''}>
      <summary><span class="grow"><b>Scrivi a mano</b><br><span class="small muted">Facoltativo: per esercizi che non sono nella lista</span></span></summary>
      <div class="day-body"><div class="story-box"><textarea id="gym-text" placeholder="${esc(GYM_PLACEHOLDER)}">${esc(text)}</textarea></div></div>
    </details>
    <section class="card ${R(5)}" id="gym-out">${gymAnalysisHTML(text)}</section>
    <div class="wizard-actions"><button class="btn primary" data-action="gym-done">Aggiorna il mio piano</button></div>
  </section>`;
}
let gymTimer = null;
// aggiorna scheda, lista, contatore e analisi dopo una scelta (senza ridisegnare la pagina)
function gymApply(text, { keepText = false } = {}) {
  state.profile.schedaPalestra = text; save();
  const ta = document.getElementById('gym-text');
  if (ta && !keepText) ta.value = text;
  const picked = pickedFromText(text);
  document.getElementById('gym-chosen').innerHTML = gymChosenHTML(text);
  document.getElementById('gym-count').textContent = `${Object.keys(picked).length} scelti`;
  document.querySelectorAll('#gym-picker button[data-key]').forEach((b) => b.classList.toggle('on', !!picked[b.dataset.key]));
  document.getElementById('gym-out').innerHTML = gymAnalysisHTML(text);
}
function bindGym() {
  const el = document.getElementById('gym-text');
  el.addEventListener('input', () => {
    clearTimeout(gymTimer);
    gymTimer = setTimeout(() => gymApply(el.value, { keepText: true }), 300);
  });
  const search = document.getElementById('gym-search');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let any = false;
    document.querySelectorAll('#gym-picker .gym-group').forEach((g) => {
      let n = 0;
      g.querySelectorAll('button[data-search]').forEach((b) => { const ok = !q || b.dataset.search.includes(q); b.hidden = !ok; if (ok) n++; });
      g.hidden = !n; if (n) any = true;
    });
    document.getElementById('gym-none').hidden = any;
  });
  // serie × ripetizioni e kg degli esercizi scelti
  document.getElementById('gym-chosen').addEventListener('change', (e) => {
    const row = e.target.closest('.gym-chosen');
    if (!row) return;
    const [sets, reps] = (row.querySelector('.gym-sets')?.value || '').split('x').map(Number);
    const kg = parseFloat(String(row.querySelector('.gym-kg input')?.value || '').replace(',', '.'));
    clearTimeout(gymTimer);
    gymApply(setPickDetail(state.profile.schedaPalestra || '', row.dataset.key, { sets: sets || null, reps: reps || null, kg: kg > 0 ? kg : null }, PICK_LABELS[row.dataset.key]?.label));
  });
}
// riquadro di richiamo (Oggi, Piano)
function gymCard(cls = '') {
  if (!hasGym()) return '';
  const r = gymReview();
  if (!r) return `<a class="card glow gym-cta ${cls}" href="#/palestra"><span class="ti">🏋️</span><div><b>Che esercizi fai in palestra?</b><p class="small muted" style="margin-top:2px">Scrivili e ti dico quali tenere, cambiare o aggiungere.</p></div></a>`;
  const change = r.items.filter((x) => ['cambia', 'togli', 'riduci'].includes(x.verdict)).length;
  return `<a class="card gym-cta ${cls}" href="#/palestra"><span class="ti">🏋️</span><div><b>La tua scheda di palestra</b><p class="small muted" style="margin-top:2px">${r.keep.length} esercizi nel piano${change ? ` · ${change} da rivedere` : ''}${r.add.length ? ` · ${r.add.length} da aggiungere` : ''} · copertura ${r.coverage}%</p></div></a>`;
}

// ==================================================================
// Libreria esercizi
// ==================================================================

const LIB_FILTERS = [['tutti', 'Tutti'], ['perte', 'Adatti a te'], ['strength', 'Forza'], ['cardio', 'Cardio'], ['mobility', 'Mobilità'], ['warmup', 'Riscaldamento'], ['balance', 'Equilibrio']];
const CAT_LABEL = { warmup: 'Riscaldamento', strength: 'Forza', cardio: 'Cardio', mobility: 'Mobilità', balance: 'Equilibrio' };

function viewLibrary() {
  const ok = new Set(allowedExercises(state.profile).map((e) => e.id));
  return `
  <header class="hdr ${R(0)}"><div><p class="kicker">${EXERCISES.length} esercizi · ${ok.size} adatti a te</p><h1>Libreria 3D</h1></div></header>
  <div class="search ${R(1)}" style="margin-top:16px">${ICON.search}<input type="text" id="lib-q" placeholder="Cerca esercizio o muscolo" value="${esc(libQuery)}" autocomplete="off"></div>
  <div class="filters seg ${R(2)}">${LIB_FILTERS.map(([id, l]) => `<button data-action="lib-filter" data-f="${id}" class="${libFilter === id ? 'on' : ''}">${l}</button>`).join('')}</div>
  <div class="lib-grid" id="lib-grid">${libCards(ok)}</div>`;
}

function libCards(ok = new Set(allowedExercises(state.profile).map((e) => e.id))) {
  const q = libQuery.trim().toLowerCase();
  const list = EXERCISES.filter((e) => {
    if (libFilter === 'perte' && !ok.has(e.id)) return false;
    if (!['tutti', 'perte'].includes(libFilter) && e.cat !== libFilter) return false;
    if (!q) return true;
    const g = guideFor(e.id);
    return e.n.toLowerCase().includes(q) || g?.mm.some((m) => MUSCLE_LABELS[m].toLowerCase().includes(q));
  });
  if (!list.length) return '<p class="muted">Nessun esercizio trovato.</p>';
  return list.map((e, i) => {
    const g = guideFor(e.id);
    const yes = ok.has(e.id);
    return `<button class="lib-card ${yes ? '' : 'locked'} ${i < 12 ? R(i) : ''}" data-action="open-ex" data-id="${e.id}">
      <span class="play">${ICON.play}</span>
      <span class="cat">${CAT_LABEL[e.cat]}${yes ? '' : ' · non nel tuo piano'}</span>
      <b>${esc(e.n)}</b>
      <span class="mus">${g ? g.mm.slice(0, 3).map((m) => MUSCLE_LABELS[m]).join(' · ') : ''}</span>
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
  <header class="hdr ${R(0)}"><div><p class="kicker">Dal ${formatDate(state.planStart)}</p><h1>Progressi</h1></div></header>
  <div class="stats ${R(1)}" style="margin-top:16px">
    <div class="stat"><b data-count="${totalDone}">${totalDone}</b><span>allenamenti</span></div>
    <div class="stat"><b data-count="${an.streak}">${an.streak}</b><span>di fila</span></div>
    <div class="stat"><b>${an.adherence ?? '–'}${an.adherence !== null ? '<small style="font-size:14px">%</small>' : ''}</b><span>costanza</span></div>
  </div>

  ${sugg.length ? `<div class="section-title"><h2>Il coach dice</h2><span class="chip cyan live"><i></i>Analisi</span></div><div class="stack">${sugg.map((s, i) => `
    <div class="alert ${s.ok ? 'ok' : 'info'} ${R(i + 2)}" style="flex-direction:column;gap:10px">
      <span>${esc(s.text)}</span>
      ${s.action ? `<button class="btn ghost small" style="align-self:flex-start" data-action="apply" data-i="${i}">${esc(s.action.label)}</button>` : ''}
    </div>`).join('')}</div>` : ''}

  ${kpiSection(getPlan(), true)}
  <div class="section-title"><h2>Valutazioni</h2><a class="link small" href="#/partenza">Dettagli →</a></div>
  <section class="card">
    ${state.assess.length ? state.assess.map((a, i) => `<div class="list-row"><span>${i ? 'Controllo' : 'Valutazione iniziale'} · ${formatDate(a.date)}</span><span>${Object.keys(a.results || {}).filter((k) => !k.endsWith('Var')).length} test</span></div>`).join('') : '<p class="muted small">Nessuna valutazione ancora.</p>'}
    <a class="btn ghost wide" style="margin-top:12px" href="#/valutazione">${state.assess.length ? 'Fai il test di controllo' : 'Fai la valutazione iniziale'}</a>
  </section>

  <div class="section-title"><h2>Peso</h2>${last ? `<span class="mono small muted">${fmt(last.kg, 1)} KG · ${diff > 0 ? '+' : ''}${fmt(diff, 1)}</span>` : ''}</div>
  <section class="card ${R(3)}">
    ${weightChart(weights, plan)}
    <form class="row" style="margin-top:14px" data-form="weight">
      <input type="number" name="kg" step="0.1" min="30" max="300" inputmode="decimal" placeholder="Peso di oggi (kg)" required>
      <button class="btn ghost">Aggiungi</button>
    </form>
  </section>

  <div class="section-title"><h2>Storico</h2></div>
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
  <div class="legend"><span><i style="background:var(--volt)"></i>Peso</span>${pPath ? '<span><i style="background:var(--cyan)"></i>Previsto</span>' : ''}${n.target && n.rate ? '<span><i style="background:var(--violet)"></i>Obiettivo</span>' : ''}</div>`;
}

function historyList(plan) {
  const done = Object.entries(state.log).filter(([, l]) => l.done).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  if (!done.length) return '<p class="muted">Ancora nessun allenamento completato. Il primo è il più importante.</p>';
  return done.map(([iso, l]) => {
    const wd = l.sessionFrom ?? weekdayIndex(fromISO(iso));
    const s = plan.schedule[wd].session;
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
  const rows = [
    ['Nome', esc(p.nome) || '–'],
    ['Età', `${p.eta} anni`],
    ['Altezza · peso iniziale', `${p.altezza} cm · ${fmt(p.peso, 1)} kg`],
    ['Obiettivo', `${goal.icon} ${goal.label}${p.pesoObiettivo ? ` · ${p.pesoObiettivo} kg` : ''}`],
    ['Tempo', `${p.minuti} min × ${p.giorni} giorni`],
    ['Attrezzi', ['Corpo libero', ...(p.attrezzi || []).map((a) => EQUIPMENT.find((e) => e.id === a)?.label)].join(', ')],
    ['Salute', p.condizioni?.length ? p.condizioni.map((c) => CONDITIONS.find((x) => x.id === c)?.label).join(', ') : 'Nessuna condizione indicata'],
  ];
  return `
  <header class="hdr ${R(0)}"><div><p class="kicker">Impostazioni</p><h1>Profilo</h1></div></header>
  <section class="card ${R(1)}" style="margin-top:16px">${rows.map(([k, v]) => `<div class="list-row"><span>${k}</span><span>${v}</span></div>`).join('')}
    <button class="btn primary wide" style="margin-top:14px" data-action="edit-profile">Modifica profilo e obiettivi</button>
  </section>

  ${!standalone ? `
  <div class="section-title"><h2>Installa l’app</h2></div>
  <section class="card ${R(2)}">
    ${installEvt ? '<p class="muted small">Aggiungi Ritmo alla schermata Home: funziona anche offline.</p><button class="btn ghost wide" style="margin-top:12px" data-action="install">Installa</button>'
      : isIOS ? '<p class="muted small">Su iPhone: tocca <b>Condividi</b> in Safari e poi <b>Aggiungi alla schermata Home</b>.</p>'
        : '<p class="muted small">Dal menu del browser scegli <b>Installa app</b> o <b>Aggiungi a schermata Home</b>.</p>'}
  </section>` : ''}

  <div class="section-title"><h2>La tua relazione</h2></div>
  <section class="card">
    ${p.relazione ? `<p class="small muted story-quote">“${esc(p.relazione.length > 280 ? p.relazione.slice(0, 280) + '…' : p.relazione)}”</p>` : '<p class="small muted">Racconta la tua situazione con parole tue: il piano verrà ricalcolato.</p>'}
    <a class="btn ghost wide" style="margin-top:12px" href="#/racconto">${p.relazione ? 'Aggiorna la relazione' : 'Scrivi la tua relazione'}</a>
    <div class="row between" style="margin-top:16px"><b class="small">Analisi avanzata con Claude</b>${aiKey() ? '<button class="link small" data-action="ai-remove">Rimuovi chiave</button>' : '<span class="small muted">non attiva</span>'}</div>
    ${aiKey() ? '' : '<div class="row" style="margin-top:8px"><input type="password" id="ai-key" placeholder="Chiave API sk-ant-…" autocomplete="off"><button class="btn ghost small" data-action="ai-save">Salva</button></div>'}
    <p class="small muted" style="margin-top:6px">La chiave resta su questo dispositivo e non finisce nei backup. L’analisi usa il tuo account Anthropic.</p>
  </section>

  ${hasGym() ? `<div class="section-title"><h2>La tua scheda di palestra</h2></div>${gymCard()}` : ''}

  <div class="section-title"><h2>I tuoi dati</h2></div>
  <section class="card stack ${R(3)}">
    <p class="small muted">Tutto è salvato solo su questo dispositivo. Esporta un backup per non perderlo o per spostarlo su un altro telefono.</p>
    <div class="grid-2">
      <button class="btn ghost" data-action="export">Esporta</button>
      <label class="btn ghost" style="cursor:pointer">Importa<input type="file" accept="application/json" data-action="import" hidden></label>
    </div>
    <a class="btn ghost wide" href="#/valutazione">Rifai la valutazione</a>
    ${Object.keys(state.swaps).length || state.excluded.length || Object.keys(state.exAdj).length ? `<button class="btn line wide" data-action="reset-choices">Ripristina esercizi sostituiti ed esclusi (${Object.keys(state.swaps).length + state.excluded.length})</button>` : ''}
    <button class="btn line wide" data-action="restart-plan">Ricomincia il piano da oggi</button>
    <button class="btn danger wide" data-action="reset">Cancella tutti i dati</button>
  </section>

  <div class="section-title"><h2>Come funziona</h2></div>
  <section class="card small ${R(4)}">
    <div class="tip"><span class="ti">🔢</span><p><b>Calorie</b>: metabolismo basale con la formula di Mifflin-St Jeor per il livello di attività. Deficit massimo ~0,5–0,75% del peso a settimana, mai sotto il metabolismo basale.</p></div>
    <div class="tip"><span class="ti">🏋️</span><p><b>Allenamenti</b>: schemi motori fondamentali scelti tra gli esercizi compatibili con attrezzi, livello e salute. Cicli di 4 settimane con scarico.</p></div>
    <div class="tip"><span class="ti">🧊</span><p><b>3D</b>: ogni esercizio è animato su un manichino con i muscoli principali evidenziati. Trascina per ruotarlo.</p></div>
    <div class="tip"><span class="ti">🔁</span><p><b>Adattamento</b>: pesate e sensazioni dopo ogni allenamento correggono calorie, giorni o livello.</p></div>
  </section>
  <p class="disclaimer">Ritmo non è un dispositivo medico e non sostituisce il parere di un professionista.</p>`;
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

function markDone(iso, fb) {
  const lg = dayLog(iso);
  lg.done = true; lg.feedback = fb; lg.doneAt = new Date().toISOString();
  showFeedback = false;
  save(); rerender();
  burst(innerWidth / 2, innerHeight * 0.35);
  haptic([20, 40, 20]);
  toast(['Grande lavoro', 'Un passo in più verso l’obiettivo', 'Fatto: la costanza paga'][Math.floor(Math.random() * 3)]);
}

function startPlayer(iso) {
  const week = Math.max(1, Math.floor(daysBetween(fromISO(state.planStart), fromISO(iso)) / 7) + 1);
  const { session } = sessionFor(getPlan(week), iso);
  if (!session) return;
  const lg = dayLog(iso);
  openPlayer(session, {
    doneKeys: lg.items,
    onItemDone: (key) => { const l = dayLog(iso); if (!l.items.includes(key)) l.items.push(key); save(); },
    onFinish: (fb) => markDone(iso, fb),
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
  const t = e.target.closest('[data-action], .seg button, .chips[data-multi] button, .goal-grid button');
  if (!t || t.closest('#player') || t.closest('.sheet')) return;

  const slotSeg = t.parentElement?.closest('.seg[data-slot]');
  if (slotSeg && draft && !t.dataset.action) {
    const i = Number(slotSeg.dataset.slot), f = slotSeg.dataset.field;
    draft.sessioni[i][f] = f === 'giorni' ? Number(t.dataset.value) : t.dataset.value;
    slotSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t));
    updateWeekTotal(); haptic(8);
    return;
  }
  const segEl = t.parentElement?.closest('.seg[data-name], .goal-grid[data-name]');
  if (segEl && draft && !t.dataset.action) {
    const name = segEl.dataset.name;
    if (name.startsWith('dol_')) { draft.dolori = draft.dolori || {}; draft.dolori[name.slice(4)] = Number(t.dataset.value); }
    else draft[name] = ['sonno', 'giorni'].includes(name) ? Number(t.dataset.value) : t.dataset.value;
    segEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t));
    if (name === 'giorni') updateWeekTotal();
    haptic(8);
    return;
  }
  const multi = t.parentElement?.closest('.chips[data-multi]');
  if (multi && draft && !t.dataset.action) {
    const name = multi.dataset.multi;
    const set = new Set(draft[name] || []);
    set.has(t.dataset.value) ? set.delete(t.dataset.value) : set.add(t.dataset.value);
    draft[name] = [...set];
    t.classList.toggle('on');
    haptic(8);
    return;
  }

  const a = t.dataset.action;
  switch (a) {
    case 'start-setup': startWizard(false); break;
    case 'start-story': location.hash = '#/racconto'; break;
    case 'slot-add': draft.sessioni.push({ giorni: 3, minuti: 20, luogo: 'casa' }); rerender(); break;
    case 'slot-del': draft.sessioni.splice(Number(t.dataset.i), 1); rerender(); break;
    case 'story-example': { const el = document.getElementById('story'); el.value = EXAMPLE; storySave(EXAMPLE); updateStoryCoverage(); break; }
    case 'story-mic': toggleDictation(t); break;
    case 'story-analyze': analyzeStory(t); break;
    case 'story-edit-all': { wizardStep = 0; draft._edit = !!state.profile; location.hash = '#/setup'; break; }
    case 'story-generate': {
      const err = reviewError();
      const box = document.getElementById('wiz-error');
      if (err) { box.textContent = err; box.hidden = false; box.scrollIntoView({ block: 'center' }); haptic([10, 30, 10]); return; }
      finishWizard();
      break;
    }
    case 'ai-save': {
      const v = document.getElementById('ai-key').value.trim();
      if (!/^sk-ant-/.test(v)) { toast('La chiave deve iniziare con sk-ant-'); return; }
      aiKey(v); toast('Chiave salvata su questo dispositivo'); rerender();
      break;
    }
    case 'ai-remove': aiKey(null); toast('Chiave rimossa'); rerender(); break;
    case 'edit-profile': startWizard(true); break;
    case 'wiz-back':
      if (wizardStep > 0) { wizardStep--; route(); window.scrollTo(0, 0); }
      else location.hash = state.profile ? '#/profilo' : '#/benvenuto';
      break;
    case 'wiz-next': {
      const err = STEPS[wizardStep].validate(draft);
      const box = document.getElementById('wiz-error');
      if (err) { box.textContent = err; box.hidden = false; haptic([10, 30, 10]); return; }
      if (wizardStep < STEPS.length - 1) {
        wizardStep++;
        const go = () => { route(); window.scrollTo(0, 0); };
        if (document.startViewTransition && !reduced()) document.startViewTransition(go); else go();
      } else finishWizard();
      break;
    }
    case 'pick-day': selectedDay = Number(t.dataset.day); showFeedback = false; rerender(); break;
    case 'gym-pick': {
      clearTimeout(gymTimer);
      const ta = document.getElementById('gym-text');
      const cur = ta ? ta.value : state.profile.schedaPalestra || '';
      gymApply(togglePick(cur, t.dataset.key, PICK_LABELS[t.dataset.key]?.label));
      haptic(8);
      break;
    }
    case 'gym-done': clearTimeout(gymTimer); { const el = document.getElementById('gym-text'); if (el) { state.profile.schedaPalestra = el.value; save(); } } location.hash = '#/piano'; toast('Piano aggiornato con la tua scheda'); break;
    case 'open-ex': {
      const id = t.dataset.id;
      const o = { dose: t.dataset.dose };
      if (t.dataset.swap) {
        o.alternatives = alternativesFor(id, state.profile, planCtx()).map((e) => ({ id: e.id, name: e.n }));
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
    case 'play': startPlayer(t.dataset.iso); break;
    case 'toggle-item': {
      const lg = dayLog(t.dataset.iso);
      const set = new Set(lg.items);
      set.has(t.dataset.key) ? set.delete(t.dataset.key) : set.add(t.dataset.key);
      lg.items = [...set];
      haptic(10);
      save(); rerender();
      break;
    }
    case 'ask-feedback': showFeedback = true; rerender(); break;
    case 'done': markDone(t.dataset.iso, t.dataset.fb); break;
    case 'undo-done': { const lg = dayLog(t.dataset.iso); lg.done = false; delete lg.feedback; save(); rerender(); break; }
    case 'move-session': { const lg = dayLog(t.dataset.iso); lg.sessionFrom = Number(t.dataset.from); save(); rerender(); break; }
    case 'habit': {
      const lg = dayLog(today());
      lg.habits = lg.habits || {};
      lg.habits[t.dataset.key] = !lg.habits[t.dataset.key];
      haptic(10);
      save(); rerender();
      if (Object.values(lg.habits).filter(Boolean).length === 4 && lg.habits[t.dataset.key]) { burst(innerWidth / 2, innerHeight * 0.7); toast('Tutte le abitudini di oggi completate'); }
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
        state = empty(); save(); selectedDay = null; location.hash = '#/benvenuto'; route();
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
    save(); toast('Backup importato'); location.hash = '#/oggi'; rerender();
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

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
