import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProfile, bodyFat, scorePushup, scoreChair, scoreStep, precision, buildKpis, TESTS } from '../js/assessment.js';
import { generatePlan, alternativesFor } from '../js/engine.js';

const base = {
  nome: 'T', sesso: 'M', eta: 34, altezza: 180, peso: 88, condizioni: [], dolori: {},
  misure: { vita: 98, collo: 39, fc: 72 },
  lavoro: 'sedentario', passi: '3000-5000', sonno: 7, esperienza: 'principiante', fumo: 'no', alcol: 'mai',
  alimentazione: 'media', stress: 'medio', obiettivo: 'dimagrire', pesoObiettivo: 80, minuti: 45, giorni: 4, attrezzi: ['manubri'],
};
const START = '2026-11-09';
const items = (plan) => plan.schedule.flatMap((d) => (d.session ? d.session.blocks.flatMap((b) => b.items) : []));
const ids = (plan) => new Set(items(plan).map((i) => i.id));

test('massa grassa con la formula U.S. Navy', () => {
  const bf = bodyFat(base, base.misure);
  assert.ok(bf > 20 && bf < 28, `bf ${bf}`);
  const f = bodyFat({ ...base, sesso: 'F', altezza: 165 }, { vita: 80, collo: 33, fianchi: 100 });
  assert.ok(f > 25 && f < 38, `bf donna ${f}`);
  assert.equal(bodyFat(base, { vita: 90 }), null);
});

test('punteggi rispetto ai valori di riferimento per età e sesso', () => {
  assert.equal(scorePushup(40, 'classici', base), 5);
  assert.equal(scorePushup(5, 'classici', base), 1);
  assert.ok(scorePushup(30, 'muro', base) <= 2, 'al muro non oltre "basso"');
  assert.ok(scorePushup(20, 'ginocchia', { ...base, sesso: 'F' }) >= 3);
  assert.ok(scoreChair(14, { ...base, eta: 75 }) >= 3, 'normalizzato per età');
  assert.ok(scoreChair(14, base) <= 2);
  assert.equal(scoreStep(80, base), 5);
  assert.equal(scoreStep(140, base), 1);
});

test('profilo: aree, punti deboli e limiti di mobilità', () => {
  const cp = computeProfile(base, { results: { pushup: 8, pushupVar: 'classici', chair: 24, plank: 100, ankle: 5, toetouch: 2, balance: 50, cardioSelf: 3 } });
  assert.ok(cp.areas.forzaSup < cp.areas.forzaInf);
  assert.equal(cp.flags.anklesStiff, true);
  assert.equal(cp.flags.hamstringsTight, true);
  assert.ok(cp.weak.some((a) => a.id === 'forzaSup'));
  assert.ok(cp.body.leanMass > 60);
});

test('precisione: cresce con misure e test', () => {
  const p0 = precision({ ...base, misure: {}, dolori: undefined }, {}).pct;
  const p1 = precision(base, {}).pct;
  const all = Object.fromEntries(TESTS.map((t) => [t.id, 3]));
  const p2 = precision(base, { results: all }, { feedbacks: 6, retests: 1 }).pct;
  assert.ok(p0 < 40, `senza dati ${p0}`);
  assert.ok(p1 > p0);
  assert.ok(p2 >= 95, `completa ${p2}`);
});

test('caviglie rigide: squat con talloni rialzati e mobilità della caviglia', () => {
  const plan = generatePlan(base, { startISO: START, assess: { results: { ankle: 4, chair: 20 } } });
  const s = ids(plan);
  assert.ok(s.has('s_squat_talloni'), 'squat con talloni rialzati');
  assert.ok(s.has('w_caviglie'), 'mobilità caviglia nel riscaldamento');
  assert.ok(!s.has('s_squat'));
  assert.ok(items(plan).some((i) => i.tag === 'Correttivo'));
});

test('dolore medio ai polsi: niente esercizi in appoggio sulle mani', () => {
  const plan = generatePlan({ ...base, dolori: { polsi: 2 } }, { startISO: START });
  for (const id of ['p_classici', 'p_rialzo', 'p_ginocchia', 'c_birddog', 'w_gatto']) assert.ok(!ids(plan).has(id), id);
  assert.ok(plan.alerts.some((a) => /polsi/.test(a.text)));
});

test('dolore forte: avviso di stop', () => {
  const plan = generatePlan({ ...base, dolori: { ginocchia: 3 } }, { startISO: START });
  assert.ok(plan.alerts.some((a) => a.level === 'stop' && /ginocchia/.test(a.text)));
});

test('dosi calcolate sui test', () => {
  const plan = generatePlan({ ...base, obiettivo: 'tonificare' }, { startISO: START, assess: { results: { pushup: 14, pushupVar: 'classici', plank: 60, plankVar: 'avambracci' } } });
  const push = items(plan).find((i) => i.id === 'p_classici');
  assert.ok(push, 'piegamenti classici nel piano');
  assert.match(push.dose, /7–10/);
  assert.ok(push.basis);
  const pk = items(plan).find((i) => i.id === 'c_plank');
  if (pk) assert.match(pk.dose, /35 s/);
});

test('zone cardio con la frequenza a riposo (Karvonen)', () => {
  const plan = generatePlan({ ...base, obiettivo: 'resistenza' }, { startISO: START });
  const cardio = items(plan).find((i) => /continui|bpm/.test(i.dose) && /bpm/.test(i.dose));
  assert.ok(cardio, 'zona in bpm');
  assert.ok(plan.personal.some((f) => /Karvonen/.test(f.text)));
});

test('feedback per esercizio: progressione e sostituzione', () => {
  const p = { ...base, obiettivo: 'tonificare', esperienza: 'intermedio' };
  const plan0 = generatePlan(p, { startISO: START });
  const first = items(plan0).find((i) => i.rest && i.id.startsWith('s_'));
  const harder = generatePlan(p, { startISO: START, exAdj: { [first.id]: 2 } });
  assert.ok(!ids(harder).has(first.id) || items(harder).find((i) => i.id === first.id).dose !== first.dose, 'cambia esercizio o dose');
  const alt = alternativesFor(first.id, p)[0];
  const swapped = generatePlan(p, { startISO: START, swaps: { [first.id]: alt.id } });
  assert.ok(ids(swapped).has(alt.id));
  const excluded = generatePlan(p, { startISO: START, excluded: [first.id] });
  assert.ok(!ids(excluded).has(first.id));
});

test('traguardi misurabili coerenti con l’obiettivo', () => {
  const entry = { results: { pushup: 10, pushupVar: 'classici', chair: 18, plank: 45 }, meas: base.misure };
  const plan = generatePlan(base, { startISO: START, assess: entry });
  const k = buildKpis(base, entry, plan.nutrition, plan.timeline);
  const byId = Object.fromEntries(k.map((x) => [x.id, x]));
  assert.equal(byId.peso.target, 80);
  assert.ok(byId.vita.target < 98);
  assert.ok(byId.grasso.target < byId.grasso.base);
  assert.ok(byId.pushup.target > 10);
  const r = buildKpis({ ...base, obiettivo: 'resistenza', pesoObiettivo: null }, { results: { step: 120, cardioSelf: 2 }, meas: base.misure }, plan.nutrition, {});
  assert.ok(r.some((x) => x.id === 'step' && x.target < 120));
});
