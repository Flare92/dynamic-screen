// Valutazione guidata: misure + test fisici con dimostrazione 3D e strumenti integrati
// (cronometro, conto alla rovescia, metronomo per lo step test, conteggio del polso).

import { TESTS, MEASURES, AREAS } from './assessment.js';
import { guideFor } from './guide.js';
import { ICON, load3D, beep, haptic, speak } from './fx.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.id, a.label]));

let S = null; // stato della valutazione in corso

/**
 * opts: { profile, withMeasures, prev (valori precedenti), onDone(entry), onCancel() }
 */
export function startAssessment(opts) {
  stopTools();
  S = {
    ...opts,
    screen: 'intro', i: 0,
    vals: {}, meas: {},
    tool: null, viewer: null, shown: null,
  };
}
export const assessmentActive = () => !!S;

function list() { return TESTS; }
function reason(t) { return t.when(S.profile, S.vals); }

// ------------------------------------------------------------------
// Rendering
// ------------------------------------------------------------------

export function renderAssessment() {
  if (!S) return '';
  if (S.screen === 'intro') return intro();
  if (S.screen === 'measures') return measures();
  if (S.screen === 'done') return doneScreen();
  return testScreen();
}

function top(label, pct) {
  return `
  <div class="wizard-top reveal">
    <button class="icon-btn" data-as="back" aria-label="Indietro">${ICON.prev}</button>
    <div class="progress-line"><i style="width:${Math.round(pct * 100)}%"></i></div>
    <span class="mono small muted">${label}</span>
  </div>`;
}

function intro() {
  const n = list().filter((t) => !reason(t)).length;
  return `
  ${top('', 0)}
  <section class="stack-lg">
    <div class="reveal" style="--i:1"><p class="kicker">${S.retest ? 'Test di controllo' : 'Valutazione iniziale'}</p><h1 style="margin-top:6px">${S.retest ? 'Misuriamo i tuoi progressi' : 'Il tuo vero punto di partenza'}</h1>
    <p class="muted" style="margin-top:10px">${S.retest ? 'Rifai gli stessi test di 4 settimane fa: confronteremo i risultati e adatteremo il piano.' : 'Bastano 15 minuti. Ogni risultato viene confrontato con i valori di riferimento per la tua età e il tuo sesso, e decide livello, dosi ed esercizi correttivi del tuo piano.'}</p></div>
    <div class="card reveal" style="--i:2">
      <p class="kicker">Ti serve</p>
      <div class="need-grid">
        <div>🪑<span>Una sedia stabile</span></div><div>🪜<span>Un gradino di ~30 cm</span></div>
        <div>📏<span>Un metro da sarta</span></div><div>🧱<span>Un muro libero</span></div>
      </div>
      <p class="small muted" style="margin-top:12px">Cronometro, metronomo e conteggio del polso sono nell’app. ${n} test adatti a te: quelli non sicuri per la tua salute vengono saltati in automatico. Puoi saltarne altri e farli dopo.</p>
    </div>
    <div class="alert info reveal" style="--i:3"><span>ℹ︎</span><span>Fai i test riposato, non dopo un allenamento. Fermati subito in caso di dolore, capogiri o fiato corto anomalo.</span></div>
    <div class="wizard-actions"><button class="btn primary" data-as="start">${ICON.play} Inizia</button></div>
    ${S.retest ? '' : '<button class="link small" data-as="later" style="display:block;margin:0 auto">Lo farò più tardi</button>'}
  </section>`;
}

function measures() {
  const p = S.profile;
  const fields = MEASURES.filter((m) => !m.sex || m.sex === p.sesso);
  return `
  ${top('Misure', 0.02)}
  <section class="stack-lg">
    <div class="reveal" style="--i:1"><p class="kicker">Misure di oggi</p><h1 style="margin-top:6px">Peso e circonferenze</h1></div>
    <label class="field reveal" style="--i:2"><span>Peso (kg)</span><input type="number" step="0.1" inputmode="decimal" data-meas="peso" value="${esc(S.meas.peso ?? '')}"><small>Al mattino, a digiuno.</small></label>
    ${fields.map((m, i) => `<label class="field reveal" style="--i:${i + 3}"><span>${m.label} (${m.unit})${m.optional ? ' · facoltativa' : ''}</span><input type="number" inputmode="decimal" data-meas="${m.id}" value="${esc(S.meas[m.id] ?? '')}"><small>${m.how}</small></label>`).join('')}
    <div class="wizard-actions"><button class="btn primary" data-as="meas-next">Avanti</button></div>
  </section>`;
}

function testScreen() {
  const T = list();
  const t = T[S.i];
  const why = reason(t);
  const g = guideFor(t.ex);
  const v = S.vals[t.id];
  const tool = S.tool && S.tool.id === t.id ? S.tool : null;
  const pct = (S.i + 1) / (T.length + 1);
  const label = `${String(S.i + 1).padStart(2, '0')}/${String(T.length).padStart(2, '0')}`;

  if (why) {
    return `${top(label, pct)}
    <section class="stack-lg">
      <div class="reveal"><p class="kicker">${AREA_LABEL[t.area]}</p><h1 style="margin-top:6px">${t.title}</h1></div>
      <div class="alert attenzione reveal" style="--i:1"><span>⤼</span><span>${esc(why)}</span></div>
      <div class="wizard-actions"><button class="btn primary" data-as="next">Avanti</button></div>
    </section>`;
  }

  let input = '';
  if (t.variants) {
    const cur = S.vals[t.id + 'Var'] || t.variants[0][0];
    input += `<div class="field"><span>Versione</span><div class="seg" data-as-var="${t.id}">${t.variants.map(([id, l]) => `<button type="button" data-v="${id}" class="${cur === id ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
  }
  if (t.kind === 'choice') {
    input += `<div class="choice-list">${t.options.map(([val, l]) => `<button type="button" data-as="choose" data-v="${val}" class="${String(v) === String(val) ? 'on' : ''}"><i>${val}</i>${esc(l)}</button>`).join('')}</div>`;
  } else {
    if (t.kind === 'hold') {
      input += `<div class="tool card flat"><div class="tool-num" id="as-num">${tool ? fmtS(tool.elapsed) : v ? fmtS(v) : '0,0'}</div><p class="kicker" style="text-align:center">${tool?.running ? 'In corso…' : 'Cronometro'}</p>
        <button class="btn ${tool?.running ? 'ghost' : 'primary'} wide" data-as="${tool?.running ? 'stop' : 'stopwatch'}">${tool?.running ? 'Stop' : v ? 'Ripeti' : 'Avvia cronometro'}</button></div>`;
    }
    if (t.kind === 'count') {
      input += `<div class="tool card flat"><div class="tool-num" id="as-num">${tool ? Math.ceil(tool.left) : t.timer}</div><p class="kicker" style="text-align:center">${tool ? (tool.prep ? 'Preparati' : 'Vai! Conta le alzate') : 'Secondi'}</p>
        ${tool ? '<button class="btn ghost wide" data-as="stop">Annulla</button>' : `<button class="btn primary wide" data-as="countdown">Avvia ${t.timer} secondi</button>`}</div>`;
    }
    if (t.kind === 'hr') {
      const phase = tool?.phase;
      input += `<div class="tool card flat"><div class="tool-num" id="as-num">${tool ? fmtMin(tool.left) : '3:00'}</div>
        <p class="kicker" style="text-align:center" id="as-phase">${phase === 'step' ? 'Su-su-giù-giù al ritmo del bip' : phase === 'pulse' ? 'Seduto: conta i battiti del polso' : phase === 'prep' ? 'Preparati' : 'Step 3 minuti + 1 minuto di polso'}</p>
        ${tool ? '<button class="btn ghost wide" data-as="stop">Annulla</button>' : '<button class="btn primary wide" data-as="steptest">Avvia step test</button>'}</div>`;
    }
    input += `<label class="field"><span>Risultato (${t.unit})</span><input type="number" inputmode="decimal" id="as-val" value="${esc(v ?? '')}" placeholder="${t.kind === 'hr' ? 'battiti contati in 1 minuto' : ''}"></label>`;
  }

  return `
  ${top(label, pct)}
  <section class="stack">
    <div class="reveal"><p class="kicker">${AREA_LABEL[t.area]}</p><h1 style="margin-top:6px">${t.title}</h1></div>
    <div class="test-stage reveal" style="--i:1"><div class="viewer" id="as-viewer"><div class="fallback"><div class="loader"></div></div></div></div>
    <div class="card reveal" style="--i:2">
      <p class="sub-h" style="margin-top:0">Preparazione</p>
      <ol class="steps-list">${t.setup.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      ${t.steps.length ? `<p class="sub-h">Come si fa</p><ol class="steps-list">${t.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    </div>
    <div class="stack reveal" style="--i:3">${input}</div>
    <p class="error" id="as-err" hidden></p>
    <div class="wizard-actions">
      <button class="btn ghost" data-as="skip" style="flex:0 0 auto">Salta</button>
      <button class="btn primary" data-as="save">Salva e avanti</button>
    </div>
    ${g ? `<p class="small muted" style="text-align:center">${esc(g.perche)}</p>` : ''}
  </section>`;
}

function doneScreen() {
  const n = Object.keys(S.vals).filter((k) => !k.endsWith('Var')).length;
  return `
  <section class="finish-screen stack-lg">
    <span class="chip volt reveal"><i></i>Valutazione completata</span>
    <h1 class="reveal" style="--i:1">${n} test registrati</h1>
    <p class="muted reveal" style="--i:2">Sto ricalcolando livelli, dosi, esercizi correttivi e traguardi sui tuoi risultati.</p>
    <button class="btn primary wide reveal" style="--i:3" data-as="finish">Vedi il tuo punto di partenza</button>
  </section>`;
}

const fmtS = (s) => (Math.round(s * 10) / 10).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtMin = (s) => { const x = Math.max(0, Math.ceil(s)); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };

// ------------------------------------------------------------------
// Montaggio 3D e strumenti
// ------------------------------------------------------------------

export async function mountAssessment() {
  if (!S || S.screen !== 'test') { disposeViewer(); return; }
  const t = list()[S.i];
  if (reason(t)) { disposeViewer(); return; }
  const el = document.getElementById('as-viewer');
  if (!el) return;
  try {
    const m = await load3D();
    if (!S || !document.getElementById('as-viewer')) return;
    if (!m.webglAvailable()) { el.innerHTML = ''; return; }
    disposeViewer();
    el.innerHTML = '';
    S.viewer = m.createViewer(el, { exercise: t.ex, muscles: guideFor(t.ex)?.mm || [] });
  } catch { el.innerHTML = ''; }
}
function disposeViewer() { if (S?.viewer) { S.viewer.dispose(); S.viewer = null; } }

function stopTools() {
  if (S?.tool?.int) clearInterval(S.tool.int);
  if (S) S.tool = null;
}

function paintTool() {
  const el = document.getElementById('as-num');
  if (!el || !S?.tool) return;
  const tl = S.tool;
  if (tl.kind === 'hold') el.textContent = fmtS(tl.elapsed);
  else if (tl.kind === 'count') el.textContent = Math.ceil(tl.left);
  else el.textContent = fmtMin(tl.left);
}

function startStopwatch(t, rerender) {
  stopTools();
  const t0 = performance.now();
  S.tool = { id: t.id, kind: 'hold', running: true, elapsed: 0 };
  S.tool.int = setInterval(() => {
    S.tool.elapsed = (performance.now() - t0) / 1000;
    if (S.tool.elapsed >= t.max) { S.tool.elapsed = t.max; finishStopwatch(t, rerender); return; }
    paintTool();
  }, 100);
  beep(990, 0.15); haptic(20);
  rerender();
}
function finishStopwatch(t, rerender) {
  const secs = Math.round(S.tool.elapsed);
  stopTools();
  S.vals[t.id] = secs;
  beep(660, 0.2); haptic([20, 40, 20]);
  rerender();
}

function startCountdown(t, rerender) {
  stopTools();
  S.tool = { id: t.id, kind: 'count', left: 3, prep: true };
  speak('Pronti', true);
  S.tool.int = setInterval(() => {
    S.tool.left -= 0.25;
    const w = Math.ceil(S.tool.left);
    if (Math.abs(S.tool.left - w) < 0.01 && w > 0 && w <= 3) beep(S.tool.prep ? 660 : 880, 0.1);
    if (S.tool.left <= 0) {
      if (S.tool.prep) { S.tool.prep = false; S.tool.left = t.timer; beep(1180, 0.25); speak('Via', true); rerender(); return; }
      beep(1180, 0.5); haptic([200, 80, 200]); speak('Stop. Inserisci quante alzate hai fatto', true);
      stopTools(); rerender();
      setTimeout(() => document.getElementById('as-val')?.focus(), 200);
      return;
    }
    paintTool();
  }, 250);
  rerender();
}

function startStepTest(t, rerender) {
  stopTools();
  const beat = 60 / t.metronome; // 0,625 s
  S.tool = { id: t.id, kind: 'hr', phase: 'prep', left: 5, beats: 0, acc: 0 };
  speak('Preparati sul gradino', true);
  let last = performance.now();
  S.tool.int = setInterval(() => {
    const now = performance.now();
    const dt = (now - last) / 1000; last = now;
    const tl = S.tool;
    tl.left -= dt;
    if (tl.phase === 'step') {
      tl.acc += dt;
      while (tl.acc >= beat) { tl.acc -= beat; beep(tl.beats % 4 === 0 ? 1050 : 760, 0.06, 0.15); tl.beats++; }
    }
    if (tl.left <= 0) {
      if (tl.phase === 'prep') { tl.phase = 'step'; tl.left = t.timer; tl.acc = beat; speak('Via', true); rerender(); return; }
      if (tl.phase === 'step') { tl.phase = 'pulse'; tl.left = 60; beep(1180, 0.4); speak('Siediti e conta i battiti', true); rerender(); return; }
      beep(1180, 0.5); haptic([200, 80, 200]); speak('Stop. Inserisci i battiti contati', true);
      stopTools(); rerender();
      setTimeout(() => document.getElementById('as-val')?.focus(), 200);
      return;
    }
    paintTool();
  }, 50);
  rerender();
}

// ------------------------------------------------------------------
// Eventi
// ------------------------------------------------------------------

export function handleAssessmentClick(e, rerender) {
  if (!S) return false;
  const varBtn = e.target.closest('[data-as-var] button');
  if (varBtn) {
    const id = varBtn.parentElement.dataset.asVar;
    S.vals[id + 'Var'] = varBtn.dataset.v;
    varBtn.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === varBtn));
    return true;
  }
  const t = e.target.closest('[data-as]');
  if (!t) return false;
  const a = t.dataset.as;
  const T = list();
  const test = T[S.i];
  const readInput = () => { const el = document.getElementById('as-val'); if (el && el.value !== '') S.vals[test.id] = Number(el.value); };
  const go = (fn) => { stopTools(); disposeViewer(); fn(); rerender(); window.scrollTo(0, 0); };

  switch (a) {
    case 'later': stopTools(); disposeViewer(); { const cb = S.onCancel; S = null; cb?.(); } break;
    case 'start': go(() => { S.screen = S.withMeasures ? 'measures' : 'test'; S.i = 0; }); break;
    case 'meas-next': {
      document.querySelectorAll('[data-meas]').forEach((el) => { if (el.value !== '') S.meas[el.dataset.meas] = Number(el.value); });
      go(() => { S.screen = 'test'; S.i = 0; });
      break;
    }
    case 'back':
      if (S.screen === 'test' && S.i > 0) go(() => { S.i--; });
      else if (S.screen === 'test' && S.withMeasures) go(() => { S.screen = 'measures'; });
      else if (S.screen === 'done') go(() => { S.screen = 'test'; S.i = T.length - 1; });
      else if (S.screen !== 'intro') go(() => { S.screen = 'intro'; });
      else { stopTools(); disposeViewer(); const cb = S.onCancel; S = null; cb?.(); }
      break;
    case 'choose':
      S.vals[test.id] = Number(t.dataset.v);
      t.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t));
      haptic(10);
      break;
    case 'stopwatch': startStopwatch(test, rerender); break;
    case 'stop':
      if (S.tool?.kind === 'hold') finishStopwatch(test, rerender);
      else { stopTools(); rerender(); }
      break;
    case 'countdown': startCountdown(test, rerender); break;
    case 'steptest': startStepTest(test, rerender); break;
    case 'skip': go(() => { delete S.vals[test.id]; nextTest(); }); break;
    case 'next': go(() => nextTest()); break;
    case 'save': {
      readInput();
      const v = S.vals[test.id];
      const err = document.getElementById('as-err');
      if (v === undefined || Number.isNaN(v) || v < 0) { err.textContent = 'Inserisci un risultato o tocca "Salta".'; err.hidden = false; return true; }
      if (test.kind === 'hr' && (v < 50 || v > 200)) { err.textContent = 'Il valore dei battiti non sembra corretto (50–200).'; err.hidden = false; return true; }
      if (test.variants && !S.vals[test.id + 'Var']) S.vals[test.id + 'Var'] = test.variants[0][0];
      go(() => nextTest());
      break;
    }
    case 'finish': {
      const entry = { results: { ...S.vals }, meas: { ...S.meas } };
      stopTools(); disposeViewer();
      const cb = S.onDone; S = null; cb?.(entry);
      break;
    }
    default: return false;
  }
  return true;
}

function nextTest() {
  if (S.i < list().length - 1) S.i++;
  else S.screen = 'done';
}

export function cancelAssessment() { if (S) { stopTools(); disposeViewer(); S = null; } }
