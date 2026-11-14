// Dimostrazione di un esercizio: due foto reali (partenza e arrivo) che si alternano.
// L'alternanza è fatta in CSS; un tocco la mette in pausa e mostra una foto alla volta.

import { BY_ID } from './exercises.js';
import { demoFor, videoSearchUrl } from './demos.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** riquadro grande con le due foto animate (scheda esercizio, allenamento guidato) */
export function demoHTML(id, { note = true } = {}) {
  const ex = BY_ID[id];
  const d = demoFor(id);
  if (!d) {
    return `<div class="demo demo-empty">
      <div><span class="demo-ico">🎬</span>
      <p>${esc(ex?.how || '')}</p>
      ${ex ? `<a class="btn soft small" href="${videoSearchUrl(ex.n)}" target="_blank" rel="noopener">Guarda un video</a>` : ''}</div>
    </div>`;
  }
  return `<div class="demo" data-demo role="img" aria-label="${esc(ex?.n || '')}: posizione di partenza e di arrivo">
    <img class="demo-a" src="${d.a}" alt="" decoding="async">
    <img class="demo-b" src="${d.b}" alt="" decoding="async">
    <span class="demo-lbl demo-lbl-a">1 · Partenza</span>
    <span class="demo-lbl demo-lbl-b">2 · Arrivo</span>
    <span class="demo-hint">Tocca per fermare</span>
  </div>${note && d.nota ? `<p class="demo-note">${esc(d.nota)}</p>` : ''}`;
}

/** miniatura per gli elenchi */
export function thumbHTML(id) {
  const d = demoFor(id);
  return d ? `<span class="thumb"><img src="${d.b}" alt="" loading="lazy" decoding="async"></span>` : '<span class="thumb thumb-empty">🎬</span>';
}

/** tocco sulla dimostrazione: ferma l'alternanza e passa da una foto all'altra */
export function handleDemoClick(e) {
  const el = e.target.closest('[data-demo]');
  if (!el) return false;
  if (!el.classList.contains('paused')) { el.classList.add('paused'); el.dataset.frame = 'a'; }
  else if (el.dataset.frame === 'a') el.dataset.frame = 'b';
  else { el.classList.remove('paused'); delete el.dataset.frame; }
  const hint = el.querySelector('.demo-hint');
  if (hint) hint.textContent = el.classList.contains('paused') ? (el.dataset.frame === 'a' ? 'Tocca: arrivo' : 'Tocca per riprendere') : 'Tocca per fermare';
  return true;
}

/** scarica in anticipo le foto di un elenco di esercizi, così sono pronte anche offline */
export function warmDemos(ids) {
  const urls = [...new Set(ids)].flatMap((id) => { const d = demoFor(id); return d ? [d.a, d.b] : []; });
  const run = () => urls.forEach((u) => { const im = new Image(); im.decoding = 'async'; im.src = u; });
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 1500);
}
