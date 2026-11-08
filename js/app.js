import {
  CONDITIONS, GOALS, EQUIPMENT, WEEKDAYS, WEEKDAYS_LONG, TYPE_KIND,
  generatePlan, analyzeProgress, expectedWeight, buildSession, derive,
  toISO, fromISO, addDays, daysBetween, weekdayIndex, formatDate,
} from './engine.js';

// ==================================================================
// Stato (salvato solo sul dispositivo)
// ==================================================================

const KEY = 'ritmo.v1';
const empty = () => ({ profile: null, planStart: null, calorieAdjust: 0, log: {}, weights: [] });

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
let selectedDay = null; // giorno della settimana visualizzato in "Oggi"
let openHow = new Set();
let showFeedback = false;

const $app = document.getElementById('app');
const today = () => toISO(new Date());
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });

function currentWeek() {
  return Math.max(1, Math.floor(daysBetween(fromISO(state.planStart), new Date()) / 7) + 1);
}
function getPlan(week = currentWeek()) {
  return generatePlan(state.profile, { startISO: state.planStart, week, calorieAdjust: state.calorieAdjust });
}
function dayLog(iso) {
  if (!state.log[iso]) state.log[iso] = { done: false, items: [], habits: {} };
  return state.log[iso];
}

// ==================================================================
// Router
// ==================================================================

function route() {
  const hash = location.hash.replace('#/', '') || 'oggi';
  const tabbar = document.getElementById('tabbar');
  if (!state.profile && hash !== 'setup') { location.hash = '#/benvenuto'; }
  const page = state.profile ? (hash === 'benvenuto' ? 'oggi' : hash) : (hash === 'setup' ? 'setup' : 'benvenuto');
  const withTabs = !['setup', 'benvenuto'].includes(page);
  tabbar.hidden = !withTabs;
  document.body.classList.toggle('no-tabs', !withTabs);
  tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.tab === page));

  if (page === 'setup' && !draft) initDraft(!!state.profile);
  const views = { benvenuto: viewWelcome, setup: viewWizard, oggi: viewToday, piano: viewPlan, progressi: viewProgress, profilo: viewProfile };
  $app.innerHTML = (views[page] || viewToday)();
  if (page === 'setup') bindWizardInputs();
}
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); route(); });

function rerender() {
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
}

// ==================================================================
// Benvenuto
// ==================================================================

function viewWelcome() {
  return `
  <section class="hero-welcome stack-lg">
    <div>
      <img class="mark" src="icons/icon.svg" alt="">
      <h1>La tua routine,<br>su misura.</h1>
      <p class="muted" style="margin-top:12px;font-size:18px">Dimmi chi sei, cosa vuoi raggiungere e quanto tempo hai. Ti preparo un piano che tiene conto del tuo corpo, della tua salute e delle tue abitudini.</p>
    </div>
    <ul class="feature-list card">
      <li><span class="fi">🎯</span><div><b>Obiettivi chiari</b><p class="muted small">Quando ci arrivi, a che ritmo, con quali tappe.</p></div></li>
      <li><span class="fi">🩺</span><div><b>Sicuro per te</b><p class="muted small">Esclude gli esercizi non adatti alla tua storia clinica.</p></div></li>
      <li><span class="fi">⏱️</span><div><b>Sul tuo tempo</b><p class="muted small">Da 10 a 120 minuti al giorno, da 2 a 7 giorni a settimana.</p></div></li>
      <li><span class="fi">📈</span><div><b>Si adatta</b><p class="muted small">Segue i tuoi progressi e ti suggerisce quando cambiare.</p></div></li>
    </ul>
    <button class="btn primary wide" data-action="start-setup">Iniziamo · 2 minuti</button>
    <p class="disclaimer">I tuoi dati restano solo su questo dispositivo.<br>Ritmo non sostituisce il parere del medico.</p>
  </section>`;
}

// ==================================================================
// Wizard
// ==================================================================

const seg = (name, opts, val) => `<div class="seg" data-name="${name}">${opts.map(([v, l]) => `<button type="button" data-value="${v}" class="${String(val) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const chips = (name, opts, vals = []) => `<div class="chips" data-multi="${name}">${opts.map((o) => `<button type="button" data-value="${o.id}" class="${vals.includes(o.id) ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div>`;
const num = (name, label, val, attrs = '', hint = '') => `<label class="field"><span>${label}</span><input type="number" inputmode="decimal" name="${name}" value="${val ?? ''}" ${attrs}>${hint ? `<small>${hint}</small>` : ''}</label>`;

const STEPS = [
  {
    title: 'Il tuo corpo', sub: 'Servono per calcolare metabolismo e fabbisogno.',
    render: (d) => `
      <label class="field"><span>Come ti chiami?</span><input type="text" name="nome" value="${esc(d.nome)}" autocomplete="given-name" placeholder="Nome"></label>
      <div class="field"><span>Sesso biologico</span>${seg('sesso', [['F', 'Donna'], ['M', 'Uomo']], d.sesso)}</div>
      <div class="grid-3">
        ${num('eta', 'Età', d.eta, 'min="14" max="100"')}
        ${num('altezza', 'Altezza (cm)', d.altezza, 'min="120" max="230"')}
        ${num('peso', 'Peso (kg)', d.peso, 'min="30" max="300" step="0.1"')}
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
    title: 'La tua salute', sub: 'Seleziona tutto ciò che ti riguarda. Se non hai nulla, vai avanti.',
    render: (d) => `
      ${chips('condizioni', CONDITIONS, d.condizioni)}
      <label class="field"><span>Farmaci, infortuni o altro da sapere (facoltativo)</span><textarea name="note" placeholder="Es. operato al menisco destro nel 2022">${esc(d.note)}</textarea><small>Resta sul tuo telefono. Ricordati di parlarne con il medico.</small></label>`,
    validate: () => null,
  },
  {
    title: 'Le tue abitudini', sub: 'Come vivi oggi, senza giudizi.',
    render: (d) => `
      <div class="field"><span>Il tuo lavoro</span>${seg('lavoro', [['sedentario', 'Seduto'], ['in_piedi', 'In piedi'], ['fisico', 'Fisico/pesante']], d.lavoro)}</div>
      <div class="field"><span>Passi al giorno (circa)</span>${seg('passi', [['<3000', '< 3.000'], ['3000-5000', '3–5 mila'], ['5000-7500', '5–7,5 mila'], ['7500-10000', '7,5–10 mila'], ['>10000', '> 10.000']], d.passi)}</div>
      <div class="field"><span>Ore di sonno per notte</span>${seg('sonno', [[5, '≤ 5'], [6, '6'], [7, '7'], [8, '8'], [9, '9+']], d.sonno)}</div>
      <div class="field"><span>Esperienza di allenamento</span>${seg('esperienza', [['principiante', 'Principiante'], ['intermedio', 'Intermedio'], ['avanzato', 'Avanzato']], d.esperienza)}<small>Principiante: mai allenato o fermo da più di 6 mesi.</small></div>
      <div class="field"><span>Alimentazione</span>${seg('alimentazione', [['disordinata', 'Disordinata'], ['media', 'Nella media'], ['curata', 'Curata']], d.alimentazione)}</div>
      <div class="grid-2">
        <div class="field"><span>Fumi?</span>${seg('fumo', [['no', 'No'], ['si', 'Sì']], d.fumo)}</div>
        <div class="field"><span>Alcol</span>${seg('alcol', [['mai', 'Mai'], ['occasionale', 'A volte'], ['spesso', 'Spesso']], d.alcol)}</div>
      </div>
      <div class="field"><span>Livello di stress</span>${seg('stress', [['basso', 'Basso'], ['medio', 'Medio'], ['alto', 'Alto']], d.stress)}</div>`,
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
        ${num('pesoObiettivo', 'Peso obiettivo (kg)', d.pesoObiettivo, 'min="35" max="250" step="0.5" placeholder="facoltativo"')}
        <label class="field"><span>Entro quando?</span><input type="date" name="dataObiettivo" value="${esc(d.dataObiettivo)}" min="${toISO(addDays(new Date(), 14))}"></label>
      </div>
      <label class="field"><span>Un traguardo concreto (facoltativo)</span><input type="text" name="traguardo" value="${esc(d.traguardo)}" placeholder="Es. correre 10 km, fare 10 trazioni, giocare con i figli senza fiatone"></label>`,
    validate: (d) => (!d.obiettivo ? 'Scegli un obiettivo.' : d.pesoObiettivo && !(d.pesoObiettivo >= 35 && d.pesoObiettivo <= 250) ? 'Il peso obiettivo non sembra corretto.' : null),
  },
  {
    title: 'Il tuo tempo', sub: 'Meglio poco ma costante: scegli un impegno che riesci davvero a mantenere.',
    render: (d) => `
      <div class="card flat">
        <span class="eyebrow">Minuti al giorno</span>
        <div class="slider-out"><span id="min-out">${d.minuti}</span><small>min</small></div>
        <input type="range" name="minuti" min="10" max="120" step="5" value="${d.minuti}">
        <p class="small muted" id="min-hint">${minutesHint(d.minuti)}</p>
      </div>
      <div class="field"><span>Giorni a settimana</span>${seg('giorni', [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7']], d.giorni)}</div>
      <p class="small muted" id="week-total">Totale: ${d.minuti * d.giorni} minuti a settimana${d.minuti * d.giorni < 150 ? ' · le camminate completeranno il resto' : ''}.</p>
      <div class="field"><span>Cosa hai a disposizione?</span>${chips('attrezzi', EQUIPMENT, d.attrezzi)}<small>Il corpo libero è sempre incluso.</small></div>`,
    validate: (d) => (!d.giorni ? 'Scegli quanti giorni a settimana.' : null),
  },
];

function minutesHint(m) {
  if (m <= 15) return 'Allenamenti brevi in formato circuito: pochi minuti, ma intensi e regolari.';
  if (m <= 30) return 'Ottimo compromesso: abbastanza per vedere risultati concreti.';
  if (m <= 60) return 'Tempo pieno: riscaldamento, lavoro completo e defaticamento.';
  return 'Tanto tempo: sessioni complete con più volume. Ricordati di recuperare.';
}

function viewWizard() {
  const step = STEPS[wizardStep];
  const pct = Math.round(((wizardStep + 1) / STEPS.length) * 100);
  return `
  <div class="wizard-top">
    <button class="icon-btn" data-action="wiz-back" aria-label="Indietro">‹</button>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <span class="small muted">${wizardStep + 1}/${STEPS.length}</span>
  </div>
  <form id="wizard" class="stack-lg" onsubmit="return false">
    <div><h1>${step.title}</h1><p class="muted" style="margin-top:6px">${step.sub}</p></div>
    ${step.render(draft)}
    <p class="error" id="wiz-error" hidden></p>
    <div class="wizard-actions">
      <button type="button" class="btn primary" data-action="wiz-next">${wizardStep === STEPS.length - 1 ? 'Crea il mio piano' : 'Avanti'}</button>
    </div>
  </form>`;
}

function bindWizardInputs() {
  const form = document.getElementById('wizard');
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.name) return;
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
  if (el) el.textContent = `Totale: ${draft.minuti * (draft.giorni || 0)} minuti a settimana${draft.minuti * draft.giorni < 150 ? ' · le camminate completeranno il resto' : ''}.`;
}

function initDraft(edit) {
  draft = edit && state.profile ? structuredClone(state.profile) : {
    nome: '', condizioni: [], attrezzi: [], minuti: 30, giorni: 3, sonno: '', note: '', traguardo: '', pesoObiettivo: '', dataObiettivo: '',
  };
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
  p.pesoObiettivo = p.pesoObiettivo === '' ? null : p.pesoObiettivo;
  p.dataObiettivo = p.dataObiettivo || null;
  const old = state.profile;
  const goalChanged = !old || old.obiettivo !== p.obiettivo || old.pesoObiettivo !== p.pesoObiettivo || old.peso !== p.peso;
  state.profile = p;
  if (!wasEdit || goalChanged) {
    state.planStart = today();
    state.calorieAdjust = 0;
  }
  if (!state.weights.some((w) => w.date === today())) state.weights.push({ date: today(), kg: p.peso });
  else state.weights = state.weights.map((w) => (w.date === today() ? { ...w, kg: p.peso } : w));
  save();
  draft = null;
  location.hash = '#/piano';
  toast(wasEdit ? 'Piano aggiornato' : 'Il tuo piano è pronto!');
}

// ==================================================================
// Oggi
// ==================================================================

function sessionFor(plan, iso) {
  const lg = state.log[iso];
  const from = lg?.sessionFrom;
  const wd = from ?? weekdayIndex(fromISO(iso));
  return { session: plan.schedule[wd].session, moved: from !== undefined && from !== null };
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
  <header class="top">
    <div>
      <p class="eyebrow">${viewDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1>${isToday ? `Ciao${p.nome ? ' ' + esc(p.nome) : ''}` : WEEKDAYS_LONG[selectedDay]}</h1>
    </div>
    <span class="badge">Sett. ${week} · ${plan.phase.label}</span>
  </header>
  <nav class="weekstrip" aria-label="Settimana">${strip}</nav>
  <div class="stack">
    ${stops.length ? `<a href="#/piano" class="alert stop" style="text-decoration:none"><span>⚠️</span><span><b>Prima di iniziare:</b> ${esc(stops[0].text)}${stops.length > 1 ? ` (+${stops.length - 1})` : ''}</span></a>` : ''}
    ${session ? sessionCard(session, iso, lg, moved) : restCard(plan, iso, lg)}
    ${isToday ? habitsCard(plan, iso) : ''}
    ${isToday && needWeigh ? `
      <div class="card">
        <div class="row between"><h3>Pesata settimanale</h3><span class="small muted">${lastW ? 'ultima: ' + fmt(lastW.kg, 1) + ' kg' : ''}</span></div>
        <p class="small muted" style="margin-top:4px">Pesati al mattino, a digiuno, dopo il bagno. Serve per adattare il piano.</p>
        <form class="row" style="margin-top:12px" data-form="weight"><input type="number" name="kg" step="0.1" min="30" max="300" inputmode="decimal" placeholder="kg" required><button class="btn dark">Salva</button></form>
      </div>` : ''}
  </div>`;
}

function sessionCard(s, iso, lg, moved) {
  const isToday = iso === today();
  const future = fromISO(iso) > fromISO(today()) || fromISO(iso) < fromISO(state.planStart);
  const kind = TYPE_KIND[s.type];
  const kindLabel = { forza: 'Forza', cardio: 'Cardio', mobilita: 'Mobilità' }[kind];
  const doneItems = new Set(lg.items || []);
  let total = 0;
  const blocks = s.blocks.map((b, bi) => `
    <div class="block">
      <div class="block-head"><h3>${b.name}</h3><span class="small muted">${b.minutes} min</span></div>
      ${b.note ? `<p class="block-note">${esc(b.note)}</p>` : ''}
      ${b.items.map((it, ii) => {
        const key = `${bi}:${ii}`;
        total++;
        const on = doneItems.has(key);
        return `<div class="ex ${on ? 'done' : ''}">
          ${future ? '' : `<button class="check ${on ? 'on' : ''}" data-action="toggle-item" data-key="${key}" data-iso="${iso}" aria-label="Fatto">✓</button>`}
          <div class="ex-body">
            <div class="ex-name">${esc(it.name)}</div>
            <div class="ex-dose">${esc(it.dose)}</div>
            <p class="ex-how" ${openHow.has(key) ? '' : 'hidden'}>${esc(it.how)}</p>
          </div>
          <div class="ex-tools">
            ${it.how ? `<button class="icon-btn" data-action="toggle-how" data-key="${key}" aria-label="Come si fa">?</button>` : ''}
            ${it.rest && !future ? `<button class="icon-btn" data-action="timer" data-sec="${it.rest}" aria-label="Timer recupero">⏱</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');

  let footer = '';
  if (lg.done) {
    footer = `<div class="alert ok" style="margin-top:16px"><span>✓</span><span><b>Allenamento completato.</b> ${lg.feedback ? 'Sensazione: ' + { facile: 'facile', giusto: 'giusto', duro: 'duro' }[lg.feedback] + '.' : ''}</span></div>
      <button class="link small" style="margin-top:10px" data-action="undo-done" data-iso="${iso}">Annulla</button>`;
  } else if (!future) {
    footer = showFeedback
      ? `<p style="margin-top:18px;font-weight:650">Com’è andata?</p>
         <div class="feedback" style="margin-top:8px">
           <button data-action="done" data-iso="${iso}" data-fb="facile"><span>😌</span>Facile</button>
           <button data-action="done" data-iso="${iso}" data-fb="giusto"><span>💪</span>Giusto</button>
           <button data-action="done" data-iso="${iso}" data-fb="duro"><span>🥵</span>Duro</button>
         </div>`
      : `<button class="btn primary wide" style="margin-top:18px" data-action="ask-feedback">${isToday ? 'Ho finito l’allenamento' : 'Segna come fatto'}</button>`;
  }

  return `
  <article class="card">
    <div class="session-head">
      <div>
        <span class="badge ${kind}">${kindLabel} · ${s.minutes} min</span>
        <h2 style="margin-top:10px">${esc(s.title)}</h2>
        ${moved ? '<p class="small muted" style="margin-top:4px">Allenamento spostato a oggi</p>' : ''}
      </div>
      ${!future && !lg.done ? `<span class="small muted" style="white-space:nowrap">${doneItems.size}/${total}</span>` : ''}
    </div>
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
  <article class="card">
    <span class="badge">Recupero attivo</span>
    <h2 style="margin-top:10px">Giorno di riposo</h2>
    <p class="muted" style="margin-top:6px">Il recupero fa parte dell’allenamento: è qui che il corpo si rinforza. Muoviti comunque in modo leggero.</p>
    <div class="block">
      <div class="block-head"><h3>Oggi</h3></div>
      <div class="ex"><div class="ex-body"><div class="ex-name">Camminata all’aperto</div><div class="ex-dose">20–30 min · obiettivo ${steps ? steps.target.toLocaleString('it-IT') : '8.000'} passi</div></div></div>
      ${items.map((it) => `<div class="ex"><div class="ex-body"><div class="ex-name">${esc(it.name)}</div><div class="ex-dose">${esc(it.dose)} · facoltativo</div></div></div>`).join('')}
    </div>
    ${canMove && missed.length && !lg.done ? `
      <div class="block">
        <div class="block-head"><h3>${isStart ? 'Vuoi iniziare subito?' : 'Hai saltato un allenamento?'}</h3></div>
        <p class="small muted">${isStart ? 'Puoi fare oggi il primo allenamento:' : 'Puoi recuperarlo oggi:'}</p>
        <div class="chips" style="margin-top:8px">${missed.map((m) => `<button data-action="move-session" data-from="${m.weekday}" data-iso="${iso}">${m.label}: ${esc(m.session.title)}</button>`).join('')}</div>
      </div>` : ''}
  </article>`;
}

function habitsCard(plan, iso) {
  const lg = state.log[iso] || { habits: {} };
  const h = lg.habits || {};
  const steps = plan.habits.find((x) => x.key === 'passi');
  const list = [
    ['passi', '👟', `${steps.target.toLocaleString('it-IT')} passi`],
    ['acqua', '💧', `${fmt(plan.nutrition.water, 1)} litri d’acqua`],
    ['proteine', '🍳', `${plan.nutrition.protein} g di proteine`],
    ['sonno', '😴', 'Almeno 7 ore di sonno'],
  ];
  return `
  <div class="card">
    <h3>Abitudini di oggi</h3>
    <div style="margin-top:6px">
      ${list.map(([k, ic, l]) => `<div class="habit"><button class="check ${h[k] ? 'on' : ''}" data-action="habit" data-key="${k}" aria-label="${l}">✓</button><span class="grow">${l}</span><span>${ic}</span></div>`).join('')}
    </div>
  </div>`;
}

// ==================================================================
// Piano
// ==================================================================

const BLOCK_LABELS = { impatto: 'salti e corsa', supino: 'esercizi sdraiati sulla schiena', prono: 'esercizi a pancia in giù', valsalva: 'carichi massimali', testaGiu: 'posizioni a testa in giù', flessioneCarico: 'flessioni del busto sotto carico' };

function viewPlan() {
  const p = state.profile;
  const plan = getPlan();
  const goal = GOALS.find((g) => g.id === p.obiettivo);
  const t = plan.timeline;
  const n = plan.nutrition;
  const weekly = plan.schedule.filter((d) => d.session).length * p.minuti;

  const timelineHtml = t.hasWeight ? `
      <p class="eyebrow" style="margin-top:18px">Traguardo stimato</p>
      <div class="big-num" style="margin-top:4px">${fmt(n.target, 1)}<small>kg</small></div>
      <p style="margin-top:6px">intorno al <b>${formatDate(t.eta)}</b> · ${t.weeks} settimane a ${fmt(t.rate, 2)} kg/sett.</p>
      <div class="milestones">${t.milestones.slice(0, 8).map((m) => `<div>sett. ${m.week}<b>${fmt(m.kg, 1)} kg</b></div>`).join('')}</div>`
    : '';

  const kcalNote = state.calorieAdjust ? `<p class="small muted" style="margin-top:6px">Include un aggiustamento di ${state.calorieAdjust > 0 ? '+' : ''}${state.calorieAdjust} kcal basato sui tuoi progressi. <button class="link" data-action="reset-kcal">Azzera</button></p>` : '';
  const modeLabel = { deficit: 'Deficit calorico moderato', surplus: 'Leggero surplus calorico', mantenimento: 'Calorie di mantenimento' }[n.mode];
  const macro = (label, g, kcalPer, color) => {
    const pct = Math.round((g * kcalPer / n.kcal) * 100);
    return `<div class="macro"><div class="macro-row"><span>${label}</span><span><b>${g} g</b> · ${pct}%</span></div><div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
  };

  return `
  <header class="top"><div><p class="eyebrow">Il tuo piano</p><h1>${goal.icon} ${goal.label}</h1></div></header>
  <div class="stack">
    <section class="card accent">
      <p class="eyebrow">Ogni settimana</p>
      <div class="big-num" style="margin-top:4px">${p.giorni}<small>allenamenti</small> ${p.minuti}<small>min</small></div>
      <p style="margin-top:8px">${weekly} minuti di allenamento a settimana${p.traguardo ? ` · verso: <b>${esc(p.traguardo)}</b>` : ''}</p>
      ${timelineHtml}
      <p class="small" style="margin-top:14px;opacity:.9">${esc(t.message)}</p>
    </section>
    ${t.warning ? `<div class="alert attenzione"><span>⏳</span><span>${esc(t.warning)}</span></div>` : ''}
    ${plan.alerts.map((a) => `<div class="alert ${a.level}"><span>${a.level === 'stop' ? '⚠️' : 'ℹ️'}</span><span>${esc(a.text)}</span></div>`).join('')}
  </div>

  <div class="section-title"><h2>La settimana</h2><span class="badge">${plan.phase.label}</span></div>
  <p class="small muted" style="margin:0 2px 12px">${esc(plan.phase.note)}</p>
  ${plan.schedule.map((d) => d.session ? `
    <details class="day">
      <summary><span class="day-label">${d.label}</span><span class="grow"><b>${esc(d.session.title)}</b><br><span class="small muted">${d.session.minutes} min · ${d.session.blocks.map((b) => b.name.toLowerCase()).join(', ')}</span></span></summary>
      <div class="day-body">${d.session.blocks.map((b) => `
        <div class="block"><div class="block-head"><h3>${b.name}</h3><span class="small muted">${b.minutes} min</span></div>
        ${b.note ? `<p class="block-note">${esc(b.note)}</p>` : ''}
        ${b.items.map((it) => `<div class="ex"><div class="ex-body"><div class="ex-name">${esc(it.name)}</div><div class="ex-dose">${esc(it.dose)}</div><p class="ex-how">${esc(it.how)}</p></div></div>`).join('')}</div>`).join('')}
      </div>
    </details>` : `<div class="day-rest"><span class="day-label">${d.label}</span><span>Riposo attivo · camminata</span></div>`).join('')}

  <div class="section-title"><h2>Alimentazione</h2></div>
  <section class="card">
    <p class="eyebrow">${modeLabel}</p>
    <div class="big-num" style="margin-top:4px">${n.kcal.toLocaleString('it-IT')}<small>kcal al giorno</small></div>
    ${kcalNote}
    ${macro('Proteine', n.protein, 4, 'var(--accent)')}
    ${macro('Carboidrati', n.carbs, 4, '#E9A23B')}
    ${macro('Grassi', n.fat, 9, 'var(--ok)')}
    <div style="margin-top:16px">
      <div class="list-row"><span>Metabolismo basale</span><span>${n.bmr.toLocaleString('it-IT')} kcal</span></div>
      <div class="list-row"><span>Consumo totale stimato</span><span>${n.tdee.toLocaleString('it-IT')} kcal</span></div>
      <div class="list-row"><span>Acqua</span><span>${fmt(n.water, 1)} L (+0,5 L nei giorni di allenamento)</span></div>
      <div class="list-row"><span>Fibre</span><span>almeno ${n.fiber} g</span></div>
    </div>
    ${n.notes.map((x) => `<div class="alert info" style="margin-top:10px"><span>💡</span><span>${esc(x)}</span></div>`).join('')}
    <p class="small muted" style="margin-top:12px">Sono stime di partenza: l’app le corregge in base a come cambia il tuo peso nelle settimane.</p>
  </section>

  <div class="section-title"><h2>Abitudini</h2></div>
  <section class="card">
    ${plan.habits.map((h) => `<div class="tip"><span class="ti">${h.icon}</span><div><b>${esc(h.title)}</b><p class="small muted" style="margin-top:2px">${esc(h.text)}</p></div></div>`).join('')}
  </section>

  <div class="section-title"><h2>Come è stato costruito</h2></div>
  <section class="card">
    <div class="list-row"><span>BMI</span><span>${fmt(plan.derived.bmi, 1)} · ${bmiLabel(plan.derived.bmi)}</span></div>
    <div class="list-row"><span>Livello degli esercizi</span><span>${['', 'Base', 'Intermedio', 'Avanzato'][plan.derived.level]}</span></div>
    <div class="list-row"><span>Frequenza cardiaca max stimata</span><span>${plan.derived.hrMax} bpm</span></div>
    <div class="list-row"><span>Intervalli ad alta intensità</span><span>${plan.derived.hiitOk ? 'Sì' : 'No, solo intensità moderate'}</span></div>
    ${plan.derived.blocked.length ? `<div class="list-row"><span>Esclusi per te</span><span>${plan.derived.blocked.map((b) => BLOCK_LABELS[b]).join(', ')}</span></div>` : ''}
    ${p.condizioni?.length ? `<div class="list-row"><span>Condizioni considerate</span><span>${p.condizioni.map((c) => CONDITIONS.find((x) => x.id === c)?.label).join(', ')}</span></div>` : ''}
  </section>
  <p class="disclaimer">Ritmo fornisce indicazioni generali e non sostituisce il parere di medici, fisioterapisti o nutrizionisti.<br>Se senti dolore, fermati.</p>`;
}

function bmiLabel(b) {
  if (b < 18.5) return 'sottopeso';
  if (b < 25) return 'normopeso';
  if (b < 30) return 'sovrappeso';
  return 'obesità';
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

  const extra = [];
  if (last && Math.abs(last.kg - p.peso) >= 2 && daysBetween(fromISO(state.planStart), new Date()) >= 14) {
    extra.push({ text: `Il tuo peso è cambiato di ${fmt(Math.abs(diff), 1)} kg dall’inizio del piano. Ricalcola calorie e tempi sul peso attuale.`, action: { type: 'repeso', label: 'Ricalcola dal peso attuale' } });
  }
  const sugg = [...an.suggestions, ...extra];

  return `
  <header class="top"><div><p class="eyebrow">Dal ${formatDate(state.planStart)}</p><h1>Progressi</h1></div></header>
  <div class="stats">
    <div class="stat"><b>${totalDone}</b><span>allenamenti</span></div>
    <div class="stat"><b>${an.streak}</b><span>di fila</span></div>
    <div class="stat"><b>${an.adherence ?? '–'}${an.adherence !== null ? '%' : ''}</b><span>costanza</span></div>
  </div>

  ${sugg.length ? `<div class="section-title"><h2>Suggerimenti</h2></div><div class="stack">${sugg.map((s, i) => `
    <div class="alert ${s.ok ? 'ok' : 'info'}" style="flex-direction:column;gap:10px">
      <span>${esc(s.text)}</span>
      ${s.action ? `<button class="btn dark small" style="align-self:flex-start" data-action="apply" data-i="${i}">${esc(s.action.label)}</button>` : ''}
    </div>`).join('')}</div>` : ''}

  <div class="section-title"><h2>Peso</h2>${last ? `<span class="small muted">${fmt(last.kg, 1)} kg · ${diff > 0 ? '+' : ''}${fmt(diff, 1)} kg</span>` : ''}</div>
  <section class="card">
    ${weightChart(weights, plan)}
    <form class="row" style="margin-top:14px" data-form="weight">
      <input type="number" name="kg" step="0.1" min="30" max="300" inputmode="decimal" placeholder="Peso di oggi (kg)" required>
      <button class="btn dark">Aggiungi</button>
    </form>
  </section>

  <div class="section-title"><h2>Storico</h2></div>
  <section class="card">${historyList(plan)}</section>`;
}

function weightChart(weights, plan) {
  if (weights.length < 1) return '<p class="muted">Nessuna pesata ancora.</p>';
  const p = state.profile;
  const n = plan.nutrition;
  const W = 320, H = 170, L = 34, R = 10, T = 12, B = 24;
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
  const x = (iso) => L + (daysBetween(first, fromISO(iso)) / span) * (W - L - R);
  const y = (kg) => T + ((hi - kg) / (hi - lo)) * (H - T - B);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const path = weights.map((w, i) => `${i ? 'L' : 'M'}${x(w.date).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ');
  const pPath = proj.map((q, i) => `${i ? 'L' : 'M'}${x(q.d).toFixed(1)},${y(q.kg).toFixed(1)}`).join(' ');
  const months = [];
  for (let i = 0; i <= span; i++) { const dd = addDays(first, i); if (dd.getDate() === 1 || i === 0) months.push(dd); }
  return `
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento del peso">
    ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${t}</text>`).join('')}
    ${months.filter((m, i) => i === 0 || m.getDate() === 1).slice(0, 8).map((m) => `<text class="axis" x="${x(toISO(m))}" y="${H - 6}" text-anchor="${x(toISO(m)) < L + 10 ? 'start' : 'middle'}">${m.toLocaleDateString('it-IT', { day: m.getDate() === 1 ? undefined : 'numeric', month: 'short' })}</text>`).join('')}
    ${n.target && n.rate ? `<line class="target" x1="${L}" x2="${W - R}" y1="${y(n.target)}" y2="${y(n.target)}"/>` : ''}
    ${pPath ? `<path class="proj" d="${pPath}"/>` : ''}
    <path class="line" d="${path}"/>
    ${weights.map((w) => `<circle class="dot" cx="${x(w.date)}" cy="${y(w.kg)}" r="3.5"><title>${formatDate(w.date)}: ${fmt(w.kg, 1)} kg</title></circle>`).join('')}
  </svg>
  <div class="legend"><span><i style="background:var(--accent)"></i>Il tuo peso</span>${pPath ? '<span><i style="background:var(--ink-2)"></i>Previsto</span>' : ''}${n.target && n.rate ? '<span><i style="background:var(--ok)"></i>Obiettivo</span>' : ''}</div>`;
}

function historyList(plan) {
  const done = Object.entries(state.log).filter(([, l]) => l.done).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  if (!done.length) return '<p class="muted">Ancora nessun allenamento completato. Il primo è il più importante!</p>';
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
  <header class="top"><div><p class="eyebrow">Impostazioni</p><h1>Profilo</h1></div></header>
  <section class="card">${rows.map(([k, v]) => `<div class="list-row"><span>${k}</span><span>${v}</span></div>`).join('')}
    <button class="btn primary wide" style="margin-top:14px" data-action="edit-profile">Modifica profilo e obiettivi</button>
  </section>

  ${!standalone ? `
  <div class="section-title"><h2>Installa l’app</h2></div>
  <section class="card">
    ${installEvt ? '<p class="muted small">Aggiungi Ritmo alla schermata Home: funziona anche offline.</p><button class="btn dark wide" style="margin-top:12px" data-action="install">Installa</button>'
      : isIOS ? '<p class="muted small">Su iPhone: tocca <b>Condividi</b> ⬆︎ in Safari e poi <b>Aggiungi alla schermata Home</b>.</p>'
      : '<p class="muted small">Dal menu del browser scegli <b>Installa app</b> o <b>Aggiungi a schermata Home</b>.</p>'}
  </section>` : ''}

  <div class="section-title"><h2>I tuoi dati</h2></div>
  <section class="card stack">
    <p class="small muted">Tutto è salvato solo su questo dispositivo. Esporta un backup per non perderlo o per spostarlo su un altro telefono.</p>
    <div class="grid-2">
      <button class="btn ghost" data-action="export">Esporta backup</button>
      <label class="btn ghost" style="cursor:pointer">Importa<input type="file" accept="application/json" data-action="import" hidden></label>
    </div>
    <button class="btn line wide" data-action="restart-plan">Ricomincia il piano da oggi</button>
    <button class="btn danger wide" data-action="reset">Cancella tutti i dati</button>
  </section>

  <div class="section-title"><h2>Come funziona</h2></div>
  <section class="card small">
    <div class="tip"><span class="ti">🔢</span><p><b>Calorie</b>: metabolismo basale con la formula di Mifflin-St Jeor, moltiplicato per il tuo livello di attività (lavoro, passi, allenamenti). Deficit massimo ~0,5–0,75% del peso a settimana, mai sotto il metabolismo basale.</p></div>
    <div class="tip"><span class="ti">🏋️</span><p><b>Allenamenti</b>: schemi motori fondamentali (spinta, tirata, squat, anca, core) scelti tra gli esercizi compatibili con attrezzi, livello e condizioni di salute. Progressione a cicli di 4 settimane con una settimana di scarico.</p></div>
    <div class="tip"><span class="ti">❤️</span><p><b>Cardio</b>: zone di frequenza cardiaca dalla formula di Tanaka (208 − 0,7 × età). Le intensità alte sono escluse in caso di problemi cardiaci, pressione alta o gravidanza.</p></div>
    <div class="tip"><span class="ti">🔁</span><p><b>Adattamento</b>: con le pesate settimanali e le tue sensazioni dopo ogni allenamento, l’app ti propone di correggere calorie, giorni o livello.</p></div>
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

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action], .seg button, .chips[data-multi] button, .goal-grid button');
  if (!t) return;

  // controlli del wizard
  const segEl = t.parentElement?.closest('.seg[data-name], .goal-grid[data-name]');
  if (segEl && draft && !t.dataset.action) {
    const name = segEl.dataset.name;
    const raw = t.dataset.value;
    draft[name] = ['sonno', 'giorni'].includes(name) ? Number(raw) : raw;
    segEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t));
    if (name === 'giorni') updateWeekTotal();
    return;
  }
  const multi = t.parentElement?.closest('.chips[data-multi]');
  if (multi && draft && !t.dataset.action) {
    const name = multi.dataset.multi;
    const set = new Set(draft[name] || []);
    set.has(t.dataset.value) ? set.delete(t.dataset.value) : set.add(t.dataset.value);
    draft[name] = [...set];
    t.classList.toggle('on');
    return;
  }

  const a = t.dataset.action;
  switch (a) {
    case 'start-setup': startWizard(false); break;
    case 'edit-profile': startWizard(true); break;
    case 'wiz-back':
      if (wizardStep > 0) { wizardStep--; route(); window.scrollTo(0, 0); }
      else location.hash = state.profile ? '#/profilo' : '#/benvenuto';
      break;
    case 'wiz-next': {
      const err = STEPS[wizardStep].validate(draft);
      const box = document.getElementById('wiz-error');
      if (err) { box.textContent = err; box.hidden = false; return; }
      if (wizardStep < STEPS.length - 1) { wizardStep++; route(); window.scrollTo(0, 0); }
      else finishWizard();
      break;
    }
    case 'pick-day': selectedDay = Number(t.dataset.day); showFeedback = false; openHow.clear(); rerender(); break;
    case 'toggle-how': {
      const k = t.dataset.key;
      openHow.has(k) ? openHow.delete(k) : openHow.add(k);
      const how = t.closest('.ex').querySelector('.ex-how');
      if (how) how.hidden = !openHow.has(k);
      break;
    }
    case 'toggle-item': {
      const lg = dayLog(t.dataset.iso);
      const set = new Set(lg.items);
      set.has(t.dataset.key) ? set.delete(t.dataset.key) : set.add(t.dataset.key);
      lg.items = [...set];
      save(); rerender();
      break;
    }
    case 'ask-feedback': showFeedback = true; rerender(); break;
    case 'done': {
      const lg = dayLog(t.dataset.iso);
      lg.done = true; lg.feedback = t.dataset.fb; lg.doneAt = new Date().toISOString();
      showFeedback = false;
      save(); rerender();
      toast(['Grande! 🎉', 'Un passo in più verso l’obiettivo 💪', 'Fatto! La costanza paga 🔥'][Math.floor(Math.random() * 3)]);
      break;
    }
    case 'undo-done': { const lg = dayLog(t.dataset.iso); lg.done = false; delete lg.feedback; save(); rerender(); break; }
    case 'move-session': { const lg = dayLog(t.dataset.iso); lg.sessionFrom = Number(t.dataset.from); save(); rerender(); break; }
    case 'habit': {
      const lg = dayLog(today());
      lg.habits = lg.habits || {};
      lg.habits[t.dataset.key] = !lg.habits[t.dataset.key];
      save(); rerender();
      break;
    }
    case 'timer': startTimer(Number(t.dataset.sec)); break;
    case 'timer-add': timerLeft = Math.max(5, timerLeft + Number(t.dataset.sec)); paintTimer(); break;
    case 'timer-stop': stopTimer(); break;
    case 'reset-kcal': state.calorieAdjust = 0; save(); rerender(); break;
    case 'apply': {
      const plan = getPlan();
      const an = analyzeProgress(state, plan);
      const list = [...an.suggestions];
      const weights = [...state.weights].sort((x, y) => x.date.localeCompare(y.date));
      const last = weights[weights.length - 1];
      if (last && Math.abs(last.kg - state.profile.peso) >= 2 && daysBetween(fromISO(state.planStart), new Date()) >= 14) list.push({ action: { type: 'repeso' } });
      const s = list[Number(t.dataset.i)];
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
// Timer di recupero
// ==================================================================

let timerLeft = 0;
let timerId = null;
const $timer = document.getElementById('timer');

function paintTimer() { document.getElementById('timer-num').textContent = timerLeft; }
function startTimer(sec) {
  timerLeft = sec;
  paintTimer();
  $timer.hidden = false;
  clearInterval(timerId);
  timerId = setInterval(() => {
    timerLeft--;
    paintTimer();
    if (timerLeft <= 0) { beep(); navigator.vibrate?.([200, 100, 200]); stopTimer(); toast('Recupero finito: via con la serie!'); }
  }, 1000);
}
function stopTimer() { clearInterval(timerId); $timer.hidden = true; }
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start(); o.stop(ctx.currentTime + 0.6);
  } catch { /* audio non disponibile */ }
}

// ==================================================================
// Toast, avvio, service worker
// ==================================================================

let toastId = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastId);
  toastId = setTimeout(() => { el.hidden = true; }, 2600);
}

route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
