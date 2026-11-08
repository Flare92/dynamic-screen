// Scheda esercizio: animazione 3D + guida tecnica dettagliata.

import { BY_ID } from './exercises.js';
import { guideFor, MUSCLE_LABELS } from './guide.js';
import { ICON, load3D } from './fx.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CAT = { warmup: 'Riscaldamento', strength: 'Forza', cardio: 'Cardio', mobility: 'Mobilità', balance: 'Equilibrio' };
const LVL = ['', 'Base', 'Intermedio', 'Avanzato'];

let viewer = null;
let host = null;
let lastFocus = null;

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.className = 'sheet';
  host.hidden = true;
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  document.body.appendChild(host);
  host.addEventListener('click', onClick);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !host.hidden) closeSheet(); });
  return host;
}

function tabContent(tab, g, ex, dose) {
  if (tab === 'come') {
    return `
      <p class="muted" style="margin-top:6px">${esc(g.perche)}</p>
      <p class="sub-h">Posizione di partenza</p>
      <ol class="steps-list">${g.setup.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="sub-h">Esecuzione</p>
      <ol class="steps-list">${g.passi.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="info-grid">
        <div><span>Respirazione</span><p>${esc(g.respiro)}</p></div>
        <div><span>Ritmo</span><p>${esc(g.ritmo)}</p></div>
      </div>`;
  }
  if (tab === 'errori') {
    return `
      <p class="sub-h">Errori da evitare</p>
      <ol class="steps-list err-list">${g.errori.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="alert attenzione" style="margin-top:14px"><span>⚠︎</span><span><b>Sicurezza:</b> ${esc(g.sicurezza)}</span></div>
      ${ex.how ? `<p class="sub-h">In breve</p><p class="muted">${esc(ex.how)}</p>` : ''}`;
  }
  const q = encodeURIComponent(`${ex.n} esecuzione corretta`);
  return `
    <div class="info-grid" style="grid-template-columns:1fr">
      <div><span>Più facile</span><p>${esc(g.facile)}</p></div>
      <div><span>Più difficile</span><p>${esc(g.difficile)}</p></div>
    </div>
    ${dose ? `<div class="alert ok" style="margin-top:12px"><span>◎</span><span><b>Oggi per te:</b> ${esc(dose)}</span></div>` : ''}
    <a class="btn ghost wide" style="margin-top:14px" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">${ICON.video} Cerca video tutorial</a>
    <p class="small muted" style="margin-top:8px;text-align:center">Apre YouTube: scegli video di fisioterapisti o preparatori qualificati.</p>`;
}

let current = null;

export async function openSheet(id, opts = {}) {
  const ex = BY_ID[id];
  const g = guideFor(id);
  if (!ex || !g) return;
  ensureHost();
  lastFocus = document.activeElement;
  current = { id, ex, g, dose: opts.dose, tab: 'come' };
  host.innerHTML = `
    <div class="scrim" data-sheet="close"></div>
    <div class="panel">
      <div class="grab"></div>
      <div class="stage">
        <div class="viewer" id="sheet-viewer"><div class="fallback"><div class="loader"></div></div></div>
        <div class="hud">
          <span class="chip cyan live"><i></i>3D · ${CAT[ex.cat]}</span>
          <button class="icon-btn" data-sheet="close" aria-label="Chiudi">${ICON.close}</button>
        </div>
        <span class="hint">TRASCINA PER RUOTARE</span>
        <div class="controls">
          <button data-sheet="view" data-v="front">Fronte</button>
          <button data-sheet="view" data-v="side">Lato</button>
          <button data-sheet="speed" class="">0.5×</button>
          <button data-sheet="pause">Pausa</button>
        </div>
      </div>
      <div class="sheet-body">
        <p class="kicker">${CAT[ex.cat]} · livello ${LVL[ex.lvl]}</p>
        <h2 style="margin-top:6px">${esc(ex.n)}</h2>
        <div class="mus-chips">${g.mm.map((m, i) => `<span class="chip ${i === 0 ? 'volt' : ''}">${MUSCLE_LABELS[m]}</span>`).join('')}</div>
        <div class="tabs" role="tablist">
          <button class="on" data-sheet="tab" data-t="come">Come si fa</button>
          <button data-sheet="tab" data-t="errori">Errori</button>
          <button data-sheet="tab" data-t="varianti">Varianti</button>
        </div>
        <div id="sheet-tab">${tabContent('come', g, ex, opts.dose)}</div>
      </div>
    </div>`;
  host.hidden = false;
  document.body.classList.add('locked');
  host.querySelector('[data-sheet=close]:not(.scrim)')?.focus({ preventScroll: true });

  try {
    const m = await load3D();
    if (!current || current.id !== id) return;
    const el = document.getElementById('sheet-viewer');
    if (!m.webglAvailable()) { el.innerHTML = '<div class="fallback">Il tuo dispositivo non supporta la grafica 3D.<br>Segui le istruzioni passo passo qui sotto.</div>'; return; }
    el.innerHTML = '';
    viewer?.dispose();
    viewer = m.createViewer(el, { exercise: id, muscles: g.mm });
  } catch {
    const el = document.getElementById('sheet-viewer');
    if (el) el.innerHTML = '<div class="fallback">Animazione non disponibile offline al primo avvio.</div>';
  }
}

export function closeSheet() {
  if (!host || host.hidden) return;
  viewer?.dispose(); viewer = null; current = null;
  host.hidden = true; host.innerHTML = '';
  document.body.classList.remove('locked');
  lastFocus?.focus?.({ preventScroll: true });
}

function onClick(e) {
  const t = e.target.closest('[data-sheet]');
  if (!t) return;
  const a = t.dataset.sheet;
  if (a === 'close') closeSheet();
  if (a === 'tab' && current) {
    current.tab = t.dataset.t;
    host.querySelectorAll('[data-sheet=tab]').forEach((b) => b.classList.toggle('on', b === t));
    document.getElementById('sheet-tab').innerHTML = tabContent(current.tab, current.g, current.ex, current.dose);
  }
  if (!viewer) return;
  if (a === 'view') { viewer.view(t.dataset.v); host.querySelectorAll('[data-sheet=view]').forEach((b) => b.classList.toggle('on', b === t)); }
  if (a === 'speed') { const slow = viewer.speed !== 0.5; viewer.setSpeed(slow ? 0.5 : 1); t.classList.toggle('on', slow); }
  if (a === 'pause') { const playing = viewer.toggle(); t.textContent = playing ? 'Pausa' : 'Play'; t.classList.toggle('on', !playing); }
}
