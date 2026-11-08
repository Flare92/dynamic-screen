import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan } from '../js/engine.js';
import { buildSteps, parseDose } from '../js/player.js';

const base = {
  sesso: 'F', eta: 40, altezza: 165, peso: 70, condizioni: [], lavoro: 'sedentario', passi: '5000-7500', sonno: 7,
  esperienza: 'intermedio', fumo: 'no', alcol: 'mai', alimentazione: 'media', stress: 'medio',
  obiettivo: 'tonificare', pesoObiettivo: null, minuti: 45, giorni: 4, attrezzi: ['manubri'],
};

test('interpreta i dosaggi', () => {
  const blk = { items: [{}, {}], minutes: 10 };
  assert.deepEqual(parseDose({ dose: '3 × 10–12 · recupero 60 s' }, blk), { sets: 3, reps: '10–12' });
  assert.deepEqual(parseDose({ dose: '2 × 30 s · recupero 60 s' }, blk), { sets: 2, secs: 30 });
  assert.deepEqual(parseDose({ dose: '45 s' }, blk), { sets: 1, secs: 45 });
  assert.deepEqual(parseDose({ dose: '2 min' }, blk), { sets: 1, secs: 120 });
  assert.deepEqual(parseDose({ dose: '28 min continui' }, { items: [{}], minutes: 28 }), { sets: 1, secs: 1680 });
});

test('ogni sessione genera una sequenza guidata completa', () => {
  for (const obiettivo of ['dimagrire', 'massa', 'tonificare', 'resistenza', 'mobilita', 'salute']) {
    for (const minuti of [10, 30, 60]) {
      const plan = generatePlan({ ...base, obiettivo, minuti, giorni: 5 }, { startISO: '2026-11-09' });
      for (const d of plan.schedule.filter((x) => x.session)) {
        const steps = buildSteps(d.session);
        const keys = new Set(steps.filter((s) => s.type === 'work').map((s) => s.key));
        const total = d.session.blocks.reduce((a, b) => a + b.items.length, 0);
        assert.equal(keys.size, total, `${obiettivo} ${minuti}: ${d.session.title}`);
        assert.equal(steps[steps.length - 1].type, 'work');
        assert.ok(steps.filter((s) => s.type === 'work' && s.last).length === total, 'ogni esercizio ha un’ultima serie');
      }
    }
  }
});
