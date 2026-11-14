// Scheda esercizio: foto dimostrative + guida tecnica dettagliata.

import { BY_ID } from './exercises.js';
import { guideFor, MUSCLE_LABELS } from './guide.js';
import { ICON } from './fx.js';
import { demoHTML, handleDemoClick } from './demo.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CAT = { warmup: 'Riscaldamento', strength: 'Forza', cardio: 'Cardio', mobility: 'Mobilità', balance: 'Equilibrio' };
const LVL = ['', 'Base', 'Intermedio', 'Avanzato'];

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

function swapSection() {
  if (!current?.alts) return '';
  return `
    <p class="sub-h">Non ti piace o non puoi farlo?</p>
    ${current.alts.length ? `<p class="small muted">Sostituiscilo nel tuo piano con:</p>
    <div class="chips" style="margin-top:8px">${current.alts.slice(0, 8).map((a) => `<button data-sheet="swap" data-to="${a.id}">${esc(a.name)}</button>`).join('')}</div>` : '<p class="small muted">Non ci sono alternative adatte a te per questo schema motorio.</p>'}
    <button class="btn danger wide" style="margin-top:12px" data-sheet="exclude">Mi dà fastidio: escludilo dal piano</button>`;
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
    <a class="btn ghost wide" style="margin-top:14px" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">${ICON.video} Guarda un video del movimento</a>
    <p class="small muted" style="margin-top:8px;text-align:center">Apre YouTube: scegli video di fisioterapisti o preparatori qualificati.</p>
    ${swapSection()}`;
}

let current = null;

export function openSheet(id, opts = {}) {
  const ex = BY_ID[id];
  const g = guideFor(id);
  if (!ex || !g) return;
  ensureHost();
  lastFocus = document.activeElement;
  current = { id, ex, g, dose: opts.dose, tab: 'come', alts: opts.alternatives || null, onSwap: opts.onSwap, onExclude: opts.onExclude };
  host.innerHTML = `
    <div class="scrim" data-sheet="close"></div>
    <div class="panel">
      <div class="grab"></div>
      <div class="stage">
        ${demoHTML(id)}
        <button class="icon-btn stage-close" data-sheet="close" aria-label="Chiudi">${ICON.close}</button>
      </div>
      <div class="sheet-body">
        <p class="kicker">${CAT[ex.cat]} · livello ${LVL[ex.lvl].toLowerCase()}</p>
        <h2 style="margin-top:4px">${esc(ex.n)}</h2>
        ${opts.dose ? `<p class="sheet-dose">Oggi per te: <b>${esc(opts.dose)}</b></p>` : ''}
        <div class="mus-chips">${g.mm.map((m, i) => `<span class="chip ${i === 0 ? 'accent' : ''}">${MUSCLE_LABELS[m]}</span>`).join('')}</div>
        <div class="tabs" role="tablist">
          <button class="on" data-sheet="tab" data-t="come">Come si fa</button>
          <button data-sheet="tab" data-t="errori">Errori</button>
          <button data-sheet="tab" data-t="varianti">${opts.alternatives ? 'Cambia' : 'Varianti'}</button>
        </div>
        <div id="sheet-tab">${tabContent('come', g, ex, opts.dose)}</div>
      </div>
    </div>`;
  host.hidden = false;
  document.body.classList.add('locked');
  host.querySelector('[data-sheet=close]:not(.scrim)')?.focus({ preventScroll: true });

}

export function closeSheet() {
  if (!host || host.hidden) return;
  current = null;
  host.hidden = true; host.innerHTML = '';
  document.body.classList.remove('locked');
  lastFocus?.focus?.({ preventScroll: true });
}

function onClick(e) {
  if (handleDemoClick(e)) return;
  const t = e.target.closest('[data-sheet]');
  if (!t) return;
  const a = t.dataset.sheet;
  if (a === 'close') closeSheet();
  if (a === 'tab' && current) {
    current.tab = t.dataset.t;
    host.querySelectorAll('[data-sheet=tab]').forEach((b) => b.classList.toggle('on', b === t));
    document.getElementById('sheet-tab').innerHTML = tabContent(current.tab, current.g, current.ex, current.dose);
  }
  if (a === 'swap' && current) { const { id, onSwap } = current; closeSheet(); onSwap?.(id, t.dataset.to); return; }
  if (a === 'exclude' && current) { const { id, onExclude } = current; closeSheet(); onExclude?.(id); return; }
}
