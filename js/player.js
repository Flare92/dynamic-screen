// Allenamento guidato a schermo intero: manichino 3D, timer, serie, recuperi, voce.

import { guideFor, MUSCLE_LABELS } from './guide.js';
import { ICON, load3D, beep, speak, haptic, burst } from './fx.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ------------------------------------------------------------------
// Dal programma della sessione alla sequenza di passi
// ------------------------------------------------------------------

export function parseDose(it, block) {
  const d = it.dose || '';
  let m;
  if (block.items.length === 1 && /min/.test(d) && !/^\d+\s*×\s*\d+\s*s/.test(d)) return { sets: 1, secs: block.minutes * 60 };
  if ((m = d.match(/^(\d+)\s*×\s*(\d+)\s*s\b/))) return { sets: +m[1], secs: +m[2] };
  if ((m = d.match(/^(\d+)\s*×\s*([\d–-]+)/))) return { sets: +m[1], reps: m[2] + (/per lato/.test(d) ? ' per lato' : '') };
  if ((m = d.match(/^(\d+)\s*s\b/))) return { sets: 1, secs: +m[1] };
  if ((m = d.match(/^(\d+)\s*min/))) return { sets: 1, secs: +m[1] * 60 };
  return { sets: 1 };
}

export function buildSteps(session) {
  const steps = [];
  session.blocks.forEach((b, bi) => {
    const circuit = /giri/.test(b.note || '') && b.name === 'Circuito';
    const rounds = circuit ? Number((b.note.match(/(\d+) giri/) || [0, 1])[1]) : 1;
    for (let r = 0; r < rounds; r++) {
      b.items.forEach((it, ii) => {
        const key = `${bi}:${ii}`;
        const base = { type: 'work', id: it.id, name: it.name, key, block: b.name, dose: it.dose };
        if (circuit) {
          steps.push({ ...base, set: r + 1, sets: rounds, secs: 40, last: r === rounds - 1, round: true });
          const lastItem = ii === b.items.length - 1;
          if (!(lastItem && r === rounds - 1)) steps.push({ type: 'rest', secs: lastItem ? 60 : 20 });
          return;
        }
        const p = parseDose(it, b);
        for (let s = 1; s <= p.sets; s++) {
          steps.push({ ...base, set: s, sets: p.sets, secs: p.secs || null, reps: p.reps || null, last: s === p.sets });
          if (it.rest && !(s === p.sets && ii === b.items.length - 1)) steps.push({ type: 'rest', secs: it.rest });
        }
      });
    }
  });
  // il recupero mostra l'esercizio successivo
  steps.forEach((s, i) => {
    if (s.type !== 'rest') return;
    const nx = steps.slice(i + 1).find((x) => x.type === 'work');
    if (nx) { s.next = nx; } else s.drop = true;
  });
  return steps.filter((s) => !s.drop);
}

// ------------------------------------------------------------------
// Interfaccia
// ------------------------------------------------------------------

let P = null;

export function openPlayer(session, opts) {
  const steps = buildSteps(session);
  if (!steps.length) return;
  const keys = [...new Set(steps.filter((s) => s.type === 'work').map((s) => s.key))];
  const host = document.getElementById('player');
  P = {
    session, steps, keys, opts, host, idx: 0, left: 0, running: false, phase: 'idle',
    viewer: null, shownEx: null, tick: null, start: Date.now(), done: new Set(opts.doneKeys || []),
    voice: (() => { try { return localStorage.getItem('ritmo.voice') !== '0'; } catch { return true; } })(),
    cueI: 0, cueT: 0, wake: null,
  };
  host.innerHTML = `
    <div class="p-top">
      <div class="p-bars">${keys.map((k) => `<i data-k="${k}"></i>`).join('')}</div>
      <div class="p-head">
        <span class="chip cyan live" id="p-block"><i></i></span>
        <div class="row">
          <span class="mono small muted" id="p-count"></span>
          <button class="icon-btn" data-p="voice" aria-label="Voce">${P.voice ? ICON.sound : ICON.mute}</button>
          <button class="icon-btn" data-p="close" aria-label="Chiudi">${ICON.close}</button>
        </div>
      </div>
    </div>
    <div class="p-stage"><div class="viewer" id="p-viewer"><div class="fallback"><div class="loader"></div></div></div></div>
    <div class="p-info">
      <p class="kicker" id="p-kicker"></p>
      <h2 id="p-name" style="margin-top:6px"></h2>
      <div class="p-timer" id="p-timer"></div>
      <div class="p-dose" id="p-dose"></div>
      <div class="set-dots" id="p-sets"></div>
      <p class="p-cue" id="p-cue"></p>
    </div>
    <div class="p-ctrl">
      <button class="round" data-p="prev" aria-label="Indietro">${ICON.prev}</button>
      <button class="btn primary p-main" data-p="main" id="p-main"></button>
      <button class="round" data-p="next" aria-label="Avanti">${ICON.next}</button>
    </div>`;
  host.hidden = false;
  host.classList.remove('rest');
  document.body.classList.add('locked');
  host.onclick = onClick;
  try { navigator.wakeLock?.request('screen').then((w) => { if (P) P.wake = w; }).catch(() => {}); } catch { /* */ }

  load3D().then((m) => {
    if (!P) return;
    const el = document.getElementById('p-viewer');
    if (!m.webglAvailable()) { el.innerHTML = ''; return; }
    el.innerHTML = '';
    P.viewer = m.createViewer(el, {});
    P.shownEx = null;
    paint();
  }).catch(() => { const el = document.getElementById('p-viewer'); if (el) el.innerHTML = ''; });

  enter(0);
  P.tick = setInterval(tick, 250);
}

function step() { return P.steps[P.idx]; }

function enter(i) {
  P.idx = Math.max(0, Math.min(P.steps.length - 1, i));
  const s = step();
  P.cueI = 0; P.cueT = 0;
  if (s.type === 'rest') {
    P.phase = 'rest'; P.left = s.secs; P.running = true;
    speak(`Recupero. Poi: ${s.next.name}`, P.voice);
  } else if (s.secs) {
    P.phase = 'prep'; P.left = 3; P.running = true;
    speak(`${s.name}. ${s.secs >= 60 ? Math.round(s.secs / 60) + ' minuti' : s.secs + ' secondi'}`, P.voice);
  } else {
    P.phase = 'reps'; P.running = false;
    speak(`${s.name}. ${s.reps ? 'Serie ' + s.set + ' di ' + s.sets + ', ' + s.reps.replace('–', ' a ') + ' ripetizioni' : ''}`, P.voice);
  }
  paint();
}

function completeWork(s) {
  if (s.type === 'work' && s.last && !P.done.has(s.key)) {
    P.done.add(s.key);
    P.opts.onItemDone?.(s.key);
  }
}

function advance(skip = false) {
  const s = step();
  if (!skip) completeWork(s);
  haptic(20);
  if (P.idx >= P.steps.length - 1) return finish();
  enter(P.idx + 1);
}

function tick() {
  if (!P || !P.running) return;
  P.left -= 0.25;
  P.cueT += 0.25;
  const whole = Math.ceil(P.left);
  if (Math.abs(P.left - whole) < 0.01 && whole <= 3 && whole > 0 && P.phase !== 'prep') beep(660, 0.12, 0.12);
  if (P.left <= 0) {
    if (P.phase === 'prep') { P.phase = 'work'; P.left = step().secs; beep(990, 0.25); speak('Via!', P.voice); }
    else { beep(1180, 0.3); advance(); return; }
  }
  if (P.cueT >= 5) { P.cueT = 0; P.cueI++; }
  paint(true);
}

function fmtT(t) {
  const s = Math.max(0, Math.ceil(t));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s);
}

function paint(light = false) {
  if (!P) return;
  const s = step();
  const host = P.host;
  const $ = (id) => document.getElementById(id);
  const work = s.type === 'work' ? s : s.next;
  host.classList.toggle('rest', s.type === 'rest');

  // barre di avanzamento
  const curKey = s.type === 'work' ? s.key : null;
  host.querySelectorAll('.p-bars i').forEach((b) => {
    const k = b.dataset.k;
    b.classList.toggle('done', P.done.has(k));
    b.classList.toggle('cur', k === curKey && !P.done.has(k));
    if (k === curKey) b.style.setProperty('--p', s.secs && P.phase === 'work' ? String(1 - P.left / s.secs) : String((s.set - 1) / s.sets));
  });

  // timer
  let timer = '';
  if (P.phase === 'rest' || P.phase === 'work') timer = fmtT(P.left);
  if (P.phase === 'prep') timer = fmtT(P.left);
  $('p-timer').textContent = timer;
  $('p-timer').style.display = timer ? '' : 'none';

  // testo che cambia a ogni secondo
  const g = guideFor(work.id);
  if (g) {
    const cues = s.type === 'rest' ? [`Prossimo: ${work.name}`, ...g.setup] : [...g.passi, `Respirazione: ${g.respiro}`];
    $('p-cue').textContent = cues[P.cueI % cues.length];
  }
  const mainLabel = s.type === 'rest' ? 'Salta recupero'
    : P.phase === 'prep' ? 'Preparati…'
      : P.phase === 'work' ? (P.running ? 'Pausa' : 'Riprendi')
        : (s.sets > 1 ? `Serie ${s.set} fatta ✓` : 'Fatto ✓');
  $('p-main').innerHTML = mainLabel;
  if (light) return;

  const workSteps = P.steps.filter((x) => x.type === 'work');
  const pos = workSteps.indexOf(work) + 1;
  $('p-count').textContent = `${pos}/${workSteps.length}`;
  $('p-block').innerHTML = `<i></i>${s.type === 'rest' ? 'Recupero' : esc(s.block)}`;
  $('p-kicker').textContent = s.type === 'rest' ? 'Prossimo esercizio' : (s.round ? `Giro ${s.set} di ${s.sets}` : s.sets > 1 ? `Serie ${s.set} di ${s.sets}` : g ? g.mm.slice(0, 3).map((m) => MUSCLE_LABELS[m]).join(' · ') : '');
  $('p-name').textContent = work.name;
  $('p-dose').textContent = s.type === 'rest' ? '' : (s.reps ? `${s.reps} ripetizioni` : s.round ? '40 s di lavoro' : '');
  $('p-sets').innerHTML = s.type === 'work' && s.sets > 1 ? Array.from({ length: s.sets }, (_, i) => `<i class="${i < s.set ? 'on' : ''}"></i>`).join('') : '';

  if (P.viewer && P.shownEx !== work.id) {
    P.viewer.setMotion(work.id, g ? g.mm : []);
    P.shownEx = work.id;
  }
}

function finish() {
  clearInterval(P.tick);
  P.running = false;
  const mins = Math.max(1, Math.round((Date.now() - P.start) / 60000));
  const sets = P.steps.filter((s) => s.type === 'work').length;
  speak('Allenamento completato. Grande lavoro!', P.voice);
  P.viewer?.dispose(); P.viewer = null;
  P.host.querySelector('.p-stage').remove();
  P.host.querySelector('.p-info').remove();
  P.host.querySelector('.p-ctrl').remove();
  const f = document.createElement('div');
  f.className = 'finish';
  f.innerHTML = `
    <span class="chip volt"><i></i>Completato</span>
    <div class="big grad-text">${mins}′</div>
    <p class="muted">${P.keys.length} esercizi · ${sets} serie e intervalli</p>
    <h2 style="margin-top:12px">Com’è andata?</h2>
    <div class="feedback" style="width:min(420px,100%)">
      <button data-p="fb" data-fb="facile"><span>😌</span>Facile</button>
      <button data-p="fb" data-fb="giusto"><span>💪</span>Giusto</button>
      <button data-p="fb" data-fb="duro"><span>🥵</span>Duro</button>
    </div>
    <p class="small muted" style="max-width:340px">Il tuo feedback serve ad adattare il livello delle prossime settimane.</p>`;
  P.host.appendChild(f);
  burst(innerWidth / 2, innerHeight * 0.35);
}

export function closePlayer() {
  if (!P) return;
  clearInterval(P.tick);
  P.viewer?.dispose();
  try { P.wake?.release(); } catch { /* */ }
  try { speechSynthesis.cancel(); } catch { /* */ }
  P.host.hidden = true; P.host.innerHTML = '';
  document.body.classList.remove('locked');
  const cb = P.opts.onClose;
  P = null;
  cb?.();
}

function onClick(e) {
  const t = e.target.closest('[data-p]');
  if (!t || !P) return;
  const a = t.dataset.p;
  const s = step();
  if (a === 'close') {
    const started = P.done.size > 0 || P.idx > 0;
    if (!started || confirm('Interrompere l’allenamento? Gli esercizi completati restano salvati.')) closePlayer();
  }
  if (a === 'voice') {
    P.voice = !P.voice;
    try { localStorage.setItem('ritmo.voice', P.voice ? '1' : '0'); } catch { /* */ }
    t.innerHTML = P.voice ? ICON.sound : ICON.mute;
    if (!P.voice) try { speechSynthesis.cancel(); } catch { /* */ }
  }
  if (a === 'main') {
    if (s.type === 'rest') advance();
    else if (P.phase === 'reps') advance();
    else if (P.phase === 'work') { P.running = !P.running; paint(); }
  }
  if (a === 'next') advance(true);
  if (a === 'prev') {
    let i = P.idx - 1;
    while (i > 0 && P.steps[i].type === 'rest') i--;
    enter(i);
  }
  if (a === 'fb') {
    P.opts.onFinish?.(t.dataset.fb);
    closePlayer();
  }
}
