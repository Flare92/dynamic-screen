import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan, nutrition, analyzeProgress, derive, toISO, addDays, fromISO } from '../js/engine.js';
import { BY_ID } from '../js/exercises.js';

const base = {
  nome: 'Test', sesso: 'M', eta: 35, altezza: 178, peso: 90,
  condizioni: [], lavoro: 'sedentario', passi: '3000-5000', sonno: 7,
  esperienza: 'principiante', fumo: 'no', alcol: 'occasionale', alimentazione: 'media', stress: 'medio',
  obiettivo: 'dimagrire', pesoObiettivo: 80, dataObiettivo: null, minuti: 40, giorni: 4, attrezzi: [],
};
const START = '2026-11-09';

const allItems = (plan) => plan.schedule.flatMap((d) => (d.session ? d.session.blocks.flatMap((b) => b.items) : []));

test('il numero di giorni di allenamento corrisponde a quello scelto', () => {
  for (const obiettivo of ['dimagrire', 'massa', 'tonificare', 'resistenza', 'mobilita', 'salute']) {
    for (let giorni = 2; giorni <= 7; giorni++) {
      for (const minuti of [10, 15, 30, 60, 120]) {
        const plan = generatePlan({ ...base, obiettivo, giorni, minuti }, { startISO: START });
        assert.equal(plan.schedule.filter((d) => d.session).length, giorni, `${obiettivo} ${giorni}gg ${minuti}min`);
        for (const d of plan.schedule.filter((x) => x.session)) {
          const sum = d.session.blocks.reduce((a, b) => a + b.minutes, 0);
          assert.equal(sum, minuti, `durata ${obiettivo} ${giorni}gg ${minuti}min: ${d.session.title}`);
          assert.ok(d.session.blocks.every((b) => b.items.length > 0), `blocco vuoto in ${d.session.title}`);
        }
      }
    }
  }
});

test('ginocchia: nessun esercizio controindicato o ad alto impatto', () => {
  const plan = generatePlan({ ...base, condizioni: ['ginocchia'], attrezzi: ['palestra', 'corda'], esperienza: 'avanzato', obiettivo: 'resistenza' }, { startISO: START });
  for (const it of allItems(plan)) {
    const ex = BY_ID[it.id];
    assert.ok(!ex.contra.includes('ginocchia'), `${ex.n} non va bene per le ginocchia`);
    assert.ok(!ex.tags.includes('impatto'), `${ex.n} è ad alto impatto`);
  }
});

test('gravidanza: niente esercizi sdraiati, salti, HIIT né deficit calorico', () => {
  const p = { ...base, sesso: 'F', peso: 68, altezza: 165, condizioni: ['gravidanza'], obiettivo: 'dimagrire', pesoObiettivo: 60, giorni: 5 };
  const plan = generatePlan(p, { startISO: START });
  for (const it of allItems(plan)) {
    const ex = BY_ID[it.id];
    assert.ok(!ex.tags.some((t) => ['supino', 'prono', 'impatto', 'valsalva'].includes(t)), `${ex.n} non adatto in gravidanza`);
  }
  assert.equal(plan.nutrition.mode, 'mantenimento');
  assert.equal(plan.derived.hiitOk, false);
  assert.ok(plan.alerts.some((a) => a.level === 'stop'));
});

test('pressione alta: niente carichi massimali e niente testa in giù', () => {
  const plan = generatePlan({ ...base, condizioni: ['ipertensione'], attrezzi: ['palestra'], esperienza: 'avanzato', obiettivo: 'massa', peso: 75 }, { startISO: START });
  for (const it of allItems(plan)) {
    const ex = BY_ID[it.id];
    assert.ok(!ex.tags.includes('valsalva') && !ex.tags.includes('testaGiu'), ex.n);
  }
});

test('solo attrezzi disponibili', () => {
  const plan = generatePlan({ ...base, attrezzi: ['elastici'], esperienza: 'avanzato' }, { startISO: START });
  for (const it of allItems(plan)) {
    const ex = BY_ID[it.id];
    assert.ok(ex.eq.some((e) => ['corpo', 'elastici'].includes(e)), `${ex.n} richiede ${ex.eq}`);
  }
});

test('calorie: deficit sicuro e mai sotto il metabolismo basale', () => {
  const n = nutrition({ ...base, sesso: 'F', peso: 60, altezza: 160, eta: 50, pesoObiettivo: 50, passi: '<3000' });
  assert.equal(n.mode, 'deficit');
  assert.ok(n.kcal >= n.bmr, `kcal ${n.kcal} < bmr ${n.bmr}`);
  assert.ok(n.kcal >= 1200);
  const m = nutrition(base);
  assert.ok(m.rate <= 1 && m.rate >= 0.25);
  assert.ok(m.kcal < m.tdee);
});

test('peso obiettivo sotto BMI 18,5 viene corretto', () => {
  const n = nutrition({ ...base, peso: 60, altezza: 180, pesoObiettivo: 50 });
  assert.ok(n.target >= 18.5 * 1.8 * 1.8 - 0.5);
  assert.ok(n.notes.length > 0);
});

test('massa con BMI alto: prima ricomposizione', () => {
  const n = nutrition({ ...base, obiettivo: 'massa', peso: 95 });
  assert.equal(n.mode, 'mantenimento');
});

test('data obiettivo troppo vicina genera un avviso con data realistica', () => {
  const plan = generatePlan({ ...base, pesoObiettivo: 75, dataObiettivo: toISO(addDays(fromISO(START), 30)) }, { startISO: START });
  assert.equal(plan.timeline.feasible, false);
  assert.match(plan.timeline.warning, /troppo veloce/);
});

test('problemi cardiaci: livello base e niente intensità alte', () => {
  const d = derive({ ...base, condizioni: ['cuore'], esperienza: 'avanzato' });
  assert.equal(d.level, 1);
  const plan = generatePlan({ ...base, condizioni: ['cuore'], esperienza: 'avanzato', obiettivo: 'resistenza', giorni: 5 }, { startISO: START });
  assert.ok(!plan.schedule.some((x) => x.session?.title.startsWith('Intervalli ·')));
});

test('analisi progressi: dimagrimento troppo lento suggerisce meno calorie', () => {
  const state = { profile: base, planStart: START, calorieAdjust: 0, log: {}, weights: [] };
  for (let i = 0; i <= 21; i += 3) state.weights.push({ date: toISO(addDays(fromISO(START), i)), kg: 90 - i * 0.005 });
  const plan = generatePlan(base, { startISO: START });
  const an = analyzeProgress(state, plan, toISO(addDays(fromISO(START), 21)));
  assert.ok(an.suggestions.some((s) => s.action?.type === 'kcal' && s.action.value < 0));
});

test('analisi progressi: costanza bassa suggerisce meno giorni', () => {
  const state = { profile: { ...base, giorni: 5 }, planStart: START, calorieAdjust: 0, log: {}, weights: [] };
  const plan = generatePlan(state.profile, { startISO: START });
  const an = analyzeProgress(state, plan, toISO(addDays(fromISO(START), 15)));
  assert.ok(an.suggestions.some((s) => s.action?.type === 'giorni' && s.action.value === 4));
});
